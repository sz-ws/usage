import { z } from "zod";

/**
 * Signing in with Cloudflare: OAuth for a client that keeps no secret, the
 * authorization code flow with PKCE (S256) against dash.cloudflare.com.
 *
 * Only the protocol is here: the address the owner is sent to, the `state`
 * that travels there and back, and the three calls that trade a code for
 * tokens, renew them and revoke them. Nothing is stored and nothing is
 * routed.
 *
 * What is sent to Cloudflare (the code, the PKCE verifier, a refresh token) is
 * kept out of every error. When Cloudflare's answer repeats one of them, as it
 * was sent or the way a URL or a form writes it, the answer's words are left out.
 */

/** Where the owner's browser goes to grant access. */
export const AUTHORIZE_URL = "https://dash.cloudflare.com/oauth2/auth";
/** Trades a code for tokens, and a refresh token for the pair that replaces it. */
export const TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";
/** Revokes a token. */
export const REVOKE_URL = "https://dash.cloudflare.com/oauth2/revoke";

export const SCOPE_ANALYTICS = "account-analytics.read";
export const SCOPE_SETTINGS = "account-settings.read";
/** Without it Cloudflare issues no refresh token, and the sign-in ends with its first access token. */
export const SCOPE_OFFLINE = "offline_access";

/** `fetch`, narrowed to what is used here, so that a test can stand in for Cloudflare. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function randomBase64Url(byteLength: number): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The verifier stays here until the code is exchanged; the challenge goes out in the address. */
export interface Pkce {
  verifier: string;
  challenge: string;
}

/** The S256 challenge for a verifier: its SHA-256 as base64url, without padding. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
}

/** A new pair. 32 random bytes make a verifier of 43 characters, the shortest RFC 7636 takes. */
export async function createPkce(): Promise<Pkce> {
  const verifier = randomBase64Url(32);
  return { verifier, challenge: await pkceChallenge(verifier) };
}

/** 16 random bytes as 22 characters, for the `n` of a state. */
export function randomNonce(): string {
  return randomBase64Url(16);
}

/*
 * The state.
 *
 * `state` goes to Cloudflare and comes back untouched with the code. It is
 * base64url (no padding) of the JSON {"v":1,"o":"<origin>","n":"<nonce>"}:
 * `o` is the origin the sign-in returns to, `n` a nonce to hold against the
 * one kept where the sign-in started. Anyone can write a state, so reading one
 * proves nothing by itself; it only says where to look and what to compare.
 */

export interface OAuthState {
  o: string;
  n: string;
}

const STATE_VERSION = 1;
/** Above anything written here: the longest origin with the longest nonce comes to 454 characters. */
const MAX_STATE_LENGTH = 512;
const MAX_ORIGIN_LENGTH = 255;
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The hosts plain HTTP is taken from: this machine, where a development server
 * has no certificate. Not `[::1]`: the relay page's policy cannot name an IPv6
 * host, so its form could never post there.
 */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

/**
 * Whether `value` is an origin a code may be returned to: exactly an origin
 * (no path, query, fragment, credentials or trailing slash, written the way
 * `URL` writes it), over https, or over http on this machine.
 */
