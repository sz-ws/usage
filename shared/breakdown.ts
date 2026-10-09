import type { Evaluation, Report } from "./forecast";
import { formatPercent } from "./format";
import type { Messages } from "./i18n/messages";
import { resourceName } from "./insights";
import { diffDays, toIso } from "./dates";
import { OTHER_KEY, type ResourceNames, type Series, type Snapshot } from "./types";

export interface BreakdownRow {
  key: string;
  name: string;
  /** This period's usage, or the amount stored now. */
  amount: number;
  share: number;
  /** The last 7 complete days against the 7 before them (for stored amounts: now against 7 days ago). */
  recent: number;
  before: number;
  /** A second figure that explains the first, when there is one. */
  aside: string | null;
}

export interface Breakdown {
  rows: BreakdownRow[];
  /** What is left after the rows shown. `count` is null when it includes resources that were never listed one by one. */
  rest: { count: number | null; amount: number } | null;
}

const WEEK = 7;

function sumBetween(values: readonly number[], from: number, to: number): number {
  let total = 0;
  for (let index = Math.max(0, from); index < Math.min(values.length, to); index += 1) {
    total += values[index] ?? 0;
  }
  return total;
}

/** Who used it: the largest resources this period, with what changed in the last week. */
export function breakdown(
  evaluation: Evaluation,
  snapshot: Snapshot,
  report: Report,
  names: ResourceNames,
  limit: number,
  m: Messages,
): Breakdown {
  const series: Series | undefined = snapshot.metrics[evaluation.def.id];
  const first = snapshot.days[0];
  const lastDay = snapshot.days[snapshot.days.length - 1];
  if (!series || first === undefined || lastDay === undefined) return { rows: [], rest: null };

  const asOfDay = toIso(report.asOfMs);
  const today = diffDays(first, asOfDay < lastDay ? asOfDay : lastDay);
  const cycleStart = Math.max(0, diffDays(first, report.cycle.start));
  const isLevel = evaluation.def.mode === "level";

  const amountOf = (values: readonly number[]) =>
    isLevel ? (values[today] ?? 0) : sumBetween(values, cycleStart, today + 1);
  const recentOf = (values: readonly number[]) =>
    isLevel ? (values[today] ?? 0) : sumBetween(values, today - WEEK, today);
  const beforeOf = (values: readonly number[]) =>
    isLevel ? (values[today - WEEK] ?? 0) : sumBetween(values, today - 2 * WEEK, today - WEEK);

  const whole = amountOf(series.total);
  const requests = snapshot.metrics["workers.requests"]?.by ?? {};
  const errors = snapshot.extras["workers.errors"]?.by ?? {};

  const aside = (key: string, amount: number): string | null => {
    if (key === OTHER_KEY) return null;
    if (evaluation.def.id === "workers.cpuMs") {
      const handled = amountOf(requests[key] ?? []);
      if (handled <= 0) return null;
      const each = amount / handled;
      return m.detail.breakdown.perRequest({ ms: each.toFixed(each < 10 ? 1 : 0) });
    }
    if (evaluation.def.id === "workers.requests") {
      const failed = amountOf(errors[key] ?? []);
      return failed > 0 && amount > 0 ? m.detail.breakdown.failed({ share: formatPercent(failed / amount) }) : null;
    }
    return null;
  };

  const ranked = Object.entries(series.by)
    .map(([key, values]) => ({ key, values, amount: amountOf(values) }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => Number(a.key === OTHER_KEY) - Number(b.key === OTHER_KEY) || b.amount - a.amount);

  const rows = ranked.slice(0, limit).map(({ key, values, amount }) => ({
    key,
    name: resourceName(key, names, m),
    amount,
    share: whole > 0 ? amount / whole : 0,
    recent: recentOf(values),
    before: beforeOf(values),
    aside: aside(key, amount),
  }));

  const hidden = ranked.slice(limit);
  const rest =
    hidden.length > 0
      ? {
          count: hidden.some((entry) => entry.key === OTHER_KEY) ? null : hidden.length,
          amount: hidden.reduce((total, entry) => total + entry.amount, 0),
        }
      : null;

  return { rows, rest };
}
