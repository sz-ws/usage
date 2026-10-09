import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTHORIZE_URL,
  OAuthError,
  REVOKE_URL,
  SCOPE_ANALYTICS,
  SCOPE_OFFLINE,
  SCOPE_SETTINGS,
  TOKEN_URL,
  authorizationUrl,
  createPkce,
  decodeState,
  encodeState,
  exchangeCode,
  isReturnOrigin,
  pkceChallenge,
  randomNonce,
  refreshTokens,
  revokeToken,
  type FetchLike,
} from "../worker/cloudflare-oauth";
import { fakeFetch } from "./helpers";

const CLIENT_ID = "0f6c2b1e5d7a4c3b9e8f";
const REDIRECT_URI = "https://usage.example.com/oauth/callback";
const ORIGIN = "https://usage.example.workers.dev";
const NONCE = "q3J5uV0cX8mZ1aB7dE9fGw";
const NOW = Date.parse("2026-10-10T08:00:00Z");
const HOUR_MS = 3_600_000;

/** RFC 7636, appendix B. */
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

/** Written differently by every encoding, so that an echo in any of them shows. */
const CODE = "code/4 Ab+x=y&z";
const VERIFIER = "verifier~1/2 3+4=5&6";
const REFRESH_TOKEN = "refresh/1 2+3=4&5";

const ALL_SCOPES = [SCOPE_ANALYTICS, SCOPE_SETTINGS, SCOPE_OFFLINE];
const GRANTED = {
  access_token: "access-1",
  expires_in: 3600,
  token_type: "bearer",
  scope: ALL_SCOPES.join(" "),
  refresh_token: "refresh-2",
};

/** The three things an error can ask for. */
const SIGN_IN_AGAIN = { reconnectNeeded: true, retryable: false };
const TRY_AGAIN = { reconnectNeeded: false, retryable: true };
const NEITHER = { reconnectNeeded: false, retryable: false };

type Answer = () => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** An OAuth error as Cloudflare sends it. */
function refusal(error: string, status = 400, description?: unknown): Response {
  return json({ error, error_description: description }, status);
}

/** Cloudflare's token endpoint, answering every request the same way. */
function tokenEndpoint(answer: Answer) {
  return fakeFetch({ [TOKEN_URL]: answer });
}

function exchange(fetcher?: FetchLike, now?: () => number) {
  const sent = { clientId: CLIENT_ID, code: CODE, verifier: VERIFIER, redirectUri: REDIRECT_URI };
  return exchangeCode({ ...sent, fetch: fetcher, now });
}

function refresh(fetcher?: FetchLike, now?: () => number) {
  return refreshTokens({ clientId: CLIENT_ID, refreshToken: REFRESH_TOKEN, fetch: fetcher, now });
}

function revoke(fetcher?: FetchLike) {
  return revokeToken({ clientId: CLIENT_ID, token: REFRESH_TOKEN, fetch: fetcher });
}

/** The error a request ends in. Anything else, a success included, fails the test. */
async function failure(attempt: Promise<unknown>): Promise<OAuthError> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof OAuthError) return error;
    throw error;
  }
  throw new Error("the request was expected to fail");
}

function failedExchange(answer: Answer): Promise<OAuthError> {
  return failure(exchange(tokenEndpoint(answer).fetcher, () => NOW));
}

function failedRefresh(answer: Answer): Promise<OAuthError> {
  return failure(refresh(tokenEndpoint(answer).fetcher, () => NOW));
}

/** The fields of the form a request carried. */
async function formOf(request: Request): Promise<Record<string, string>> {
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A `state` as it would arrive, made from any text, to try what is turned away. */
function stateOf(text: string): string {
  return base64Url(new TextEncoder().encode(text));
}

function textOf(state: string): string {
  return atob(state.replace(/-/g, "+").replace(/_/g, "/"));
}

/** The longest origin there is room for: 255 characters. */
const LONG_LABELS = `${"a".repeat(63)}.`.repeat(3);
const LONGEST_ORIGIN = `https://${LONG_LABELS}${"b".repeat(51)}.com`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a PKCE pair", () => {
  it("has the challenge RFC 7636 gives for its own example", async () => {
    expect(await pkceChallenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it("is a new 43-character verifier and the challenge made from it", async () => {
    const pkce = await createPkce();
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).toBe(await pkceChallenge(pkce.verifier));
    expect((await createPkce()).verifier).not.toBe(pkce.verifier);
  });

  it("comes with a nonce of 22 characters, different every time", () => {
    const nonce = randomNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomNonce()).not.toBe(nonce);
  });
});

