import { isConfigured } from "../shared/account";
import { breakdown } from "../shared/breakdown";
import { CATALOG, type MetricId, type Mode, type Unit } from "../shared/catalog";
import type { Cycle } from "../shared/cycle";
import type { IsoDate } from "../shared/dates";
import { byUrgency, evaluateSnapshot, totalOverageUsd, type Evaluation, type Status } from "../shared/forecast";
import type { Messages } from "../shared/i18n";
import { findings, headline, overallTone, resourceName, type Finding, type Tone } from "../shared/insights";
import { OTHER_KEY, type ResourceNames, type Snapshot, type TokenProblem, type Warning } from "../shared/types";
import { directoryOf, findAccount } from "./accounts";
import { MIN_REFRESH_INTERVAL_MS, refreshAccount, renewalDayOf, type Reader } from "./usage";

/**
 * The page's conclusions as data, for scripts and agents: the same evaluation
 * the browser does, done here, so a caller does not have to redo the arithmetic.
 */

export interface MetricReport {
  id: MetricId;
  product: string;
  label: string;
  unit: Unit;
  /** How the metric meets its allowance. See shared/catalog.ts. */
  mode: Mode;
  /** Used so far this period, stored now, or used today, by `mode`. In `unit`. */
  used: number;
  allowance: number;
  usedRatio: number;
  /** What the allowance is held against: the period's total, its average level, or a day's usage. */
  projected: number;
  projectedRatio: number;
  status: Status;
  exhaustsOn: IsoDate | null;
  estimatedOverageUsd: number;
  /** `daily` only. */
  daily: Evaluation["daily"];
  /** The largest resources behind the figure. */
  top: { name: string; amount: number; share: number }[];
}

export interface AccountReport {
  id: string;
  name: string;
  /** Day of the month the bill renews. Null until it has been set on the page; the rest is then empty. */
  renewalDay: number | null;
  /** When the usage was read from Cloudflare. Null when it never has been. */
  fetchedAt: string | null;
  cycle: Cycle | null;
  status: Tone | null;
  headline: { title: string; detail: string } | null;
  estimatedOverageUsd: number;
  /** Metrics with usage, most pressing first. */
  metrics: MetricReport[];
  /** Metrics in the catalog with no usage on record. */
  unused: MetricId[];
  findings: Finding[];
  warnings: string[];
}

export interface AccountInput {
  id: string;
  name: string;
  renewalDay: number | null;
}

const TOP_RESOURCES = 5;

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function accountReport(
  account: AccountInput,
  snapshot: Snapshot | null,
  names: ResourceNames,
  nowMs: number,
  m: Messages,
  warnings: readonly Warning[] = [],
): AccountReport {
  if (!snapshot || !isConfigured(account)) {
    return {
      ...account,
      fetchedAt: snapshot?.fetchedAt ?? null,
      cycle: null,
      status: null,
      headline: null,
      estimatedOverageUsd: 0,
      metrics: [],
      unused: [],
      findings: [],
      warnings: warnings.map((warning) => m.warning(warning)),
    };
  }

  const report = evaluateSnapshot(snapshot, account.renewalDay);
  const active = byUrgency(report.evaluations.filter((entry) => entry.active));
  const { title, detail } = headline(report, nowMs, m);

  return {
    ...account,
    fetchedAt: snapshot.fetchedAt,
    cycle: report.cycle,
    status: overallTone(report.evaluations),
    headline: { title, detail },
    estimatedOverageUsd: round(totalOverageUsd(report.evaluations), 4),
    metrics: active.map((entry) => ({
      id: entry.def.id,
      product: m.products[entry.def.product],
      label: m.metrics[entry.def.id].label,
      unit: entry.def.unit,
      mode: entry.def.mode,
      used: entry.used,
      allowance: entry.def.allowance,
      usedRatio: round(entry.ratio, 4),
      projected: round(entry.projected, 2),
      projectedRatio: round(entry.projectedRatio, 4),
      status: entry.status,
      exhaustsOn: entry.exhaustsOn,
      estimatedOverageUsd: round(entry.overageUsd, 4),
      daily: entry.daily,
      top: breakdown(entry, snapshot, report, names, TOP_RESOURCES, m).rows.map((row) => ({
        name: row.name,
        amount: row.amount,
        share: round(row.share, 4),
      })),
    })),
    unused: report.evaluations.filter((entry) => !entry.active).map((entry) => entry.def.id),
    findings: findings(snapshot, report, names, m),
    warnings: [...snapshot.warnings, ...warnings].map((warning) => m.warning(warning)),
  };
}

