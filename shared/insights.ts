import type { MetricId } from "./catalog";
import { diffDays, fromIso, toIso, type IsoDate } from "./dates";
import {
  byUrgency,
  totalOverageUsd,
  type Evaluation,
  type Report,
} from "./forecast";
import {
  formatAmount,
  formatChange,
  formatDay,
  formatPercent,
  formatTimeLeft,
  formatUsd,
} from "./format";
import type { Messages } from "./i18n/messages";
import { OTHER_KEY, type ResourceNames, type Series, type Snapshot } from "./types";

export type Tone = "ok" | "watch" | "over";

export interface Headline {
  tone: Tone;
  title: string;
  detail: string;
}

export interface Finding {
  id: string;
  tone: "note" | "watch" | "over";
  text: string;
  /** The metric to open for the numbers behind the sentence. */
  metric?: MetricId;
}

const MAX_FINDINGS = 6;
const PAGES_PREFIX = "pages:";
/** What the analytics API calls requests it cannot attribute to a Worker. */
const UNATTRIBUTED = "__unknown__";
const ID_PATTERN = /^[0-9a-f]{32}$|^[0-9a-f-]{36}$/i;

/** A resource's name as a person would say it, falling back to a short id. */
export function resourceName(key: string, names: ResourceNames, m: Messages): string {
  if (key === OTHER_KEY) return m.names.other;
  if (key === UNATTRIBUTED) return m.names.unattributed;
  if (key.startsWith(PAGES_PREFIX)) return m.names.pages({ name: key.slice(PAGES_PREFIX.length) });
  // `hasOwn`: a Worker may be called "constructor", and that must not find Object's.
  if (Object.hasOwn(names, key)) return names[key] ?? key;
  return ID_PATTERN.test(key) ? key.slice(0, 8) : key;
}

/** How the account stands as a whole: the worst of its metrics. */
export function overallTone(evaluations: readonly Evaluation[]): Tone {
  if (evaluations.some((entry) => entry.status === "exceeded" || entry.status === "will-exceed")) return "over";
  return evaluations.some((entry) => entry.status === "watch") ? "watch" : "ok";
}

const ids = (evaluations: readonly Evaluation[]): MetricId[] => evaluations.map((entry) => entry.def.id);

export function headline(report: Report, nowMs: number, m: Messages): Headline {
  const active = report.evaluations.filter((entry) => entry.active);
  const renewal = m.headline.renewal({
    day: formatDay(report.cycle.end, m),
    left: formatTimeLeft(fromIso(report.cycle.end) - nowMs, m),
  });

  if (active.length === 0) {
    return { tone: "ok", title: m.headline.noUsage, detail: renewal };
  }

  const ordered = byUrgency(active);
  const exceeded = ordered.filter((entry) => entry.status === "exceeded");
  const willExceed = ordered
    .filter((entry) => entry.status === "will-exceed")
    .sort((a, b) => (a.exhaustsOn ?? "9999").localeCompare(b.exhaustsOn ?? "9999"));
  const closest = ordered.find((entry) => entry.def.allowance > 0);

  const overage = totalOverageUsd(report.evaluations);
  const cost = overage >= 0.005 ? m.headline.cost({ usd: formatUsd(overage) }) : null;
  const detail = (...parts: (string | null)[]) =>
    m.sentences({ parts: parts.filter((part): part is string => part !== null) });

  if (exceeded.length > 0) {
    const also = willExceed.length > 0 ? m.headline.alsoOver({ metrics: ids(willExceed) }) : null;
    const onlyDaily = exceeded.every((entry) => entry.def.mode === "daily");
    return {
      tone: "over",
      title: onlyDaily
        ? m.headline.overDaily({ metrics: ids(exceeded) })
        : m.headline.over({ metrics: ids(exceeded) }),
      detail: detail(renewal, also, cost),
    };
  }

  const first = willExceed[0];
  if (first) {
    const rest = willExceed.length > 1 ? m.headline.alsoOver({ metrics: ids(willExceed.slice(1)) }) : null;
    return {
      tone: "over",
      // Only usage that adds up has a day it runs out; storage goes over on its average.
      title:
        first.def.mode === "cycle" && first.exhaustsOn
          ? m.headline.runsOutOn({ metric: first.def.id, day: formatDay(first.exhaustsOn, m) })
          : m.headline.willGoOver({ metric: first.def.id }),
      detail: detail(renewal, rest, cost),
    };
  }

  if (!closest) return { tone: "ok", title: m.headline.fine, detail: detail(renewal, cost) };

  const near = { metric: closest.def.id, share: formatPercent(closest.projectedRatio) };
  if (closest.status === "watch") {
    return { tone: "watch", title: m.headline.fineBut[closest.def.mode](near), detail: detail(renewal, cost) };
  }

  return {
    tone: "ok",
    title: m.headline.fine,
    detail: detail(renewal, m.headline.closest[closest.def.mode](near), cost),
  };
}

