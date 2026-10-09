import { describe, expect, it } from "vitest";

import { CATALOG, type MetricDef, type MetricId } from "../shared/catalog";
import { cycleFor, previousCycle } from "../shared/cycle";
import { rangeDays } from "../shared/dates";
import { byUrgency, evaluate, evaluateSnapshot, isMinor, totalOverageUsd } from "../shared/forecast";
import type { Snapshot } from "../shared/types";

const RENEWAL_DAY = 13;
const DAYS = rangeDays("2026-07-13", "2026-10-09");
/** Noon UTC on the last day on record: 3.5 days before the period ends on 10-13. */
const AS_OF = Date.parse("2026-10-09T12:00:00Z");

function def(id: MetricId): MetricDef {
  const found = CATALOG.find((entry) => entry.id === id);
  if (!found) throw new Error(`no metric ${id}`);
  return found;
}

function run(id: MetricId, valueFor: (day: string, index: number) => number, asOfMs = AS_OF) {
  const cycle = cycleFor("2026-10-09", RENEWAL_DAY);
  return evaluate({
    def: def(id),
    days: DAYS,
    values: DAYS.map(valueFor),
    cycle,
    previous: previousCycle(cycle, RENEWAL_DAY),
    asOfMs,
  });
}

describe("a metric that adds up over the period", () => {
  it("counts what was used since the period began, today included", () => {
    // 09-13 … 10-09 is 27 days.
    const result = run("workers.requests", () => 100_000);
    expect(result.used).toBe(2_700_000);
    expect(result.ratio).toBeCloseTo(0.27);
  });

  it("projects the rest of the period from the time left, not from whole days", () => {
    const result = run("workers.requests", () => 100_000);
    expect(result.rate7).toBe(100_000);
    expect(result.projected7).toBeCloseTo(2_700_000 + 100_000 * 3.5);
    expect(result.status).toBe("ok");
    expect(result.exhaustsOn).toBeNull();
    expect(result.overageUsd).toBe(0);
  });

  it("leaves today's partial count out of the pace", () => {
    const result = run("workers.requests", (day) => (day === "2026-10-09" ? 5 : 100_000));
    expect(result.rate7).toBe(100_000);
  });

  it("uses the faster of the two paces for the headline projection", () => {
    // Quiet for most of the month, busy for the last week.
    const result = run("workers.cpuMs", (day) => (day >= "2026-10-02" ? 2_000_000 : 500_000));
    expect(result.rate7).toBe(2_000_000);
    expect(result.rate30).toBe(850_000);
    expect(result.projected).toBe(result.projected7);
  });

  it("names the day the allowance runs out and prices the excess", () => {
    // 1M ms a day: 27M by 10-09 noon, 30M three days later, 30.5M at the close.
    const result = run("workers.cpuMs", () => 1_000_000);
    expect(result.status).toBe("will-exceed");
    expect(result.exhaustsOn).toBe("2026-10-12");
    expect(result.projected).toBeCloseTo(30_500_000);
    expect(result.overageUsd).toBeCloseTo(0.01);
  });

  it("flags a projection that comes close without crossing", () => {
    // 27 days x 900k = 24.3M, plus 3.5 days = 27.45M of 30M: 91.5%.
    const result = run("workers.cpuMs", () => 900_000);
    expect(result.status).toBe("watch");
    expect(result.exhaustsOn).toBeNull();
  });

  it("reports an allowance that is already gone, and the day it went", () => {
    // 50K a day from 09-13 reaches 1M on the twentieth day.
    const result = run("kv.writes", () => 50_000);
    expect(result.used).toBe(1_350_000);
    expect(result.status).toBe("exceeded");
    expect(result.exhaustsOn).toBe("2026-10-02");
    expect(result.overageUsd).toBeGreaterThan(0);
  });

  it("puts a price on usage with no allowance before any of it lands in the new period", () => {
    // The first half hour of a period: nothing used yet, but 1,000 a day until yesterday.
    const days = rangeDays("2026-08-01", "2026-10-13");
    const cycle = cycleFor("2026-10-13", RENEWAL_DAY);
    const result = evaluate({
      def: def("r2ia.classA"),
      days,
      values: days.map((day) => (day < "2026-10-13" ? 1_000 : 0)),
      cycle,
      previous: previousCycle(cycle, RENEWAL_DAY),
      asOfMs: Date.parse("2026-10-13T00:30:00Z"),
    });
    expect(result.used).toBe(0);
    expect(result.status).toBe("metered");
    expect(result.overageUsd).toBeGreaterThan(0);
  });

  it("compares with the previous period at the same point and in full", () => {
    // The previous period (08-13 … 09-12, 31 days) ran at 10 a day, this one at 30.
    const result = run("queues.operations", (day) => (day >= "2026-09-13" ? 30 : 10));
    expect(result.previous?.total).toBe(310);
    // 26.5 days into the previous period.
    expect(result.previous?.samePoint).toBeCloseTo(265);
  });

  it("has no comparison when the previous period is not on record", () => {
    const cycle = cycleFor("2026-10-09", RENEWAL_DAY);
    const days = rangeDays("2026-09-01", "2026-10-09");
    const result = evaluate({
      def: def("d1.rowsRead"),
      days,
      values: days.map(() => 1),
      cycle,
      previous: previousCycle(cycle, RENEWAL_DAY),
      asOfMs: AS_OF,
    });
    expect(result.previous).toBeNull();
  });

  it("is inactive when nothing was ever used", () => {
    const result = run("queues.operations", () => 0);
    expect(result.active).toBe(false);
    expect(result.status).toBe("ok");
    expect(result.projected).toBe(0);
  });
});

