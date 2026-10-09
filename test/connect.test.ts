import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueSession } from "../worker/access";
import { app } from "../worker/app";
import { decodeState } from "../worker/cloudflare-oauth";
import { ReconnectNeeded, accessTokenOf } from "../worker/connection";
import { setupOf, type Env } from "../worker/env";
import { canRead, homeAmong, isHome, sightingOf } from "../worker/home";
import { Store, type Connection } from "../worker/store";
import { fakeContext, fakeFetch, fakeKv } from "./helpers";

const HOME = "1".repeat(32);
const OTHER = "2".repeat(32);
const HIDDEN = "3".repeat(32);
const CLIENT = "c".repeat(32);
const VERSION = "6f1f3a52-1d0c-4c58-9b0e-2b1f0e6a7c11";
const ORIGIN = "https://usage.example.workers.dev";
const RELAY = "https://connect.example";
const CALLBACK = `${RELAY}/callback`;
const SESSION_KEY = "k".repeat(43);

const TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";
const REVOKE_URL = "https://dash.cloudflare.com/oauth2/revoke";
const API = "https://api.cloudflare.com/client/v4";

let kv: ReturnType<typeof fakeKv>;

function env(overrides: Partial<Env> = {}): Env {
  return {
    CF_OAUTH_CLIENT_ID: CLIENT,
    CF_OAUTH_CALLBACK_URL: CALLBACK,
    CF_VERSION_METADATA: { id: VERSION },
    OAUTH_KV: kv.kv,
    ASSETS: { fetch: async () => new Response("the page", { headers: { "content-type": "text/html" } }) },
    ...overrides,
  } as unknown as Env;
}

/** What Cloudflare knows in these tests: which access token reads which account, and where the Worker runs. */
interface World {
  /** Access token to the accounts it may read. */
  reads: Record<string, string[]>;
  /** Authorization code to what the token endpoint answers. */
  codes: Record<string, Record<string, unknown>>;
  refresh?: (refreshToken: string) => Response;
}

const WORLD: World = {
  reads: { "A-find": [HOME, OTHER, HIDDEN], "A-grant": [HOME, OTHER], "A-signin": [HOME], "A-stranger": [OTHER] },
  codes: {
    "code-find": { access_token: "A-find", expires_in: 3600, token_type: "bearer" },
    "code-grant": { access_token: "A-grant", refresh_token: "R-1", expires_in: 3600, token_type: "bearer" },
    "code-signin": { access_token: "A-signin", expires_in: 3600, token_type: "bearer" },
    "code-stranger": { access_token: "A-stranger", refresh_token: "R-x", expires_in: 3600, token_type: "bearer" },
    "code-no-refresh": { access_token: "A-grant", expires_in: 3600, token_type: "bearer" },
  },
};

