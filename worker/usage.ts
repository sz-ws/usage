import type { AccountSettings, AccountState, AppState, Snapshot } from "../shared/types";
import { directoryOf } from "./accounts";
import { alertAccount, alertTokens, alertsView } from "./alerts";
import { readUsage } from "./cloudflare";
import { readNames } from "./names";
import { shape } from "./shape";
import { Store, type Directory } from "./store";

/**
 * Reading usage and keeping it: the part shared by the page's API, the JSON
 * report, the MCP tools and the scheduled refresh.
 */

export type DirectoryAccount = Directory["accounts"][number];

export interface Reader {
  store: Store;
  /** API tokens, each asked which accounts it can see. Empty when the owner signed in with Cloudflare instead. */
  tokens: readonly string[];
  /** The accounts a Cloudflare sign-in was allowed to read. Such a grant cannot list them itself. */
  known?: readonly { id: string; name: string }[];
  /** What reads `account` right now. */
  tokenFor(account: DirectoryAccount): Promise<string>;
}

/** A refresh asked for sooner than this after the last one returns what is already stored. */
export const MIN_REFRESH_INTERVAL_MS = 60_000;

/** How often an account's resource names are looked up again. */
const NAMES_TTL_MS = 86_400_000;

export function readerFor(kv: KVNamespace, tokens: readonly string[]): Reader {
  return {
    store: new Store(kv),
    tokens,
    tokenFor: async (account) => {
      const token = tokens[account.token];
      if (!token) throw new Error(`no token for account ${account.id}`);
      return token;
    },
  };
}

/** The accounts there are to show, wherever the reader learns them from. */
export async function accountsOf(reader: Reader, nowMs: number, options: { fresh?: boolean } = {}): Promise<Directory> {
  if (!reader.known) return directoryOf(reader.store, reader.tokens, nowMs, options);

  const accounts = reader.known.map((account) => ({ ...account, token: 0 }));
  return { v: 1, fetchedAt: new Date(nowMs).toISOString(), tokens: "", accounts, problems: [] };
}

/** Refreshes under way in this isolate, so a second press joins the first instead of repeating it. */
const refreshing = new Map<string, Promise<Snapshot>>();

/** Reads the account's usage from Cloudflare now and stores it. */
export function refreshAccount(
  reader: Reader,
  account: DirectoryAccount,
  existing: Snapshot | null,
): Promise<Snapshot> {
  const underWay = refreshing.get(account.id);
  if (underWay) return underWay;

  const work = readAndStore(reader, account, existing).finally(() => refreshing.delete(account.id));
  refreshing.set(account.id, work);
  return work;
}

async function readAndStore(reader: Reader, account: DirectoryAccount, existing: Snapshot | null): Promise<Snapshot> {
  const token = await reader.tokenFor(account);

  const nowMs = Date.now();
  const read = await readUsage(token, account.id, nowMs);
  const snapshot = shape({
    accountId: account.id,
    fetchedAt: new Date(nowMs).toISOString(),
    days: read.days,
    windows: read.windows,
    warnings: read.warnings,
  });

  await reader.store.saveSnapshot(snapshot);

  // Both are worth doing, but not worth losing the fresh numbers over.
  const firstDay = snapshot.days[0];
  if (existing && firstDay) {
    await reader.store.archive(existing, firstDay).catch((error: unknown) => {
      console.error("archive failed", account.id, error);
    });
  }
  await refreshNames(reader, account.id, token, nowMs).catch((error: unknown) => {
    console.error("names failed", account.id, error);
  });
  return snapshot;
}

async function refreshNames(reader: Reader, accountId: string, token: string, nowMs: number): Promise<void> {
  const record = await reader.store.namesRecord(accountId);
  if (record && nowMs - Date.parse(record.checkedAt) < NAMES_TTL_MS) return;

  const names = await readNames(token, accountId, record?.names ?? {});
  await reader.store.saveNames(accountId, { v: 1, checkedAt: new Date(nowMs).toISOString(), names });
}

export function renewalDayOf(settings: Record<string, AccountSettings>, accountId: string): number | null {
  return (Object.hasOwn(settings, accountId) ? settings[accountId]?.renewalDay : undefined) ?? null;
}

/** Everything the page shows: each account with its settings, its last reading and its resource names. */
export async function readState(reader: Reader, nowMs: number): Promise<AppState> {
  const [directory, settings] = await Promise.all([
    accountsOf(reader, nowMs),
    reader.store.settings(),
  ]);

  const accounts: AccountState[] = await Promise.all(
    directory.accounts.map(async (account) => {
      const [snapshot, names] = await Promise.all([
        reader.store.snapshot(account.id),
        reader.store.names(account.id),
      ]);
      const renewalDay = renewalDayOf(settings.accounts, account.id);
      return { id: account.id, name: account.name, renewalDay, snapshot, names };
    }),
  );

  return { accounts, problems: directory.problems, alerts: alertsView(settings.alerts) };
}

/**
 * Keeps the stored readings current, so the page opens on recent numbers and no
 * day ages out unseen, and tells the owner what the new readings changed.
 */
export async function refreshAll(reader: Reader): Promise<void> {
  const nowMs = Date.now();
  const directory = await accountsOf(reader, nowMs, { fresh: true });
  const settings = await reader.store.settings();

  for (const account of directory.accounts) {
    try {
      const snapshot = await refreshAccount(reader, account, await reader.store.snapshot(account.id));
      const renewalDay = renewalDayOf(settings.accounts, account.id);
      await alertAccount(reader.store, { id: account.id, name: account.name, renewalDay }, snapshot, nowMs);
    } catch (error) {
      console.error("scheduled refresh failed", account.id, error);
    }
  }

  await alertTokens(reader.store, directory.problems, nowMs).catch((error: unknown) => {
    console.error("token alert failed", error);
  });
}
