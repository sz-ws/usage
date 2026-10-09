import type { MetricId } from "../shared/catalog";
import type { IsoDate } from "../shared/dates";
import type { AccountSettings, ResourceNames, Settings, Snapshot, StoredAlerts, TokenProblem } from "../shared/types";

/**
 * Everything this Worker keeps, in the one KV namespace it shares with the
 * OAuth library (whose keys start `client:`, `grant:` and `token:`):
 *
 *   usage:directory           the accounts the tokens can see
 *   usage:snapshot:<account>  the last read of the analytics API (about 90 days)
 *   usage:history:<account>   daily totals for days that have aged out of the snapshot
 *   usage:names:<account>     resource id to name, where the token may list them
 *   usage:settings            what was set on the page (billing day per account, alerts)
 *   usage:alerted:<account>   what the owner has already been told this billing period
 *   usage:alerted:tokens      which token problems have been reported
 */

const PREFIX = "usage:";
const HISTORY_MAX_DAYS = 800;

export type History = Record<IsoDate, Partial<Record<MetricId, number>>>;

export interface Directory {
  v: 1;
  fetchedAt: string;
  /** Fingerprint of the token list this was read with. */
  tokens: string;
  /** `token` is the position of the token that reads the account, counted from 0. */
  accounts: { id: string; name: string; token: number }[];
  problems: TokenProblem[];
}

export interface NamesRecord {
  v: 1;
  /** When the lists were last asked for, whether or not the token was allowed to see them. */
  checkedAt: string;
  names: ResourceNames;
}

const EMPTY_SETTINGS: Settings = { accounts: {} };

export class Store {
  constructor(private readonly kv: KVNamespace) {}

  async directory(): Promise<Directory | null> {
    const stored = await this.kv.get<Directory>(`${PREFIX}directory`, "json");
    return stored?.v === 1 ? stored : null;
  }

  async saveDirectory(directory: Directory): Promise<void> {
    await this.kv.put(`${PREFIX}directory`, JSON.stringify(directory));
  }

  async snapshot(accountId: string): Promise<Snapshot | null> {
    const stored = await this.kv.get<Snapshot>(`${PREFIX}snapshot:${accountId}`, "json");
    return stored?.v === 1 ? stored : null;
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    await this.kv.put(`${PREFIX}snapshot:${snapshot.accountId}`, JSON.stringify(snapshot));
  }

  async namesRecord(accountId: string): Promise<NamesRecord | null> {
    const stored = await this.kv.get<NamesRecord>(`${PREFIX}names:${accountId}`, "json");
    return stored?.v === 1 ? stored : null;
  }

  async names(accountId: string): Promise<ResourceNames> {
    return (await this.namesRecord(accountId))?.names ?? {};
  }

  async saveNames(accountId: string, record: NamesRecord): Promise<void> {
    await this.kv.put(`${PREFIX}names:${accountId}`, JSON.stringify(record));
  }

  async settings(): Promise<Settings> {
    return (await this.kv.get<Settings>(`${PREFIX}settings`, "json")) ?? EMPTY_SETTINGS;
  }

  /** Sets what is given and keeps the rest of the account's settings. */
  async saveAccountSettings(accountId: string, changes: AccountSettings): Promise<AccountSettings> {
    const current = await this.settings();
    const merged: AccountSettings = { ...current.accounts[accountId], ...changes };
    const next: Settings = { ...current, accounts: { ...current.accounts, [accountId]: merged } };
    await this.kv.put(`${PREFIX}settings`, JSON.stringify(next));
    return merged;
  }

  async saveAlerts(alerts: StoredAlerts): Promise<void> {
    const current = await this.settings();
    await this.kv.put(`${PREFIX}settings`, JSON.stringify({ ...current, alerts } satisfies Settings));
  }

  /** What has already been reported, by account id or the word `tokens`. */
  async alerted<T>(key: string): Promise<T | null> {
    return this.kv.get<T>(`${PREFIX}alerted:${key}`, "json");
  }

  async saveAlerted(key: string, ledger: unknown): Promise<void> {
    await this.kv.put(`${PREFIX}alerted:${key}`, JSON.stringify(ledger));
  }

  /**
   * Keeps the daily totals of days the next snapshot will no longer cover. The
   * analytics API forgets after 90 days; this is what lets a later version of
   * the page look further back.
   */
  async archive(previous: Snapshot, firstDayKept: IsoDate): Promise<void> {
    const aged = previous.days
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => day < firstDayKept);
    if (aged.length === 0) return;

    const key = `${PREFIX}history:${previous.accountId}`;
    const history = (await this.kv.get<History>(key, "json")) ?? {};
    const additions: History = {};
    for (const { day, index } of aged) {
      if (history[day]) continue;
      const totals: Partial<Record<MetricId, number>> = {};
      for (const [id, series] of Object.entries(previous.metrics) as [MetricId, { total: number[] }][]) {
        const value = series.total[index] ?? 0;
        if (value > 0) totals[id] = value;
      }
      additions[day] = totals;
    }
    if (Object.keys(additions).length === 0) return;

    const merged = Object.entries({ ...history, ...additions })
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-HISTORY_MAX_DAYS);
    await this.kv.put(key, JSON.stringify(Object.fromEntries(merged)));
  }
}
