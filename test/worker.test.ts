import { AuthorizationError, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rangeDays } from "../shared/dates";
import type { AppState, Snapshot } from "../shared/types";
import { issueSession, keyFingerprint } from "../worker/access";
import { NO_ALERTS } from "../worker/alerts";
import { app } from "../worker/app";
import type { Env } from "../worker/env";
import type { AccountReport } from "../worker/report";
import { fakeContext, fakeFetch, fakeKv } from "./helpers";

const ACCOUNT = "4".repeat(32);
const TOKEN = "cfat_never_shown_to_anyone";
const KEY = "a-long-enough-access-key";
const ORIGIN = "https://usage.example.workers.dev";
const API = "https://api.cloudflare.com/client/v4";

let kv: ReturnType<typeof fakeKv>;

function env(overrides: Partial<Env> = {}): Env {
  return {
    ANALYTICS_TOKEN: TOKEN,
    ACCESS_KEY: KEY,
    OAUTH_KV: kv.kv,
    ASSETS: {
      fetch: async (request: Request) =>
        new Response(`asset ${new URL(request.url).pathname}`, { headers: { "content-type": "text/html" } }),
    },
    ...overrides,
  } as unknown as Env;
}

function send(request: Request, bindings: Env = env()): Promise<Response> {
  return app.fetch(request as Parameters<typeof app.fetch>[0], bindings, fakeContext().ctx);
}

async function cookie(): Promise<string> {
  return `__Host-usage-session=${await issueSession(KEY, Date.now())}`;
}

async function signedIn(path: string, init: RequestInit = {}): Promise<Request> {
  const headers = new Headers(init.headers);
  headers.set("cookie", await cookie());
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
}

const write = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method,
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
});

const form = (fields: Record<string, string>, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  body: new URLSearchParams(fields),
  headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN, ...headers },
});

/** Cloudflare as the Worker sees it: one account, and analytics that answer with `rows` for every dataset. */
function cloudflare(options: { analytics?: () => Response } = {}) {
  const fake = fakeFetch({
    [`${API}/accounts?`]: () => Response.json({ result: [{ id: ACCOUNT, name: "Personal" }] }),
    [`${API}/accounts/`]: () => new Response(null, { status: 403 }),
    [`${API}/graphql`]:
      options.analytics ??
      (() =>
        Response.json({
          data: {
            viewer: {
              accounts: [
                {
                  workers: [
                    {
                      dimensions: { date: new Date().toISOString().slice(0, 10), scriptName: "site" },
                      sum: { requests: 1200, errors: 0, cpuTimeUs: 5_000_000 },
                    },
                  ],
                },
              ],
            },
          },
        })),
  });
  vi.stubGlobal("fetch", fake.fetcher);
  return fake;
}

function snapshotOf(): Snapshot {
  const today = new Date().toISOString().slice(0, 10);
  const days = rangeDays(new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10), today);
  return {
    v: 1,
    accountId: ACCOUNT,
    fetchedAt: new Date().toISOString(),
    days,
    metrics: { "workers.requests": { total: days.map(() => 100_000), by: { site: days.map(() => 100_000) } } },
    extras: {},
    warnings: [],
  };
}

beforeEach(() => {
  kv = fakeKv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a deployment that is missing a secret", () => {
  it("says which one, to a person and to a script, and serves nothing else", async () => {
    const page = await send(new Request(`${ORIGIN}/`), env({ ACCESS_KEY: undefined }));
    expect(page.status).toBe(503);
    const body = await page.text();
    expect(body).toContain("ACCESS_KEY");
    expect(body).not.toContain("ANALYTICS_TOKEN");
    expect(body).not.toContain(TOKEN);

    const api = await send(new Request(`${ORIGIN}/api/state`), env({ ACCESS_KEY: "" }));
    expect(api.status).toBe(503);
    expect(await api.json()).toEqual({ success: false, data: null, error: "not-set-up" });
  });

  it("does not accept a key too short to be one", async () => {
    const response = await send(new Request(`${ORIGIN}/signin`), env({ ACCESS_KEY: "hunter2" }));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("24");
  });

  it("answers in Chinese to a browser that asks for it", async () => {
    const response = await send(
      new Request(`${ORIGIN}/`, { headers: { "accept-language": "zh-TW,zh;q=0.9" } }),
      env({ ACCESS_KEY: undefined }),
    );
    expect(await response.text()).toContain('lang="zh-Hant"');
  });
});

