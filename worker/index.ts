import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

import { sameSecret } from "./access";
import { app } from "./app";
import { SCOPE, type GrantProps } from "./authorize";
import { setupOf, type Env } from "./env";
import { isLoopback, overLimit } from "./http";
import { mcp } from "./mcp";
import { readerFor, refreshAll } from "./usage";

/**
 * The Worker's front door.
 *
 * Requests to /mcp carry a token; the OAuth provider checks it and hands the
 * request to the MCP server. It also answers the OAuth endpoints an MCP client
 * needs in order to get that token (/oauth/token, /oauth/register and the
 * /.well-known documents). Everything else goes to the app.
 */

const MCP_PATH = "/mcp";

/**
 * Tokens are issued for one address, and a Worker does not know its own until a
 * request arrives: it may be on workers.dev today and a custom domain tomorrow.
 * So there is one provider per origin it has been reached at.
 */
const providers = new Map<string, OAuthProvider<Env>>();
const MAX_ORIGINS = 8;

const REGISTRATION_TTL_SECONDS = 30 * 86_400;
const MAX_REGISTRATION_CHARS = 4_096;
const MAX_REDIRECT_ADDRESSES = 5;

function providerFor(origin: string): OAuthProvider<Env> {
  const existing = providers.get(origin);
  if (existing) return existing;

  const resource = `${origin}${MCP_PATH}`;
  const provider = new OAuthProvider<Env>({
    apiRoute: MCP_PATH,
    apiHandler: mcp,
    defaultHandler: app,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    // Older MCP clients register themselves; newer ones present a metadata document instead.
    clientRegistrationEndpoint: "/oauth/register",
    clientIdMetadataDocumentEnabled: true,
    // Anyone can register, and each registration is stored: keep them small, and
    // let one that is no longer used lapse when its last token would have.
    clientRegistrationTTL: REGISTRATION_TTL_SECONDS,
    clientRegistrationCallback: ({ clientMetadata }) => {
      const addresses = Array.isArray(clientMetadata.redirect_uris) ? clientMetadata.redirect_uris.length : 0;
      const tooLarge =
        JSON.stringify(clientMetadata).length > MAX_REGISTRATION_CHARS || addresses > MAX_REDIRECT_ADDRESSES;
      return tooLarge ? { code: "invalid_client_metadata", description: "The registration is too large." } : undefined;
    },
    // Desktop apps return to an address of their own (`cursor://…`). PKCE, which the
    // library requires of them, is what keeps another app from using the answer.
    allowPrivateUseRedirectUris: true,
    scopesSupported: [SCOPE],
    requiredScopes: [SCOPE],
    resourceMetadata: { resource, authorization_servers: [origin] },
    // A client that cannot open a browser sends the access key itself as the bearer token.
    resolveExternalToken: async ({ token, env }) => {
      const setup = setupOf(env);
      if (!setup.ready || !(await sameSecret(token, setup.accessKey))) return null;
      return { props: { via: "key" } satisfies GrantProps, audience: resource };
    },
  });

  if (providers.size >= MAX_ORIGINS) providers.clear();
  providers.set(origin, provider);
  return provider;
}

/** Paths anyone on the internet may call, and the limit each caller is held to. */
function limitFor(pathname: string, env: Env): RateLimit | undefined {
  // Each registration is a KV write that stays for a month.
  if (pathname === "/oauth/register") return env.REGISTER_LIMIT;
  if (pathname === "/oauth/token") return env.API_LIMIT;
  if (pathname === MCP_PATH || pathname.startsWith(`${MCP_PATH}/`)) return env.API_LIMIT;
  return undefined;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    // The key, sessions and tokens must never travel in the clear. (Tokens are
    // also issued for an https address only, so nothing would work over http.)
    if (url.protocol === "http:" && !isLoopback(url.hostname)) {
      url.protocol = "https:";
      return new Response(null, { status: 308, headers: { location: url.href } });
    }

    if (await overLimit(limitFor(url.pathname, env), request)) {
      return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
    }

    // A copy for each request: the provider leaves its helpers on the object it
    // is given, and they belong to that provider's origin and no other.
    return providerFor(url.origin).fetch(request, { ...env }, ctx);
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    const setup = setupOf(env);
    if (!setup.ready) return;
    ctx.waitUntil(refreshAll(readerFor(env.OAUTH_KV, setup.tokens)));
  },
} satisfies ExportedHandler<Env>;