describe("a stored amount", () => {
  const GB = 1e9;

  it("holds the current level against the allowance", () => {
    const result = run("r2.storage", () => 2 * GB);
    expect(result.used).toBe(2 * GB);
    expect(result.ratio).toBeCloseTo(0.2);
    expect(result.rate7).toBe(0);
    expect(result.projected).toBe(2 * GB);
    expect(result.overageUsd).toBe(0);
  });

  it("extends recent growth to the end of the period and judges the average", () => {
    // Grows 0.1 GB a day: 6.2 GB when the period opened, 8.8 GB on 10-09, 9.1 GB on its last day.
    const result = run("r2.storage", (_, index) => index * 0.1 * GB);
    expect(result.used).toBeCloseTo(8.8 * GB);
    expect(result.rate7).toBeCloseTo(0.1 * GB);
    expect(result.closing).toBeCloseTo(9.1 * GB);
    // The bill is on the average of the 30 days: (6.2 + 9.1) / 2.
    expect(result.projected).toBeCloseTo(7.65 * GB);
    expect(result.status).toBe("ok");
    // 1.2 GB to go at 0.1 GB a day.
    expect(result.exhaustsOn).toBe("2026-10-21");
  });

  it("does not call a late jump over the allowance an overage while the average is under", () => {
    // 4 GB for most of the period, 12 GB since 10-05: about 6.1 GB on average.
    const result = run("r2.storage", (day) => (day >= "2026-10-05" ? 12 * GB : 4 * GB));
    expect(result.ratio).toBeCloseTo(1.2);
    expect(result.projected).toBeCloseTo((22 * 4 + 8 * 12) / 30 * GB);
    expect(result.overageUsd).toBe(0);
    // Not billed this period, but it will be if it stays: flagged, not ignored.
    expect(result.status).toBe("watch");
  });

  it("still reports the overage after storage was cleared late in the period", () => {
    // 12 GB until yesterday, 2 GB today: the days already stored put the average over.
    const result = run("r2.storage", (day) => (day === "2026-10-09" ? 2 * GB : 12 * GB));
    expect(result.used).toBe(2 * GB);
    expect(result.status).toBe("exceeded");
    expect(result.overageUsd).toBeGreaterThan(0);
  });

  it("does not read one jump as a trend", () => {
    // A 3 GB database appears on 10-06 and stays that size.
    const result = run("d1.storage", (day) => (day >= "2026-10-06" ? 3 * GB : 0));
    expect(result.rate7).toBe(0);
    expect(result.rate30).toBe(0);
    expect(result.closing).toBe(3 * GB);
    expect(result.status).toBe("ok");
    expect(result.exhaustsOn).toBeNull();
  });

  it("still sees growth that comes in steps", () => {
    // 1 GB added every Monday for a month.
    const result = run("r2.storage", (day) => {
      const mondays = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"];
      return mondays.filter((monday) => day >= monday).length * GB;
    });
    expect(result.rate30).toBeGreaterThan(0);
    expect(result.exhaustsOn).not.toBeNull();
  });

  it("charges on the average level over the period, not the peak", () => {
    // 12 GB all period: 2 GB over, at $0.015 per GB-month.
    const result = run("r2.storage", () => 12 * GB);
    expect(result.status).toBe("exceeded");
    expect(result.overageUsd).toBeCloseTo(0.03);
  });

  it("never projects below zero when storage is shrinking", () => {
    const result = run("kv.storage", (_, index) => Math.max(0, 1e6 - index * 5e5));
    expect(result.projected).toBe(0);
  });

  it("gives the previous period's closing level", () => {
    const result = run("d1.storage", (day) => (day >= "2026-09-13" ? 300 : 100));
    expect(result.previous).toEqual({ total: 100, samePoint: 100 });
  });
});

