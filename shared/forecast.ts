import { CATALOG, type MetricDef } from "./catalog";
import { cycleFor, previousCycle, type Cycle } from "./cycle";
import { DAY_MS, addDays, diffDays, fromIso, toIso, type IsoDate } from "./dates";
import type { Snapshot } from "./types";

/**
 * `metered` is a metric with no allowance at all (R2 Infrequent Access): it can
 * not be "over", it simply costs from the first unit.
 */
export type Status = "exceeded" | "will-exceed" | "watch" | "ok" | "metered";

/** A projection this close to the allowance is worth a look before it lands. */
export const WATCH_RATIO = 0.8;

/** How far ahead a stored amount is followed when asking when it passes the allowance. */
const LEVEL_HORIZON_DAYS = 365;

export interface Evaluation {
  def: MetricDef;
  /** Whether anything was used on any day on record. */
  active: boolean;
  /**
   * The figure shown against the allowance: used so far this period (`cycle`),
   * stored right now (`level`), or used so far today (`daily`, whose allowance
   * starts again every UTC midnight).
   */
  used: number;
  /** `used` over the allowance. 0 when there is no allowance. */
  ratio: number;
  /**
   * Pace over the last 7 and 30 complete days: units per day, or for `level`
   * metrics the typical growth per day.
   */
  rate7: number;
  rate30: number;
  /**
   * What the allowance is held against, at each pace: the period's total when
   * it closes (`cycle`), the period's average level (`level`), or a day's
   * usage, today's or an ordinary recent day's, whichever is more (`daily`).
   */
  projected7: number;
  projected30: number;
  /** The larger of the two projections, and its share of the allowance. */
  projected: number;
  projectedRatio: number;
  /** `level` only: the amount expected to be stored on the period's last day. */
  closing: number | null;
  /** `daily` only: how the days of this period went against the daily allowance. */
  daily: { busiest: number; busiestDay: IsoDate | null; daysOver: number } | null;
  /**
   * `cycle`: the day the allowance ran out or will run out this period.
   * `level`: the day the stored amount passes the allowance, when that is within a year.
   */
  exhaustsOn: IsoDate | null;
  /** Estimated charge for this period at the faster pace. */
  overageUsd: number;
  status: Status;
  /** The period before this one: its final figure, and where it stood at this same point. */
  previous: { total: number; samePoint: number } | null;
}

export interface EvaluateInput {
  def: MetricDef;
  days: readonly IsoDate[];
  values: readonly number[];
  cycle: Cycle;
  previous: Cycle;
  /** The moment the data describes. */
  asOfMs: number;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

/** A day-aligned series with bounds-safe reads. Days outside it read as 0. */
class Frame {
  readonly firstDay: IsoDate | undefined;

  constructor(
    private readonly days: readonly IsoDate[],
    private readonly values: readonly number[],
  ) {
    this.firstDay = days[0];
  }

  get lastDay(): IsoDate | undefined {
    return this.days[this.days.length - 1];
  }

  private index(day: IsoDate): number {
    return this.firstDay === undefined ? -1 : diffDays(this.firstDay, day);
  }

  covers(day: IsoDate): boolean {
    const index = this.index(day);
    return index >= 0 && index < this.days.length;
  }

  on(day: IsoDate): number {
    return this.covers(day) ? (this.values[this.index(day)] ?? 0) : 0;
  }

  /** Values from `from` up to but not including `to`, limited to days on record. */
  slice(from: IsoDate, to: IsoDate): number[] {
    const start = Math.max(0, this.index(from));
    const end = Math.min(this.days.length, this.index(to));
    return end > start ? this.values.slice(start, end) : [];
  }

  sum(from: IsoDate, to: IsoDate): number {
    return this.slice(from, to).reduce((total, value) => total + value, 0);
  }

  /** Average of the `count` complete days before `day`. */
  meanBefore(day: IsoDate, count: number): number {
    return mean(this.slice(addDays(day, -count), day));
  }

