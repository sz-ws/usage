import { OAuthError, refreshTokens } from "./cloudflare-oauth";
import type { Connection, Store } from "./store";
import type { Reader } from "./usage";

/**
 * Keeping the Cloudflare sign-in usable. The grant's access token lasts an
 * hour; Cloudflare trades the refresh token for a new pair, and the old
 * refresh token stops being the current one.
 */

/** Cloudflare no longer honours the grant. Only the owner signing in again mends it. */
export class ReconnectNeeded extends Error {
  override name = "ReconnectNeeded";
}

/** Renewed this long before it runs out, so no reading starts with a token about to. */
const RENEW_BEFORE_MS = 5 * 60_000;

/** A renewal under way in this isolate, so two readings share it rather than racing each other. */
let renewing: Promise<string> | null = null;

async function renew(store: Store, connection: Connection, nowMs: number): Promise<string> {
  let renewed: Connection;
  try {
    const tokens = await refreshTokens({
      clientId: connection.clientId,
      refreshToken: connection.refreshToken,
      now: () => nowMs,
    });
    renewed = {
      ...connection,
      accessToken: tokens.accessToken,
      accessExpiresAt: tokens.expiresAt,
      refreshToken: tokens.refreshToken ?? connection.refreshToken,
    };
  } catch (error) {
    if (!(error instanceof OAuthError) || !error.reconnectNeeded) throw error;
    // Another isolate may have renewed first, which makes this refresh token
    // the stale one rather than the grant a dead one.
    const latest = await store.connection();
    if (latest && !latest.broken && latest.refreshToken !== connection.refreshToken) return latest.accessToken;
    if (latest?.connectedAt === connection.connectedAt) await store.saveConnection({ ...connection, broken: true });
    throw new ReconnectNeeded();
  }

  // The owner may have connected again while Cloudflare was answering; that grant wins.
  const latest = await store.connection();
  if (latest && latest.connectedAt !== connection.connectedAt) return latest.accessToken;
  await store.saveConnection(renewed);
  return renewed.accessToken;
}

/** An access token that is good for a reading, renewed first when it is about to run out. */
export async function accessTokenOf(store: Store, nowMs: number): Promise<string> {
  const connection = await store.connection();
  if (!connection || connection.broken) throw new ReconnectNeeded();
  if (connection.accessExpiresAt - nowMs > RENEW_BEFORE_MS) return connection.accessToken;

  renewing ??= renew(store, connection, nowMs).finally(() => {
    renewing = null;
  });
  return renewing;
}

/** Reads the accounts of a Cloudflare sign-in, with whatever access token is current at the time. */
export function readerOver(store: Store, connection: Connection): Reader {
  return {
    store,
    tokens: [],
    known: connection.accounts,
    tokenFor: () => accessTokenOf(store, Date.now()),
  };
}

/** A fresh key for signing sessions: 32 random bytes, as text. */
export function newSessionKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
