import { isSignedIn, issueSession, sessionCookie } from "./access";
import { accountsSeenBy } from "./accounts";
import {
  OAuthError,
  SCOPE_ANALYTICS,
  SCOPE_OFFLINE,
  SCOPE_SETTINGS,
  authorizationUrl,
  createPkce,
  decodeState,
  encodeState,
  exchangeCode,
  isReturnOrigin,
  randomNonce,
  revokeToken,
  type Tokens,
} from "./cloudflare-oauth";
import { newSessionKey, readerOver } from "./connection";
import type { Env, OAuthClient } from "./env";
import { canRead, homeAmong, isHome } from "./home";
import { html, isForeignCall, json, nextPath, overLimit, redirect, secured } from "./http";
import { cloudflareSignInPage, connectPage, connectProblemPage } from "./pages";
import type { Connection, Store } from "./store";
import type { PageText } from "./text";
import { refreshAll } from "./usage";

/**
 * Signing in with Cloudflare, for a deployment that has no API token.
 *
 * Cloudflare is asked up to three different things, each a consent of its own:
 *
 * - `find`: which accounts the person chose, and what they are called. That
 *   needs Account Settings Read, which also shows who the account's members
 *   are, so the answer is used once and the access given back.
 * - `grant`: reading the accounts' analytics from now on. This is the only
 *   thing the Worker keeps.
 * - `signin`: reading analytics once, to show that the person at the browser
 *   may see the account this Worker runs in. Given back at once.
 *
 * Connecting is `find` then `grant`, with a return to this Worker's own page in
 * between so the person sees the first done before being asked the second.
 * Coming back later is `signin`. In every step the person is let through on
 * what their own consent can read, never on what the browser says: the cookies
 * that carry an attempt from one step to the next are the visitor's to forge,
 * and forging them gains nothing.
 */

type Step = "find" | "grant" | "signin";

const SCOPES: Readonly<Record<Step, readonly string[]>> = {
  find: [SCOPE_ANALYTICS, SCOPE_SETTINGS],
  grant: [SCOPE_ANALYTICS, SCOPE_OFFLINE],
  signin: [SCOPE_ANALYTICS],
};

/** Cloudflare's own sign-in and consent pages, where the forms on these pages end up. */
const CLOUDFLARE = "https://dash.cloudflare.com";

const START_PATH = "/connect/start";
/** Where the relay page posts what Cloudflare gave it. */
const RETURN_PATH = "/connect/return";

/** Long enough to sign in to Cloudflare and read two consent pages. */
const ATTEMPT_TTL_MS = 10 * 60_000;
/** Both bounds keep the cookie that carries the list under what a browser accepts. */
const MAX_ACCOUNTS = 8;
const MAX_NAME_CHARS = 60;
const MAX_FORM_BYTES = 8_192;

/** One trip to Cloudflare and back: what it is for, and what proves the answer is ours. */
interface Attempt {
  step: Step;
  nonce: string;
  verifier: string;
  next: string;
  startedAt: number;
}

/** What `find` learned, carried to `grant`, which checks it again with its own access. */
interface Found {
  home: string;
  accounts: { id: string; name: string }[];
}

export interface ConnectVisit {
  request: Request;
  url: URL;
  env: Env;
  ctx: ExecutionContext;
  client: OAuthClient;
  store: Store;
  text: PageText;
}

/** Whether Cloudflare returns straight to this Worker (local development) rather than to the relay. */
function directCallbackPath(visit: Pick<ConnectVisit, "client" | "url">): string | null {
  const callback = new URL(visit.client.callbackUrl);
  return callback.origin === visit.url.origin ? callback.pathname : null;
}

export function isConnectPath(visit: Pick<ConnectVisit, "client" | "url">): boolean {
  const { pathname } = visit.url;
  return (
    pathname === "/signin" ||
    pathname === START_PATH ||
    pathname === RETURN_PATH ||
    pathname === directCallbackPath(visit)
  );
}

/*
 * Cookies. `__Host-` ties them to this exact host over https. The relay hands
 * the answer back with a form posted from its own site, and only a
 * `SameSite=None` cookie travels with that.
 */

function cookieName(base: string, secure: boolean): string {
  return secure ? `__Host-usage-${base}` : `usage-${base}`;
}

