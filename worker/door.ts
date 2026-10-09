import { readerOver } from "./connection";
import { setupOf, type Env, type Setup } from "./env";
import { Store, type Connection } from "./store";
import { readerFor, type Reader } from "./usage";

/**
 * What it takes to let someone in and to read Cloudflare, whichever way the
 * deployment is set up: with an API token and an access key, or with the
 * owner's Cloudflare sign-in.
 */
export interface Door {
  /** Browser sessions are signed with it, and agents' grants are tied to it. */
  secret: string;
  /** What a script may send as a bearer token. Null when the deployment has no access key. */
  bearer: string | null;
  reader: Reader;
  /** The Cloudflare sign-in the readings come through, when there is no API token. */
  connection: Connection | null;
}

type Ready = Extract<Setup, { ready: true }>;

/** Null while there is nobody to let in: the owner has not connected Cloudflare yet. */
export async function doorOf(env: Env, setup: Ready): Promise<Door | null> {
  if (setup.mode === "keys") {
    const reader = readerFor(env.OAUTH_KV, setup.tokens);
    return { secret: setup.accessKey, bearer: setup.accessKey, reader, connection: null };
  }

  const store = new Store(env.OAUTH_KV);
  const connection = await store.connection();
  if (!connection) return null;
  return {
    secret: connection.sessionKey,
    bearer: setup.accessKey,
    reader: readerOver(store, connection),
    connection,
  };
}

/** The same, for callers with nothing to say to a deployment that is not set up. */
export async function openDoor(env: Env): Promise<Door | null> {
  const setup = setupOf(env);
  return setup.ready ? doorOf(env, setup) : null;
}
