import type { Cycle } from "../../shared/cycle";
import { DAY_MS, addDays, diffDays, fromIso, toIso, type IsoDate } from "../../shared/dates";
import type { Evaluation, Report } from "../../shared/forecast";

/** A point on a period chart. `x` is days since the period began. */
export interface Point {
  x: number;
  y: number;
}

export interface DayRow {
  day: IsoDate;
  /** That day's own figure. */
  value: number;
  /** What the chart draws at that day: the running total, or the same figure. */
  plotted: number;
}

export interface ChartData {
  /** Whether the line is a running total or a value per day. */
  kind: "running" | "perDay";
  /** Length of the period in days: the width of the x axis. */
  span: number;
  start: IsoDate;
  actual: Point[];
  /** From where the data ends to the close of the period. Empty when there is nothing left to project. */
  projection: Point[];
  /** The previous period on the same axis. Empty when it is not on record. */
  previous: Point[];
  /** The allowance, when the metric has one. */
  limit: number | null;
  /** The same numbers as a table. */
  rows: DayRow[];
}

interface Reader {
  on(day: IsoDate): number;
  lastDay: IsoDate;
}

function reader(days: readonly IsoDate[], values: readonly number[]): Reader | null {
  const first = days[0];
  const lastDay = days[days.length - 1];
  if (first === undefined || lastDay === undefined) return null;
  return {
    lastDay,
    on: (day) => {
      const index = diffDays(first, day);
      return index >= 0 && index < values.length ? (values[index] ?? 0) : 0;
    },
  };
}

function daysOf(cycle: Cycle, through: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = cycle.start; day < cycle.end && day <= through; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The points of one metric across the current period, with its projection and the period before. */
export function chartData(
  evaluation: Evaluation,
  days: readonly IsoDate[],
  values: readonly number[],
  report: Report,
): ChartData {
  const { cycle, previous, asOfMs } = report;
  const { def } = evaluation;
  const kind = def.mode === "cycle" ? "running" : "perDay";
  const base: ChartData = {
    kind,
    span: cycle.days,
    start: cycle.start,
    actual: [],
    projection: [],
    previous: [],
    limit: def.allowance > 0 ? def.allowance : null,
    rows: [],
  };

  const read = reader(days, values);
  if (!read) return base;

  const asOfDay = toIso(asOfMs);
  const today = asOfDay < read.lastDay ? asOfDay : read.lastDay;
  const elapsed = Math.min(cycle.days, Math.max(0, (asOfMs - fromIso(cycle.start)) / DAY_MS));
  const current = daysOf(cycle, today);
  // The previous period is drawn only when the data reaches back to its first
  // day. Daily-allowance metrics are read for the last month only, so for them
  // the earlier days are missing, not zero.
  const firstDay = days[0];
  const before =
    def.mode !== "daily" && firstDay !== undefined && firstDay <= previous.start
      ? daysOf(previous, addDays(previous.end, -1))
      : [];

  if (kind === "running") {
    // A day's usage lands at the end of that day; today's lands at "now".
    let running = 0;
    const actual: Point[] = [{ x: 0, y: 0 }];
    const rows: DayRow[] = [];
    current.forEach((day, index) => {
      const value = read.on(day);
      running += value;
      const x = day === today ? Math.max(index, Math.min(index + 1, elapsed)) : index + 1;
      actual.push({ x, y: running });
      rows.push({ day, value, plotted: running });
    });

    let total = 0;
    const earlier: Point[] = before.length > 0 ? [{ x: 0, y: 0 }] : [];
    before.forEach((day, index) => {
      total += read.on(day);
      if (index + 1 <= cycle.days) earlier.push({ x: index + 1, y: total });
    });

    const last = actual[actual.length - 1];
    const projection =
      last && last.x < cycle.days ? [last, { x: cycle.days, y: evaluation.projected }] : [];

    return { ...base, actual, projection, previous: earlier, rows };
  }

  // Per-day figures sit in the middle of their day.
  const actual = current.map((day, index) => ({ x: index + 0.5, y: read.on(day) }));
  const rows = current.map((day) => ({ day, value: read.on(day), plotted: read.on(day) }));
  const earlier = before
    .map((day, index) => ({ x: index + 0.5, y: read.on(day) }))
    .filter((point) => point.x < cycle.days);

  const last = actual[actual.length - 1];
  const projection =
    def.mode === "level" && last && last.x < cycle.days - 0.5
      ? [last, { x: cycle.days - 0.5, y: evaluation.closing ?? last.y }]
      : [];

  return { ...base, actual, projection, previous: earlier, rows };
}
