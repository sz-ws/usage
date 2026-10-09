import { CATALOG, r2Class, type MetricId, type Unit } from "../shared/catalog";
import type { IsoDate } from "../shared/dates";
import { OTHER_KEY, type DatasetName, type ExtraId, type Series, type Snapshot, type Warning } from "../shared/types";

/**
 * Turns the analytics API's rows into one value per day per metric.
 *
 * Kept free of Workers APIs so it runs unchanged under vitest.
 */

interface Dated {
  date: IsoDate;
}

interface Row<Dimensions, Sum = never, Max = never> {
  dimensions: Dated & Dimensions;
  sum?: Sum;
  max?: Max;
}

/** The datasets of one query window, as the GraphQL aliases name them. */
export interface RawWindow {
  workers?: Row<{ scriptName: string }, { requests: number; errors: number; cpuTimeUs: number }>[];
  pages?: Row<{ scriptName: string }, { requests: number; errors: number }>[];
  d1?: Row<{ databaseId: string }, { rowsRead: number; rowsWritten: number }>[];
  d1s?: Row<{ databaseId: string }, never, { databaseSizeBytes: number }>[];
  kv?: Row<{ actionType: string; namespaceId: string }, { requests: number }>[];
  kvs?: Row<{ namespaceId: string }, never, { byteCount: number }>[];
  r2?: Row<{ actionType: string; bucketName: string; storageClass: string }, { requests: number }>[];
  r2s?: Row<
    { bucketName: string; storageClass: string },
    never,
    { payloadSize: number; metadataSize: number }
  >[];
  doi?: Row<{ scriptName: string }, { requests: number }>[];
  dop?: Row<{ namespaceId: string }, { duration: number; rowsRead: number; rowsWritten: number }>[];
  doq?: Row<{ namespaceId: string }, never, { storedBytes: number }>[];
  queues?: Row<{ queueId: string }, { billableOperations: number }>[];
  ai?: Row<{ modelId: string }, { totalNeurons: number }>[];
}

/** Fails to compile when a dataset is added here but not to the names the page can word. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const DATASETS_MATCH: Same<keyof RawWindow, DatasetName> = true;

/** Resources past this many are folded into one "other" line per metric. */
export const MAX_RESOURCES = 40;

const KV_ACTIONS: Readonly<Record<string, MetricId>> = {
  read: "kv.reads",
  write: "kv.writes",
  delete: "kv.deletes",
  list: "kv.lists",
};

const R2_INFREQUENT = "InfrequentAccess";

/** A stored resource with no reading for this many days, while others have one, was deleted. */
const GONE_AFTER_DAYS = 2;

const DECIMALS: Readonly<Record<Unit, number>> = { count: 0, ms: 0, bytes: 0, gbs: 3, neurons: 2 };

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

type SeriesId = MetricId | ExtraId;

/**
 * Collects readings into day-aligned rows. Counted metrics add up; stored
 * amounts keep one reading per day and start as "no reading" so that a missing
 * day can be told apart from an empty one.
 */
class Ledger {
  private readonly dayIndex: Map<IsoDate, number>;
  private readonly tables = new Map<SeriesId, Map<string, number[]>>();

  constructor(private readonly days: readonly IsoDate[]) {
    this.dayIndex = new Map(days.map((day, index) => [day, index]));
  }

  private row(id: SeriesId, key: string, fill: number): number[] {
    let table = this.tables.get(id);
    if (!table) {
      table = new Map();
      this.tables.set(id, table);
    }
    let row = table.get(key);
    if (!row) {
      row = new Array<number>(this.days.length).fill(fill);
      table.set(key, row);
    }
    return row;
  }

  count(id: SeriesId, key: string, date: IsoDate, amount: number): void {
    const index = this.dayIndex.get(date);
    if (index === undefined || !Number.isFinite(amount) || amount === 0) return;
    const row = this.row(id, key, 0);
    row[index] = (row[index] ?? 0) + amount;
  }

  level(id: SeriesId, key: string, date: IsoDate, amount: number): void {
    const index = this.dayIndex.get(date);
    if (index === undefined || !Number.isFinite(amount)) return;
    const row = this.row(id, key, Number.NaN);
    const current = row[index];
    row[index] = current === undefined || Number.isNaN(current) ? amount : Math.max(current, amount);
  }

  /**
   * Stored amounts have no reading on some days: the newest day or two lag
   * behind, and a resource has none before it existed or after it was deleted.
   * A gap is filled with the reading before it. Past its last reading a
   * resource keeps that value unless the rest of the dataset has moved on by
   * two days or more; only then is it taken to be gone and read as 0. One day
   * behind is ordinary: early in a UTC day the readings arrive resource by
   * resource.
   */
  private settleLevels(table: Map<string, number[]>): void {
    let latest = -1;
    for (const row of table.values()) {
      for (let index = row.length - 1; index > latest; index -= 1) {
        if (!Number.isNaN(row[index])) latest = index;
      }
    }

    for (const row of table.values()) {
      let last = -1;
      for (let index = row.length - 1; index >= 0 && last < 0; index -= 1) {
        if (!Number.isNaN(row[index])) last = index;
      }
      let carried = 0;
      for (let index = 0; index < row.length; index += 1) {
        const reading = row[index];
        if (reading !== undefined && !Number.isNaN(reading)) {
          carried = reading;
        } else {
          row[index] = index > last && latest - last >= GONE_AFTER_DAYS ? 0 : carried;
        }
      }
    }
  }