function cloudflare(world: World = WORLD) {
  const revoked: string[] = [];
  const bearer = (request: Request) => (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const fake = fakeFetch({
    [TOKEN_URL]: async (request) => {
      const form = new URLSearchParams(await request.text());
      if (form.get("grant_type") === "refresh_token") {
        return world.refresh?.(form.get("refresh_token") ?? "") ?? Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      const answer = world.codes[form.get("code") ?? ""];
      return answer ? Response.json(answer) : Response.json({ error: "invalid_grant" }, { status: 400 });
    },
    [REVOKE_URL]: async (request) => {
      revoked.push(new URLSearchParams(await request.text()).get("token") ?? "");
      return new Response(null, { status: 200 });
    },
    [`${API}/accounts`]: (request) => {
      // Only the access that asked for account settings can list anything.
      const listed = bearer(request) === "A-find" ? (world.reads["A-find"] ?? []) : [];
      const result = listed.map((id) => ({ id, name: id === HOME ? "Acme" : `Account ${id[0]}` }));
      return Response.json({ result, result_info: { total_pages: 1 } });
    },
    [`${API}/graphql`]: async (request) => {
      const body = (await request.json()) as { variables: { account: string; version?: string } };
      const { account, version } = body.variables;
      if (version === undefined) return new Response("no readings in this test", { status: 500 });
      if (!(world.reads[bearer(request)] ?? []).includes(account)) {
        return Response.json({ data: null, errors: [{ message: "not authorized for that account" }] });
      }
      const ran = account === HOME && version === VERSION ? [{ dimensions: { scriptVersion: version } }] : [];
      return Response.json({ data: { viewer: { accounts: [{ ran }] } }, errors: null });
    },
  });
  vi.stubGlobal("fetch", fake.fetcher);
  return { ...fake, revoked };
}

/** A browser as far as cookies go: keeps what the Worker sets and sends it back. */
function browser(bindings: () => Env = env) {
  const jar = new Map<string, string>();
  const contexts: ReturnType<typeof fakeContext>[] = [];

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (jar.size > 0) headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    const context = fakeContext();
    contexts.push(context);
    const request = new Request(`${ORIGIN}${path}`, { ...init, headers });
    const response = await app.fetch(request as Parameters<typeof app.fetch>[0], bindings(), context.ctx);
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ""] = cookie.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      const value = pair.slice(pair.indexOf("=") + 1);
      if (value === "" || /Max-Age=0/.test(cookie)) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  }

  const start = (fields: Record<string, string> = {}) =>
    send("/connect/start", {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN, "sec-fetch-site": "same-origin" },
    });

  /** The relay handing back what Cloudflare gave it, for the consent `leaving` sent the browser to. */
  const comeBack = (leaving: Response, fields: Record<string, string>) => {
    const state = new URL(leaving.headers.get("location") ?? "").searchParams.get("state") ?? "";
    return send("/connect/return", {
      method: "POST",
      body: new URLSearchParams({ state, ...fields }),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: RELAY,
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
      },
    });
  };

  return { jar, send, start, comeBack, settled: () => Promise.all(contexts.map((context) => context.settled())) };
}

function scopeOf(response: Response): string[] {
  return (new URL(response.headers.get("location") ?? "").searchParams.get("scope") ?? "").split(" ");
}

function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    v: 1,
    clientId: CLIENT,
    home: HOME,
    accounts: [{ id: HOME, name: "Acme" }],
    refreshToken: "R-0",
    accessToken: "A-stored",
    accessExpiresAt: Date.now() + 3_000_000,
    connectedAt: "2026-10-01T00:00:00.000Z",
    sessionKey: SESSION_KEY,
    broken: false,
    ...overrides,
  };
}

