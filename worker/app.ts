import { z } from "zod";

import { MAX_RENEWAL_DAY, MIN_RENEWAL_DAY } from "../shared/cycle";
import { messages, pickLocale, type Locale } from "../shared/i18n";
import { bearerOf, clearedCookie, isSignedIn, issueSession, sameSecret, sessionCookie } from "./access";
import { directoryOf } from "./accounts";
import { authorize } from "./authorize";
import { AnalyticsError } from "./cloudflare";
import { setupOf, type Env, type Setup } from "./env";
import {
  html,
  isCrossSiteSubrequest,
  isForeignCall,
  isOpenAsset,
  isTopLevelVisit,
  json,
  keepFor,
  nextPath,
  overLimit,
  redirect,
  secured,
  signInAddress,
} from "./http";
import { setupPage, signInPage, type KeyError } from "./pages";
import { reportsFor } from "./report";
import { pageText } from "./text";
import { MIN_REFRESH_INTERVAL_MS, readState, readerFor, refreshAccount, type Reader } from "./usage";

/**
 * Everything but the MCP endpoint and the OAuth plumbing in front of it: the
 * page and its API, the JSON report, signing in and out, and the page that lets
 * an agent connect.
 */

type Ready = Extract<Setup, { ready: true }>;

const refreshBody = z.object({ accountId: z.string() });
const settingsBody = z.object({
  accountId: z.string(),
  renewalDay: z.number().int().min(MIN_RENEWAL_DAY).max(MAX_RENEWAL_DAY),
});

function localeOf(request: Request, url: URL): Locale {
  return pickLocale(url.searchParams.get("lang") ?? request.headers.get("accept-language"));
}

function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

/** A form this small has no business being larger. */
const MAX_FORM_BYTES = 8_192;

async function signIn(request: Request, url: URL, env: Env, setup: Ready): Promise<Response> {
  const text = pageText(localeOf(request, url));

  if (request.method === "GET") {
    const next = nextPath(url.searchParams.get("next"));
    if (await isSignedIn(request, setup.accessKey, Date.now())) return redirect(next);
    const flagged = url.searchParams.get("error");
    const error: KeyError | null = flagged === "wrong" || flagged === "too-many" ? flagged : null;
    return html(signInPage(text, next, error), error ? 401 : 200);
  }

  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  if (isForeignCall(request, url)) return json({ error: "origin-not-allowed" }, 403);
  // Counted before the form is read, so a flood costs as little as possible.
  if (await overLimit(env.SIGNIN_LIMIT, request)) return redirect(signInAddress(url, "too-many"), 303);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FORM_BYTES) {
    return json({ error: "invalid-request" }, 413);
  }

  const form = await request.formData();
  const next = nextPath(String(form.get("next") ?? ""));
  const back = new URL(url);
  back.searchParams.set("next", next);

  if (!(await sameSecret(String(form.get("key") ?? ""), setup.accessKey))) {
    return redirect(signInAddress(back, "wrong"), 303);
  }

  const response = redirect(next, 303);
  response.headers.append(
    "set-cookie",
    sessionCookie(await issueSession(setup.accessKey, Date.now()), isSecure(url)),
  );
  return response;
}

function signOut(request: Request, url: URL): Response {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  if (isForeignCall(request, url)) return json({ error: "origin-not-allowed" }, 403);

  const response = redirect("/signin", 303);
  response.headers.append("set-cookie", clearedCookie(isSecure(url)));
  return response;
}

async function refresh(request: Request, reader: Reader): Promise<Response> {
  const body = refreshBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid-request" }, 400);

  // A press of the button is also when a new account or a renamed one should show up.
  const directory = await directoryOf(reader.store, reader.tokens, Date.now(), { fresh: true });
  const account = directory.accounts.find((entry) => entry.id === body.data.accountId);
  if (!account) return json({ error: "unknown-account" }, 404);

  const existing = await reader.store.snapshot(account.id);
  if (existing && Date.now() - Date.parse(existing.fetchedAt) < MIN_REFRESH_INTERVAL_MS) {
    return json({ snapshot: existing, names: await reader.store.names(account.id) });
  }

  try {
    const snapshot = await refreshAccount(reader, account, existing);
    return json({ snapshot, names: await reader.store.names(account.id) });
  } catch (error) {
    console.error("refresh failed", account.id, error);
    // Cloudflare's own words say what it objected to; anything else stays in the log.
    return json({ error: "analytics", message: error instanceof AnalyticsError ? error.message : undefined }, 502);
  }
}

async function saveSettings(request: Request, reader: Reader): Promise<Response> {
  const body = settingsBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid-request" }, 400);

  const directory = await directoryOf(reader.store, reader.tokens, Date.now());
  if (!directory.accounts.some((entry) => entry.id === body.data.accountId)) {
    return json({ error: "unknown-account" }, 404);
  }

  const { accountId, renewalDay } = body.data;
  await reader.store.saveAccountSettings(accountId, { renewalDay });
  return json({ accountId, renewalDay });
}