describe("someone who is not signed in", () => {
  it("is sent to sign in, and back to where they were going", async () => {
    const home = await send(new Request(`${ORIGIN}/`));
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("/signin");

    const deep = await send(new Request(`${ORIGIN}/?open=workers.cpuMs`));
    expect(deep.headers.get("location")).toBe("/signin?next=%2F%3Fopen%3Dworkers.cpuMs");
    expect(deep.headers.get("cache-control")).toBe("private, no-store");
  });

  it("gets a plain 401 from the API, with nothing about what is behind it", async () => {
    const response = await send(new Request(`${ORIGIN}/api/state`));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
  });

  it("can load what the sign-in page is made of, and nothing of the app", async () => {
    for (const path of ["/door.css", "/favicon.ico", "/fonts/inter-latin-wght-normal.woff2"]) {
      const response = await send(new Request(`${ORIGIN}${path}`));
      expect(response.status, path).toBe(200);
      expect(await response.text()).toBe(`asset ${path}`);
    }
    expect((await send(new Request(`${ORIGIN}/assets/index-abc.js`))).status).toBe(302);
  });

  it("is not signed in by a cookie it made up", async () => {
    const forged = new Request(`${ORIGIN}/api/state`, {
      headers: { cookie: `__Host-usage-session=v1.${Date.now() + 86_400_000}.AAAA` },
    });
    expect((await send(forged)).status).toBe(401);
  });
});

