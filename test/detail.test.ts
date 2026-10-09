import { describe, expect, it } from "vitest";

import { CATALOG, type MetricId } from "../shared/catalog";
import { rangeDays } from "../shared/dates";
import { evaluateSnapshot } from "../shared/forecast";
import { messages } from "../shared/i18n";
import type { Series, Snapshot } from "../shared/types";
import { breakdown } from "../shared/breakdown";
import { chartData } from "../src/lib/detail";
import { niceTicks } from "../src/lib/scale";

const DAYS = rangeDays("2026-07-13", "2026-10-09");
const NOW = "2026-10-09T12:00:00Z";
const en = messages("en");
const zh = messages("zh-TW");
/** More rows than any of these fixtures has resources. */
const ALL = 8;

type Daily = (day: string, index: number) => number;

function series(total: Daily, by: Record<string, Daily> = {}): Series {
  return {
    total: DAYS.map(total),
    by: Object.fromEntries(Object.entries(by).map(([key, fn]) => [key, DAYS.map(fn)])),
  };
}

function setup(id: MetricId, metric: Series, more: Partial<Record<MetricId, Series>> = {}, extras: Snapshot["extras"] = {}) {
  const snapshot: Snapshot = {
    v: 1,
    accountId: "a",
    fetchedAt: NOW,
    days: DAYS,
    metrics: { [id]: metric, ...more },
    extras,
    warnings: [],
  };
  const report = evaluateSnapshot(snapshot, 13);
  const evaluation = report.evaluations[CATALOG.findIndex((def) => def.id === id)];
  if (!evaluation) throw new Error(`no metric ${id}`);
  return { snapshot, report, evaluation };
}

describe("chartData for usage that adds up", () => {
  const { snapshot, report, evaluation } = setup("workers.requests", series(() => 100));
  const chart = chartData(evaluation, snapshot.days, snapshot.metrics["workers.requests"]?.total ?? [], report);

  it("draws a running total from the start of the period to now", () => {
    expect(chart.kind).toBe("running");
    expect(chart.span).toBe(30);
    expect(chart.actual[0]).toEqual({ x: 0, y: 0 });
    expect(chart.actual[1]).toEqual({ x: 1, y: 100 });
    // 27 days on record; today's lands at noon of day 27, not at its end.
    expect(chart.actual).toHaveLength(28);
    expect(chart.actual[27]).toEqual({ x: 26.5, y: 2700 });
  });

  it("continues to the projected close", () => {
    expect(chart.projection).toEqual([
      { x: 26.5, y: 2700 },
      { x: 30, y: evaluation.projected },
    ]);
  });

  it("lays the previous period on the same axis, cut to this period's length", () => {
    // The previous period has 31 days; only 30 fit.
    expect(chart.previous[0]).toEqual({ x: 0, y: 0 });
    expect(chart.previous[chart.previous.length - 1]).toEqual({ x: 30, y: 3000 });
  });

  it("offers the same numbers as rows, one per day", () => {
    expect(chart.rows).toHaveLength(27);
    expect(chart.rows[0]).toEqual({ day: "2026-09-13", value: 100, plotted: 100 });
    expect(chart.rows[26]).toEqual({ day: "2026-10-09", value: 100, plotted: 2700 });
  });

  it("carries the allowance as the limit", () => {
    expect(chart.limit).toBe(10_000_000);
  });
});

describe("chartData for a stored amount", () => {
  const { snapshot, report, evaluation } = setup("r2.storage", series((_, index) => index * 1e6));
  const chart = chartData(evaluation, snapshot.days, snapshot.metrics["r2.storage"]?.total ?? [], report);

  it("draws the level of each day, not a running total", () => {
    expect(chart.kind).toBe("perDay");
    expect(chart.actual[0]).toEqual({ x: 0.5, y: 62e6 });
    expect(chart.actual[26]).toEqual({ x: 26.5, y: 88e6 });
    expect(chart.rows[26]).toEqual({ day: "2026-10-09", value: 88e6, plotted: 88e6 });
  });

  it("extends growth to the last day of the period", () => {
    expect(chart.projection[1]?.x).toBe(29.5);
    expect(chart.projection[1]?.y).toBeCloseTo(91e6);
  });
});

