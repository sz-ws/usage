/**
 * What is metered, how much of it the plan includes, and what the rest costs.
 *
 * Numbers are the Workers Paid and R2 list prices read on 2026-10-09 from
 *   https://developers.cloudflare.com/workers/platform/pricing/
 *   https://developers.cloudflare.com/r2/pricing/
 *   https://developers.cloudflare.com/workers-ai/platform/pricing/
 * Cloudflare changes these now and then; this file is the only place they live.
 *
 * Quantities are stored in the unit the analytics API reports (requests, CPU
 * milliseconds, bytes, GB-seconds, neurons). Storage is billed in decimal
 * gigabytes, so 1 GB is 1e9 bytes here.
 */

export type MetricId =
  | "workers.requests"
  | "workers.cpuMs"
  | "d1.rowsRead"
  | "d1.rowsWritten"
  | "d1.storage"
  | "kv.reads"
  | "kv.writes"
  | "kv.deletes"
  | "kv.lists"
  | "kv.storage"
  | "r2.classA"
  | "r2.classB"
  | "r2.storage"
  | "r2ia.classA"
  | "r2ia.classB"
  | "r2ia.storage"
  | "do.requests"
  | "do.duration"
  | "do.rowsRead"
  | "do.rowsWritten"
  | "do.storage"
  | "queues.operations"
  | "ai.neurons";

export type Unit = "count" | "ms" | "bytes" | "gbs" | "neurons";

/**
 * How a metric meets its allowance.
 *  - `cycle`: usage adds up over the billing period (requests, rows, operations).
 *  - `level`: a stored amount, billed on its average over the period.
 *  - `daily`: the allowance resets every UTC day and only the excess is billed.
 */
export type Mode = "cycle" | "level" | "daily";

/** Cloudflare's own name for what a metric belongs to. `m.products` says it in the reader's language. */
export type Product =
  | "Workers"
  | "D1"
  | "KV"
  | "R2"
  | "R2 Infrequent Access"
  | "Durable Objects"
  | "Queues"
  | "Workers AI";

/** What one row of a metric's breakdown is. `m.resources` has the noun. */
export type ResourceKind = "worker" | "database" | "namespace" | "bucket" | "queue" | "model";

/**
 * The facts of one metric. Its name and any note about it are text, and live
 * in the dictionaries under `m.metrics[id]` (see shared/i18n).
 */
export interface MetricDef {
  id: MetricId;
  product: Product;
  unit: Unit;
  mode: Mode;
  /** Included amount, per billing period or per day depending on `mode`. */
  allowance: number;
  /** Price of usage beyond the allowance: `usd` for every `per` units. */
  price: { usd: number; per: number };
  resource: ResourceKind;
}

const MILLION = 1e6;
const BILLION = 1e9;
const GB = 1e9;

