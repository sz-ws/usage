import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  ASSETS: Fetcher;
  /**
   * The one KV namespace: readings, settings, and the agent sign-ins the OAuth
   * library keeps. The library looks for this binding name, hence the name.
   */
  OAUTH_KV: KVNamespace;
  /** Put there by the OAuth provider for the handlers it wraps. */
  OAUTH_PROVIDER: OAuthHelpers;
  /** Secret. API tokens with Account Analytics Read, one per account, separated by commas or whitespace. */
  ANALYTICS_TOKEN?: string;
  /** Secret. The password for the page; the JSON API and the MCP endpoint also take it as a bearer token. */
  ACCESS_KEY?: string;
  /** The Cloudflare OAuth client the owner signs in through, when it is not the one built in. */
  CF_OAUTH_CLIENT_ID?: string;
  /** Where Cloudflare sends the browser back: the relay page, or an address of this Worker's own. */
  CF_OAUTH_CALLBACK_URL?: string;
  /** The account this Worker runs in, when whoever deployed it wrote it down. */
  HOME_ACCOUNT_ID?: string;
  /** Says which version of the Worker is running, which is how it finds its own account. */
  CF_VERSION_METADATA?: { id: string };
  /** Per caller IP, for the JSON API. Absent in local development. */
  API_LIMIT?: RateLimit;
  /** Per caller IP, for access key attempts. Absent in local development. */
  SIGNIN_LIMIT?: RateLimit;
  /** Per caller IP, for MCP clients registering themselves. Absent in local development. */
  REGISTER_LIMIT?: RateLimit;
}

/**
 * The key is the whole defence: the rate limits only slow a guesser down, and
 * a session cookie that leaked could be used to test guesses offline. Long
 * enough that neither gets anywhere.
 */
export const MIN_ACCESS_KEY_LENGTH = 24;

export type SecretName = "ANALYTICS_TOKEN" | "ACCESS_KEY";

/** The OAuth client registered with Cloudflare. Its id is a public identifier, not a secret. */
export interface OAuthClient {
  clientId: string;
  /** Registered with the client; Cloudflare sends the browser nowhere else. */
  callbackUrl: string;
}

/**
 * The client every deployment signs in through unless it names its own:
 * "Usage", registered with Cloudflare by sz-ws, open to every Cloudflare user
 * and verified for usage.sz.ws. Its one registered address is the relay
 * (`relay/` in this repository), which hands Cloudflare's answer on to the
 * deployment that asked.
 */
const BUILT_IN_CLIENT: OAuthClient = {
  clientId: "602bf8dab95b977ded33458b8d0aa8f6",
  callbackUrl: "https://usage.sz.ws/callback",
};

export function oauthClientOf(env: Pick<Env, "CF_OAUTH_CLIENT_ID" | "CF_OAUTH_CALLBACK_URL">): OAuthClient | null {
  const clientId = env.CF_OAUTH_CLIENT_ID?.trim() ?? "";
  const callbackUrl = env.CF_OAUTH_CALLBACK_URL?.trim() ?? "";
  if (clientId.length === 0 && callbackUrl.length === 0) return BUILT_IN_CLIENT;

  if (!/^[0-9a-f]{32}$/.test(clientId) || !URL.canParse(callbackUrl)) return null;
  const { search, hash, username, password } = new URL(callbackUrl);
  return search === "" && hash === "" && username === "" && password === "" ? { clientId, callbackUrl } : null;
}

/**
 * How a deployment lets its owner in and reads Cloudflare:
 *
 * - `keys`: an API token reads the usage and an access key opens the page.
 * - `signin`: the owner signs in with Cloudflare, which both opens the page and
 *   gives the Worker a grant to read with. An access key is optional and then
 *   serves scripts and agents that cannot open a browser.
 */
export type Setup =
  | { ready: true; mode: "keys"; accessKey: string; tokens: string[] }
  | { ready: true; mode: "signin"; accessKey: string | null; client: OAuthClient }
  | { ready: false; missing: SecretName[]; shortKey: boolean };

type SetupEnv = Pick<Env, "ANALYTICS_TOKEN" | "ACCESS_KEY" | "CF_OAUTH_CLIENT_ID" | "CF_OAUTH_CALLBACK_URL">;

/** One token per account; a person pasting several separates them however comes naturally. */
export function tokensOf(env: Pick<Env, "ANALYTICS_TOKEN">): string[] {
  const parts = (env.ANALYTICS_TOKEN ?? "").split(/[\s,;]+/).filter((part) => part.length > 0);
  return [...new Set(parts)];
}

/** Whether a deployment has what it needs. Nothing is served to anyone until it does. */
export function setupOf(env: SetupEnv): Setup {
  const tokens = tokensOf(env);
  const accessKey = env.ACCESS_KEY?.trim() ?? "";
  const shortKey = accessKey.length > 0 && accessKey.length < MIN_ACCESS_KEY_LENGTH;

  // A token says how this deployment reads Cloudflare; signing in is for one without.
  const client = tokens.length === 0 ? oauthClientOf(env) : null;
  if (client && !shortKey) {
    return { ready: true, mode: "signin", accessKey: accessKey.length > 0 ? accessKey : null, client };
  }

  const missing: SecretName[] = [];
  if (tokens.length === 0 && !client) missing.push("ANALYTICS_TOKEN");
  if (accessKey.length === 0 && !client) missing.push("ACCESS_KEY");

  if (missing.length > 0 || shortKey) return { ready: false, missing, shortKey };
  return { ready: true, mode: "keys", accessKey, tokens };
}