describe("an origin a sign-in may return to", () => {
  it("is a bare https origin, or http on this machine", () => {
    for (const value of [
      ORIGIN,
      "https://usage.example.com:8443",
      "https://xn--bcher-kva.example",
      "http://localhost",
      "http://localhost:8787",
      "http://127.0.0.1:8787",
    ]) {
      expect(isReturnOrigin(value), value).toBe(true);
    }
  });

  it("is nothing with more than an origin in it, and nothing over plain http elsewhere", () => {
    for (const value of [
      "",
      "usage.example.com",
      "null",
      `${ORIGIN}/`,
      `${ORIGIN}/callback`,
      `${ORIGIN}?next=1`,
      `${ORIGIN}#top`,
      "https://owner:secret@usage.example.com",
      "https://owner@usage.example.com",
      "https://USAGE.example.com",
      "https://usage.example.com:443",
      "https://bücher.example",
      "http://usage.example.com",
      "http://192.168.1.10:8787",
      "http://0.0.0.0:8787",
      "http://[::1]:8787",
      "http://localhost.example.com",
      "http://127.0.0.1.example.com",
      "ftp://usage.example.com",
      "blob:https://usage.example.com/1",
      "javascript:alert(1)",
    ]) {
      expect(isReturnOrigin(value), value).toBe(false);
    }
  });

  it("is at most 255 characters", () => {
    expect(LONGEST_ORIGIN).toHaveLength(255);
    expect(isReturnOrigin(LONGEST_ORIGIN)).toBe(true);
    expect(isReturnOrigin(`https://${LONG_LABELS}${"b".repeat(52)}.com`)).toBe(false);
  });
});

