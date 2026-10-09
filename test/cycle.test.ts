import { describe, expect, it } from "vitest";

import { cycleFor, isRenewalDay, previousCycle } from "../shared/cycle";
import { addDays, diffDays, rangeDays } from "../shared/dates";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days between two dates", () => {
    expect(diffDays("2026-09-13", "2026-10-13")).toBe(30);
    expect(diffDays("2026-10-13", "2026-09-13")).toBe(-30);
  });

  it("lists a range with both ends", () => {
    expect(rangeDays("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(rangeDays("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("cycleFor", () => {
  it("finds the period around a day after the renewal day", () => {
    expect(cycleFor("2026-10-09", 13)).toEqual({ start: "2026-09-13", end: "2026-10-13", days: 30 });
  });

  it("starts a new period on the renewal day itself", () => {
    expect(cycleFor("2026-10-13", 13)).toEqual({ start: "2026-10-13", end: "2026-11-13", days: 31 });
  });

  it("is still the old period the day before renewal", () => {
    expect(cycleFor("2026-10-12", 13).start).toBe("2026-09-13");
  });

  it("crosses the year end", () => {
    expect(cycleFor("2027-01-05", 13)).toEqual({ start: "2026-12-13", end: "2027-01-13", days: 31 });
  });

  it("falls back to the last day in months too short for the renewal day", () => {
    expect(cycleFor("2026-02-10", 31)).toEqual({ start: "2026-01-31", end: "2026-02-28", days: 28 });
    expect(cycleFor("2026-02-28", 31)).toEqual({ start: "2026-02-28", end: "2026-03-31", days: 31 });
    expect(cycleFor("2028-02-29", 30)).toEqual({ start: "2028-02-29", end: "2028-03-30", days: 30 });
  });

  it("handles a renewal on the 1st", () => {
    expect(cycleFor("2026-10-01", 1)).toEqual({ start: "2026-10-01", end: "2026-11-01", days: 31 });
    expect(cycleFor("2026-10-31", 1).end).toBe("2026-11-01");
  });
});

describe("previousCycle", () => {
  it("is the period that ends where this one starts", () => {
    const current = cycleFor("2026-10-09", 13);
    expect(previousCycle(current, 13)).toEqual({ start: "2026-08-13", end: "2026-09-13", days: 31 });
  });

  it("keeps the short-month fallback", () => {
    const march = cycleFor("2026-03-15", 31);
    expect(march.start).toBe("2026-02-28");
    expect(previousCycle(march, 31)).toEqual({ start: "2026-01-31", end: "2026-02-28", days: 28 });
  });
});

describe("isRenewalDay", () => {
  it("accepts whole days of the month only", () => {
    expect(isRenewalDay(1)).toBe(true);
    expect(isRenewalDay(31)).toBe(true);
    expect(isRenewalDay(0)).toBe(false);
    expect(isRenewalDay(32)).toBe(false);
    expect(isRenewalDay(13.5)).toBe(false);
    expect(isRenewalDay("13")).toBe(false);
  });
});