beforeEach(() => {
  kv = fakeKv();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("how a deployment is set up", () => {
  const client = { CF_OAUTH_CLIENT_ID: CLIENT, CF_OAUTH_CALLBACK_URL: CALLBACK };

  it("signs in with Cloudflare when there is a client and no API token", () => {
    expect(setupOf(client)).toEqual({
      ready: true,
      mode: "signin",
      accessKey: null,
      client: { clientId: CLIENT, callbackUrl: CALLBACK },
    });
  });

  it("keeps an access key for scripts, and holds it to the same length", () => {
    const key = "a-long-enough-access-key";
    expect(setupOf({ ...client, ACCESS_KEY: key })).toMatchObject({ mode: "signin", accessKey: key });
    expect(setupOf({ ...client, ACCESS_KEY: "short" })).toEqual({ ready: false, missing: [], shortKey: true });
  });

  it("reads with the API token when there is one, whatever else is set", () => {
    const setup = setupOf({ ...client, ANALYTICS_TOKEN: "cfat_x", ACCESS_KEY: "a-long-enough-access-key" });
    expect(setup).toMatchObject({ ready: true, mode: "keys" });
  });

  it("is not set up when the client is only half named or is not one", () => {
    const missing = { ready: false, missing: ["ANALYTICS_TOKEN", "ACCESS_KEY"], shortKey: false };
    expect(setupOf({ CF_OAUTH_CLIENT_ID: CLIENT })).toEqual(missing);
    expect(setupOf({ CF_OAUTH_CALLBACK_URL: CALLBACK })).toEqual(missing);
    expect(setupOf({ CF_OAUTH_CLIENT_ID: "not-an-id", CF_OAUTH_CALLBACK_URL: CALLBACK })).toEqual(missing);
    expect(setupOf({ CF_OAUTH_CLIENT_ID: CLIENT, CF_OAUTH_CALLBACK_URL: `${CALLBACK}?x=1` })).toEqual(missing);
  });
});

describe("before anyone has connected", () => {
  it("sends every page to the one that connects, and answers the API with why", async () => {
    const page = await browser().send("/");
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/signin");

    const api = await browser().send("/api/state");
    expect(api.status).toBe(503);
    expect(await api.json()).toMatchObject({ error: "not-connected" });
    expect(kv.keys()).toEqual([]);
  });

  it("shows a page whose only way on is Cloudflare", async () => {
    const response = await browser().send("/signin?next=/%3Faccount%3DAcme");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('action="/connect/start"');
    expect(body).toContain('name="next" value="/?account=Acme"');
    expect(body).not.toContain('name="key"');
    expect(response.headers.get("content-security-policy")).toContain("form-action 'self' https://dash.cloudflare.com");
  });

  it("leaves for Cloudflare asking only to find the accounts, and remembers the attempt in a cookie", async () => {
    cloudflare();
    const visitor = browser();
    const leaving = await visitor.start({ next: "/?account=Acme" });
    const address = new URL(leaving.headers.get("location") ?? "");

    expect(leaving.status).toBe(303);
    expect(address.origin + address.pathname).toBe("https://dash.cloudflare.com/oauth2/auth");
    expect(address.searchParams.get("client_id")).toBe(CLIENT);
    expect(address.searchParams.get("redirect_uri")).toBe(CALLBACK);
    expect(address.searchParams.get("code_challenge_method")).toBe("S256");
    expect(scopeOf(leaving)).toEqual(["account-analytics.read", "account-settings.read"]);
    expect(decodeState(address.searchParams.get("state") ?? "")?.o).toBe(ORIGIN);

    const cookie = leaving.headers.getSetCookie().find((entry) => entry.startsWith("__Host-usage-connect="));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=None/);
    // Nothing is written for a visitor who has shown nothing yet.
    expect(kv.keys()).toEqual([]);
  });

  it("says so, rather than failing, at an address a sign-in cannot come back to", async () => {
    const context = fakeContext();
    const request = new Request("http://127.0.0.2:8799/connect/start", {
      method: "POST",
      body: new URLSearchParams({}),
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://127.0.0.2:8799" },
    });
    const response = await app.fetch(request as Parameters<typeof app.fetch>[0], env(), context.ctx);
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Sign-in did not finish");
  });

  it("starts only from its own page", async () => {
    const response = await browser().send("/connect/start", {
      method: "POST",
      body: new URLSearchParams({}),
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://elsewhere.example" },
    });
    expect(response.status).toBe(403);
  });
});

describe("connecting", () => {
  async function connectAs(grantCode = "code-grant") {
    const cf = cloudflare();
    const visitor = browser();
    const toFind = await visitor.start({ next: "/?account=Acme" });
    const between = await visitor.comeBack(toFind, { code: "code-find" });
    const steps = await visitor.send(between.headers.get("location") ?? "");
    const toGrant = await visitor.start({ next: "/?account=Acme", step: "grant" });
    const done = await visitor.comeBack(toGrant, { code: grantCode });
    await visitor.settled();
    return { cf, visitor, between, steps, toGrant, done };
  }

  /** Both steps for a visitor who has already started, ending with the answer to the second. */
  async function finishWith(visitor: ReturnType<typeof browser>, toFind: Response, grantCode: string) {
    await visitor.comeBack(toFind, { code: "code-find" });
    const answer = await visitor.comeBack(await visitor.start({ step: "grant" }), { code: grantCode });
    await visitor.settled();
    return answer;
  }

  it("asks twice, keeps only the access that reads usage, and lets the owner in", async () => {
    const { cf, visitor, between, steps, toGrant, done } = await connectAs();

    // Back on this Worker's own page between the two, with the first step shown as done.
    expect(between.status).toBe(303);
    expect(between.headers.get("location")).toBe("/signin?next=%2F%3Faccount%3DAcme");
    const shown = await steps.text();
    expect(shown).toContain('class="door-step is-done"');
    expect(shown).toContain("<span>Acme</span>");
    // Cloudflare's page asks for the accounts again, so the page says to pick the same ones.
    expect(shown).toContain("Choose the same accounts on Cloudflare&#39;s page.");
    expect(shown).toContain('name="step" value="grant"');

    expect(toGrant.status).toBe(303);
    expect(scopeOf(toGrant)).toEqual(["account-analytics.read", "offline_access"]);
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe("/?account=Acme");

    const stored = kv.read<Connection>("usage:connection");
    expect(stored).toMatchObject({
      clientId: CLIENT,
      home: HOME,
      // The third account was listed, but the kept access cannot read it.
      accounts: [
        { id: HOME, name: "Acme" },
        { id: OTHER, name: "Account 2" },
      ],
      refreshToken: "R-1",
      accessToken: "A-grant",
      broken: false,
    });
    // What listed the accounts was given back; what was kept was not.
    expect(cf.revoked).toEqual(["A-find"]);

    expect(visitor.jar.has("__Host-usage-session")).toBe(true);
    expect(visitor.jar.has("__Host-usage-connect")).toBe(false);
    expect(visitor.jar.has("__Host-usage-found")).toBe(false);

    const state = await visitor.send("/api/state");
    expect(state.status).toBe(200);
    expect(await state.json()).toMatchObject({
      accounts: [
        { id: HOME, name: "Acme" },
        { id: OTHER, name: "Account 2" },
      ],
      reconnect: false,
    });
  });

  it("refuses a login whose accounts do not include the one this Worker runs in", async () => {
    const cf = cloudflare({ ...WORLD, reads: { ...WORLD.reads, "A-find": [OTHER, HIDDEN] } });
    const visitor = browser();
    const answer = await visitor.comeBack(await visitor.start(), { code: "code-find" });
    await visitor.settled();

    expect(answer.status).toBe(400);
    expect(await answer.text()).toContain("None of the accounts you chose is running this Worker.");
    expect(cf.revoked).toEqual(["A-find"]);
    expect(kv.keys()).toEqual([]);
  });

  it("does not take the browser's word for which account is home", async () => {
    const cf = cloudflare();
    const visitor = browser();
    await visitor.comeBack(await visitor.start(), { code: "code-find" });
    const toGrant = await visitor.start({ step: "grant" });

    // A visitor rewrites the list to name an account of their own as home.
    const forged = Buffer.from(JSON.stringify({ home: OTHER, accounts: [{ id: OTHER, name: "Mine" }] })).toString("base64url");
    visitor.jar.set("__Host-usage-found", forged);
    const answer = await visitor.comeBack(toGrant, { code: "code-stranger" });
    await visitor.settled();

    expect(answer.status).toBe(403);
    expect(kv.read("usage:connection")).toBeUndefined();
    expect(visitor.jar.has("__Host-usage-session")).toBe(false);
    expect(cf.revoked).toContain("R-x");
  });

  it("starts with the first step when the browser has nothing from it", async () => {
    cloudflare();
    const leaving = await browser().start({ step: "grant" });
    expect(scopeOf(leaving)).toEqual(["account-analytics.read", "account-settings.read"]);
  });

  it("does not keep a grant that cannot be renewed", async () => {
    const { done } = await connectAs("code-no-refresh");
    expect(done.status).toBe(400);
    expect(kv.read("usage:connection")).toBeUndefined();
  });

  it("takes the account from HOME_ACCOUNT_ID when the deployment names it", async () => {
    cloudflare();
    const visitor = browser(() => env({ HOME_ACCOUNT_ID: OTHER, CF_VERSION_METADATA: undefined }));
    const done = await finishWith(visitor, await visitor.start(), "code-grant");

    expect(done.status).toBe(303);
    expect(kv.read<Connection>("usage:connection")?.home).toBe(OTHER);
  });

  it("keeps sessions and agents when the owner connects again, and gives the old grant back", async () => {
    await new Store(kv.kv).saveConnection(connection({ broken: true }));
    const cf = cloudflare();
    const visitor = browser();
    const toFind = await visitor.start({ again: "1" });
    expect(scopeOf(toFind)).toContain("account-settings.read");

    const done = await finishWith(visitor, toFind, "code-grant");

    expect(done.status).toBe(303);
    expect(kv.read<Connection>("usage:connection")).toMatchObject({
      sessionKey: SESSION_KEY,
      refreshToken: "R-1",
      broken: false,
    });
    expect(cf.revoked).toEqual(["A-find", "R-0"]);
  });

  it("will not move a connected page to another account", async () => {
    await new Store(kv.kv).saveConnection(connection({ home: OTHER }));
    cloudflare();
    const visitor = browser();
    const toFind = await visitor.start({ again: "1" });
    const answer = await finishWith(visitor, toFind, "code-grant");

    expect(answer.status).toBe(403);
    expect(kv.read<Connection>("usage:connection")?.home).toBe(OTHER);
    expect(kv.read<Connection>("usage:connection")?.refreshToken).toBe("R-0");
  });
});

describe("an answer that is not this browser's", () => {
  it("is refused when the browser never started, or the answer names another attempt", async () => {
    cloudflare();
    const visitor = browser();
    const leaving = await visitor.start();

    const stranger = browser();
    expect((await stranger.comeBack(leaving, { code: "code-find" })).status).toBe(400);

    const other = await browser().start();
    const mixed = await visitor.comeBack(other, { code: "code-find" });
    expect(mixed.status).toBe(400);
    expect(await mixed.text()).toContain("Sign-in did not finish");
    expect(kv.keys()).toEqual([]);
  });

  it("is refused when it was made for another address", async () => {
    cloudflare();
    const visitor = browser();
    await visitor.start();
    const elsewhere = Buffer.from(JSON.stringify({ v: 1, o: "https://other.example", n: "n".repeat(22) })).toString("base64url");
    const answer = await visitor.send("/connect/return", {
      method: "POST",
      body: new URLSearchParams({ state: elsewhere, code: "code-find" }),
      headers: { "content-type": "application/x-www-form-urlencoded", origin: RELAY },
    });
    expect(answer.status).toBe(400);
  });

  it("says so when access was not granted, without asking Cloudflare anything", async () => {
    const cf = cloudflare();
    const visitor = browser();
    const answer = await visitor.comeBack(await visitor.start(), { error: "access_denied" });

    expect(answer.status).toBe(400);
    expect(await answer.text()).toContain("Access was not granted");
    expect(cf.calls).toEqual([]);
    expect(visitor.jar.has("__Host-usage-connect")).toBe(false);
  });

  it("says so when Cloudflare refuses the code", async () => {
    cloudflare();
    const visitor = browser();
    const answer = await visitor.comeBack(await visitor.start(), { code: "code-nobody-issued" });
    expect(answer.status).toBe(400);
    expect(kv.keys()).toEqual([]);
  });
});

describe("signing in to a connected page", () => {
  beforeEach(async () => {
    await new Store(kv.kv).saveConnection(connection());
  });

  it("asks Cloudflare once, lets in a login that reads the home account, and keeps nothing", async () => {
    const cf = cloudflare();
    const visitor = browser();
    const leaving = await visitor.start({ next: "/authorize?x=1" });
    expect(scopeOf(leaving)).toEqual(["account-analytics.read"]);

    const done = await visitor.comeBack(leaving, { code: "code-signin" });
    await visitor.settled();

    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe("/authorize?x=1");
    expect(visitor.jar.has("__Host-usage-session")).toBe(true);
    expect(cf.revoked).toEqual(["A-signin"]);
    expect(kv.read<Connection>("usage:connection")?.refreshToken).toBe("R-0");
    expect((await visitor.send("/")).status).toBe(200);
  });

  it("turns away a login that cannot read the home account", async () => {
    const cf = cloudflare();
    const visitor = browser();
    const answer = await visitor.comeBack(await visitor.start(), { code: "code-stranger" });
    await visitor.settled();

    expect(answer.status).toBe(403);
    expect(visitor.jar.has("__Host-usage-session")).toBe(false);
    expect(cf.revoked).toEqual(["A-stranger"]);
    expect((await visitor.send("/")).status).toBe(302);
  });

  it("shows the sign-in page to a visitor and passes a signed-in owner through", async () => {
    const page = await browser().send("/signin");
    expect(await page.text()).toContain("Sign in with Cloudflare");

    const cookie = `__Host-usage-session=${await issueSession(SESSION_KEY, Date.now())}`;
    const owner = await browser().send("/signin?next=/%3Faccount%3DAcme", { headers: { cookie } });
    expect(owner.status).toBe(302);
    expect(owner.headers.get("location")).toBe("/?account=Acme");

    const again = await browser().send("/signin?again=1", { headers: { cookie } });
    expect(await again.text()).toContain("Reconnect Cloudflare");
  });

  it("keeps an owner who comes back signed in, without renewing a session made today", async () => {
    const day = 86_400_000;
    const old = `__Host-usage-session=${await issueSession(SESSION_KEY, Date.now() - 2 * day)}`;
    const visit = await browser().send("/api/state", { headers: { cookie: old } });
    const renewed = visit.headers.getSetCookie().find((entry) => entry.startsWith("__Host-usage-session="));
    expect(visit.status).toBe(200);
    expect(renewed).toMatch(/Max-Age=2592000/);
    expect(renewed).not.toContain(old);

    const fresh = `__Host-usage-session=${await issueSession(SESSION_KEY, Date.now())}`;
    const again = await browser().send("/api/state", { headers: { cookie: fresh } });
    expect(again.headers.getSetCookie()).toEqual([]);

    // Other calls leave the session as it is, and a signed-out caller gets nothing.
    const other = await browser().send("/api/v1/usage", { headers: { cookie: old } });
    expect(other.headers.getSetCookie()).toEqual([]);
    expect((await browser().send("/api/state")).headers.getSetCookie()).toEqual([]);
  });

  it("tells the page when the owner has to connect again", async () => {
    await new Store(kv.kv).saveConnection(connection({ broken: true }));
    const cookie = `__Host-usage-session=${await issueSession(SESSION_KEY, Date.now())}`;
    const state = await browser().send("/api/state", { headers: { cookie } });
    expect(await state.json()).toMatchObject({ reconnect: true });
  });

  it("has no key for a script to send unless the deployment set one", async () => {
    const headers = { authorization: "Bearer a-long-enough-access-key" };
    expect((await browser().send("/api/v1/usage", { headers })).status).toBe(401);

    const withKey = browser(() => env({ ACCESS_KEY: "a-long-enough-access-key" }));
    expect((await withKey.send("/api/v1/usage", { headers })).status).toBe(200);
  });
});

describe("keeping the grant usable", () => {
  const renewed = { access_token: "A-new", refresh_token: "R-new", expires_in: 3600, token_type: "bearer" };

  it("uses the stored access token while it has time left, without asking Cloudflare", async () => {
    const cf = cloudflare();
    const store = new Store(kv.kv);
    await store.saveConnection(connection());
    expect(await accessTokenOf(store, Date.now())).toBe("A-stored");
    expect(cf.calls).toEqual([]);
  });

  it("renews one that is about to run out, and keeps the refresh token Cloudflare hands back", async () => {
    cloudflare({ ...WORLD, refresh: (token) => (token === "R-0" ? Response.json(renewed) : new Response(null, { status: 500 })) });
    const store = new Store(kv.kv);
    const nowMs = Date.now();
    await store.saveConnection(connection({ accessExpiresAt: nowMs + 60_000 }));

    expect(await accessTokenOf(store, nowMs)).toBe("A-new");
    expect(await store.connection()).toMatchObject({
      accessToken: "A-new",
      refreshToken: "R-new",
      accessExpiresAt: nowMs + 3_600_000,
    });
  });

  it("marks the connection broken when Cloudflare says the grant is gone", async () => {
    cloudflare();
    const store = new Store(kv.kv);
    await store.saveConnection(connection({ accessExpiresAt: 0 }));

    await expect(accessTokenOf(store, Date.now())).rejects.toBeInstanceOf(ReconnectNeeded);
    expect((await store.connection())?.broken).toBe(true);
    await expect(accessTokenOf(store, Date.now())).rejects.toBeInstanceOf(ReconnectNeeded);
  });

  it("leaves the connection alone when Cloudflare is only unreachable", async () => {
    cloudflare({ ...WORLD, refresh: () => new Response("bad gateway", { status: 502 }) });
    const store = new Store(kv.kv);
    await store.saveConnection(connection({ accessExpiresAt: 0 }));

    await expect(accessTokenOf(store, Date.now())).rejects.not.toBeInstanceOf(ReconnectNeeded);
    expect((await store.connection())?.broken).toBe(false);
  });

  it("does not overwrite a connection made while it was renewing", async () => {
    const store = new Store(kv.kv);
    const fresh = connection({ connectedAt: "2026-10-09T00:00:00.000Z", accessToken: "A-reconnected", refreshToken: "R-9" });
    cloudflare({
      ...WORLD,
      refresh: () => {
        // The owner connects again while Cloudflare is answering the old grant's renewal.
        void store.saveConnection(fresh);
        return Response.json(renewed);
      },
    });
    await store.saveConnection(connection({ accessExpiresAt: 0 }));

    expect(await accessTokenOf(store, Date.now())).toBe("A-reconnected");
    expect((await store.connection())?.refreshToken).toBe("R-9");
  });
});

describe("recognising the account this Worker runs in", () => {
  const nowMs = Date.parse("2026-10-10T00:00:00Z");

  it("tells a run of this version from an account without one, and from an account it cannot read", async () => {
    cloudflare();
    expect(await sightingOf("A-grant", HOME, VERSION, nowMs)).toBe("yes");
    expect(await sightingOf("A-grant", OTHER, VERSION, nowMs)).toBe("no");
    expect(await sightingOf("A-grant", HIDDEN, VERSION, nowMs)).toBe("unreadable");
    expect(await canRead("A-grant", OTHER, nowMs)).toBe(true);
    expect(await canRead("A-grant", HIDDEN, nowMs)).toBe(false);
  });

  it("is unreadable when Cloudflare does not answer or answers something else", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>", { status: 200 }));
    expect(await sightingOf("A-grant", HOME, VERSION, nowMs)).toBe("unreadable");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network");
    });
    expect(await sightingOf("A-grant", HOME, VERSION, nowMs)).toBe("unreadable");
  });

  it("goes by the version, or by the named account when there is one", async () => {
    cloudflare();
    const versioned = { CF_VERSION_METADATA: { id: VERSION } };
    expect(await isHome(versioned, "A-grant", HOME, nowMs)).toBe(true);
    expect(await isHome(versioned, "A-grant", OTHER, nowMs)).toBe(false);
    expect(await homeAmong(versioned, "A-grant", [OTHER, HOME], nowMs)).toBe(HOME);
    expect(await homeAmong(versioned, "A-stranger", [OTHER], nowMs)).toBeNull();

    const named = { HOME_ACCOUNT_ID: OTHER };
    expect(await isHome(named, "A-grant", OTHER, nowMs)).toBe(true);
    expect(await isHome(named, "A-grant", HOME, nowMs)).toBe(false);
    // Naming an account is no use to a login that cannot read it.
    expect(await isHome({ HOME_ACCOUNT_ID: HIDDEN }, "A-grant", HIDDEN, nowMs)).toBe(false);
  });

  it("recognises nothing without a version or a named account", async () => {
    cloudflare();
    expect(await isHome({}, "A-grant", HOME, nowMs)).toBe(false);
    expect(await isHome({ CF_VERSION_METADATA: { id: "" } }, "A-grant", HOME, nowMs)).toBe(false);
  });
});