describe("the state sent through Cloudflare", () => {
  const written = JSON.stringify({ v: 1, o: ORIGIN, n: NONCE });

  it("is base64url of the JSON, without padding, and reads back as it was written", () => {
    const state = encodeState({ o: ORIGIN, n: NONCE });
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(textOf(state)).toBe(`{"v":1,"o":"${ORIGIN}","n":"${NONCE}"}`);
    expect(decodeState(state)).toEqual({ o: ORIGIN, n: NONCE });
  });

  it("has room for the longest origin and the longest nonce", () => {
    const state = encodeState({ o: LONGEST_ORIGIN, n: "n".repeat(64) });
    expect(state).toHaveLength(454);
    expect(decodeState(state)).toEqual({ o: LONGEST_ORIGIN, n: "n".repeat(64) });
  });

  it("is not written from an origin or a nonce that would not be read back", () => {
    expect(() => encodeState({ o: `${ORIGIN}/`, n: NONCE })).toThrow(TypeError);
    expect(() => encodeState({ o: "http://usage.example.com", n: NONCE })).toThrow(TypeError);
    expect(() => encodeState({ o: ORIGIN, n: "short" })).toThrow(TypeError);
  });

  it("gives back the origin and the nonce, and nothing else that was in it", () => {
    const state = stateOf(JSON.stringify({ v: 1, o: ORIGIN, n: NONCE, extra: true }));
    expect(decodeState(state)).toEqual({ o: ORIGIN, n: NONCE });
  });

  it("takes a nonce of 16 to 64 characters", () => {
    for (const n of ["a".repeat(16), "_-".repeat(32)]) {
      expect(decodeState(stateOf(JSON.stringify({ v: 1, o: ORIGIN, n }))), n).toEqual({ o: ORIGIN, n });
      expect(decodeState(encodeState({ o: ORIGIN, n })), n).toEqual({ o: ORIGIN, n });
    }
  });

  it("is turned away when it is not one that was made here", () => {
    const turnedAway: Record<string, unknown> = {
      "another version": { v: 2, o: ORIGIN, n: NONCE },
      "the version as text": { v: "1", o: ORIGIN, n: NONCE },
      "no version": { o: ORIGIN, n: NONCE },
      "a nonce too short": { v: 1, o: ORIGIN, n: "a".repeat(15) },
      "a nonce too long": { v: 1, o: ORIGIN, n: "a".repeat(65) },
      "a nonce in other characters": { v: 1, o: ORIGIN, n: "sixteen chars + more" },
      "no nonce": { v: 1, o: ORIGIN },
      "an origin with a path": { v: 1, o: `${ORIGIN}/callback`, n: NONCE },
      "an origin with a trailing slash": { v: 1, o: `${ORIGIN}/`, n: NONCE },
      "an origin that is not an address": { v: 1, o: "usage", n: NONCE },
      "an origin that is not text": { v: 1, o: 7, n: NONCE },
      "no origin": { v: 1, n: NONCE },
      "plain http away from this machine": { v: 1, o: "http://usage.example.com", n: NONCE },
      "credentials in the origin": { v: 1, o: "https://owner:secret@usage.example.com", n: NONCE },
      "a list": [1, ORIGIN, NONCE],
      "nothing at all": null,
    };
    for (const [what, value] of Object.entries(turnedAway)) {
      expect(decodeState(stateOf(JSON.stringify(value))), what).toBeNull();
    }
  });

  it("is turned away when it is not base64url of JSON", () => {
    const state = stateOf(written);
    const encoder = new TextEncoder();
    // A good state but for one byte, in a field that is not looked at, that is not UTF-8.
    const badText = [...encoder.encode(`${written.slice(0, -1)},"x":"`), 0xff, ...encoder.encode('"}')];
    for (const value of [
      "",
      "not base64url!",
      `${state}=`,
      `${state.slice(0, 10)}+${state.slice(10)}`,
      `${state.slice(0, 10)}/${state.slice(10)}`,
      // One character more than a whole number of bytes.
      `${state.slice(0, 40)}A`,
      stateOf("not json"),
      stateOf(written.slice(0, -1)),
      base64Url(new Uint8Array(badText)),
    ]) {
      expect(decodeState(value), value).toBeNull();
    }
  });

  it("is read up to 512 characters and no further", () => {
    // 384 bytes are 512 characters; JSON may end in spaces, so only the length differs.
    const fits = stateOf(written.padEnd(384, " "));
    const tooLong = stateOf(written.padEnd(385, " "));
    expect(fits).toHaveLength(512);
    expect(decodeState(fits)).toEqual({ o: ORIGIN, n: NONCE });
    expect(tooLong.length).toBeGreaterThan(512);
    expect(decodeState(tooLong)).toBeNull();
  });
});

describe("the address the owner is sent to", () => {
  it("is Cloudflare's, with the scopes separated by %20", () => {
    const state = encodeState({ o: ORIGIN, n: NONCE });
    const url = authorizationUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: ALL_SCOPES,
      state,
      challenge: RFC_CHALLENGE,
    });
    expect(url).toBe(
      "https://dash.cloudflare.com/oauth2/auth" +
        "?response_type=code" +
        `&client_id=${CLIENT_ID}` +
        "&redirect_uri=https%3A%2F%2Fusage.example.com%2Foauth%2Fcallback" +
        "&scope=account-analytics.read%20account-settings.read%20offline_access" +
        `&state=${state}` +
        `&code_challenge=${RFC_CHALLENGE}` +
        "&code_challenge_method=S256",
    );
    expect(url.startsWith(`${AUTHORIZE_URL}?`)).toBe(true);
    expect(url).not.toContain("+");
  });

  it("is not made without scopes, or from a scope that is empty or has a space in it", () => {
    const args = { clientId: CLIENT_ID, redirectUri: REDIRECT_URI, state: "state", challenge: "challenge" };
    const bad = [[], [""], [SCOPE_ANALYTICS, ""], ["account analytics"], ["tab\there"], [`${SCOPE_OFFLINE}\n`]];
    for (const scopes of bad) {
      expect(() => authorizationUrl({ ...args, scopes }), JSON.stringify(scopes)).toThrow(TypeError);
    }
  });
});