describe("a metric with no allowance", () => {
  it("is metered from the first unit instead of being over", () => {
    const result = run("r2ia.storage", () => 3e9);
    expect(result.status).toBe("metered");
    expect(result.ratio).toBe(0);
    expect(result.overageUsd).toBeCloseTo(0.03);
  });

  it("stays quiet when unused", () => {
    expect(run("r2ia.classA", () => 0).status).toBe("ok");
  });
});

describe("a daily allowance", () => {
  it("holds today against the allowance, because the allowance starts again every day", () => {
    // 9,300 on 10-03, the usual 200 since. Today is 10-09.
    const result = run("ai.neurons", (day) => (day === "2026-10-03" ? 9_300 : 200));
    expect(result.used).toBe(200);
    expect(result.ratio).toBeCloseTo(0.02);
    // An ordinary recent day (the last 7 include 10-03) is what today is measured against, not the record.
    expect(result.projected).toBeCloseTo(1_500);
    expect(result.status).toBe("ok");
    expect(result.daily).toEqual({ busiest: 9_300, busiestDay: "2026-10-03", daysOver: 0 });
    expect(result.overageUsd).toBe(0);
  });

  it("keeps a day that went over on the bill, and bills only the excess", () => {
    const result = run("ai.neurons", (day) => (day === "2026-10-01" ? 14_000 : 200));
    expect(result.used).toBe(200);
    expect(result.status).toBe("exceeded");
    expect(result.daily).toEqual({ busiest: 14_000, busiestDay: "2026-10-01", daysOver: 1 });
    // 4,000 neurons over on one day at $0.011 per 1,000.
    expect(result.overageUsd).toBeCloseTo(0.044);
  });

  it("treats a day that used exactly the allowance as inside it", () => {
    const result = run("ai.neurons", (day) => (day === "2026-10-01" ? 10_000 : 200));
    expect(result.status).toBe("ok");
    expect(result.daily?.daysOver).toBe(0);
  });

  it("flags today once it is most of the way through the allowance", () => {
    const result = run("ai.neurons", (day) => (day === "2026-10-09" ? 8_500 : 200));
    expect(result.used).toBe(8_500);
    expect(result.status).toBe("watch");
  });

  it("flags a pace that runs past the allowance on an ordinary day", () => {
    const result = run("ai.neurons", (day) => (day === "2026-10-09" ? 100 : 9_900));
    expect(result.status).toBe("watch");
    expect(run("ai.neurons", (day) => (day === "2026-10-09" ? 100 : 12_000)).status).toBe("exceeded");
  });

  it("forgets a busy day once the period it fell in is over", () => {
    // 15,000 on 09-25, in the period before; as of 10-20 the new period has only quiet days.
    const days = rangeDays("2026-08-01", "2026-10-20");
    const cycle = cycleFor("2026-10-20", RENEWAL_DAY);
    const result = evaluate({
      def: def("ai.neurons"),
      days,
      values: days.map((day) => (day === "2026-09-25" ? 15_000 : 200)),
      cycle,
      previous: previousCycle(cycle, RENEWAL_DAY),
      asOfMs: Date.parse("2026-10-20T12:00:00Z"),
    });
    expect(result.used).toBe(200);
    expect(result.status).toBe("ok");
    expect(result.overageUsd).toBe(0);
    expect(result.daily).toEqual({ busiest: 200, busiestDay: "2026-10-13", daysOver: 0 });
  });

  it("is fine while every day stays inside", () => {
    const result = run("ai.neurons", () => 260);
    expect(result.status).toBe("ok");
    expect(result.projected).toBe(260);
    expect(result.overageUsd).toBe(0);
  });
});