function encode(value: unknown): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(text: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
  } catch {
    return null;
  }
}

function setCookie(base: string, value: unknown | null, secure: boolean): string {
  const attributes = [
    `${cookieName(base, secure)}=${value === null ? "" : encode(value)}`,
    "Path=/",
    "HttpOnly",
    secure ? "SameSite=None" : "SameSite=Lax",
    `Max-Age=${value === null ? 0 : Math.floor(ATTEMPT_TTL_MS / 1000)}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function cookieOf(request: Request, base: string, secure: boolean): unknown {
  const name = cookieName(base, secure);
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator !== -1 && pair.slice(0, separator).trim() === name) return decode(pair.slice(separator + 1).trim());
  }
  return null;
}

const ACCOUNT_ID = /^[0-9a-f]{32}$/;

function attemptOf(request: Request, secure: boolean, nowMs: number): Attempt | null {
  const value = cookieOf(request, "connect", secure) as Partial<Attempt> | null;
  if (!value || typeof value !== "object") return null;
  const { step, nonce, verifier, next, startedAt } = value;
  if (step !== "find" && step !== "grant" && step !== "signin") return null;
  if (typeof nonce !== "string" || typeof verifier !== "string" || typeof next !== "string") return null;
  if (typeof startedAt !== "number" || nowMs - startedAt > ATTEMPT_TTL_MS || startedAt > nowMs) return null;
  return { step, nonce, verifier, next: nextPath(next), startedAt };
}

function foundOf(request: Request, secure: boolean): Found | null {
  const value = cookieOf(request, "found", secure) as Partial<Found> | null;
  if (!value || typeof value !== "object" || typeof value.home !== "string" || !Array.isArray(value.accounts)) {
    return null;
  }
  const accounts = value.accounts
    .filter(
      (account): account is { id: string; name: string } =>
        typeof account?.id === "string" && ACCOUNT_ID.test(account.id) && typeof account.name === "string",
    )
    .slice(0, MAX_ACCOUNTS)
    .map(({ id, name }) => ({ id, name: name.slice(0, MAX_NAME_CHARS) }));
  return accounts.some((account) => account.id === value.home) ? { home: value.home, accounts } : null;
}

function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

/** A page whose form leads to Cloudflare, which a redirect after a form post has to be allowed to do. */
function page(body: string, status = 200): Response {
  return secured(html(body, status), "none", CLOUDFLARE);
}

type Problem = keyof PageText["connect"]["problems"];

/** Says what went wrong and offers to start again. Whatever the attempt left in the browser is cleared. */
function problem(visit: ConnectVisit, reason: Problem, status = 400): Response {
  const response = page(connectProblemPage(visit.text, visit.text.connect.problems[reason]), status);
  const secure = isSecure(visit.url);
  response.headers.append("set-cookie", setCookie("connect", null, secure));
  response.headers.append("set-cookie", setCookie("found", null, secure));
  return response;
}

/** Sends the browser to Cloudflare for `step`, remembering what will prove the answer. */
async function leaveFor(visit: ConnectVisit, step: Step, next: string): Promise<Response> {
  const pkce = await createPkce();
  const attempt: Attempt = { step, nonce: randomNonce(), verifier: pkce.verifier, next, startedAt: Date.now() };
  const address = authorizationUrl({
    clientId: visit.client.clientId,
    redirectUri: visit.client.callbackUrl,
    scopes: SCOPES[step],
    state: encodeState({ o: visit.url.origin, n: attempt.nonce }),
    challenge: pkce.challenge,
  });

  const response = secured(redirect(address, 303));
  const secure = isSecure(visit.url);
  response.headers.append("set-cookie", setCookie("connect", attempt, secure));
  return response;
}

/** The page to come back to between the two steps, and after them. */
function connectAddress(next: string, again: boolean): string {
  const params = new URLSearchParams();
  if (next !== "/") params.set("next", next);
  if (again) params.set("again", "1");
  const query = params.toString();
  return query ? `/signin?${query}` : "/signin";
}

async function show(visit: ConnectVisit): Promise<Response> {
  const { request, url, store, text } = visit;
  const next = nextPath(url.searchParams.get("next"));
  const again = url.searchParams.get("again") === "1";
  const tooMany = url.searchParams.get("error") === "too-many";
  const connection = await store.connection();
  const found = foundOf(request, isSecure(url));

  // Connecting, for the first time or again: the two steps, the first ticked once it is done.
  if (!connection || again || found) {
    return page(connectPage(text, { again: connection !== null, found: found?.accounts ?? null, next, tooMany }));
  }
  if (await isSignedIn(request, connection.sessionKey, Date.now())) return secured(redirect(next));
  return page(cloudflareSignInPage(text, next, tooMany));
}

async function start(visit: ConnectVisit): Promise<Response> {
  const { request, url, env, store } = visit;
  if (request.method !== "POST") return secured(new Response(null, { status: 405, headers: { allow: "POST" } }));
  if (isForeignCall(request, url)) return secured(json({ error: "origin-not-allowed" }, 403));
  if (await overLimit(env.SIGNIN_LIMIT, request)) return secured(redirect("/signin?error=too-many", 303));
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FORM_BYTES) {
    return secured(json({ error: "invalid-request" }, 413));
  }

  // Only reached in development, on an address a sign-in cannot come back to (a LAN or IPv6 one).
  if (!isReturnOrigin(url.origin)) {
    console.warn("sign-in cannot return to this address; use https, or http on localhost or 127.0.0.1");
    return problem(visit, "failed");
  }

  const form = await request.formData();
  const next = nextPath(String(form.get("next") ?? ""));
  if (form.get("step") === "grant" && foundOf(request, isSecure(url))) return leaveFor(visit, "grant", next);

  const connected = (await store.connection()) !== null;
  // Connecting again goes through the same two steps as the first time.
  return leaveFor(visit, !connected || form.get("again") === "1" ? "find" : "signin", next);
}

/** `find`: learn the accounts, pick out the one this Worker runs in, and show the person it is done. */
async function find(visit: ConnectVisit, attempt: Attempt, tokens: Tokens): Promise<Response> {
  const nowMs = Date.now();
  const giveBack = () => visit.ctx.waitUntil(revokeToken({ clientId: visit.client.clientId, token: tokens.accessToken }));

  const listed = await accountsSeenBy(tokens.accessToken);
  if (!listed || listed.length === 0) {
    giveBack();
    return problem(visit, listed ? "noAccounts" : "failed");
  }

  const candidates = listed.slice(0, MAX_ACCOUNTS);
  const home = await homeAmong(
    visit.env,
    tokens.accessToken,
    candidates.map((account) => account.id),
    nowMs,
  );
  giveBack();
  if (!home) return problem(visit, "notFound");

  const accounts = candidates
    .map(({ id, name }) => ({ id, name: name.slice(0, MAX_NAME_CHARS) }))
    .sort((left, right) => Number(right.id === home) - Number(left.id === home));

  const connected = (await visit.store.connection()) !== null;
  const secure = isSecure(visit.url);
  const response = secured(redirect(connectAddress(attempt.next, connected), 303));
  response.headers.append("set-cookie", setCookie("found", { home, accounts } satisfies Found, secure));
  response.headers.append("set-cookie", setCookie("connect", null, secure));
  return response;
}

/** `grant`: keep the access that reads analytics, and let the person in. */
async function grant(visit: ConnectVisit, attempt: Attempt, tokens: Tokens): Promise<Response> {
  const { env, store, url, ctx, client } = visit;
  const nowMs = Date.now();
  const giveBack = (token: string) => ctx.waitUntil(revokeToken({ clientId: client.clientId, token }));

  const found = foundOf(visit.request, isSecure(url));
  if (!found) {
    giveBack(tokens.refreshToken ?? tokens.accessToken);
    return problem(visit, "expired");
  }
  if (!tokens.refreshToken) {
    giveBack(tokens.accessToken);
    return problem(visit, "notKept");
  }

  // The list came through the browser, so home is shown again with this access.
  const existing = await store.connection();
  const allowed =
    (!existing || existing.home === found.home) && (await isHome(env, tokens.accessToken, found.home, nowMs));
  if (!allowed) {
    giveBack(tokens.refreshToken);
    return problem(visit, existing && existing.home !== found.home ? "otherAccount" : "notAllowed", 403);
  }

  const readable = await Promise.all(
    found.accounts.map(async (account) => account.id === found.home || (await canRead(tokens.accessToken, account.id, nowMs))),
  );
  const connection: Connection = {
    v: 1,
    clientId: client.clientId,
    home: found.home,
    accounts: found.accounts.filter((_, index) => readable[index]),
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken,
    accessExpiresAt: tokens.expiresAt,
    connectedAt: new Date(nowMs).toISOString(),
    // Kept across reconnecting, so browsers and agents that were let in stay in.
    sessionKey: existing?.sessionKey ?? newSessionKey(),
    broken: false,
  };
  await store.saveConnection(connection);
  if (existing) giveBack(existing.refreshToken);
  ctx.waitUntil(refreshAll(readerOver(store, connection)));

  return letIn(visit, connection, attempt.next);
}

/** `signin`: the person may come in if their own consent reads the account this Worker runs in. */
async function signIn(visit: ConnectVisit, attempt: Attempt, tokens: Tokens): Promise<Response> {
  const connection = await visit.store.connection();
  const allowed = connection !== null && (await canRead(tokens.accessToken, connection.home, Date.now()));
  visit.ctx.waitUntil(revokeToken({ clientId: visit.client.clientId, token: tokens.accessToken }));
  if (!connection || !allowed) return problem(visit, connection ? "notAllowed" : "expired", 403);
  return letIn(visit, connection, attempt.next);
}

async function letIn(visit: ConnectVisit, connection: Connection, next: string): Promise<Response> {
  const secure = isSecure(visit.url);
  const response = secured(redirect(next, 303));
  response.headers.append("set-cookie", sessionCookie(await issueSession(connection.sessionKey, Date.now()), secure));
  response.headers.append("set-cookie", setCookie("connect", null, secure));
  response.headers.append("set-cookie", setCookie("found", null, secure));
  return response;
}

/** What Cloudflare answered, however it reached here: in the address, or in the relay's form. */
async function answerOf(visit: ConnectVisit): Promise<URLSearchParams | null> {
  const { request, url } = visit;
  if (request.method === "GET" && url.pathname === directCallbackPath(visit)) return url.searchParams;
  if (request.method !== "POST" || url.pathname !== RETURN_PATH) return null;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FORM_BYTES) return null;

  const answer = new URLSearchParams();
  for (const [name, value] of await request.formData()) {
    if (typeof value === "string") answer.set(name, value);
  }
  return answer;
}

async function finish(visit: ConnectVisit): Promise<Response> {
  if (await overLimit(visit.env.SIGNIN_LIMIT, visit.request)) return problem(visit, "tooMany", 429);

  const answer = await answerOf(visit);
  if (!answer) return secured(new Response(null, { status: 405 }));

  // The attempt this browser started, and an answer that names it: anything
  // else was started somewhere else, or by someone else.
  const attempt = attemptOf(visit.request, isSecure(visit.url), Date.now());
  const state = decodeState(answer.get("state") ?? "");
  if (!attempt || !state || state.o !== visit.url.origin || state.n !== attempt.nonce) {
    return problem(visit, "expired");
  }

  const code = answer.get("code");
  if (answer.has("error") || !code) return problem(visit, "declined");

  let tokens: Tokens;
  try {
    tokens = await exchangeCode({
      clientId: visit.client.clientId,
      code,
      verifier: attempt.verifier,
      redirectUri: visit.client.callbackUrl,
    });
  } catch (error) {
    if (!(error instanceof OAuthError)) throw error;
    console.warn("cloudflare sign-in failed", error.code, error.status);
    return problem(visit, error.reconnectNeeded ? "expired" : "failed", error.retryable ? 502 : 400);
  }

  if (attempt.step === "find") return find(visit, attempt, tokens);
  if (attempt.step === "grant") return grant(visit, attempt, tokens);
  return signIn(visit, attempt, tokens);
}

export async function connect(visit: ConnectVisit): Promise<Response> {
  const { request, url } = visit;
  if (url.pathname === "/signin") {
    return request.method === "GET" ? show(visit) : secured(new Response(null, { status: 405, headers: { allow: "GET" } }));
  }
  if (url.pathname === START_PATH) return start(visit);
  return finish(visit);
}
