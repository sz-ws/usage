/**
 * Response helpers and the headers every response leaves with.
 */

/**
 * The page loads its own script, stylesheet and fonts and talks only to its own
 * API, so nothing else is allowed. React sets inline styles through the CSSOM,
 * which this policy does not restrict; there are no inline `style` attributes
 * or scripts in the built HTML or in the pages the Worker draws.
 *
 * Forms post back here. The one exception is the page that lets an agent
 * connect: its answer is a redirect to the agent's own address, and browsers
 * hold a form's redirects to `form-action` too, so that address is added for
 * that response alone.
 */
function contentSecurityPolicy(formTarget: string | null): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    formTarget ? `form-action 'self' ${formTarget}` : "form-action 'self'",
  ].join("; ");
}

/**
 * What `form-action` needs in order to allow a redirect to `address`: the
 * origin of a web address, or the scheme of an app's own (`cursor:`). Null when
 * the address is not one a policy can name.
 */
export function formTargetOf(address: string): string | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  // The URL parser lets `*` and `;` through in a host; a policy must not.
  if (url.protocol === "https:" || url.protocol === "http:") {
    return /^https?:\/\/[a-z0-9.[\]:-]+$/i.test(url.origin) ? url.origin : null;
  }
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) ? url.protocol : null;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-robots-tag": "noindex, nofollow",
};

/** How long the browser may keep a response. Anything that depends on who is asking is `none`. */
export type Keep = "none" | "day" | "forever";

const CACHE_CONTROL: Readonly<Record<Keep, string>> = {
  none: "private, no-store",
  day: "private, max-age=86400",
  forever: "private, max-age=31536000, immutable",
};

/** Static files that are the same for everyone. Their names say how long they stay valid. */
export function keepFor(pathname: string, status: number): Keep {
  // 304 counts: its headers replace the ones the browser stored with the file.
  if (status !== 200 && status !== 304) return "none";
  if (pathname.startsWith("/assets/")) return "forever";
  if (isOpenAsset(pathname)) return "day";
  return "none";
}

/** A copy of `response` carrying the security headers. Never `public`: what a response holds depends on who asked. */
export function secured(response: Response, keep: Keep = "none", formTarget: string | null = null): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set("content-security-policy", contentSecurityPolicy(formTarget));
  headers.set("cache-control", CACHE_CONTROL[keep]);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

/** 303 after a form post, so the browser fetches the next page with GET; 302 otherwise. */
export function redirect(location: string, status: 302 | 303 = 302): Response {
  return new Response(null, { status, headers: { location, "cache-control": "no-store" } });
}

/** Files the sign-in page needs before anyone has signed in. Nothing in them depends on the account. */
export function isOpenAsset(pathname: string): boolean {
  return pathname === "/door.css" || pathname === "/favicon.ico" || pathname.startsWith("/fonts/");
}

/**
 * Whether another site is making the visitor's browser fetch something here,
 * as opposed to the visitor arriving by a link or a redirect. Turned away
 * before anything else: it has no business with the page, and answering it
 * would tell the other site whether the visitor is signed in.
 */
export function isCrossSiteSubrequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== "same-site" && site !== "cross-site") return false;
  return request.headers.get("sec-fetch-mode") !== "navigate";
}

/**
 * Whether the visitor's own browser is opening this address as a page: typed,
 * bookmarked, or followed from a link anywhere. Whoever supplied the link sees
 * nothing of the answer, and it cannot be framed (see the headers above), so a
 * read may trust the session cookie here the way the page itself does.
 */
export function isTopLevelVisit(request: Request): boolean {
  return (
    request.method === "GET" &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.headers.get("sec-fetch-dest") === "document"
  );
}

/**
 * Whether an API call comes from somewhere other than this page. Reads are
 * harmless to another site (no CORS headers, so the answer is unreadable) but
 * are still turned away; writes must name this origin exactly.
 */
export function isForeignCall(request: Request, url: URL): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  if (request.method === "GET" || request.method === "HEAD") return false;
  return request.headers.get("origin") !== url.origin;
}

/**
 * Where to go after signing in: a path on this site, never an address someone
 * else supplied. Control characters are refused as well as `//` and `\`,
 * because a browser drops tabs and newlines from an address before reading it,
 * which turns `/<tab>/evil.example` into `//evil.example`.
 */
export function nextPath(value: string | null): string {
  if (!value || !/^\/(?![/\\])[^\u0000-\u001f\u007f\\]*$/.test(value)) return "/";
  return value;
}

/** The sign-in page, set to come back to `url` afterwards. */
export function signInAddress(url: URL, error?: string): string {
  const params = new URLSearchParams();
  const next = url.pathname === "/signin" ? nextPath(url.searchParams.get("next")) : nextPath(url.pathname + url.search);
  if (next !== "/") params.set("next", next);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/signin?${query}` : "/signin";
}

/**
 * What a caller is counted under. An IPv6 customer is usually handed a whole
 * /64, so counting single addresses would give them a fresh allowance for
 * every request; the first four groups stand for all of them.
 */
export function limitKeyOf(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head = "", tail = ""] = ip.split("::");
  const front = head.split(":").filter((group) => group.length > 0);
  const back = tail.split(":").filter((group) => group.length > 0);
  const groups = ip.includes("::")
    ? [...front, ...Array.from({ length: Math.max(0, 8 - front.length - back.length) }, () => "0"), ...back]
    : front;
  return groups
    .slice(0, 4)
    .map((group) => group.toLowerCase().replace(/^0+(?=.)/, ""))
    .join(":");
}

/**
 * Whether this caller has used up `limit`. Without the binding or an address
 * there is nothing to count with and nobody is turned away: that is local
 * development. The length of the access key, not this, is what makes guessing
 * it hopeless.
 */
export async function overLimit(limit: RateLimit | undefined, request: Request): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip");
  if (limit === undefined || ip === null) return false;
  return !(await limit.limit({ key: limitKeyOf(ip) })).success;
}

/** The hosts plain HTTP is expected on: a developer's own machine. */
export function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127(\.\d{1,3}){3}$/.test(hostname);
}