  series(id: SeriesId, kind: "count" | "level", decimals: number): Series | null {
    const table = this.tables.get(id);
    if (!table) return null;
    if (kind === "level") this.settleLevels(table);

    const total = new Array<number>(this.days.length).fill(0);
    for (const row of table.values()) {
      row.forEach((value, index) => {
        total[index] = (total[index] ?? 0) + value;
      });
    }
    if (!total.some((value) => value > 0)) return null;

    const weight = (row: number[]) =>
      kind === "level" ? Math.max(...row) : row.reduce((sum, value) => sum + value, 0);
    const ranked = [...table.entries()]
      .map(([key, row]) => ({ key, row, weight: weight(row) }))
      .filter((entry) => entry.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    const entries: [string, number[]][] = ranked
      .slice(0, MAX_RESOURCES)
      .map(({ key, row }) => [key, row.map((value) => round(value, decimals))]);
    const rest = ranked.slice(MAX_RESOURCES);
    if (rest.length > 0) {
      entries.push([
        OTHER_KEY,
        total.map((_, index) =>
          round(
            rest.reduce((sum, entry) => sum + (entry.row[index] ?? 0), 0),
            decimals,
          ),
        ),
      ]);
    }

    // `fromEntries` defines every key as its own property, even one a Worker named "__proto__".
    return { total: total.map((value) => round(value, decimals)), by: Object.fromEntries(entries) };
  }
}

export interface ShapeInput {
  accountId: string;
  fetchedAt: string;
  days: readonly IsoDate[];
  windows: readonly RawWindow[];
  warnings?: readonly Warning[];
}

export function shape(input: ShapeInput): Snapshot {
  const ledger = new Ledger(input.days);
  const unknownR2 = new Set<string>();

  for (const window of input.windows) {
    for (const { dimensions: d, sum } of window.workers ?? []) {
      if (!sum) continue;
      ledger.count("workers.requests", d.scriptName, d.date, sum.requests);
      ledger.count("workers.cpuMs", d.scriptName, d.date, sum.cpuTimeUs / 1000);
      ledger.count("workers.errors", d.scriptName, d.date, sum.errors);
    }
    // Pages Functions are billed as Workers requests.
    for (const { dimensions: d, sum } of window.pages ?? []) {
      if (!sum) continue;
      ledger.count("workers.requests", `pages:${d.scriptName}`, d.date, sum.requests);
      ledger.count("workers.errors", `pages:${d.scriptName}`, d.date, sum.errors);
    }

    for (const { dimensions: d, sum } of window.d1 ?? []) {
      if (!sum) continue;
      ledger.count("d1.rowsRead", d.databaseId, d.date, sum.rowsRead);
      ledger.count("d1.rowsWritten", d.databaseId, d.date, sum.rowsWritten);
    }
    for (const { dimensions: d, max } of window.d1s ?? []) {
      if (max) ledger.level("d1.storage", d.databaseId, d.date, max.databaseSizeBytes);
    }

    for (const { dimensions: d, sum } of window.kv ?? []) {
      const metric = KV_ACTIONS[d.actionType];
      if (metric && sum) ledger.count(metric, d.namespaceId, d.date, sum.requests);
    }
    for (const { dimensions: d, max } of window.kvs ?? []) {
      if (max) ledger.level("kv.storage", d.namespaceId, d.date, max.byteCount);
    }

    for (const { dimensions: d, sum } of window.r2 ?? []) {
      if (!sum) continue;
      const tier = d.storageClass === R2_INFREQUENT ? "r2ia" : "r2";
      const billedAs = r2Class(d.actionType);
      if (billedAs === "A") {
        ledger.count(`${tier}.classA`, d.bucketName, d.date, sum.requests);
      } else if (billedAs === "B") {
        ledger.count(`${tier}.classB`, d.bucketName, d.date, sum.requests);
      } else if (billedAs === "unknown") {
        unknownR2.add(d.actionType);
      }
    }
    for (const { dimensions: d, max } of window.r2s ?? []) {
      if (!max) continue;
      const tier = d.storageClass === R2_INFREQUENT ? "r2ia" : "r2";
      ledger.level(`${tier}.storage`, d.bucketName, d.date, max.payloadSize + max.metadataSize);
    }

    for (const { dimensions: d, sum } of window.doi ?? []) {
      if (sum) ledger.count("do.requests", d.scriptName, d.date, sum.requests);
    }
    for (const { dimensions: d, sum } of window.dop ?? []) {
      if (!sum) continue;
      ledger.count("do.duration", d.namespaceId, d.date, sum.duration);
      ledger.count("do.rowsRead", d.namespaceId, d.date, sum.rowsRead);
      ledger.count("do.rowsWritten", d.namespaceId, d.date, sum.rowsWritten);
    }
    for (const { dimensions: d, max } of window.doq ?? []) {
      if (max) ledger.level("do.storage", d.namespaceId, d.date, max.storedBytes);
    }

    for (const { dimensions: d, sum } of window.queues ?? []) {
      if (sum) ledger.count("queues.operations", d.queueId, d.date, sum.billableOperations);
    }
    for (const { dimensions: d, sum } of window.ai ?? []) {
      if (sum) ledger.count("ai.neurons", d.modelId, d.date, sum.totalNeurons);
    }
  }

  const metrics: Snapshot["metrics"] = {};
  for (const def of CATALOG) {
    const series = ledger.series(def.id, def.mode === "level" ? "level" : "count", DECIMALS[def.unit]);
    if (series) metrics[def.id] = series;
  }

  const extras: Snapshot["extras"] = {};
  const errors = ledger.series("workers.errors", "count", 0);
  if (errors) extras["workers.errors"] = errors;

  const warnings: Warning[] = [...(input.warnings ?? [])];
  if (unknownR2.size > 0) {
    warnings.push({ kind: "r2-unknown", actions: [...unknownR2].sort() });
  }

  return {
    v: 1,
    accountId: input.accountId,
    fetchedAt: input.fetchedAt,
    days: [...input.days],
    metrics,
    extras,
    warnings,
  };
}
