import type { MetricId } from "./catalog";
import type { IsoDate } from "./dates";

/**
 * One value per day, aligned to `Snapshot.days`. `by` holds the same shape for
 * each resource that used anything in the period (Worker, database, bucket…).
 */
export interface Series {
  total: number[];
  by: Record<string, number[]>;
}

/** Key in `Series.by` for everything past the largest resources. */
export const OTHER_KEY = "__other";

/** The analytics datasets a reading is assembled from. */
export type DatasetName =
  | "workers"
  | "pages"
  | "d1"
  | "d1s"
  | "kv"
  | "kvs"
  | "r2"
  | "r2s"
  | "doi"
  | "dop"
  | "doq"
  | "queues"
  | "ai";

/**
 * Something about a reading the reader should know. Kept as data so the page
 * and the JSON report can each say it in the reader's language.
 */
export type Warning =
  /** Workers AI usage could not be read; `reason` is Cloudflare's own message. */
  | { kind: "recent-unavailable"; reason: string }
  /** These datasets hit the row limit, so real usage is higher than shown. */
  | { kind: "clipped"; datasets: DatasetName[] }
  /** R2 operations that could not be classed as A or B and were left out. */
  | { kind: "r2-unknown"; actions: string[] }
  /** The latest read failed; this is the reading before it. */
  | { kind: "stale" };

/** Per-Worker figures that explain usage but are not billed on their own. */
export type ExtraId = "workers.errors";

export interface Snapshot {
  v: 1;
  accountId: string;
  /** When the analytics API was read, ISO timestamp. */
  fetchedAt: string;
  /** Every UTC day covered, oldest first, no gaps. */
  days: IsoDate[];
  metrics: Partial<Record<MetricId, Series>>;
  extras: Partial<Record<ExtraId, Series>>;
  /** Empty when everything arrived. */
  warnings: Warning[];
}

/** Display names for resources the analytics API only knows by id. */
export type ResourceNames = Record<string, string>;

export interface AccountState {
  id: string;
  name: string;
  /** Day of the month the bill renews. Null until the owner has said. */
  renewalDay: number | null;
  snapshot: Snapshot | null;
  names: ResourceNames;
}

export interface AppState {
  accounts: AccountState[];
  /** API tokens that did not work. Empty when all of them did. */
  problems: TokenProblem[];
  alerts: AlertsView;
  /** Cloudflare no longer honours the sign-in the readings come through. Absent when they come through an API token. */
  reconnect?: boolean;
}

/** What the owner wants to hear about. */
export interface AlertEvents {
  /** A product is on course to go over its allowance this period. */
  willExceed: boolean;
  /** A product has gone over. */
  exceeded: boolean;
  /** A product is on course to pass 80% of its allowance. */
  watch: boolean;
  /** An API token stopped working. */
  token: boolean;
}

/** Where alerts go, as the page may see it: the addresses, and whether a credential is set, never the credential. */
export interface AlertsView {
  events: AlertEvents;
  ntfy: { url: string | null; hasToken: boolean };
  webhook: { url: string | null; hasSecret: boolean };
}

/** The same settings as they are kept, credentials included. Stays in the Worker. */
export interface StoredAlerts {
  events: AlertEvents;
  ntfyUrl: string | null;
  ntfyToken: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  /** The language alerts are written in: the one the page was in when they were saved. */
  locale: string;
  /** The page's own address, for the link in an alert. A scheduled run has no request to read it from. */
  origin: string;
}

/** What the owner has told the page about an account. Cloudflare's API does not say it to a token this narrow. */
export interface AccountSettings {
  /** Day of the month the Workers Paid subscription renews, 1 to 31. */
  renewalDay?: number;
}

export interface Settings {
  accounts: Record<string, AccountSettings>;
  alerts?: StoredAlerts;
}

/** An API token that did not work: its position in ANALYTICS_TOKEN counted from 1, and what Cloudflare answered. */
export interface TokenProblem {
  token: number;
  /** HTTP status; 200 when the token works but can see no account; null when Cloudflare could not be reached. */
  status: number | null;
}
