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

/**
 * How far back a run of this version counts. A run reaches analytics about a
 * minute after it happens, so a new deployment shows up that long after its
 * first request; a week keeps one that is visited now and then in sight.
 */
const LOOK_BACK_MS = 7 * 24 * 3_600_000;

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
  errors: z.array(z.object({ extensions: z.object({ code: z.string().nullish() }).nullish() })).nullish(),
  data: z
    .object({ viewer: z.object({ accounts: z.array(z.object({ ran: z.array(z.unknown()) })) }) })
    .nullish(),
});

/**
 * `yes`: the version has run in the account. `no`: the account is readable and
 * shows no such run. `denied`: Cloudflare said this access may not read the
 * account. `unreadable`: Cloudflare gave no answer that says either way.
 */
export type Sighting = "yes" | "no" | "denied" | "unreadable";

/** What Cloudflare puts on an error when the access is not allowed to read the account. */
const DENIED = "authz";

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
    if (!body.success) return "unreadable";
    const errors = body.data.errors ?? [];
    if (errors.length > 0) return errors.every((error) => error.extensions?.code === DENIED) ? "denied" : "unreadable";

    const account = body.data.data?.viewer.accounts[0];
    if (!account) return "unreadable";
    return account.ran.length > 0 ? "yes" : "no";
  } catch {
    return "unreadable";
  }
}

/**
 * How long to wait before asking again after no usable answer. On a deployed
 * Worker a sign-in was once turned away on such a non-answer, seconds after
 * Cloudflare issued the access, and went through when repeated; whether the
 * access was too new for the API or the API stumbled is not known. Either way
 * one silence should not cost a person the trip through Cloudflare's pages.
 */
export const pacing = { askAgainAfterMs: [400, 1_200] as readonly number[] };

/** `sightingOf`, asked again when Cloudflare gave no answer that says either way. */
async function settledSightingOf(token: string, accountId: string, version: string, nowMs: number): Promise<Sighting> {
  let sighting = await sightingOf(token, accountId, version, nowMs);
  for (const wait of pacing.askAgainAfterMs) {
    if (sighting !== "unreadable") break;
    await new Promise((resolve) => setTimeout(resolve, wait));
    sighting = await sightingOf(token, accountId, version, nowMs);
  }
  return sighting;
}

/** Matches no real version, so asking for it only tests whether the account can be read. */
const NO_VERSION = "00000000-0000-4000-8000-000000000000";

/** Whether an access reads an account: it does, Cloudflare says it may not, or Cloudflare would not say. */
export type Reading = "readable" | "denied" | "unanswered";

export async function readingOf(token: string, accountId: string, nowMs: number): Promise<Reading> {
  const sighting = await settledSightingOf(token, accountId, NO_VERSION, nowMs);
  if (sighting === "denied") return "denied";
  return sighting === "unreadable" ? "unanswered" : "readable";
}

export async function canRead(token: string, accountId: string, nowMs: number): Promise<boolean> {
  return (await readingOf(token, accountId, nowMs)) === "readable";
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
  return version ? (await settledSightingOf(token, accountId, version, nowMs)) === "yes" : false;
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