export function isReturnOrigin(value: string): boolean {
  if (value.length > MAX_ORIGIN_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.origin !== value) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

const stateSchema = z.object({
  v: z.literal(STATE_VERSION),
  o: z.string().refine(isReturnOrigin),
  n: z.string().regex(NONCE),
});

// The Workers types want both options written out; only `fatal` differs from what a decoder does unasked.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

/** The `state` parameter for a sign-in. Throws a `TypeError` for a state `decodeState` would not read back. */
export function encodeState(state: OAuthState): string {
  const written = { v: STATE_VERSION, o: state.o, n: state.n };
  if (!stateSchema.safeParse(written).success) {
    throw new TypeError("An OAuth state needs an origin to return to and a nonce of 16 to 64 base64url characters.");
  }
  return toBase64Url(encoder.encode(JSON.stringify(written)));
}

/**
 * Reads a `state` back as its origin and nonce. Null for anything that is not
 * base64url of such JSON, or is longer than 512 characters.
 */
export function decodeState(value: string): OAuthState | null {
  if (value.length > MAX_STATE_LENGTH) return null;
  const bytes = fromBase64Url(value);
  if (!bytes) return null;
  let text: string;
  try {
    text = utf8.decode(bytes);
  } catch {
    return null;
  }
  const parsed = stateSchema.safeParse(parseJson(text));
  return parsed.success ? { o: parsed.data.o, n: parsed.data.n } : null;
}

/**
 * The address that takes the owner to Cloudflare to grant access. The code
 * comes back to `redirectUri`, which has to be one the client registered,
 * character for character.
 */
export function authorizationUrl(args: {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
  challenge: string;
}): string {
  if (args.scopes.length === 0 || args.scopes.some((scope) => scope.length === 0 || /\s/.test(scope))) {
    throw new TypeError("OAuth scopes are a list of at least one name, none of them empty or with whitespace in it.");
  }
  const query: [string, string][] = [
    ["response_type", "code"],
    ["client_id", args.clientId],
    ["redirect_uri", args.redirectUri],
    ["scope", args.scopes.join(" ")],
    ["state", args.state],
    ["code_challenge", args.challenge],
    ["code_challenge_method", "S256"],
  ];
  // Not URLSearchParams: it would write the spaces between scopes as "+", and Cloudflare is sent "%20".
  return `${AUTHORIZE_URL}?${query.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("&")}`;
}

/*
 * Errors.
 */

export type OAuthOperation = "exchange" | "refresh";

const FAILED: Readonly<Record<OAuthOperation, string>> = {
  exchange: "Cloudflare sign-in could not be completed",
  refresh: "Cloudflare access could not be renewed",
};

/** `code` when no whole answer arrived: the request may or may not have reached Cloudflare. */
const NETWORK_ERROR = "network_error";
/** `code` when an answer arrived that was neither tokens nor an OAuth error. */
const INVALID_RESPONSE = "invalid_response";
/** The OAuth error for a grant that is gone: revoked, expired, or a code already used. */
const GRANT_GONE = "invalid_grant";

/** Codes that say "not now" where the others say "no". */
const PASSING_CODES: ReadonlySet<string> = new Set([
  NETWORK_ERROR,
  INVALID_RESPONSE,
  "temporarily_unavailable",
  "server_error",
]);

/** A status that says nothing lasting: the server failed, was busy or gave up waiting, or there was none. */
function isPassing(status: number | null): boolean {
  return status === null || status >= 500 || status === 429 || status === 408;
}

/**
 * A code exchange or a renewal that failed. The two flags say what to do next:
 *
 * - `reconnectNeeded`: the grant is gone and no retry brings it back; the
 *   owner has to sign in again. Only `invalid_grant` says so, and only on an
 *   answer whose status can be taken at its word.
 * - `retryable`: nothing final was said. No whole answer arrived, the status
 *   was 5xx, 429 or 408, Cloudflare asked for a later try, or the answer was
 *   something else than OAuth (a gateway or challenge page, tokens with a
 *   field missing). The grant may be as good as before.
 * - Neither: Cloudflare refused the request itself (`invalid_client`,
 *   `invalid_request`, `invalid_scope`, …), which points at the client id, the
 *   redirect URI or the scopes, not at the owner's grant.
 *
 * `description` goes into the message and must hold nothing that was sent.
 */
export class OAuthError extends Error {
  readonly operation: OAuthOperation;
  /** The OAuth `error`, or `network_error` / `invalid_response` when Cloudflare gave none. */
  readonly code: string;
  /** The HTTP status, or null when no response arrived. */
  readonly status: number | null;
  readonly reconnectNeeded: boolean;
  readonly retryable: boolean;

  constructor(failure: { operation: OAuthOperation; code: string; status: number | null; description?: string }) {
    const answer = failure.status === null ? "no response" : `HTTP ${failure.status}`;
    const detail = failure.description ? `: ${failure.description}` : "";
    super(`${FAILED[failure.operation]} (${answer}, ${failure.code})${detail}`);
    this.name = "OAuthError";
    this.operation = failure.operation;
    this.code = failure.code;
    this.status = failure.status;
    this.reconnectNeeded = failure.code === GRANT_GONE && !isPassing(failure.status);
    this.retryable = isPassing(failure.status) || PASSING_CODES.has(failure.code);
  }
}

const MAX_DESCRIPTION_LENGTH = 300;
const lenientUtf8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

/**
 * Percent-escapes read back as text, whatever the case of their digits. Bytes
 * that are not UTF-8 become U+FFFD and the reading goes on, so an odd byte in
 * front of a value does not keep the value from being recognised.
 */
function unescaped(text: string): string {
  return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) =>
    lenientUtf8.decode(Uint8Array.from(run.slice(1).split("%"), (hex) => Number.parseInt(hex, 16))),
  );
}