export interface ReportOptions {
  /** A name or an id; null for every account. */
  account: string | null;
  /** Read from Cloudflare first, unless that was done in the last minute. */
  fresh: boolean;
  m: Messages;
  nowMs: number;
}

export interface Reports {
  accounts: AccountReport[];
  /** API tokens that did not work. Empty when all of them did. */
  tokenProblems: TokenProblem[];
}

/** The reports the JSON API and the MCP tool hand out. Null when the account asked for is not one of them. */
export async function reportsFor(reader: Reader, options: ReportOptions): Promise<Reports | null> {
  const { m, nowMs } = options;
  const [directory, settings] = await Promise.all([
    directoryOf(reader.store, reader.tokens, nowMs),
    reader.store.settings(),
  ]);

  const wanted = options.account?.trim();
  const chosen = wanted ? [findAccount(directory, wanted)].filter((entry) => entry !== undefined) : directory.accounts;
  if (wanted && chosen.length === 0) return null;

  const accounts = await Promise.all(
    chosen.map(async (account) => {
      const input: AccountInput = {
        id: account.id,
        name: account.name,
        renewalDay: renewalDayOf(settings.accounts, account.id),
      };
      const stored = await reader.store.snapshot(account.id);
      const isRecent = stored !== null && nowMs - Date.parse(stored.fetchedAt) < MIN_REFRESH_INTERVAL_MS;

      if (!options.fresh || isRecent) {
        return accountReport(input, stored, await reader.store.names(account.id), nowMs, m);
      }
      try {
        const snapshot = await refreshAccount(reader, account, stored);
        return accountReport(input, snapshot, await reader.store.names(account.id), nowMs, m);
      } catch (error) {
        console.error("report refresh failed", account.id, error);
        // What is stored is still worth having; say that it is not the fresh reading that was asked for.
        return accountReport(input, stored, await reader.store.names(account.id), nowMs, m, [{ kind: "stale" }]);
      }
    }),
  );

  return { accounts, tokenProblems: directory.problems };
}

export interface MetricHistory {
  account: { id: string; name: string };
  metric: { id: MetricId; label: string; unit: Unit; mode: Mode; allowance: number };
  /** UTC days, oldest first. Every list below lines up with this one. */
  days: IsoDate[];
  total: number[];
  /** The resources that used the most over these days, largest first. */
  resources: { name: string; total: number; values: number[] }[];
}

export const MAX_HISTORY_DAYS = 90;
const HISTORY_RESOURCES = 8;

export function isMetricId(value: string): value is MetricId {
  return CATALOG.some((def) => def.id === value);
}

/** One metric day by day, with the resources behind it. Null when the account is unknown or has no reading. */
export async function historyFor(
  reader: Reader,
  options: { account: string; metric: MetricId; days: number; m: Messages; nowMs: number },
): Promise<MetricHistory | "unknown-account" | "no-reading"> {
  const directory = await directoryOf(reader.store, reader.tokens, options.nowMs);
  const account = findAccount(directory, options.account);
  if (!account) return "unknown-account";

  const [snapshot, names] = await Promise.all([reader.store.snapshot(account.id), reader.store.names(account.id)]);
  if (!snapshot) return "no-reading";

  const def = CATALOG.find((entry) => entry.id === options.metric);
  if (!def) throw new Error(`unknown metric ${options.metric}`);

  const count = Math.max(1, Math.min(options.days, snapshot.days.length));
  const start = snapshot.days.length - count;
  const series = snapshot.metrics[def.id];
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

  const resources = Object.entries(series?.by ?? {})
    .map(([key, values]) => {
      const window = values.slice(start);
      // Stored amounts are a level, not a flow: the latest day is the figure, not the sum.
      const total = def.mode === "level" ? (window.at(-1) ?? 0) : sum(window);
      return { key, name: resourceName(key, names, options.m), total, values: window };
    })
    .filter((entry) => entry.total > 0)
    .sort((left, right) => Number(left.key === OTHER_KEY) - Number(right.key === OTHER_KEY) || right.total - left.total)
    .slice(0, HISTORY_RESOURCES)
    .map(({ name, total, values }) => ({ name, total, values }));

  return {
    account: { id: account.id, name: account.name },
    metric: {
      id: def.id,
      label: options.m.metrics[def.id].label,
      unit: def.unit,
      mode: def.mode,
      allowance: def.allowance,
    },
    days: snapshot.days.slice(start),
    total: (series?.total ?? snapshot.days.map(() => 0)).slice(start),
    resources,
  };
}