describe("data that stops before now", () => {
  it("reads up to the last day on record", () => {
    const later = Date.parse("2026-10-11T00:00:00Z");
    const result = run("workers.requests", () => 100_000, later);
    expect(result.used).toBe(2_700_000);
    expect(result.projected7).toBeCloseTo(2_700_000 + 100_000 * 2);
  });

  it("copes with no data at all", () => {
    const cycle = cycleFor("2026-10-09", RENEWAL_DAY);
    const result = evaluate({
      def: def("workers.requests"),
      days: [],
      values: [],
      cycle,
      previous: previousCycle(cycle, RENEWAL_DAY),
      asOfMs: AS_OF,
    });
    expect(result.used).toBe(0);
    expect(result.active).toBe(false);
  });
});

describe("isMinor", () => {
  it("sets aside what is under 1% of its allowance now and projected", () => {
    expect(isMinor(run("kv.reads", () => 300))).toBe(true);
    expect(isMinor(run("workers.requests", () => 10_000))).toBe(false);
  });

  it("keeps anything flagged, metered, or with a notable day in view", () => {
    expect(isMinor(run("kv.writes", () => 50_000))).toBe(false);
    expect(isMinor(run("r2ia.storage", () => 5))).toBe(false);
    // Quiet today and on average, but one day this period used a third of the daily allowance.
    expect(isMinor(run("ai.neurons", (day) => (day === "2026-09-20" ? 3_000 : 0)))).toBe(false);
    expect(isMinor(run("ai.neurons", () => 50))).toBe(true);
  });
});

describe("the whole account", () => {
  const snapshot: Snapshot = {
    v: 1,
    accountId: "a",
    fetchedAt: "2026-10-09T12:00:00Z",
    days: DAYS,
    metrics: {
      "workers.cpuMs": { total: DAYS.map(() => 1_000_000), by: {} },
      "workers.requests": { total: DAYS.map(() => 10_000), by: {} },
      "kv.writes": { total: DAYS.map(() => 50_000), by: {} },
    },
    extras: {},
    warnings: [],
  };

  it("judges every metric in the catalog against the period the data falls in", () => {
    const report = evaluateSnapshot(snapshot, RENEWAL_DAY);
    expect(report.cycle.start).toBe("2026-09-13");
    expect(report.evaluations).toHaveLength(CATALOG.length);
  });

  it("puts what needs attention first", () => {
    const ordered = byUrgency(evaluateSnapshot(snapshot, RENEWAL_DAY).evaluations);
    expect(ordered.slice(0, 3).map((entry) => entry.def.id)).toEqual([
      "kv.writes",
      "workers.cpuMs",
      "workers.requests",
    ]);
  });

  it("adds up the estimated charges", () => {
    const { evaluations } = evaluateSnapshot(snapshot, RENEWAL_DAY);
    const expected = evaluations.reduce((total, entry) => total + entry.overageUsd, 0);
    expect(totalOverageUsd(evaluations)).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