/** Sum of `values[from, to)`, limited to what exists. */
function windowSum(values: readonly number[], from: number, to: number): number {
  let total = 0;
  for (let index = Math.max(0, from); index < Math.min(values.length, to); index += 1) {
    total += values[index] ?? 0;
  }
  return total;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

interface Ranked {
  key: string;
  amount: number;
}

/** The resource with the largest `measure`, ignoring the catch-all bucket. */
function largest(series: Series | undefined, measure: (values: number[]) => number): Ranked | null {
  let best: Ranked | null = null;
  for (const [key, values] of Object.entries(series?.by ?? {})) {
    if (key === OTHER_KEY) continue;
    const amount = measure(values);
    if (amount > 0 && (!best || amount > best.amount)) best = { key, amount };
  }
  return best;
}

/** Day indexes the findings are measured over. `today` is the last day the data describes. */
interface Windows {
  today: number;
  cycleStart: number;
}

const WEEK = 7;
/** A share of one resource worth naming. */
const DOMINANT_SHARE = 0.4;
/** Usage below this share of the allowance is too small for its swings to matter. */
const MATERIAL_RATIO = 0.05;
const MATERIAL_WEEK_RATIO = 0.005;
const SPIKE_FACTOR = 4;
const ERROR_RATE = 0.05;
const MIN_REQUESTS = 200;

function concentration(
  entry: Evaluation,
  snapshot: Snapshot,
  names: ResourceNames,
  { today, cycleStart }: Windows,
  m: Messages,
): Finding | null {
  if (entry.projectedRatio < MATERIAL_RATIO) return null;
  const series = snapshot.metrics[entry.def.id];
  if (!series) return null;

  const isLevel = entry.def.mode === "level";
  const measure = (values: number[]) =>
    isLevel ? (values[today] ?? 0) : windowSum(values, cycleStart, today + 1);
  const top = largest(series, measure);
  const whole = measure(series.total);
  if (!top || whole <= 0 || top.amount / whole < DOMINANT_SHARE) return null;

  let msPerRequest: number | null = null;
  if (entry.def.id === "workers.cpuMs") {
    const requests = windowSum(
      snapshot.metrics["workers.requests"]?.by[top.key] ?? [],
      cycleStart,
      today + 1,
    );
    if (requests >= MIN_REQUESTS) msPerRequest = Math.round(top.amount / requests);
  }

  return {
    id: `share:${entry.def.id}`,
    tone: entry.status === "ok" ? "note" : entry.status === "watch" ? "watch" : "over",
    text: m.findings.share({
      metric: entry.def.id,
      name: resourceName(top.key, names, m),
      share: formatPercent(top.amount / whole),
      stored: isLevel,
      msPerRequest,
    }),
    metric: entry.def.id,
  };
}

function surge(
  entry: Evaluation,
  snapshot: Snapshot,
  names: ResourceNames,
  { today }: Windows,
  m: Messages,
): Finding | null {
  if (entry.def.mode !== "cycle" || entry.def.allowance <= 0) return null;
  const series = snapshot.metrics[entry.def.id];
  if (!series) return null;

  const recent = windowSum(series.total, today - WEEK, today);
  const before = windowSum(series.total, today - 2 * WEEK, today - WEEK);
  if (recent < entry.def.allowance * MATERIAL_WEEK_RATIO) return null;
  if (before <= 0 || recent < before * 2) return null;

  const grower = largest(
    series,
    (values) => windowSum(values, today - WEEK, today) - windowSum(values, today - 2 * WEEK, today - WEEK),
  );

  return {
    id: `surge:${entry.def.id}`,
    tone: "watch",
    text: m.findings.surge({
      metric: entry.def.id,
      days: WEEK,
      change: formatChange(recent, before, m) ?? "",
      grower: grower ? resourceName(grower.key, names, m) : null,
    }),
    metric: entry.def.id,
  };
}

function spike(entry: Evaluation, snapshot: Snapshot, { today }: Windows, m: Messages): Finding | null {
  if (entry.def.mode !== "cycle" || entry.def.allowance <= 0) return null;
  const totals = snapshot.metrics[entry.def.id]?.total;
  if (!totals) return null;

  let peakIndex = -1;
  for (let index = Math.max(0, today - WEEK); index < today; index += 1) {
    if (peakIndex < 0 || (totals[index] ?? 0) > (totals[peakIndex] ?? 0)) peakIndex = index;
  }
  const peak = totals[peakIndex] ?? 0;
  const usual = median(totals.slice(Math.max(0, today - 37), Math.max(0, today - WEEK)));
  if (peak < entry.def.allowance * MATERIAL_WEEK_RATIO) return null;
  if (usual <= 0 || peak < usual * SPIKE_FACTOR) return null;

  const day = snapshot.days[peakIndex];
  if (!day) return null;
  return {
    id: `spike:${entry.def.id}`,
    tone: "watch",
    text: m.findings.spike({
      metric: entry.def.id,
      day: formatDay(day, m),
      change: formatChange(peak, usual, m) ?? "",
      amount: formatAmount(peak, entry.def.unit),
    }),
    metric: entry.def.id,
  };
}

function failingWorkers(snapshot: Snapshot, names: ResourceNames, { today }: Windows, m: Messages): Finding[] {
  const requests = snapshot.metrics["workers.requests"]?.by ?? {};
  const errors = snapshot.extras["workers.errors"]?.by ?? {};

  return Object.entries(errors)
    .filter(([key]) => key !== OTHER_KEY && key !== UNATTRIBUTED)
    .map(([key, values]) => ({
      key,
      failed: windowSum(values, today - WEEK + 1, today + 1),
      handled: windowSum(requests[key] ?? [], today - WEEK + 1, today + 1),
    }))
    .filter((row) => row.handled >= MIN_REQUESTS && row.failed / row.handled >= ERROR_RATE)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 2)
    .map((row) => ({
      id: `errors:${row.key}`,
      tone: "watch" as const,
      text: m.findings.errors({
        name: resourceName(row.key, names, m),
        days: WEEK,
        share: formatPercent(row.failed / row.handled),
        count: formatAmount(row.failed, "count"),
      }),
      metric: "workers.requests" as const,
    }));
}

