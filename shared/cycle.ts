import { addDays, diffDays, type IsoDate } from "./dates";

/** One billing period. `end` is the next renewal date and is not part of it. */
export interface Cycle {
  start: IsoDate;
  end: IsoDate;
  days: number;
}

export const MIN_RENEWAL_DAY = 1;
export const MAX_RENEWAL_DAY = 31;

export function isRenewalDay(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_RENEWAL_DAY &&
    value <= MAX_RENEWAL_DAY
  );
}

/**
 * The renewal date inside a given month. A renewal day the month does not have
 * (the 31st in a 30-day month, the 29th to 31st in February) falls on the
 * month's last day.
 */
function renewalDateIn(year: number, monthIndex: number, renewalDay: number): IsoDate {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(renewalDay, lastDay)))
    .toISOString()
    .slice(0, 10);
}

/** The billing period that contains `today`. */
export function cycleFor(today: IsoDate, renewalDay: number): Cycle {
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;

  const thisMonth = renewalDateIn(year, monthIndex, renewalDay);
  const start = today >= thisMonth ? thisMonth : renewalDateIn(year, monthIndex - 1, renewalDay);
  const end = today >= thisMonth ? renewalDateIn(year, monthIndex + 1, renewalDay) : thisMonth;

  return { start, end, days: diffDays(start, end) };
}

export function previousCycle(cycle: Cycle, renewalDay: number): Cycle {
  return cycleFor(addDays(cycle.start, -1), renewalDay);
}
