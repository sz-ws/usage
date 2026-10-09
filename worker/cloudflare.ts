import { addDays, toIso, type IsoDate } from "../shared/dates";
import type { DatasetName, Warning } from "../shared/types";
import type { RawWindow } from "./shape";

/**
 * Reads daily usage from Cloudflare's GraphQL Analytics API.
 *
 * The API token only carries "Account Analytics Read": it can see how much was
 * used, never what is stored. Limits that shape the queries below (read from
 * the API's own `settings` on 2026-10-09):
 *   - one query may span at most 32 days, so the history is read in windows
 *   - the datasets in CORE keep 90 days; the ones in RECENT keep 32
 *   - one dataset returns at most 10,000 rows per query
 */

const ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const ROW_LIMIT = 10_000;
const WINDOW_DAYS = 30;
/** Days of history to read. One short of the 90-day retention so the oldest day is never refused. */
export const HISTORY_DAYS = 89;
/**
 * Days read from the short-retention datasets. A billing period can be 31 days
 * long, so the 30-day window of the others would miss its first day.
 */
const RECENT_DAYS = 31;
const REQUEST_TIMEOUT_MS = 25_000;

const ARGS = `(limit: ${ROW_LIMIT}, filter: {date_geq: $from, date_leq: $to})`;

const CORE = `
  workers: workersInvocationsAdaptive${ARGS} { dimensions { date scriptName } sum { requests errors cpuTimeUs } }
  pages: pagesFunctionsInvocationsAdaptiveGroups${ARGS} { dimensions { date scriptName } sum { requests errors } }
  d1: d1AnalyticsAdaptiveGroups${ARGS} { dimensions { date databaseId } sum { rowsRead rowsWritten } }
  d1s: d1StorageAdaptiveGroups${ARGS} { dimensions { date databaseId } max { databaseSizeBytes } }
  kv: kvOperationsAdaptiveGroups${ARGS} { dimensions { date actionType namespaceId } sum { requests } }
  kvs: kvStorageAdaptiveGroups${ARGS} { dimensions { date namespaceId } max { byteCount } }
  r2: r2OperationsAdaptiveGroups${ARGS} { dimensions { date actionType bucketName storageClass } sum { requests } }
  r2s: r2StorageAdaptiveGroups${ARGS} { dimensions { date bucketName storageClass } max { payloadSize metadataSize } }
  doi: durableObjectsInvocationsAdaptiveGroups${ARGS} { dimensions { date scriptName } sum { requests } }
  dop: durableObjectsPeriodicGroups${ARGS} { dimensions { date namespaceId } sum { duration rowsRead rowsWritten } }
  doq: durableObjectsSqlStorageGroups${ARGS} { dimensions { date namespaceId } max { storedBytes } }
  queues: queueMessageOperationsAdaptiveGroups${ARGS} { dimensions { date queueId } sum { billableOperations } }
`;

const RECENT = `
  ai: aiInferenceAdaptiveGroups${ARGS} { dimensions { date modelId } sum { totalNeurons } }
`;

function document(fields: string): string {
  return `query Usage($account: String!, $from: Date!, $to: Date!) {
    viewer { accounts(filter: {accountTag: $account}) { ${fields} } }
  }`;
}

interface GraphQLResponse {
  data?: { viewer?: { accounts?: RawWindow[] } } | null;
  errors?: { message: string }[] | null;
}

export class AnalyticsError extends Error {}

async function run(
  token: string,
  accountId: string,
  fields: string,
  from: IsoDate,
  to: IsoDate,
): Promise<RawWindow> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: document(fields), variables: { account: accountId, from, to } }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new AnalyticsError(`Cloudflare Analytics answered ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse;
  const message = body.errors?.[0]?.message;
  if (message) throw new AnalyticsError(message);

  const window = body.data?.viewer?.accounts?.[0];
  if (!window) throw new AnalyticsError("Cloudflare Analytics returned nothing for this account");
  return window;
}

export interface UsageRead {
  days: IsoDate[];
  windows: RawWindow[];
  warnings: Warning[];
}

interface Span {
  from: IsoDate;
  to: IsoDate;
}

/** The history split into query-sized spans, newest first. */
export function spans(today: IsoDate, historyDays = HISTORY_DAYS, windowDays = WINDOW_DAYS): Span[] {
  const oldest = addDays(today, -(historyDays - 1));
  const result: Span[] = [];
  for (let to = today; to >= oldest; to = addDays(to, -windowDays)) {
    const from = addDays(to, -(windowDays - 1));
    result.push({ from: from < oldest ? oldest : from, to });
  }
  return result;
}

export async function readUsage(token: string, accountId: string, nowMs: number): Promise<UsageRead> {
  const today = toIso(nowMs);
  const [latest, ...older] = spans(today);
  if (!latest) throw new AnalyticsError("No date range to query");

  const warnings: Warning[] = [];

  // The short-retention datasets ride in their own request so that a problem
  // there costs one line of the page instead of the whole refresh.
  const recentFrom = addDays(today, -(RECENT_DAYS - 1));
  const recent = run(token, accountId, RECENT, recentFrom, today).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    warnings.push({ kind: "recent-unavailable", reason });
    return {} as RawWindow;
  });

  const windows = await Promise.all([
    run(token, accountId, CORE, latest.from, latest.to),
    recent,
    ...older.map((span) => run(token, accountId, CORE, span.from, span.to)),
  ]);

  const clipped = new Set<DatasetName>();
  for (const window of windows) {
    for (const [name, rows] of Object.entries(window) as [DatasetName, unknown[]][]) {
      if (rows.length >= ROW_LIMIT) clipped.add(name);
    }
  }
  if (clipped.size > 0) warnings.push({ kind: "clipped", datasets: [...clipped].sort() });

  const oldest = older[older.length - 1]?.from ?? latest.from;
  const days: IsoDate[] = [];
  for (let day = oldest; day <= today; day = addDays(day, 1)) days.push(day);

  return { days, windows, warnings };
}
