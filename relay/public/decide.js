/*
 * What the callback page does with the address Cloudflare sent the browser to.
 * Nothing here touches the page, so test/relay.test.ts runs it as it is. The
 * Worker reads the same state with code of its own; the fixed states in that
 * test are what the two are held to.
 */

/** Where on a usage page the answer is posted. */
export const RETURN_PATH = "/connect/return";

export const MAX_STATE_LENGTH = 512;
export const MAX_ORIGIN_LENGTH = 255;
export const MAX_CODE_LENGTH = 2048;

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
/** RFC 6749 §4.1.2.1: printable ASCII without the double quote and the backslash. */
const OAUTH_ERROR = /^[\x20\x21\x23-\x5B\x5D-\x7E]{1,100}$/;
/**
 * The only hosts plain http is allowed on: a usage page under development.
 * Not `[::1]`: `form-action` cannot name an IPv6 host, so the post would be blocked.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** The text behind unpadded base64url, or null when it is not that or not UTF-8. */
function decodeBase64Url(value) {
  if (!BASE64URL.test(value)) return null;
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Whether `value` is an address the answer may be posted to: an origin written
 * exactly as the browser would write it, so what the reader checks on the page
 * is what the form is sent to. https, or http on this computer.
 */
export function isReturnOrigin(value) {
  if (typeof value !== "string" || value.length > MAX_ORIGIN_LENGTH) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Rules out a path, a query, a fragment, credentials, a trailing slash, a
  // default port, capitals in the host, and every scheme that has no origin.
  if (url.origin !== value) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
}

/**
 * The origin and the nonce a usage page put in `state`, or null when it is
 * anything but `{"v":1,"o":…,"n":…}`. Other members are left out, as the Worker
 * leaves them out.
 */
export function decodeState(state) {
  if (typeof state !== "string" || state.length > MAX_STATE_LENGTH) return null;
  const json = decodeBase64Url(state);
  if (json === null) return null;

  let value;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object") return null;

  // A list has none of the three, so the next line turns it away too.
  const { v, o, n } = value;
  if (v !== 1 || typeof n !== "string" || !NONCE.test(n) || !isReturnOrigin(o)) return null;
  return { o, n };
}

/** The one of `code` and `error` to pass on. Cloudflare sends one or the other; a code that can be used wins. */
function answerOf(query) {
  const code = query.get("code");
  if (code !== null && code.length >= 1 && code.length <= MAX_CODE_LENGTH) return { code };
  const error = query.get("error");
  if (error !== null && OAUTH_ERROR.test(error)) return { error };
  return null;
}

const PROBLEM = Object.freeze({ show: "problem" });

/**
 * What to show for the query Cloudflare sent (`location.search`): a problem,
 * or the address to confirm with the form that returns to it. `state` goes
 * back exactly as it arrived; `error_description` is never read.
 */
export function decide(search) {
  const query = new URLSearchParams(search);
  const state = query.get("state");
  const decoded = decodeState(state);
  if (decoded === null) return PROBLEM;

  const answer = answerOf(query);
  if (answer === null) return PROBLEM;

  return {
    show: "confirm",
    outcome: "code" in answer ? "approved" : "refused",
    origin: decoded.o,
    action: decoded.o + RETURN_PATH,
    fields: { ...answer, state },
  };
}