describe("exchanging the code", () => {
  it("posts the code and the verifier as a form, without following a redirect", async () => {
    const fake = tokenEndpoint(() => json(GRANTED));
    await exchange(fake.fetcher);

    expect(fake.calls).toHaveLength(1);
    const request = fake.calls[0]!;
    expect(request.url).toBe(TOKEN_URL);
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(request.headers.get("accept")).toBe("application/json");
    expect(request.headers.get("authorization")).toBeNull();
    expect(request.redirect).toBe("manual");
    expect(await formOf(request)).toEqual({
      grant_type: "authorization_code",
      code: CODE,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: VERIFIER,
    });
  });

  it("does not wait for an answer without end", async () => {
    let signal: AbortSignal | null | undefined;
    const watching: FetchLike = async (_input, init) => {
      signal = init?.signal;
      return json(GRANTED);
    };
    await exchange(watching);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the tokens, expiring an hour after the request was sent", async () => {
    let clock = NOW;
    const fake = tokenEndpoint(() => {
      // The answer takes five seconds; the hour is counted from before them.
      clock += 5_000;
      return json(GRANTED);
    });
    expect(await exchange(fake.fetcher, () => clock)).toEqual({
      accessToken: "access-1",
      expiresAt: NOW + HOUR_MS,
      refreshToken: "refresh-2",
      scopes: ALL_SCOPES,
    });
  });

  it("has no refresh token and no scopes when the answer leaves them out", async () => {
    const fake = tokenEndpoint(() => json({ access_token: "access-1", expires_in: 3600, token_type: "bearer" }));
    expect(await exchange(fake.fetcher, () => NOW)).toEqual({
      accessToken: "access-1",
      expiresAt: NOW + HOUR_MS,
      refreshToken: null,
      scopes: null,
    });
  });

  it("takes null the way it takes a field that is missing", async () => {
    const fake = tokenEndpoint(() => json({ ...GRANTED, refresh_token: null, scope: null }));
    expect(await exchange(fake.fetcher)).toMatchObject({ refreshToken: null, scopes: null });
  });

  it("takes an empty refresh token for none, and an empty scope for no scopes at all", async () => {
    const fake = tokenEndpoint(() => json({ ...GRANTED, refresh_token: "", scope: "" }));
    expect(await exchange(fake.fetcher)).toMatchObject({ refreshToken: null, scopes: [] });
  });

  it("splits the scopes on any whitespace", async () => {
    const fake = tokenEndpoint(() => json({ ...GRANTED, scope: " account-analytics.read\n offline_access  " }));
    expect((await exchange(fake.fetcher)).scopes).toEqual([SCOPE_ANALYTICS, SCOPE_OFFLINE]);
  });

  it("uses the Worker's own fetch and clock when it is given none", async () => {
    const fake = tokenEndpoint(() => json(GRANTED));
    vi.stubGlobal("fetch", fake.fetcher);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    expect((await exchange()).expiresAt).toBe(NOW + HOUR_MS);
    expect(fake.calls).toHaveLength(1);
  });
});

describe("renewing the tokens", () => {
  it("posts the refresh token and returns the pair that replaces it", async () => {
    let clock = NOW;
    const fake = tokenEndpoint(() => {
      clock += 5_000;
      return json({ ...GRANTED, access_token: "access-2", refresh_token: "refresh-3", expires_in: 1800 });
    });
    expect(await refresh(fake.fetcher, () => clock)).toEqual({
      accessToken: "access-2",
      expiresAt: NOW + HOUR_MS / 2,
      refreshToken: "refresh-3",
      scopes: ALL_SCOPES,
    });

    const request = fake.calls[0]!;
    expect(request.url).toBe(TOKEN_URL);
    expect(request.method).toBe("POST");
    expect(request.redirect).toBe("manual");
    expect(await formOf(request)).toEqual({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
    });
  });

  it("has no refresh token and no scopes when the answer leaves them out", async () => {
    const fake = tokenEndpoint(() => json({ access_token: "access-2", expires_in: 3600 }));
    expect(await refresh(fake.fetcher, () => NOW)).toEqual({
      accessToken: "access-2",
      expiresAt: NOW + HOUR_MS,
      refreshToken: null,
      scopes: null,
    });
  });
});