export const CATALOG: readonly MetricDef[] = [
  {
    id: "workers.requests",
    product: "Workers",
    unit: "count",
    mode: "cycle",
    allowance: 10 * MILLION,
    price: { usd: 0.3, per: MILLION },
    resource: "worker",
  },
  {
    id: "workers.cpuMs",
    product: "Workers",
    unit: "ms",
    mode: "cycle",
    allowance: 30 * MILLION,
    price: { usd: 0.02, per: MILLION },
    resource: "worker",
  },
  {
    id: "d1.rowsRead",
    product: "D1",
    unit: "count",
    mode: "cycle",
    allowance: 25 * BILLION,
    price: { usd: 0.001, per: MILLION },
    resource: "database",
  },
  {
    id: "d1.rowsWritten",
    product: "D1",
    unit: "count",
    mode: "cycle",
    allowance: 50 * MILLION,
    price: { usd: 1, per: MILLION },
    resource: "database",
  },
  {
    id: "d1.storage",
    product: "D1",
    unit: "bytes",
    mode: "level",
    allowance: 5 * GB,
    price: { usd: 0.75, per: GB },
    resource: "database",
  },
  {
    id: "kv.reads",
    product: "KV",
    unit: "count",
    mode: "cycle",
    allowance: 10 * MILLION,
    price: { usd: 0.5, per: MILLION },
    resource: "namespace",
  },
  {
    id: "kv.writes",
    product: "KV",
    unit: "count",
    mode: "cycle",
    allowance: MILLION,
    price: { usd: 5, per: MILLION },
    resource: "namespace",
  },
  {
    id: "kv.deletes",
    product: "KV",
    unit: "count",
    mode: "cycle",
    allowance: MILLION,
    price: { usd: 5, per: MILLION },
    resource: "namespace",
  },
  {
    id: "kv.lists",
    product: "KV",
    unit: "count",
    mode: "cycle",
    allowance: MILLION,
    price: { usd: 5, per: MILLION },
    resource: "namespace",
  },
  {
    id: "kv.storage",
    product: "KV",
    unit: "bytes",
    mode: "level",
    allowance: GB,
    price: { usd: 0.5, per: GB },
    resource: "namespace",
  },
  {
    id: "r2.classA",
    product: "R2",
    unit: "count",
    mode: "cycle",
    allowance: MILLION,
    price: { usd: 4.5, per: MILLION },
    resource: "bucket",
  },
  {
    id: "r2.classB",
    product: "R2",
    unit: "count",
    mode: "cycle",
    allowance: 10 * MILLION,
    price: { usd: 0.36, per: MILLION },
    resource: "bucket",
  },
  {
    id: "r2.storage",
    product: "R2",
    unit: "bytes",
    mode: "level",
    allowance: 10 * GB,
    price: { usd: 0.015, per: GB },
    resource: "bucket",
  },
  {
    id: "r2ia.classA",
    product: "R2 Infrequent Access",
    unit: "count",
    mode: "cycle",
    allowance: 0,
    price: { usd: 9, per: MILLION },
    resource: "bucket",
  },
  {
    id: "r2ia.classB",
    product: "R2 Infrequent Access",
    unit: "count",
    mode: "cycle",
    allowance: 0,
    price: { usd: 0.9, per: MILLION },
    resource: "bucket",
  },
  {
    id: "r2ia.storage",
    product: "R2 Infrequent Access",
    unit: "bytes",
    mode: "level",
    allowance: 0,
    price: { usd: 0.01, per: GB },
    resource: "bucket",
  },
  {
    id: "do.requests",
    product: "Durable Objects",
    unit: "count",
    mode: "cycle",
    allowance: MILLION,
    price: { usd: 0.15, per: MILLION },
    resource: "worker",
  },
  {
    id: "do.duration",
    product: "Durable Objects",
    unit: "gbs",
    mode: "cycle",
    allowance: 400_000,
    price: { usd: 12.5, per: MILLION },
    resource: "namespace",
  },
  {
    id: "do.rowsRead",
    product: "Durable Objects",
    unit: "count",
    mode: "cycle",
    allowance: 25 * BILLION,
    price: { usd: 0.001, per: MILLION },
    resource: "namespace",
  },
  {
    id: "do.rowsWritten",
    product: "Durable Objects",
    unit: "count",
    mode: "cycle",
    allowance: 50 * MILLION,
    price: { usd: 1, per: MILLION },
    resource: "namespace",
  },
  {
    id: "do.storage",
    product: "Durable Objects",
    unit: "bytes",
    mode: "level",
    allowance: 5 * GB,
    price: { usd: 0.2, per: GB },
    resource: "namespace",
  },
  {
    id: "queues.operations",
    product: "Queues",
    unit: "count",
    mode: "cycle",
    allowance: MILLION,
    price: { usd: 0.4, per: MILLION },
    resource: "queue",
  },
  {
    id: "ai.neurons",
    product: "Workers AI",
    unit: "neurons",
    mode: "daily",
    allowance: 10_000,
    price: { usd: 0.011, per: 1_000 },
    resource: "model",
  },
];

export const METRIC_IDS: readonly MetricId[] = CATALOG.map((def) => def.id);

/**
 * R2 operation names by billing class, as the pricing page lists them.
 */
const R2_CLASS_A: ReadonlySet<string> = new Set([
  "ListBuckets",
  "PutBucket",
  "ListObjects",
  "PutObject",
  "CopyObject",
  "CompleteMultipartUpload",
  "CreateMultipartUpload",
  "LifecycleStorageTierTransition",
  "ListMultipartUploads",
  "UploadPart",
  "UploadPartCopy",
  "ListParts",
  "PutBucketEncryption",
  "PutBucketCors",
  "PutBucketLifecycleConfiguration",
]);

const R2_CLASS_B: ReadonlySet<string> = new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);

const R2_FREE: ReadonlySet<string> = new Set([
  "DeleteObject",
  "DeleteObjects",
  "DeleteBucket",
  "AbortMultipartUpload",
]);

export type R2Class = "A" | "B" | "free" | "unknown";

/**
 * The billing class of an R2 operation.
 *
 * The analytics API reports operations the pricing page does not list
 * (`GetBucketSippyConfiguration`, `GetBucketNotificationConfiguration`, …).
 * Those are placed by what they do: anything that reads counts as class B,
 * anything that writes or enumerates as class A. Counting them can only
 * overstate usage, which is the safe direction for a page that warns about
 * allowances. A name that fits neither pattern is reported as unknown.
 */
export function r2Class(action: string): R2Class {
  if (R2_CLASS_A.has(action)) return "A";
  if (R2_CLASS_B.has(action)) return "B";
  if (R2_FREE.has(action)) return "free";
  if (/^(Delete|Abort)/.test(action)) return "free";
  if (/^(Get|Head)/.test(action)) return "B";
  if (/^(Put|List|Create|Copy|Upload|Complete)/.test(action)) return "A";
  return "unknown";
}