/**
 * Whether `text` repeats something that was sent: as it is, percent-encoded as
 * in a URL, or the way the form wrote it (where a space is "+").
 */
function repeats(text: string, secrets: readonly string[]): boolean {
  const readings = [text, unescaped(text), unescaped(text.replace(/\+/g, " "))];
  return secrets.some((secret) => secret.length > 0 && readings.some((reading) => reading.includes(secret)));
}

/**
 * Someone else's words made fit for an error message: one line of at most 300
 * characters, and left out altogether when they repeat something that was sent.
 */
function quotable(words: string, secrets: readonly string[]): string {
  const line = words.replace(/[\s\x00-\x1F\x7F]+/g, " ").trim();
  // Both are looked at: joining lines could put together what was apart.
  if (repeats(words, secrets) || repeats(line, secrets)) return "a description that repeated what was sent is left out";
  return line.length > MAX_DESCRIPTION_LENGTH ? `${line.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…` : line;
}

/*
 * The token endpoint.
 */

export interface Tokens {
  accessToken: string;
  /** When the access token stops working, in epoch milliseconds, counted from when the request was sent. */
  expiresAt: number;
  /** Null when the answer carried none, which after a code exchange means `offline_access` was not granted. */
  refreshToken: string | null;
  /** What was granted. Null when the answer does not say, which RFC 6749 (5.1) reads as "what was asked for". */
  scopes: string[] | null;
}

const REQUEST_TIMEOUT_MS = 10_000;

function postForm(fetcher: FetchLike | undefined, url: string, fields: Record<string, string>): Promise<Response> {
  const send: FetchLike = fetcher ?? ((input, init) => fetch(input, init));
  return send(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
    // Not followed: the form holds credentials, and they go to the address above or nowhere.
    // (Workers has no "error" mode; "manual" hands the redirect back instead of taking it.)
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().nullish(),
  scope: z.string().nullish(),
});

/**
 * Any body with an `error` string in it is a refusal. The description is taken
 * as whatever it is (some servers send null), so that a grant that is gone is
 * never mistaken for an answer that made no sense.
 */
const refusalSchema = z.object({ error: z.string(), error_description: z.unknown().optional() });

/** RFC 6749 (5.2): an `error` is printable ASCII without `"` and `\`. */
const OAUTH_ERROR = /^[\x20\x21\x23-\x5B\x5D-\x7E]{1,100}$/;

/**
 * The errors RFC 6749 names (4.1.2.1 and 5.2). They are taken as they are: a
 * code from a callback is whatever its visitor typed, and one that happens to
 * be part of "invalid_grant" must not turn that answer into another.
 */
const KNOWN_ERRORS: ReadonlySet<string> = new Set([
  "invalid_request",
  "invalid_client",
  GRANT_GONE,
  "unauthorized_client",
  "unsupported_grant_type",
  "unsupported_response_type",
  "invalid_scope",
  "access_denied",
  "server_error",
  "temporarily_unavailable",
]);

/** The refusal a body holds, as the code and the description of an error. Null when the body is not one. */
function refusalIn(body: unknown, secrets: readonly string[]): { code: string; description?: string } | null {
  const parsed = refusalSchema.safeParse(body);
  if (!parsed.success) return null;

  const { error, error_description: description } = parsed.data;
  // Any other `error` becomes the code and part of the message all the same, so it is held to the RFC's
  // characters and checked like a description.
  if (!KNOWN_ERRORS.has(error) && (!OAUTH_ERROR.test(error) || repeats(error, secrets))) {
    return { code: INVALID_RESPONSE, description: "the OAuth error code could not be used" };
  }
  return { code: error, description: typeof description === "string" ? quotable(description, secrets) : undefined };
}