describe("a request that fails", () => {
  it("needs a new sign-in when the grant is gone", async () => {
    const description = "The authorization code is invalid or has expired.";
    const error = await failedExchange(() => refusal("invalid_grant", 400, description));
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("OAuthError");
    expect(error).toMatchObject({ operation: "exchange", code: "invalid_grant", status: 400, ...SIGN_IN_AGAIN });
    expect(error.message).toContain("HTTP 400");
    expect(error.message).toContain("invalid_grant");
    expect(error.message).toContain(description);
  });

  it("says which request it was", async () => {
    const error = await failedRefresh(() => refusal("invalid_grant"));
    expect(error).toMatchObject({ operation: "refresh", code: "invalid_grant", status: 400, ...SIGN_IN_AGAIN });
    expect(error.message).not.toBe((await failedExchange(() => refusal("invalid_grant"))).message);
  });

  it("is worth another try, not a new sign-in, when the status says the server is struggling", async () => {
    for (const status of [500, 502, 503, 429, 408]) {
      const error = await failedRefresh(() => refusal("invalid_grant", status));
      expect(error, String(status)).toMatchObject({ code: "invalid_grant", status, ...TRY_AGAIN });
    }
  });

  it("is worth another try when Cloudflare says so itself", async () => {
    for (const code of ["temporarily_unavailable", "server_error"]) {
      const error = await failedExchange(() => refusal(code));
      expect(error, code).toMatchObject({ code, status: 400, ...TRY_AGAIN });
    }
  });

  it("is neither when Cloudflare refuses the request itself", async () => {
    for (const [code, status] of [
      ["invalid_client", 401],
      ["invalid_request", 400],
      ["invalid_scope", 400],
      ["unauthorized_client", 400],
      ["unsupported_grant_type", 400],
      ["access_denied", 403],
    ] as const) {
      // Some servers send the description as null.
      const error = await failedExchange(() => refusal(code, status, null));
      expect(error, code).toMatchObject({ code, status, ...NEITHER });
    }
  });

  it("is an error even when the refusal comes with a 200", async () => {
    const error = await failedExchange(() => json({ ...GRANTED, error: "invalid_grant" }));
    expect(error).toMatchObject({ code: "invalid_grant", status: 200, ...SIGN_IN_AGAIN });
  });

  it("is worth another try when the answer is a page instead of JSON", async () => {
    const page = "<!doctype html><title>502 Bad Gateway</title><h1>error code: 502</h1>";
    for (const status of [502, 403, 302, 200]) {
      const error = await failedExchange(() => new Response(page, { status }));
      expect(error, String(status)).toMatchObject({ code: "invalid_response", status, ...TRY_AGAIN });
      expect(error.message).not.toContain("Bad Gateway");
    }
  });

  it("is worth another try when a 200 holds no tokens, and names the fields without their values", async () => {
    const body = { access_token: "", expires_in: "received-as-text", refresh_token: 12_345 };
    const error = await failedExchange(() => json(body));
    expect(error).toMatchObject({ code: "invalid_response", status: 200, ...TRY_AGAIN });
    for (const field of ["access_token", "expires_in", "refresh_token"]) expect(error.message).toContain(field);
    expect(error.message).not.toContain("received-as-text");
    expect(error.message).not.toContain("12345");

    const noLifetime = { access_token: "access-1", expires_in: 0 };
    for (const other of [{}, [], "text", null, noLifetime, { ...noLifetime, expires_in: -5 }]) {
      const error = await failedExchange(() => json(other));
      expect(error, JSON.stringify(other)).toMatchObject({ code: "invalid_response", ...TRY_AGAIN });
    }
  });

  it("does not take a token response for tokens when the status is not 2xx", async () => {
    const error = await failedExchange(() => json(GRANTED, 400));
    expect(error).toMatchObject({ code: "invalid_response", status: 400, ...TRY_AGAIN });
    expect(error.message).not.toContain("access-1");
  });

  it("is worth another try when no response arrives", async () => {
    const unreachable: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await failure(exchange(unreachable));
    expect(error).toMatchObject({ code: "network_error", status: null, ...TRY_AGAIN });
    expect(error.message).toContain("no response");
    expect(error.message).toContain("fetch failed");
    expect(error.cause).toBeUndefined();
  });

  it("is the same error when what was thrown is not an error at all", async () => {
    for (const thrown of ["down", null, Object.create(null) as unknown]) {
      const odd: FetchLike = async () => {
        throw thrown;
      };
      const error = await failure(refresh(odd));
      expect(error).toMatchObject({ operation: "refresh", code: "network_error", status: null, ...TRY_AGAIN });
    }
  });

  it("is worth another try when the answer breaks off after its first line", async () => {
    const body = () =>
      new ReadableStream({
        start(controller) {
          controller.error(new Error("connection lost"));
        },
      });
    // Not even a refusal can be read from it, so nothing is concluded about the grant.
    const error = await failedRefresh(() => new Response(body(), { status: 400 }));
    expect(error).toMatchObject({ code: "network_error", status: 400, ...TRY_AGAIN });
  });

  it("does not take an error code outside what OAuth allows", async () => {
    for (const code of ["", 'say "hello"', "back\\slash", "line\nbreak", "naïve", "x".repeat(101)]) {
      const error = await failedExchange(() => refusal(code));
      expect(error, code.slice(0, 20)).toMatchObject({ code: "invalid_response", status: 400, ...TRY_AGAIN });
      if (code.length > 0) expect(error.message).not.toContain(code);
    }
  });

  it("keeps Cloudflare's description to one line of 300 characters", async () => {
    const long = await failedExchange(() => refusal("invalid_request", 400, "x".repeat(1_000)));
    const description = long.message.slice(long.message.indexOf("): ") + 3);
    expect(description).toHaveLength(300);
    expect(description.startsWith("x".repeat(299))).toBe(true);

    // One that fits is passed on whole.
    const fits = await failedExchange(() => refusal("invalid_request", 400, "x".repeat(300)));
    expect(fits.message.endsWith(`): ${"x".repeat(300)}`)).toBe(true);

    const lines = await failedExchange(() => refusal("invalid_request", 400, "first line\r\n\tsecond\u0000line"));
    expect(lines.message.endsWith(": first line second line")).toBe(true);
  });

  it("works out the same answers for an error made by hand", () => {
    const made = (code: string, status: number | null) => new OAuthError({ operation: "refresh", code, status });
    expect(made("invalid_grant", 400)).toMatchObject(SIGN_IN_AGAIN);
    expect(made("invalid_grant", 503)).toMatchObject(TRY_AGAIN);
    expect(made("network_error", null)).toMatchObject(TRY_AGAIN);
    expect(made("invalid_response", 200)).toMatchObject(TRY_AGAIN);
    expect(made("invalid_client", 401)).toMatchObject(NEITHER);
  });
});

