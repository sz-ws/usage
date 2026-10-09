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

export type Setup =
  | { ready: true; accessKey: string; tokens: string[] }
  | { ready: false; missing: SecretName[]; shortKey: boolean };

/** One token per account; a person pasting several separates them however comes naturally. */
export function tokensOf(env: Pick<Env, "ANALYTICS_TOKEN">): string[] {
  const parts = (env.ANALYTICS_TOKEN ?? "").split(/[\s,;]+/).filter((part) => part.length > 0);
  return [...new Set(parts)];
}

/** Whether the two secrets a deployment needs are there. Nothing is served to anyone until they are. */
export function setupOf(env: Pick<Env, "ANALYTICS_TOKEN" | "ACCESS_KEY">): Setup {
  const tokens = tokensOf(env);
  const accessKey = env.ACCESS_KEY?.trim() ?? "";

  const missing: SecretName[] = [];
  if (tokens.length === 0) missing.push("ANALYTICS_TOKEN");
  if (accessKey.length === 0) missing.push("ACCESS_KEY");
  const shortKey = accessKey.length > 0 && accessKey.length < MIN_ACCESS_KEY_LENGTH;

  if (missing.length > 0 || shortKey) return { ready: false, missing, shortKey };
  return { ready: true, accessKey, tokens };
}