function storageRunway(entry: Evaluation, cycleEnd: IsoDate, m: Messages): Finding | null {
  if (entry.def.mode !== "level" || !entry.exhaustsOn) return null;
  // Once the average itself is going over, the headline already says so.
  if (entry.status !== "ok" && entry.status !== "watch") return null;
  if (diffDays(cycleEnd, entry.exhaustsOn) > 90) return null;

  const text =
    entry.used >= entry.def.allowance
      ? m.findings.storedOver({ metric: entry.def.id })
      : m.findings.storedWillPass({ metric: entry.def.id, day: formatDay(entry.exhaustsOn, m) });
  return { id: `runway:${entry.def.id}`, tone: "watch", text, metric: entry.def.id };
}

function againstLastPeriod(entry: Evaluation, m: Messages): Finding | null {
  if (entry.def.mode !== "cycle" || !entry.previous) return null;
  if (entry.projectedRatio < MATERIAL_RATIO) return null;
  const { samePoint } = entry.previous;
  if (samePoint <= 0) return null;
  const ratio = entry.used / samePoint;
  if (ratio > 0.75 && ratio < 1.25) return null;

  const text =
    ratio >= 2
      ? m.findings.periodTimes({ metric: entry.def.id, change: formatChange(entry.used, samePoint, m) ?? "" })
      : m.findings.periodDiff({
          metric: entry.def.id,
          percent: `${Math.round(Math.abs(ratio - 1) * 100)}%`,
          more: ratio > 1,
        });
  return { id: `period:${entry.def.id}`, tone: "note", text, metric: entry.def.id };
}