describe("what an error never repeats", () => {
  /** Every way a value could come back: as it is, percent-encoded in either case, and as the form wrote it. */
  function spellings(secret: string): string[] {
    const encoded = encodeURIComponent(secret);
    return [
      secret,
      encoded,
      encoded.replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase()),
      new URLSearchParams({ s: secret }).toString().slice("s=".length),
    ];
  }

  /** Everything an error shows of itself: as a string, its message, as JSON, and every property it owns. */
  function shown(error: OAuthError): string {
    const values = error as unknown as Record<string, unknown>;
    const owned = Object.fromEntries(Object.getOwnPropertyNames(error).map((name) => [name, values[name]]));
    return [String(error), error.message, JSON.stringify(error), JSON.stringify(owned)].join("\n");
  }

  function expectNone(error: OAuthError, secrets: readonly string[]): void {
    const text = shown(error);
    for (const spelling of secrets.flatMap(spellings)) expect(text, spelling).not.toContain(spelling);
    expect(error.cause).toBeUndefined();
  }

  it("is tried here in four spellings that all differ", () => {
    for (const secret of [CODE, VERIFIER, REFRESH_TOKEN]) expect(new Set(spellings(secret)).size, secret).toBe(4);
  });

  it("is the code or the verifier, when Cloudflare repeats them in its description", async () => {
    for (const spelling of [CODE, VERIFIER].flatMap(spellings)) {
      const error = await failedExchange(() => refusal("invalid_grant", 400, `Already used: ${spelling}.`));
      expect(error, spelling).toMatchObject({ code: "invalid_grant", status: 400, ...SIGN_IN_AGAIN });
      expectNone(error, [CODE, VERIFIER]);
    }
  });

  it("is the refresh token, when Cloudflare repeats it in its description", async () => {
    for (const spelling of spellings(REFRESH_TOKEN)) {
      const error = await failedRefresh(() => refusal("invalid_grant", 400, `refresh_token=${spelling} is not active`));
      expect(error, spelling).toMatchObject({ operation: "refresh", code: "invalid_grant", ...SIGN_IN_AGAIN });
      expectNone(error, [REFRESH_TOKEN]);
    }
  });

  it("is what was sent, when it comes back as the error code itself", async () => {
    for (const spelling of [CODE, VERIFIER].flatMap(spellings)) {
      const error = await failedExchange(() => refusal(`unknown ${spelling}`, 400, "no such grant"));
      expect(error, spelling).toMatchObject({ code: "invalid_response", status: 400, ...TRY_AGAIN });
      expectNone(error, [CODE, VERIFIER]);
    }
    for (const spelling of spellings(REFRESH_TOKEN)) {
      const error = await failedRefresh(() => refusal(spelling));
      expect(error, spelling).toMatchObject({ code: "invalid_response", status: 400, ...TRY_AGAIN });
      expectNone(error, [REFRESH_TOKEN]);
    }
  });

  it("is what was sent, when Cloudflare lays it out over lines or with wider spaces", async () => {
    // Made one line, the description would hold the code exactly as it was sent.
    for (const gap of ["\n", "\r\n", "\t", "  "]) {
      const description = `Already used: ${CODE.replace(" ", gap)}.`;
      const error = await failedExchange(() => refusal("invalid_grant", 400, description));
      expect(error, JSON.stringify(gap)).toMatchObject(SIGN_IN_AGAIN);
      expectNone(error, [CODE, VERIFIER]);
    }
  });

  it("is what was sent, when only some of it is percent-encoded", async () => {
    // The space escaped and the plus left alone: neither a URL's spelling nor a form's.
    const echo = encodeURIComponent(REFRESH_TOKEN).replace(/%2B/g, "+");
    const error = await failedRefresh(() => refusal("invalid_grant", 400, `refresh_token=${echo}`));
    expect(error).toMatchObject(SIGN_IN_AGAIN);
    expect(shown(error)).not.toContain(echo);
  });

  it("is what was sent, when it is percent-encoded behind bytes that are not text", async () => {
    // "%FF" joins the escapes that follow it; read strictly, the whole run would stay unread.
    const description = "bad token %FF%2fstarts%2Bwith%20a%20slash";
    const fake = tokenEndpoint(() => refusal("invalid_grant", 400, description));
    const sent = { clientId: CLIENT_ID, refreshToken: "/starts+with a slash", fetch: fake.fetcher };
    const error = await failure(refreshTokens(sent));
    expect(error).toMatchObject(SIGN_IN_AGAIN);
    expect(shown(error)).not.toContain("starts");
  });

  it("is what was sent, when it has a percent sign or a run of spaces of its own", async () => {
    // Read as an escape, "%41" would no longer be what was sent; made one line, neither would the two spaces.
    for (const refreshToken of ["marked%41literal", "marked  twice\tover"]) {
      const fake = tokenEndpoint(() => refusal("invalid_grant", 400, `not active: ${refreshToken}`));
      const error = await failure(refreshTokens({ clientId: CLIENT_ID, refreshToken, fetch: fake.fetcher }));
      expect(error, refreshToken).toMatchObject(SIGN_IN_AGAIN);
      expect(shown(error), refreshToken).not.toContain("marked");
    }
  });

  it("is what was sent, when the failure to reach Cloudflare quotes the request", async () => {
    for (const spelling of [CODE, VERIFIER].flatMap(spellings)) {
      const quoting: FetchLike = async (_input, init) => {
        throw new Error(`could not send ${String(init?.body)} (${spelling})`);
      };
      const error = await failure(exchange(quoting));
      expect(error, spelling).toMatchObject({ code: "network_error", status: null, ...TRY_AGAIN });
      expectNone(error, [CODE, VERIFIER]);
    }
  });

  it("is what a broken token response held", async () => {
    const body = { access_token: 7, expires_in: 3600, refresh_token: "refresh-received", scope: ["a"] };
    const error = await failedExchange(() => json(body));
    expect(error.code).toBe("invalid_response");
    expect(shown(error)).not.toContain("refresh-received");
  });

  it("does not stop the errors OAuth names being read, however short the code a visitor brought", async () => {
    const exchangeOf = (code: string, answer: Answer) => {
      const sent = { clientId: CLIENT_ID, code, verifier: VERIFIER, redirectUri: REDIRECT_URI };
      return failure(exchangeCode({ ...sent, fetch: tokenEndpoint(answer).fetcher }));
    };
    for (const code of ["grant", "invalid_grant", "i"]) {
      const error = await exchangeOf(code, () => refusal("invalid_grant", 400, `No such code: ${code}.`));
      expect(error, code).toMatchObject({ code: "invalid_grant", status: 400, ...SIGN_IN_AGAIN });
      expect(error.message, code).not.toContain("No such code");
    }
    const denied = await exchangeOf("e", () => refusal("access_denied", 403));
    expect(denied).toMatchObject({ code: "access_denied", ...NEITHER });
    const struggling = await exchangeOf("e", () => refusal("server_error"));
    expect(struggling).toMatchObject({ code: "server_error", ...TRY_AGAIN });
  });
});