async function api(request: Request, url: URL, reader: Reader): Promise<Response> {
  if (isForeignCall(request, url)) return json({ error: "origin-not-allowed" }, 403);
  // A second check behind the origin one: a body whose type is JSON cannot be
  // sent from another origin without a preflight, and preflights are not answered.
  const isWrite = request.method !== "GET" && request.method !== "HEAD";
  if (isWrite && !request.headers.get("content-type")?.trimStart().toLowerCase().startsWith("application/json")) {
    return json({ error: "json-required" }, 415);
  }

  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/state":
      return json(await readState(reader, Date.now()));
    case "POST /api/refresh":
      return refresh(request, reader);
    case "PUT /api/settings":
      return saveSettings(request, reader);
    default:
      return json({ error: "not-found" }, 404);
  }
}

/** The envelope of /api/v1: `data` on success, an error code otherwise. Indented when a person is reading it. */
function answer(data: unknown, readable: boolean): Response {
  const body = { success: true, data, error: null };
  return new Response(JSON.stringify(body, null, readable ? 2 : undefined), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function refuse(error: string, status: number, headers?: Record<string, string>): Response {
  return Response.json({ success: false, data: null, error }, { status, headers });
}

/**
 * Who may read /api/v1: a script with the key, or the owner's own browser,
 * whether the page asked or the owner opened the address directly. A wrong key
 * is never rescued by a cookie. Someone who opens the address signed out is
 * sent to sign in, the same as on the page.
 */
async function readerOf(request: Request, url: URL, setup: Ready): Promise<"allowed" | "sign-in" | "refused"> {
  if (request.headers.has("authorization")) {
    const key = bearerOf(request.headers.get("authorization"));
    return key !== null && (await sameSecret(key, setup.accessKey)) ? "allowed" : "refused";
  }

  const visiting = isTopLevelVisit(request);
  if (isForeignCall(request, url) && !visiting) return "refused";
  if (await isSignedIn(request, setup.accessKey, Date.now())) return "allowed";
  return visiting ? "sign-in" : "refused";
}

/**
 * GET /api/v1/usage: every account's report as JSON.
 *   ?account=<name or id>  one account only
 *   ?fresh=1               read from Cloudflare first, unless that was done in the last minute
 *   ?lang=en|zh-TW         the language of the sentences; otherwise Accept-Language, then English
 */
async function report(request: Request, url: URL, env: Env, setup: Ready, reader: Reader): Promise<Response> {
  if (await overLimit(env.API_LIMIT, request)) return refuse("rate-limited", 429, { "retry-after": "60" });

  const allowed = await readerOf(request, url, setup);
  if (allowed === "sign-in") return redirect(signInAddress(url));
  if (allowed === "refused") return refuse("unauthenticated", 401, { "www-authenticate": "Bearer" });
  if (url.pathname !== "/api/v1/usage") return refuse("not-found", 404);
  if (request.method !== "GET") return refuse("method-not-allowed", 405, { allow: "GET" });

  const nowMs = Date.now();
  const reports = await reportsFor(reader, {
    account: url.searchParams.get("account"),
    fresh: url.searchParams.get("fresh") === "1",
    m: messages(localeOf(request, url)),
    nowMs,
  });
  if (reports === null) return refuse("unknown-account", 404);

  return answer({ generatedAt: new Date(nowMs).toISOString(), ...reports }, isTopLevelVisit(request));
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/");

  if (isCrossSiteSubrequest(request)) return secured(json({ error: "origin-not-allowed" }, 403));

  if (isOpenAsset(url.pathname)) {
    const asset = await env.ASSETS.fetch(request);
    return secured(asset, keepFor(url.pathname, asset.status));
  }

  const setup = setupOf(env);
  if (!setup.ready) {
    // Says which secrets are missing, never what any of them holds.
    return secured(
      isApi
        ? json({ success: false, data: null, error: "not-set-up" }, 503)
        : html(setupPage(pageText(localeOf(request, url)), setup), 503),
    );
  }

  if (url.pathname === "/signin") return secured(await signIn(request, url, env, setup));
  if (url.pathname === "/signout") return secured(signOut(request, url));
  if (url.pathname === "/authorize") {
    return authorize({ request, url, env, accessKey: setup.accessKey, text: pageText(localeOf(request, url)) });
  }

  const reader = readerFor(env.OAUTH_KV, setup.tokens);
  if (url.pathname.startsWith("/api/v1/")) return secured(await report(request, url, env, setup, reader));

  if (!(await isSignedIn(request, setup.accessKey, Date.now()))) {
    return secured(isApi ? json({ error: "unauthenticated" }, 401) : redirect(signInAddress(url)));
  }

  if (isApi) return secured(await api(request, url, reader));
  const asset = await env.ASSETS.fetch(request);
  return secured(asset, keepFor(url.pathname, asset.status));
}

export const app = {
  async fetch(request, env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error("unhandled", error);
      return secured(json({ error: "internal" }, 500));
    }
  },
} satisfies ExportedHandler<Env>;
