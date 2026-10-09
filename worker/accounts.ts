import { z } from "zod";

import type { TokenProblem } from "../shared/types";
import type { Directory, Store } from "./store";

/**
 * Which accounts there are to show. Nobody configures this: every API token is
 * asked which accounts it can see, and the answer is kept for a few hours.
 */

const ACCOUNTS_ENDPOINT = "https://api.cloudflare.com/client/v4/accounts";
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
const REQUEST_TIMEOUT_MS = 10_000;

/** New accounts and renamed ones show up within this long, or at once on a manual refresh. */
const DIRECTORY_TTL_MS = 6 * 3_600_000;

const accountsPage = z.object({
  result: z.array(z.object({ id: z.string().regex(/^[0-9a-f]{32}$/), name: z.string() })),
  result_info: z.object({ total_pages: z.number().int().optional() }).optional(),
});

interface Seen {
  accounts: { id: string; name: string }[];
  problem: TokenProblem | null;
}

async function accountsFor(token: string, position: number): Promise<Seen> {
  const accounts: Seen["accounts"] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetch(`${ACCOUNTS_ENDPOINT}?per_page=${PAGE_SIZE}&page=${page}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return { accounts: [], problem: { token: position, status: response.status } };

      const body = accountsPage.safeParse(await response.json());
      if (!body.success) return { accounts: [], problem: { token: position, status: null } };

      accounts.push(...body.data.result);
      if (page >= (body.data.result_info?.total_pages ?? 1)) break;
    }
  } catch {
    return { accounts: [], problem: { token: position, status: null } };
  }

  // A token that works but sees nothing is as much a problem as one that is refused.
  return { accounts, problem: accounts.length === 0 ? { token: position, status: 200 } : null };
}

/** Changes when the tokens change, without being the tokens. */
async function fingerprint(tokens: readonly string[]): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tokens.join("\n")));
  return [...new Uint8Array(bytes).slice(0, 8)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function discover(tokens: readonly string[], nowMs: number, previous: Directory | null): Promise<Directory> {
  const seen = await Promise.all(tokens.map((token, index) => accountsFor(token, index + 1)));

  const accounts: Directory["accounts"] = [];
  const problems: TokenProblem[] = [];
  seen.forEach((entry, index) => {
    if (entry.problem) problems.push(entry.problem);
    for (const account of entry.accounts) {
      // The first token that can see an account is the one that reads it.
      if (!accounts.some((known) => known.id === account.id)) accounts.push({ ...account, token: index });
    }
  });

  // Cloudflare being unreachable for a moment should not empty the page.
  const tokensFingerprint = await fingerprint(tokens);
  if (accounts.length === 0 && previous && previous.tokens === tokensFingerprint && previous.accounts.length > 0) {
    return { ...previous, problems };
  }

  accounts.sort((left, right) => left.name.localeCompare(right.name));
  return { v: 1, fetchedAt: new Date(nowMs).toISOString(), tokens: tokensFingerprint, accounts, problems };
}

/** Lookups under way in this isolate, so simultaneous requests ask Cloudflare once. */
let underWay: Promise<Directory> | null = null;

export async function directoryOf(
  store: Store,
  tokens: readonly string[],
  nowMs: number,
  options: { fresh?: boolean } = {},
): Promise<Directory> {
  const stored = await store.directory();
  const isCurrent =
    stored !== null &&
    stored.tokens === (await fingerprint(tokens)) &&
    nowMs - Date.parse(stored.fetchedAt) < DIRECTORY_TTL_MS &&
    stored.accounts.length > 0;
  if (isCurrent && !options.fresh) return stored;

  underWay ??= discover(tokens, nowMs, stored)
    .then(async (found) => {
      await store.saveDirectory(found);
      return found;
    })
    .finally(() => {
      underWay = null;
    });
  return underWay;
}

/** One account by id or by name, the way a person or an agent would refer to it. */
export function findAccount(directory: Directory, wanted: string): Directory["accounts"][number] | undefined {
  const needle = wanted.trim().toLowerCase();
  return (
    directory.accounts.find((account) => account.id === needle) ??
    directory.accounts.find((account) => account.name.toLowerCase() === needle)
  );
}