describe("chartData edge cases", () => {
  it("has no previous period when the data does not reach back to it", () => {
    const days = rangeDays("2026-09-01", "2026-10-09");
    const snapshot: Snapshot = {
      v: 1,
      accountId: "a",
      fetchedAt: NOW,
      days,
      metrics: { "workers.requests": { total: days.map(() => 5), by: {} } },
      extras: {},
      warnings: [],
    };
    const report = evaluateSnapshot(snapshot, 13);
    const evaluation = report.evaluations[0];
    if (!evaluation) throw new Error("no evaluation");
    expect(chartData(evaluation, days, days.map(() => 5), report).previous).toEqual([]);
  });

  it("is empty, not broken, without data", () => {
    const { report, evaluation } = setup("workers.requests", series(() => 0));
    const chart = chartData(evaluation, [], [], report);
    expect(chart.actual).toEqual([]);
    expect(chart.rows).toEqual([]);
  });

  it("does not draw a previous period for a metric read for the last month only", () => {
    const { snapshot, report, evaluation } = setup("ai.neurons", series((day) => (day >= "2026-09-09" ? 200 : 0)));
    const chart = chartData(evaluation, snapshot.days, snapshot.metrics["ai.neurons"]?.total ?? [], report);
    expect(chart.previous).toEqual([]);
    expect(chart.actual).toHaveLength(27);
  });

  it("has no limit line for a metric without an allowance", () => {
    const { snapshot, report, evaluation } = setup("r2ia.storage", series(() => 5));
    expect(chartData(evaluation, snapshot.days, snapshot.metrics["r2ia.storage"]?.total ?? [], report).limit).toBeNull();
  });
});

describe("breakdown", () => {
  it("ranks resources by this period's usage with their share and last week's change", () => {
    const { snapshot, report, evaluation } = setup(
      "workers.cpuMs",
      series(() => 1000, { big: () => 700, small: (day) => (day >= "2026-10-02" && day <= "2026-10-08" ? 600 : 300) }),
      { "workers.requests": series(() => 100, { big: () => 70, small: () => 30 }) },
    );
    const { rows, rest } = breakdown(evaluation, snapshot, report, {}, ALL, zh);

    expect(rows.map((row) => row.key)).toEqual(["big", "small"]);
    expect(rows[0]).toMatchObject({ amount: 18_900, share: 0.7, recent: 4900, before: 4900, aside: "每次請求 10 ms" });
    expect(rows[1]).toMatchObject({ recent: 4200, before: 2100 });
    expect(rest).toBeNull();
    expect(breakdown(evaluation, snapshot, report, {}, ALL, en).rows[0]?.aside).toBe("10 ms per request");
  });

  it("shows the error rate beside Workers requests", () => {
    const { snapshot, report, evaluation } = setup(
      "workers.requests",
      series(() => 100, { site: () => 100 }),
      {},
      { "workers.errors": series(() => 5, { site: () => 5 }) },
    );
    expect(breakdown(evaluation, snapshot, report, {}, ALL, zh).rows[0]?.aside).toBe("5.0% 出錯");
    expect(breakdown(evaluation, snapshot, report, {}, ALL, en).rows[0]?.aside).toBe("5.0% failed");
  });

  it("uses the current level for stored amounts and names resources", () => {
    const { snapshot, report, evaluation } = setup(
      "d1.storage",
      series(() => 300, { "ada9faa6-f012-40cd-bc7f-aba60723c557": () => 200, other: () => 100 }),
    );
    const { rows } = breakdown(evaluation, snapshot, report, { "ada9faa6-f012-40cd-bc7f-aba60723c557": "access" }, ALL, zh);
    expect(rows[0]).toMatchObject({ name: "access", amount: 200, recent: 200, before: 200 });
    expect(rows[0]?.share).toBeCloseTo(2 / 3);
  });

  it("sums what does not fit into a remainder and keeps the catch-all last", () => {
    const by: Record<string, Daily> = { __other: () => 1000 };
    for (let index = 0; index < 5; index += 1) by[`w${index}`] = () => index + 1;
    const { snapshot, report, evaluation } = setup("workers.requests", series(() => 1015, by));
    const { rows, rest } = breakdown(evaluation, snapshot, report, {}, 3, zh);

    expect(rows.map((row) => row.key)).toEqual(["w4", "w3", "w2"]);
    // w1 and w0 (2 and 1 a day over 27 days) plus the catch-all, whose own size is not known.
    expect(rest).toEqual({ count: null, amount: 27 * 1003 });
  });

  it("counts the remainder when every resource in it is known", () => {
    const by: Record<string, Daily> = {};
    for (let index = 0; index < 5; index += 1) by[`w${index}`] = () => index + 1;
    const { snapshot, report, evaluation } = setup("workers.requests", series(() => 15, by));
    expect(breakdown(evaluation, snapshot, report, {}, 3, zh).rest).toEqual({ count: 2, amount: 27 * 3 });
  });

  it("is empty for a metric with no data", () => {
    const { snapshot, report, evaluation } = setup("workers.requests", series(() => 1));
    const queue = report.evaluations.find((entry) => entry.def.id === "queues.operations");
    if (!queue) throw new Error("no queue metric");
    expect(breakdown(queue, snapshot, report, {}, ALL, zh)).toEqual({ rows: [], rest: null });
    expect(breakdown(evaluation, { ...snapshot, days: [] }, report, {}, ALL, zh)).toEqual({ rows: [], rest: null });
  });
});

describe("niceTicks", () => {
  it("picks round steps that cover the maximum", () => {
    expect(niceTicks(31_200_000)).toEqual([0, 10_000_000, 20_000_000, 30_000_000, 40_000_000]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(0.9)).toEqual([0, 0.5, 1]);
  });

  it("handles an empty axis", () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});
