import { z } from "zod";

/**
 * Which account this Worker runs in, worked out from analytics alone.
 *
 * Nothing at runtime tells a Worker its account. But Cloudflare records every
 * invocation with the version of the Worker that ran, a Worker knows its own
 * version, and a version id is not something another account can produce. So
 * an account whose analytics show this version running is this Worker's own,
 * and a person whose sign-in can read that is someone the account trusts.
 */

const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const REQUEST_TIMEOUT_MS = 10_000;

/** Invocations reach analytics about a minute after they happen; a version deployed long ago still shows. */
const LOOK_BACK_MS = 3 * 3_600_000;

const QUERY = `query ($account: String!, $since: Time!, $version: String!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      ran: workersInvocationsAdaptive(limit: 1, filter: { datetime_geq: $since, scriptVersion: $version }) {
        dimensions { scriptVersion }
      }
    }
  }
}`;

const answer = z.object({
  errors: z.array(z.unknown()).nullish(),
  data: z
    .object({ viewer: z.object({ accounts: z.array(z.object({ ran: z.array(z.unknown()) })) }) })
    .nullish(),
});

/**
 * `yes`: the version has run in the account. `no`: the account is readable and
 * shows no such run. `unreadable`: Cloudflare refused, or did not answer.
 */
export type Sighting = "yes" | "no" | "unreadable";

/** Looks for runs of `version` in the account. A version nobody has can only come back `no`, which is the plain "can it read this account" test. */
export async function sightingOf(token: string, accountId: string, version: string, nowMs: number): Promise<Sighting> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: { account: accountId, since: new Date(nowMs - LOOK_BACK_MS).toISOString(), version },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return "unreadable";

    const body = answer.safeParse(await response.json());
    const account = body.success && !body.data.errors?.length ? body.data.data?.viewer.accounts[0] : undefined;
    if (!account) return "unreadable";
    return account.ran.length > 0 ? "yes" : "no";
  } catch {
    return "unreadable";
  }
}

/** Matches no real version, so asking for it only tests whether the account can be read. */
const NO_VERSION = "00000000-0000-4000-8000-000000000000";

export async function canRead(token: string, accountId: string, nowMs: number): Promise<boolean> {
  return (await sightingOf(token, accountId, NO_VERSION, nowMs)) !== "unreadable";
}

export interface HomeEnv {
  HOME_ACCOUNT_ID?: string;
  CF_VERSION_METADATA?: { id: string };
}

/** Whether `accountId` is the account this Worker runs in, as far as `token` can show. */
export async function isHome(env: HomeEnv, token: string, accountId: string, nowMs: number): Promise<boolean> {
  const named = env.HOME_ACCOUNT_ID?.trim();
  if (named) return named === accountId && (await canRead(token, accountId, nowMs));

  const version = env.CF_VERSION_METADATA?.id;
  return version ? (await sightingOf(token, accountId, version, nowMs)) === "yes" : false;
}

/** The one of `accountIds` this Worker runs in, or null when none of them shows it. */
export async function homeAmong(
  env: HomeEnv,
  token: string,
  accountIds: readonly string[],
  nowMs: number,
): Promise<string | null> {
  const checks = await Promise.all(accountIds.map((id) => isHome(env, token, id, nowMs)));
  const index = checks.indexOf(true);
  return index === -1 ? null : (accountIds[index] ?? null);
}