/** The fields a token response got wrong, by name only: Zod's own words could repeat what was received. */
function invalidFields(issues: readonly { path: readonly PropertyKey[] }[]): string {
  const names = issues.map(({ path: [field] }) =>
    typeof field === "string" && Object.hasOwn(tokenSchema.shape, field) ? field : "body",
  );
  return [...new Set(names)].join(", ");
}

interface TokenRequest {
  operation: OAuthOperation;
  fields: Record<string, string>;
  /** The values among `fields` that no error may repeat. */
  secrets: readonly string[];
  fetch?: FetchLike;
  now?: () => number;
}

/** Cloudflare's whole answer to a form. When there is none, the error says so and is worth another try. */
async function answerTo(request: TokenRequest): Promise<{ status: number; ok: boolean; body: unknown }> {
  let status: number | null = null;
  try {
    const response = await postForm(request.fetch, TOKEN_URL, request.fields);
    status = response.status;
    return { status, ok: response.ok, body: parseJson(await response.text()) };
  } catch (error) {
    // Only an error's own words, checked like Cloudflare's. Its cause is not kept, in case it holds the request.
    // The status stays when the answer broke off after its first line; the code alone makes it worth another try.
    const description = error instanceof Error ? quotable(error.message, request.secrets) : undefined;
    throw new OAuthError({ operation: request.operation, code: NETWORK_ERROR, status, description });
  }
}

async function requestTokens(request: TokenRequest): Promise<Tokens> {
  const { operation, secrets } = request;
  // Read before sending, so that `expiresAt` is early by however long the answer took.
  const sentAt = (request.now ?? Date.now)();
  const { status, ok, body } = await answerTo(request);

  // A refusal counts whatever its status. RFC 6749 knows no 200 with an `error` in it; a server may send one anyway.
  const refusal = refusalIn(body, secrets);
  if (refusal) throw new OAuthError({ operation, status, ...refusal });

  const unusable = (description: string) => new OAuthError({ operation, status, code: INVALID_RESPONSE, description });
  // A gateway, rate-limit or challenge page. What it says is not passed on.
  if (!ok) throw unusable("the answer was not an OAuth error");
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) throw unusable(`the token response has no valid ${invalidFields(parsed.error.issues)}`);

  const granted = parsed.data;
  return {
    accessToken: granted.access_token,
    expiresAt: sentAt + granted.expires_in * 1000,
    // An empty one is none.
    refreshToken: granted.refresh_token || null,
    scopes: typeof granted.scope === "string" ? granted.scope.split(/\s+/).filter((scope) => scope.length > 0) : null,
  };
}

/**
 * Trades the code a callback received for tokens. `verifier` is the one whose
 * challenge went out in the authorization address, `redirectUri` the same one
 * as there. A code is taken once. Throws `OAuthError`.
 */
export function exchangeCode(args: {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri: string;
  fetch?: FetchLike;
  now?: () => number;
}): Promise<Tokens> {
  return requestTokens({
    operation: "exchange",
    fields: {
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: args.redirectUri,
      client_id: args.clientId,
      code_verifier: args.verifier,
    },
    secrets: [args.code, args.verifier],
    fetch: args.fetch,
    now: args.now,
  });
}

/**
 * Renews the access token of a grant. Throws `OAuthError`.
 *
 * Cloudflare replaces the refresh token every time: store the one returned
 * before using the access token, because the one sent may no longer work.
 * Should an answer carry none, `refreshToken` is null and the one sent is
 * still the one to keep (RFC 6749, section 6).
 */
export function refreshTokens(args: {
  clientId: string;
  refreshToken: string;
  fetch?: FetchLike;
  now?: () => number;
}): Promise<Tokens> {
  return requestTokens({
    operation: "refresh",
    fields: { grant_type: "refresh_token", refresh_token: args.refreshToken, client_id: args.clientId },
    secrets: [args.refreshToken],
    fetch: args.fetch,
    now: args.now,
  });
}

/**
 * Asks Cloudflare to revoke a token. Best effort: true when Cloudflare
 * answered 2xx, false for any other answer and for none. It never throws.
 */
export async function revokeToken(args: { clientId: string; token: string; fetch?: FetchLike }): Promise<boolean> {
  try {
    const response = await postForm(args.fetch, REVOKE_URL, { token: args.token, client_id: args.clientId });
    return response.ok;
  } catch {
    return false;
  }
}