describe("revoking a token", () => {
  it("posts the token to Cloudflare and is true when it is taken", async () => {
    const fake = fakeFetch({ [REVOKE_URL]: () => new Response(null, { status: 200 }) });
    expect(await revoke(fake.fetcher)).toBe(true);

    expect(fake.calls).toHaveLength(1);
    const request = fake.calls[0]!;
    expect(request.url).toBe(REVOKE_URL);
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(request.redirect).toBe("manual");
    expect(await formOf(request)).toEqual({ token: REFRESH_TOKEN, client_id: CLIENT_ID });

    const noContent = fakeFetch({ [REVOKE_URL]: () => new Response(null, { status: 204 }) });
    expect(await revoke(noContent.fetcher)).toBe(true);
  });

  it("is false when Cloudflare answers anything but 2xx", async () => {
    for (const status of [302, 400, 401, 429, 500, 503]) {
      const fake = fakeFetch({ [REVOKE_URL]: () => refusal("invalid_client", status) });
      expect(await revoke(fake.fetcher), String(status)).toBe(false);
    }
  });

  it("is false, and does not throw, when Cloudflare cannot be reached", async () => {
    const rejecting: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    const throwing: FetchLike = () => {
      throw new Error("no network");
    };
    expect(await revoke(rejecting)).toBe(false);
    expect(await revoke(throwing)).toBe(false);
  });

  it("uses the Worker's own fetch when it is given none", async () => {
    const fake = fakeFetch({ [REVOKE_URL]: () => new Response(null, { status: 200 }) });
    vi.stubGlobal("fetch", fake.fetcher);
    expect(await revoke()).toBe(true);
    expect(fake.calls).toHaveLength(1);
  });
});