  /**
   * Typical change per day over the `count` days up to `day`. The single
   * largest change is left out: one bulk upload, or a database that appeared
   * overnight, is not a trend. Steady growth reads the same either way.
   */
  growthTo(day: IsoDate, count: number): number {
    const window = this.slice(addDays(day, -count), addDays(day, 1));
    const changes = window.slice(1).map((value, index) => value - (window[index] ?? 0));
    if (changes.length < 3) return mean(changes);

    let largest = 0;
    changes.forEach((change, index) => {
      if (Math.abs(change) > Math.abs(changes[largest] ?? 0)) largest = index;
    });
    return mean(changes.filter((_, index) => index !== largest));
  }
}

function priceOf(def: MetricDef, amountOverAllowance: number): number {
  return (Math.max(0, amountOverAllowance) * def.price.usd) / def.price.per;
}

type Core = Pick<
  Evaluation,
  | "used"
  | "rate7"
  | "rate30"
  | "projected7"
  | "projected30"
  | "closing"
  | "daily"
  | "exhaustsOn"
  | "overageUsd"
  | "previous"
> & {
  /** The least the billed figure can still come to, whatever happens from here. */
  floor: number;
};

/** How far into the current period `asOfMs` is, in days. */
function elapsedDays(cycle: Cycle, asOfMs: number): number {
  return Math.max(0, (asOfMs - fromIso(cycle.start)) / DAY_MS);
}

function evaluateCycle(frame: Frame, input: EvaluateInput, today: IsoDate): Core {
  const { def, cycle, previous, asOfMs } = input;

  const tomorrow = addDays(today, 1);
  const used = frame.sum(cycle.start, tomorrow);
  const rate7 = frame.meanBefore(today, 7);
  const rate30 = frame.meanBefore(today, 30);
  const remaining = Math.max(0, (fromIso(cycle.end) - asOfMs) / DAY_MS);
  const projected7 = used + rate7 * remaining;
  const projected30 = used + rate30 * remaining;

  const pace = Math.max(rate7, rate30);
  let exhaustsOn: IsoDate | null = null;
  if (def.allowance > 0) {
    if (used >= def.allowance) {
      // Already gone: the day the running total reached the allowance.
      const from = frame.firstDay !== undefined && frame.firstDay > cycle.start ? frame.firstDay : cycle.start;
      let running = 0;
      const crossed = frame.slice(from, tomorrow).findIndex((value) => {
        running += value;
        return running >= def.allowance;
      });
      exhaustsOn = crossed < 0 ? today : addDays(from, crossed);
    } else if (pace > 0) {
      const at = asOfMs + ((def.allowance - used) / pace) * DAY_MS;
      if (at < fromIso(cycle.end)) exhaustsOn = toIso(at);
    }
  }

  let before: Core["previous"] = null;
  if (frame.covers(previous.start)) {
    const elapsed = Math.min(elapsedDays(cycle, asOfMs), previous.days);
    const whole = Math.floor(elapsed);
    const partialDay = addDays(previous.start, whole);
    before = {
      total: frame.sum(previous.start, previous.end),
      samePoint:
        frame.sum(previous.start, partialDay) +
        (partialDay < previous.end ? frame.on(partialDay) * (elapsed - whole) : 0),
    };
  }

  return {
    used,
    floor: used,
    rate7,
    rate30,
    projected7,
    projected30,
    closing: null,
    daily: null,
    exhaustsOn,
    overageUsd: priceOf(def, Math.max(projected7, projected30) - def.allowance),
    previous: before,
  };
}

/**
 * Storage is billed on the average of each day's level across the period, so
 * that average, not the amount stored today, is what goes over or stays under.
 */
function evaluateLevel(frame: Frame, input: EvaluateInput, today: IsoDate): Core {
  const { def, cycle, previous, asOfMs } = input;

  const current = frame.on(today);
  const rate7 = frame.growthTo(today, 7);
  const rate30 = frame.growthTo(today, 30);
  const growth = Math.max(rate7, rate30);
  const daysLeft = Math.max(0, diffDays(today, cycle.end) - 1);
  const levelIn = (pace: number, days: number) => Math.max(0, current + pace * days);

  const soFar = frame.sum(cycle.start, addDays(today, 1));
  const averageAt = (pace: number) => {
    let ahead = 0;
    for (let day = 1; day <= daysLeft; day += 1) ahead += levelIn(pace, day);
    return (soFar + ahead) / cycle.days;
  };
  const projected7 = averageAt(rate7);
  const projected30 = averageAt(rate30);

  let exhaustsOn: IsoDate | null = null;
  if (def.allowance > 0) {
    if (current >= def.allowance) {
      exhaustsOn = today;
    } else if (growth > 0) {
      // The small allowance for rounding keeps "exactly 12 days" from becoming 13.
      const days = Math.ceil((def.allowance - current) / growth - 1e-9);
      if (days <= LEVEL_HORIZON_DAYS) exhaustsOn = addDays(today, days);
    }
  }

  let before: Core["previous"] = null;
  if (frame.covers(previous.start)) {
    const offset = Math.min(Math.floor(elapsedDays(cycle, asOfMs)), previous.days - 1);
    before = {
      total: frame.on(addDays(previous.end, -1)),
      samePoint: frame.on(addDays(previous.start, offset)),
    };
  }

  return {
    used: current,
    // Even with everything deleted today, the days already stored count toward the average.
    floor: soFar / cycle.days,
    rate7,
    rate30,
    projected7,
    projected30,
    closing: levelIn(growth, daysLeft),
    daily: null,
    exhaustsOn,
    overageUsd: priceOf(def, Math.max(projected7, projected30) - def.allowance),
    previous: before,
  };
}

/**
 * A daily allowance starts again at every UTC midnight, so the figure held
 * against it is today's. A day that went over earlier in the period is already
 * on the bill; a day that merely came close is history.
 */
function evaluateDaily(frame: Frame, input: EvaluateInput, today: IsoDate): Core {
  const { def, cycle, asOfMs } = input;

  const from = frame.firstDay !== undefined && frame.firstDay > cycle.start ? frame.firstDay : cycle.start;
  const thisPeriod = frame.slice(from, addDays(today, 1));
  const usedToday = frame.on(today);
  const rate7 = frame.meanBefore(today, 7);
  const rate30 = frame.meanBefore(today, 30);
  const remaining = Math.max(0, (fromIso(cycle.end) - asOfMs) / DAY_MS);

  const busiest = Math.max(0, ...thisPeriod);
  const busiestIndex = busiest > 0 ? thisPeriod.indexOf(busiest) : -1;
  const over = thisPeriod.map((value) => Math.max(0, value - def.allowance));
  const charged = over.reduce((total, value) => total + value, 0);
  const ahead = remaining * Math.max(0, Math.max(rate7, rate30) - def.allowance);

  return {
    used: usedToday,
    // Once any day of the period has gone over, the period has an overage whatever today looks like.
    floor: busiest,
    rate7,
    rate30,
    // Today will end at least where it stands, and likely no lower than an ordinary recent day.
    projected7: Math.max(usedToday, rate7),
    projected30: Math.max(usedToday, rate30),
    closing: null,
    daily: {
      busiest,
      busiestDay: busiestIndex < 0 ? null : addDays(from, busiestIndex),
      daysOver: def.allowance > 0 ? over.filter((value) => value > 0).length : 0,
    },
    exhaustsOn: null,
    overageUsd: priceOf(def, charged + ahead),
    previous: null,
  };
}

function statusOf(def: MetricDef, core: Core, projected: number): Status {
  if (def.allowance <= 0) return core.used > 0 || projected > 0 ? "metered" : "ok";
  // For a daily allowance, reaching it exactly is still inside it; only more is billed.
  if (def.mode === "daily" ? core.floor > def.allowance : core.floor >= def.allowance) return "exceeded";
  if (projected >= def.allowance) return "will-exceed";
  // A stored amount above the allowance is not billed until its average is,
  // but left alone it will be: worth saying before the period that pays for it.
  if (projected >= def.allowance * WATCH_RATIO || core.used >= def.allowance) return "watch";
  return "ok";
}

export function evaluate(input: EvaluateInput): Evaluation {
  const { def, days, values, asOfMs } = input;
  const frame = new Frame(days, values);

  // Data that stops before `asOfMs` is read up to its own last day.
  const asOfDay = toIso(asOfMs);
  const lastDay = frame.lastDay ?? asOfDay;
  const today = asOfDay < lastDay ? asOfDay : lastDay;

  const core =
    def.mode === "cycle"
      ? evaluateCycle(frame, input, today)
      : def.mode === "level"
        ? evaluateLevel(frame, input, today)
        : evaluateDaily(frame, input, today);

  const projected = Math.max(core.projected7, core.projected30);
  const { floor: _floor, ...shown } = core;

  return {
    def,
    active: values.some((value) => value > 0),
    ...shown,
    ratio: def.allowance > 0 ? core.used / def.allowance : 0,
    projected,
    projectedRatio: def.allowance > 0 ? projected / def.allowance : 0,
    status: statusOf(def, core, projected),
  };
}

export interface Report {
  cycle: Cycle;
  previous: Cycle;
  asOfMs: number;
  evaluations: Evaluation[];
}

/** Every metric in the catalog, judged against the billing period that contains the data. */
export function evaluateSnapshot(snapshot: Snapshot, renewalDay: number): Report {
  const asOfMs = Date.parse(snapshot.fetchedAt);
  const cycle = cycleFor(toIso(asOfMs), renewalDay);
  const previous = previousCycle(cycle, renewalDay);

  const evaluations = CATALOG.map((def) =>
    evaluate({
      def,
      days: snapshot.days,
      values: snapshot.metrics[def.id]?.total ?? [],
      cycle,
      previous,
      asOfMs,
    }),
  );

  return { cycle, previous, asOfMs, evaluations };
}

/** Below this share of the allowance, now and projected, a metric is not worth a row of its own. */
const MINOR_RATIO = 0.01;

/** Whether a metric is far enough from its allowance to be listed out of the way. */
export function isMinor(evaluation: Evaluation): boolean {
  return (
    evaluation.status === "ok" &&
    evaluation.def.allowance > 0 &&
    evaluation.ratio < MINOR_RATIO &&
    evaluation.projectedRatio < MINOR_RATIO &&
    (evaluation.daily?.busiest ?? 0) < evaluation.def.allowance * MINOR_RATIO
  );
}

const STATUS_RANK: Record<Status, number> = {
  exceeded: 0,
  "will-exceed": 1,
  watch: 2,
  metered: 3,
  ok: 4,
};

/** Closest to the allowance first; unused metrics keep their catalog order at the end. */
export function byUrgency(evaluations: readonly Evaluation[]): Evaluation[] {
  return [...evaluations].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.projectedRatio - a.projectedRatio ||
      b.overageUsd - a.overageUsd,
  );
}

export function totalOverageUsd(evaluations: readonly Evaluation[]): number {
  return evaluations.reduce((total, evaluation) => total + evaluation.overageUsd, 0);
}
