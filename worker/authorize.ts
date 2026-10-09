import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";

import { isSignedIn, keyFingerprint } from "./access";
import type { Env } from "./env";
import { formTargetOf, html, isForeignCall, redirect, secured, signInAddress } from "./http";
import { consentPage, problemPage } from "./pages";
import type { PageText } from "./text";

/**
 * Letting an agent connect (the OAuth authorization endpoint).
 *
 * An MCP client sends the owner's browser here. Signed out, the owner signs in
 * first and comes back; nothing is looked up or stored for anyone else. The
 * library then checks the request, this page says who is asking and where
 * access will go, and the owner allows or denies it. Allowing issues the client
 * its own token, which can read usage and nothing else.
 */

/**
 * What a token carries to the MCP endpoint. A token an agent was granted holds
 * the fingerprint of the access key at the time; the key itself, sent as a
 * bearer token by a client that cannot open a browser, is checked on arrival.
 */
export type GrantProps = { via: "oauth"; key: string } | { via: "key" };

/** There is one person to grant access for. */
export const OWNER = "owner";
export const SCOPE = "usage:read";

/** A form this small has no business being larger. */
const MAX_FORM_BYTES = 8_192;

interface Visit {
  request: Request;
  url: URL;
  env: Env;
  /** What sessions are signed with and grants are tied to: the access key, or the key a Cloudflare sign-in left. */
  secret: string;
  text: PageText;
}

async function show(visit: Visit): Promise<Response> {
  const oauth = visit.env.OAUTH_PROVIDER;
  const oauthRequest = await oauth.parseAuthRequest(visit.request);
  // Described before anything is stored, so a client that cannot be looked up leaves nothing behind.
  const details = await oauth.describeConsent(oauthRequest);
  const consent = await oauth.beginConsent(oauthRequest);

  const page = html(consentPage(visit.text, { details, handle: consent.handle }));
  for (const [name, value] of consent.headers) page.headers.append(name, value);
  return secured(page, "none", formTargetOf(details.redirectUri));
}

async function decide(visit: Visit): Promise<Response> {
  const tooLarge = Number(visit.request.headers.get("content-length") ?? 0) > MAX_FORM_BYTES;
  if (tooLarge || isForeignCall(visit.request, visit.url)) {
    return secured(html(problemPage(visit.text, visit.text.problem.invalid), 403));
  }

  const oauth = visit.env.OAUTH_PROVIDER;
  const form = await visit.request.formData();
  const handle = String(form.get("handle") ?? "");

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(visit.request, handle);
    const response = redirect(denied.redirectTo);
    for (const [name, value] of denied.headers) response.headers.append(name, value);
    return secured(response);
  }

  // The request comes back from the library's storage, never from the form.
  const approved = await oauth.approveConsent(visit.request, handle, { scope: [SCOPE] });
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: OWNER,
    metadata: {},
    scope: [SCOPE],
    props: { via: "oauth", key: await keyFingerprint(visit.secret) } satisfies GrantProps,
  });

  const response = redirect(redirectTo);
  for (const [name, value] of approved.headers) response.headers.append(name, value);
  return secured(response);
}

export async function authorize(visit: Visit): Promise<Response> {
  const { request, url } = visit;
  if (request.method !== "GET" && request.method !== "POST") {
    return secured(new Response(null, { status: 405, headers: { allow: "GET, POST" } }));
  }

  // Before anything else: an anonymous visitor must not be able to make this
  // Worker fetch a client's metadata or write a consent record.
  if (!(await isSignedIn(request, visit.secret, Date.now()))) {
    return secured(redirect(signInAddress(url), request.method === "POST" ? 303 : 302));
  }

  try {
    return request.method === "GET" ? await show(visit) : await decide(visit);
  } catch (error) {
    // Shown here, never sent on to the client's address: any client may register
    // any address, so a redirect would let a crafted link bounce the owner off this site.
    if (error instanceof AuthorizationError) {
      console.warn("authorization refused", error.code, error.description);
      // Asking fails on a request that was never valid; answering fails on one that has run out.
      const reason = request.method === "GET" ? visit.text.problem.invalid : visit.text.problem.expired;
      return secured(html(problemPage(visit.text, reason), 400));
    }
    if (error instanceof CimdFetchError) {
      console.warn("client metadata could not be fetched", error.message);
      return secured(html(problemPage(visit.text, visit.text.problem.unverified), 400));
    }
    throw error;
  }
}