describe("signing in", () => {
  it("shows a form that posts back to this site", async () => {
    const response = await send(new Request(`${ORIGIN}/signin?next=%2F%3Faccount%3Dwork`));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('action="/signin"');
    expect(body).toContain('name="next" value="/?account=work"');
    expect(response.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("starts a session with the right key and goes on to the page asked for", async () => {
    const response = await send(new Request(`${ORIGIN}/signin`, form({ key: KEY, next: "/?account=work" })));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?account=work");

    const session = response.headers.get("set-cookie") ?? "";
    expect(session).toContain("__Host-usage-session=v1.");
    expect(session).toContain("HttpOnly");

    const next = new Request(`${ORIGIN}/api/state`, { headers: { cookie: session.split(";")[0] ?? "" } });
    cloudflare();
    expect((await send(next)).status).toBe(200);
  });

  it("says the key was wrong without starting anything", async () => {
    const response = await send(new Request(`${ORIGIN}/signin`, form({ key: "not the key", next: "/?a=1" })));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/signin?next=%2F%3Fa%3D1&error=wrong");
    expect(response.headers.get("set-cookie")).toBeNull();

    const page = await send(new Request(`${ORIGIN}/signin?error=wrong`));
    expect(page.status).toBe(401);
    expect(await page.text()).toContain('role="alert"');
  });

  it("only ever goes on to a path of its own", async () => {
    for (const next of ["https://evil.example/", "//evil.example", "/\\evil.example", "/\t/evil.example", "evil", ""]) {
      const response = await send(new Request(`${ORIGIN}/signin`, form({ key: KEY, next })));
      expect(response.headers.get("location"), next).toBe("/");
    }
  });

  it("refuses a form posted from another site", async () => {
    const response = await send(
      new Request(`${ORIGIN}/signin`, form({ key: KEY, next: "/" }, { origin: "https://evil.example" })),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("stops checking keys for a caller who has tried too often", async () => {
    const SIGNIN_LIMIT = { limit: vi.fn(async () => ({ success: false })) } as unknown as RateLimit;
    const response = await send(
      new Request(`${ORIGIN}/signin`, form({ key: KEY, next: "/" }, { "cf-connecting-ip": "203.0.113.9" })),
      env({ SIGNIN_LIMIT }),
    );
    expect(response.headers.get("location")).toBe("/signin?error=too-many");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not read a form too large to be one", async () => {
    const response = await send(
      new Request(`${ORIGIN}/signin`, form({ key: KEY, next: "/" }, { "content-length": "100000" })),
    );
    expect(response.status).toBe(413);
  });

  it("does not bounce a signed-in owner off the site through a crafted link", async () => {
    const response = await send(await signedIn("/signin?next=%2F%09%2Fevil.example"));
    expect(response.headers.get("location")).toBe("/");
  });

  it("skips the form for someone already signed in", async () => {
    const response = await send(await signedIn("/signin?next=%2F%3Fa%3D1"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?a=1");
  });

  it("ends the session on sign-out, which only this site can ask for", async () => {
    const out = await send(await signedIn("/signout", { method: "POST", headers: { origin: ORIGIN } }));
    expect(out.status).toBe(303);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");

    expect((await send(await signedIn("/signout"))).status).toBe(405);
    const foreign = await signedIn("/signout", { method: "POST", headers: { origin: "https://evil.example" } });
    expect((await send(foreign)).status).toBe(403);
  });
});

describe("the owner, signed in", () => {
  it("gets the page with its security headers", async () => {
    const response = await send(await signedIn("/"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset /");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    const script = await send(await signedIn("/assets/index-abc.js"));
    expect(script.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  });

  it("sees the accounts the token can see, with no billing day until one is set", async () => {
    cloudflare();
    const state = (await (await send(await signedIn("/api/state"))).json()) as AppState;
    expect(state).toEqual({
      accounts: [{ id: ACCOUNT, name: "Personal", renewalDay: null, snapshot: null, names: {} }],
      problems: [],
      alerts: NO_ALERTS,
    });
    expect(JSON.stringify(state)).not.toContain(TOKEN);
  });

  it("is told when a token does not work", async () => {
    cloudflare();
    const state = (await (
      await send(await signedIn("/api/state"), env({ ANALYTICS_TOKEN: `${TOKEN},` + "second" }))
    ).json()) as AppState;
    expect(state.accounts).toHaveLength(1);
    // The fake Cloudflare gives every token the same account, so nothing is wrong here.
    expect(state.problems).toEqual([]);

    vi.stubGlobal("fetch", async () => new Response(null, { status: 403 }));
    kv = fakeKv();
    const refused = (await (await send(await signedIn("/api/state"))).json()) as AppState;
    expect(refused).toEqual({ accounts: [], problems: [{ token: 1, status: 403 }], alerts: NO_ALERTS });
  });

  it("sets the billing day, within a month's days, for an account it has", async () => {
    cloudflare();
    const saved = await send(await signedIn("/api/settings", write("PUT", { accountId: ACCOUNT, renewalDay: 13 })));
    expect(await saved.json()).toEqual({ accountId: ACCOUNT, renewalDay: 13 });

    const state = (await (await send(await signedIn("/api/state"))).json()) as AppState;
    expect(state.accounts[0]?.renewalDay).toBe(13);

    for (const renewalDay of [0, 32, 1.5, "13", null]) {
      const bad = await send(await signedIn("/api/settings", write("PUT", { accountId: ACCOUNT, renewalDay })));
      expect(bad.status, String(renewalDay)).toBe(400);
    }
    const other = await send(
      await signedIn("/api/settings", write("PUT", { accountId: "f".repeat(32), renewalDay: 5 })),
    );
    expect(other.status).toBe(404);
  });

  it("reads usage from Cloudflare on refresh and keeps it", async () => {
    const fake = cloudflare();
    const response = await send(await signedIn("/api/refresh", write("POST", { accountId: ACCOUNT })));
    expect(response.status).toBe(200);

    const { snapshot } = (await response.json()) as { snapshot: Snapshot };
    expect(snapshot.metrics["workers.requests"]?.total.at(-1)).toBeGreaterThan(0);
    expect(kv.read<Snapshot>(`usage:snapshot:${ACCOUNT}`)?.accountId).toBe(ACCOUNT);
    expect(fake.calls.filter((call) => call.url.endsWith("/graphql")).length).toBeGreaterThan(0);
    expect(fake.calls.every((call) => call.headers.get("authorization") === `Bearer ${TOKEN}`)).toBe(true);

    // Pressed again straight away, it answers from what it just stored.
    const before = fake.calls.length;
    await send(await signedIn("/api/refresh", write("POST", { accountId: ACCOUNT })));
    expect(fake.calls.filter((call) => call.url.endsWith("/graphql")).length).toBe(
      fake.calls.slice(0, before).filter((call) => call.url.endsWith("/graphql")).length,
    );
  });

  it("passes on what Cloudflare objected to, and nothing about itself", async () => {
    cloudflare({ analytics: () => Response.json({ errors: [{ message: "not authorized for that account" }] }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await send(await signedIn("/api/refresh", write("POST", { accountId: ACCOUNT })));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "analytics", message: "not authorized for that account" });
  });

  it("is not acted for by another site", async () => {
    cloudflare();
    const foreign = await signedIn(
      "/api/settings",
      write("PUT", { accountId: ACCOUNT, renewalDay: 5 }, { origin: "https://evil.example" }),
    );
    expect((await send(foreign)).status).toBe(403);

    const notJson = await signedIn("/api/settings", {
      method: "PUT",
      body: "accountId=x",
      headers: { "content-type": "text/plain", origin: ORIGIN },
    });
    expect((await send(notJson)).status).toBe(415);

    const framed = await signedIn("/api/state", { headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" } });
    expect((await send(framed)).status).toBe(403);
  });
});

describe("the JSON report", () => {
  const report = (path = "/api/v1/usage", headers: Record<string, string> = {}) =>
    new Request(`${ORIGIN}${path}`, { headers });
  const bearer = { authorization: `Bearer ${KEY}` };

  async function seeded(renewalDay: number | null = 13) {
    cloudflare();
    kv = fakeKv({
      [`usage:snapshot:${ACCOUNT}`]: snapshotOf(),
      ...(renewalDay === null ? {} : { "usage:settings": { accounts: { [ACCOUNT]: { renewalDay } } } }),
    });
  }

  it("is closed without the key", async () => {
    const response = await send(report());
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({ success: false, data: null, error: "unauthenticated" });
  });

  it("does not let a wrong key ride on a good session", async () => {
    const request = await signedIn("/api/v1/usage", { headers: { authorization: "Bearer wrong" } });
    expect((await send(request)).status).toBe(401);
  });

  it("gives every account's conclusions to a script with the key", async () => {
    await seeded();
    const response = await send(report("/api/v1/usage", bearer));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { success: boolean; data: { accounts: AccountReport[] } };
    const account = body.data.accounts[0];
    expect(body.success).toBe(true);
    expect(account?.name).toBe("Personal");
    expect(account?.renewalDay).toBe(13);
    expect(account?.headline?.title.length).toBeGreaterThan(0);
    expect(account?.metrics[0]).toMatchObject({ id: "workers.requests", label: "Workers requests", unit: "count" });
    expect(account?.metrics[0]?.top[0]).toMatchObject({ name: "site" });
  });

  it("writes its sentences in the language asked for", async () => {
    await seeded();
    const english = (await (await send(report("/api/v1/usage", bearer))).json()) as {
      data: { accounts: AccountReport[] };
    };
    const chinese = (await (await send(report("/api/v1/usage?lang=zh-TW", bearer))).json()) as {
      data: { accounts: AccountReport[] };
    };
    expect(english.data.accounts[0]?.headline?.title).toMatch(/^[\x20-\x7e]+$/);
    expect(chinese.data.accounts[0]?.headline?.title).toMatch(/[一-鿿]/);
    expect(chinese.data.accounts[0]?.metrics[0]?.label).toBe("Workers 請求");
  });

  it("has no verdict for an account whose billing day is not set", async () => {
    await seeded(null);
    const body = (await (await send(report("/api/v1/usage", bearer))).json()) as {
      data: { accounts: AccountReport[] };
    };
    expect(body.data.accounts[0]).toMatchObject({ renewalDay: null, headline: null, metrics: [], cycle: null });
    expect(body.data.accounts[0]?.fetchedAt).not.toBeNull();
  });

  it("picks one account by name or id, and says so when there is no such account", async () => {
    await seeded();
    for (const account of ["personal", ACCOUNT]) {
      const body = (await (await send(report(`/api/v1/usage?account=${account}`, bearer))).json()) as {
        data: { accounts: AccountReport[] };
      };
      expect(body.data.accounts).toHaveLength(1);
    }
    const missing = await send(report("/api/v1/usage?account=nobody", bearer));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ success: false, data: null, error: "unknown-account" });
  });

  it("opens in the owner's browser, indented, and sends anyone else to sign in", async () => {
    await seeded();
    const visit = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "cross-site" };

    const owner = await send(await signedIn("/api/v1/usage?account=personal", { headers: visit }));
    expect(owner.status).toBe(200);
    expect(await owner.text()).toContain('\n  "success": true');

    const stranger = await send(report("/api/v1/usage?account=personal", visit));
    expect(stranger.status).toBe(302);
    expect(stranger.headers.get("location")).toBe("/signin?next=%2Fapi%2Fv1%2Fusage%3Faccount%3Dpersonal");
  });

  it("answers only GET on the one address, and only so often", async () => {
    await seeded();
    expect((await send(report("/api/v1/other", bearer))).status).toBe(404);
    const post = new Request(`${ORIGIN}/api/v1/usage`, { method: "POST", headers: bearer });
    expect((await send(post)).status).toBe(405);

    const API_LIMIT = { limit: vi.fn(async () => ({ success: false })) } as unknown as RateLimit;
    const limited = await send(
      report("/api/v1/usage", { ...bearer, "cf-connecting-ip": "203.0.113.9" }),
      env({ API_LIMIT }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});

describe("letting an agent connect", () => {
  const AUTHORIZE = `${ORIGIN}/authorize?client_id=abc&response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback&state=s`;
  const oauthRequest = {
    responseType: "code",
    clientId: "abc",
    redirectUri: "https://claude.ai/callback",
    scope: [],
    state: "s",
  };

  function provider(overrides: Partial<OAuthHelpers> = {}) {
    const helpers = {
      parseAuthRequest: vi.fn(async () => oauthRequest),
      describeConsent: vi.fn(async () => ({
        clientId: "abc",
        clientName: '<img src=x onerror="alert(1)">',
        redirectUri: "https://claude.ai/callback",
        redirectHost: "claude.ai",
        redirectIsLoopback: false,
        scope: [],
      })),
      beginConsent: vi.fn(async () => ({
        handle: "handle-1",
        headers: new Headers({ "set-cookie": "__Host-oauth-consent-1=x; Path=/; Secure; HttpOnly" }),
      })),
      approveConsent: vi.fn(async () => ({
        request: oauthRequest,
        headers: new Headers({ "set-cookie": "__Host-oauth-consent-1=; Max-Age=0" }),
      })),
      denyConsent: vi.fn(async () => ({
        request: oauthRequest,
        redirectTo: "https://claude.ai/callback?error=access_denied&state=s",
        headers: new Headers(),
      })),
      completeAuthorization: vi.fn(async () => ({ redirectTo: "https://claude.ai/callback?code=c&state=s" })),
      ...overrides,
    };
    return { helpers, bindings: env({ OAUTH_PROVIDER: helpers as unknown as OAuthHelpers }) };
  }

  it("sends anyone not signed in to sign in first, before looking anything up", async () => {
    const { helpers, bindings } = provider();

    const shown = await send(new Request(AUTHORIZE), bindings);
    expect(shown.status).toBe(302);
    const location = shown.headers.get("location") ?? "";
    expect(location.startsWith("/signin?next=%2Fauthorize%3Fclient_id%3Dabc")).toBe(true);

    const posted = await send(new Request(AUTHORIZE, form({ handle: "handle-1", decision: "approve" })), bindings);
    expect(posted.status).toBe(303);
    expect(posted.headers.get("location")?.startsWith("/signin?next=")).toBe(true);

    for (const helper of Object.values(helpers)) expect(helper).not.toHaveBeenCalled();
  });

  it("comes back to the same request after signing in", async () => {
    const { bindings } = provider();
    const toSignIn = (await send(new Request(AUTHORIZE), bindings)).headers.get("location") ?? "";
    const next = new URL(toSignIn, ORIGIN).searchParams.get("next") ?? "";

    const signed = await send(new Request(`${ORIGIN}/signin`, form({ key: KEY, next })), bindings);
    expect(signed.headers.get("location")).toBe(AUTHORIZE.slice(ORIGIN.length));
  });

  it("says who is asking and where access goes, with the client's name made harmless", async () => {
    const { bindings } = provider();
    const response = await send(await signedIn(AUTHORIZE.slice(ORIGIN.length)), bindings);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).not.toContain("<img");
    expect(body).toContain("&#60;img");
    expect(body).toContain("Access will be sent to claude.ai.");
    expect(body).toContain('name="handle" value="handle-1"');
    expect(body).not.toContain('name="key"');

    expect(response.headers.get("set-cookie")).toContain("__Host-oauth-consent-1");
    expect(response.headers.get("content-security-policy")).toContain("form-action 'self' https://claude.ai");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("issues access, bound to the current key, when the owner allows it", async () => {
    const { helpers, bindings } = provider();
    const request = await signedIn(AUTHORIZE.slice(ORIGIN.length), form({ handle: "handle-1", decision: "approve" }));
    const response = await send(request, bindings);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://claude.ai/callback?code=c&state=s");
    expect(helpers.approveConsent).toHaveBeenCalledWith(expect.anything(), "handle-1", { scope: ["usage:read"] });
    expect(helpers.completeAuthorization).toHaveBeenCalledWith({
      request: oauthRequest,
      userId: "owner",
      metadata: {},
      scope: ["usage:read"],
      props: { via: "oauth", key: await keyFingerprint(KEY) },
    });
  });

  it("tells the client no when the owner denies it", async () => {
    const { helpers, bindings } = provider();
    const request = await signedIn(AUTHORIZE.slice(ORIGIN.length), form({ handle: "handle-1", decision: "deny" }));
    const response = await send(request, bindings);
    expect(response.headers.get("location")).toBe("https://claude.ai/callback?error=access_denied&state=s");
    expect(helpers.completeAuthorization).not.toHaveBeenCalled();
  });

  it("refuses a decision posted from another site", async () => {
    const { helpers, bindings } = provider();
    const request = await signedIn(
      AUTHORIZE.slice(ORIGIN.length),
      form({ handle: "handle-1", decision: "approve" }, { origin: "https://evil.example" }),
    );
    const response = await send(request, bindings);
    expect(response.status).toBe(403);
    expect(helpers.approveConsent).not.toHaveBeenCalled();
    expect(helpers.completeAuthorization).not.toHaveBeenCalled();
  });

  it("shows a problem on its own page and never sends the owner to the client's address", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const unknownClient = provider({
      parseAuthRequest: vi.fn(async () => {
        throw new AuthorizationError("invalid_request", { description: "unknown client" });
      }),
    });
    const shown = await send(await signedIn(AUTHORIZE.slice(ORIGIN.length)), unknownClient.bindings);
    expect(shown.status).toBe(400);
    expect(shown.headers.get("location")).toBeNull();
    expect(await shown.text()).not.toContain("unknown client");

    // Any client can register any address, so even a "validated" one is not followed on an error.
    const registeredElsewhere = provider({
      parseAuthRequest: vi.fn(async () => {
        throw new AuthorizationError("invalid_scope", {
          description: "no such scope",
          redirectUri: "https://evil.example/landing",
          state: "s",
          issuer: ORIGIN,
        });
      }),
    });
    const kept = await send(await signedIn(AUTHORIZE.slice(ORIGIN.length)), registeredElsewhere.bindings);
    expect(kept.status).toBe(400);
    expect(kept.headers.get("location")).toBeNull();

    const usedHandle = provider({
      approveConsent: vi.fn(async () => {
        throw new AuthorizationError("invalid_request", { description: "handle already used" });
      }),
    });
    const again = await send(
      await signedIn(AUTHORIZE.slice(ORIGIN.length), form({ handle: "handle-1", decision: "approve" })),
      usedHandle.bindings,
    );
    expect(again.status).toBe(400);
    expect(usedHandle.helpers.completeAuthorization).not.toHaveBeenCalled();
  });
});