/** A share of the daily allowance, on a day that is over, worth mentioning afterwards. */
const NOTABLE_DAY_RATIO = 0.5;

/** What the days of this period looked like for an allowance that starts again each day. */
function dailyRecord(entry: Evaluation, m: Messages): Finding | null {
  const record = entry.daily;
  if (!record || entry.def.allowance <= 0) return null;

  if (record.daysOver > 0) {
    return {
      id: `days-over:${entry.def.id}`,
      tone: "over",
      text: m.findings.daysOver({
        metric: entry.def.id,
        days: record.daysOver,
        usd: formatUsd(entry.overageUsd),
      }),
      metric: entry.def.id,
    };
  }

  const ratio = record.busiest / entry.def.allowance;
  if (!record.busiestDay || ratio < NOTABLE_DAY_RATIO) return null;
  return {
    id: `busiest:${entry.def.id}`,
    tone: "note",
    text: m.findings.busiestDay({
      metric: entry.def.id,
      day: formatDay(record.busiestDay, m),
      share: formatPercent(ratio),
    }),
    metric: entry.def.id,
  };
}

function meteredCost(entry: Evaluation, m: Messages): Finding | null {
  if (entry.status !== "metered" || entry.overageUsd < 0.01) return null;
  return {
    id: `metered:${entry.def.id}`,
    tone: "note",
    text: m.findings.metered({ metric: entry.def.id, usd: formatUsd(entry.overageUsd) }),
    metric: entry.def.id,
  };
}

const TONE_RANK: Record<Finding["tone"], number> = { over: 0, watch: 1, note: 2 };

/** Short observations that explain the numbers: who is using it, what changed, what is failing. */
export function findings(snapshot: Snapshot, report: Report, names: ResourceNames, m: Messages): Finding[] {
  const first = snapshot.days[0];
  const last = snapshot.days[snapshot.days.length - 1];
  if (first === undefined || last === undefined) return [];

  const asOfDay = toIso(report.asOfMs);
  const today = diffDays(first, asOfDay < last ? asOfDay : last);
  const windows: Windows = { today, cycleStart: Math.max(0, diffDays(first, report.cycle.start)) };

  const active = byUrgency(report.evaluations.filter((entry) => entry.active));
  const found: Finding[] = [];
  const surged = new Set<MetricId>();

  for (const entry of active) {
    const rising = surge(entry, snapshot, names, windows, m);
    if (rising) {
      found.push(rising);
      surged.add(entry.def.id);
    }
  }
  for (const entry of active.slice(0, 3)) {
    const share = concentration(entry, snapshot, names, windows, m);
    if (share) found.push(share);
  }
  for (const entry of active) {
    if (!surged.has(entry.def.id)) {
      const burst = spike(entry, snapshot, windows, m);
      if (burst) found.push(burst);
    }
    const runway = storageRunway(entry, report.cycle.end, m);
    if (runway) found.push(runway);
  }
  found.push(...failingWorkers(snapshot, names, windows, m));
  for (const entry of active) {
    const record = dailyRecord(entry, m);
    if (record) found.push(record);
    const change = againstLastPeriod(entry, m);
    if (change) found.push(change);
    const cost = meteredCost(entry, m);
    if (cost) found.push(cost);
  }

  return found
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => TONE_RANK[a.finding.tone] - TONE_RANK[b.finding.tone] || a.index - b.index)
    .slice(0, MAX_FINDINGS)
    .map(({ finding }) => finding);
}
