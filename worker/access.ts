/**
 * Who is let in. There is one person, the owner, and one secret, `ACCESS_KEY`:
 * typed into the sign-in page it starts a browser session; sent as
 * `Authorization: Bearer …` it lets a script or an agent read without one.
 */

const encoder = new TextEncoder();

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

/**
 * Whether `presented` is the secret. Both sides are hashed first, so the
 * comparison always runs over 32 bytes and takes the same time whatever was sent.
 */
export async function sameSecret(presented: string, expected: string): Promise<boolean> {
  if (presented.length === 0 || expected.length === 0) return false;

  const [left, right] = await Promise.all([digest(presented), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/**
 * Stands for the access key without being it. Stored with each agent's grant,
 * so that changing the key disconnects every agent as well as every browser.
 */
export async function keyFingerprint(accessKey: string): Promise<string> {
  const bytes = await digest(`usage-grant:${accessKey}`);
  return [...bytes.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const BEARER = /^Bearer\s+(\S+)$/i;

export function bearerOf(authorization: string | null): string | null {
  return authorization?.match(BEARER)?.[1] ?? null;
}

/*
 * Browser sessions.
 *
 * A session is `v1.<expiry>.<signature>`, signed with a key made from the
 * access key, so there is nothing to store and changing the access key signs
 * every browser out. It cannot
 * be withdrawn one at a time; with a single owner there is no one to withdraw
 * it from but yourself. It lasts thirty days from the owner's last visit.
 */

export const SESSION_TTL_MS = 30 * 86_400_000;

const VERSION = "v1";

/**
 * `__Host-` makes the browser refuse the cookie unless it came from this exact
 * host over HTTPS, so nothing on a sibling subdomain can plant one. Plain HTTP
 * only happens on localhost, where browsers would drop a `Secure` cookie.
 */
function cookieName(secure: boolean): string {
  return secure ? "__Host-usage-session" : "usage-session";
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * The key sessions are signed with: the access key stretched through PBKDF2,
 * so that a cookie which leaked is a slow thing to test guesses against rather
 * than a fast one. The stretching costs tens of milliseconds, so it is done
 * once per isolate and remembered. (100,000 rounds is the most Workers allows.)
 */
const SIGNING_ROUNDS = 100_000;
const SIGNING_SALT = encoder.encode("usage-session-signing-key-v1");
const signingKeys = new Map<string, Promise<CryptoKey>>();

function signingKey(accessKey: string): Promise<CryptoKey> {
  const known = signingKeys.get(accessKey);
  if (known) return known;

  const derived = crypto.subtle
    .importKey("raw", encoder.encode(accessKey), "PBKDF2", false, ["deriveKey"])
    .then((material) =>
      crypto.subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt: SIGNING_SALT, iterations: SIGNING_ROUNDS },
        material,
        { name: "HMAC", hash: "SHA-256", length: 256 },
        false,
        ["sign", "verify"],
      ),
    );
  // One access key per deployment; the map only ever grows when the key changes.
  signingKeys.clear();
  signingKeys.set(accessKey, derived);
  return derived;
}

function signedPart(expiresAt: number): Uint8Array {
  return encoder.encode(`usage-session:${VERSION}:${expiresAt}`);
}

export async function issueSession(accessKey: string, nowMs: number): Promise<string> {
  const expiresAt = nowMs + SESSION_TTL_MS;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(accessKey), signedPart(expiresAt));
  return `${VERSION}.${expiresAt}.${toBase64Url(signature)}`;
}

export async function verifySession(session: string, accessKey: string, nowMs: number): Promise<boolean> {
  const [version, expiry, signature, ...rest] = session.split(".");
  if (version !== VERSION || !expiry || !signature || rest.length > 0) return false;
  if (!/^\d{1,16}$/.test(expiry)) return false;

  const expiresAt = Number(expiry);
  if (expiresAt <= nowMs) return false;

  const bytes = fromBase64Url(signature);
  if (!bytes) return false;
  return crypto.subtle.verify("HMAC", await signingKey(accessKey), bytes, signedPart(expiresAt));
}

export function sessionCookie(session: string, secure: boolean): string {
  const attributes = [`${cookieName(secure)}=${session}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  attributes.push(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearedCookie(secure: boolean): string {
  const attributes = [`${cookieName(secure)}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** The session a request carries, by exact cookie name. */
export function sessionOf(cookieHeader: string | null, secure: boolean): string | null {
  if (!cookieHeader) return null;
  const name = cookieName(secure);
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return null;
}

/** A session older than this is replaced on the owner's next visit. */
const RENEW_AFTER_MS = 86_400_000;

/**
 * The cookie for a fresh session, when the one the request carries has been in
 * use for a day or more; null otherwise. An owner who keeps coming back is
 * never signed out: only a browser left alone for the whole of the session's
 * life has to sign in again. Call it for a request already known to be signed in.
 */
export async function renewedSession(request: Request, accessKey: string, nowMs: number): Promise<string | null> {
  const secure = new URL(request.url).protocol === "https:";
  const expiresAt = Number(sessionOf(request.headers.get("cookie"), secure)?.split(".")[1]);
  if (!Number.isFinite(expiresAt) || expiresAt - nowMs > SESSION_TTL_MS - RENEW_AFTER_MS) return null;
  return sessionCookie(await issueSession(accessKey, nowMs), secure);
}

export async function isSignedIn(request: Request, accessKey: string, nowMs: number): Promise<boolean> {
  const secure = new URL(request.url).protocol === "https:";
  const session = sessionOf(request.headers.get("cookie"), secure);
  return session !== null && (await verifySession(session, accessKey, nowMs));
}
