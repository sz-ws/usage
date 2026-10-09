import { describe, expect, it } from "vitest";

import { rangeDays } from "../shared/dates";
import { OTHER_KEY } from "../shared/types";
import { spans } from "../worker/cloudflare";
import { MAX_RESOURCES, shape, type RawWindow } from "../worker/shape";

const DAYS = rangeDays("2026-10-01", "2026-10-05");

function build(...windows: RawWindow[]) {
  return shape({ accountId: "a", fetchedAt: "2026-10-05T12:00:00Z", days: DAYS, windows });
}

describe("shape", () => {
  it("lines usage up by day and by Worker, CPU in milliseconds", () => {
    const snapshot = build({
      workers: [
        { dimensions: { date: "2026-10-01", scriptName: "site" }, sum: { requests: 10, errors: 1, cpuTimeUs: 5_000 } },
        { dimensions: { date: "2026-10-03", scriptName: "site" }, sum: { requests: 20, errors: 0, cpuTimeUs: 9_400 } },
        { dimensions: { date: "2026-10-03", scriptName: "api" }, sum: { requests: 5, errors: 5, cpuTimeUs: 1_000 } },
      ],
    });

    expect(snapshot.days).toEqual(DAYS);
    expect(snapshot.metrics["workers.requests"]).toEqual({
      total: [10, 0, 25, 0, 0],
      by: { site: [10, 0, 20, 0, 0], api: [0, 0, 5, 0, 0] },
    });
    expect(snapshot.metrics["workers.cpuMs"]?.total).toEqual([5, 0, 10, 0, 0]);
    expect(snapshot.extras["workers.errors"]?.by.api).toEqual([0, 0, 5, 0, 0]);
  });

  it("counts Pages Functions as Workers requests under their own name", () => {
    const snapshot = build({
      workers: [{ dimensions: { date: "2026-10-02", scriptName: "site" }, sum: { requests: 3, errors: 0, cpuTimeUs: 0 } }],
      pages: [{ dimensions: { date: "2026-10-02", scriptName: "site" }, sum: { requests: 4, errors: 0 } }],
    });
    expect(snapshot.metrics["workers.requests"]?.total[1]).toBe(7);
    expect(Object.keys(snapshot.metrics["workers.requests"]?.by ?? {}).sort()).toEqual(["pages:site", "site"]);
  });

  it("adds rows for the same day that arrive in different windows", () => {
    const row = { dimensions: { date: "2026-10-02", databaseId: "db" }, sum: { rowsRead: 5, rowsWritten: 1 } };
    const snapshot = build({ d1: [row] }, { d1: [row] });
    expect(snapshot.metrics["d1.rowsRead"]?.total).toEqual([0, 10, 0, 0, 0]);
  });

  it("splits KV by operation", () => {
    const at = (actionType: string, requests: number) => ({
      dimensions: { date: "2026-10-01", actionType, namespaceId: "ns" },
      sum: { requests },
    });
    const snapshot = build({ kv: [at("read", 9), at("write", 3), at("delete", 2), at("list", 1), at("other", 50)] });
    expect(snapshot.metrics["kv.reads"]?.total[0]).toBe(9);
    expect(snapshot.metrics["kv.writes"]?.total[0]).toBe(3);
    expect(snapshot.metrics["kv.deletes"]?.total[0]).toBe(2);
    expect(snapshot.metrics["kv.lists"]?.total[0]).toBe(1);
  });

  it("sorts R2 operations into billing classes and storage tiers", () => {
    const at = (actionType: string, storageClass: string, requests: number) => ({
      dimensions: { date: "2026-10-01", actionType, bucketName: "b", storageClass },
      sum: { requests },
    });
    const snapshot = build({
      r2: [
        at("PutObject", "Standard", 3),
        at("ListObjects", "Standard", 2),
        at("GetObject", "Standard", 40),
        at("HeadObject", "InfrequentAccess", 7),
        at("DeleteObject", "Standard", 100),
      ],
    });
    expect(snapshot.metrics["r2.classA"]?.total[0]).toBe(5);
    expect(snapshot.metrics["r2.classB"]?.total[0]).toBe(40);
    expect(snapshot.metrics["r2ia.classB"]?.total[0]).toBe(7);
    expect(snapshot.metrics["r2ia.classA"]).toBeUndefined();
    expect(snapshot.warnings).toEqual([]);
  });

  it("places R2 operations the pricing page does not list by what they do", () => {
    const at = (actionType: string, requests: number) => ({
      dimensions: { date: "2026-10-01", actionType, bucketName: "b", storageClass: "Standard" },
      sum: { requests },
    });
    const snapshot = build({
      r2: [at("GetBucketSippyConfiguration", 2), at("PutBucketNotificationConfiguration", 3), at("DeleteBucketCors", 9)],
    });
    expect(snapshot.metrics["r2.classB"]?.total[0]).toBe(2);
    expect(snapshot.metrics["r2.classA"]?.total[0]).toBe(3);
    expect(snapshot.warnings).toEqual([]);
  });

  it("says so when R2 reports an operation it cannot classify", () => {
    const snapshot = build({
      r2: [{ dimensions: { date: "2026-10-01", actionType: "NewThing", bucketName: "b", storageClass: "Standard" }, sum: { requests: 1 } }],
    });
    expect(snapshot.warnings).toEqual([{ kind: "r2-unknown", actions: ["NewThing"] }]);
  });

  it("leaves out metrics nobody used", () => {
    const snapshot = build({ queues: [], ai: [] });
    expect(snapshot.metrics).toEqual({});
    expect(snapshot.extras).toEqual({});
  });

  it("ignores rows dated outside the days asked for", () => {
    const snapshot = build({
      d1: [{ dimensions: { date: "2026-09-30", databaseId: "db" }, sum: { rowsRead: 5, rowsWritten: 0 } }],
    });
    expect(snapshot.metrics["d1.rowsRead"]).toBeUndefined();
  });

  it("rounds to what the unit can mean", () => {
    const snapshot = build({
      dop: [{ dimensions: { date: "2026-10-01", namespaceId: "ns" }, sum: { duration: 0.058940031, rowsRead: 0, rowsWritten: 0 } }],
      ai: [{ dimensions: { date: "2026-10-01", modelId: "m" }, sum: { totalNeurons: 248.95545825 } }],
    });
    expect(snapshot.metrics["do.duration"]?.total[0]).toBe(0.059);
    expect(snapshot.metrics["ai.neurons"]?.total[0]).toBe(248.96);
  });
});

describe("stored amounts", () => {
  const size = (date: string, databaseId: string, databaseSizeBytes: number) => ({
    dimensions: { date, databaseId },
    max: { databaseSizeBytes },
  });

  it("carries the last reading across days without one", () => {
    const snapshot = build({ d1s: [size("2026-10-01", "db", 100), size("2026-10-04", "db", 400)] });
    // No reading on the 5th: the dataset as a whole stops on the 4th, so it is lag, not deletion.
    expect(snapshot.metrics["d1.storage"]?.total).toEqual([100, 100, 100, 400, 400]);
  });

  it("reads 0 before a resource existed and after it was deleted", () => {
    const snapshot = build({
      d1s: [
        size("2026-10-01", "old", 50),
        size("2026-10-02", "old", 50),
        size("2026-10-03", "new", 10),
        size("2026-10-04", "new", 20),
        size("2026-10-05", "new", 30),
      ],
    });
    expect(snapshot.metrics["d1.storage"]?.by).toEqual({
      old: [50, 50, 0, 0, 0],
      new: [0, 0, 10, 20, 30],
    });
    expect(snapshot.metrics["d1.storage"]?.total).toEqual([50, 50, 10, 20, 30]);
  });

  it("keeps a resource whose reading is one day behind the others", () => {
    // Early in a UTC day the readings arrive one resource at a time.
    const snapshot = build({
      d1s: [size("2026-10-03", "big", 800), size("2026-10-04", "big", 800), size("2026-10-04", "small", 100), size("2026-10-05", "small", 100)],
    });
    expect(snapshot.metrics["d1.storage"]?.by.big).toEqual([0, 0, 800, 800, 800]);
    expect(snapshot.metrics["d1.storage"]?.total).toEqual([0, 0, 800, 900, 900]);
  });

  it("folds the smallest stored amounts into one line too", () => {
    const snapshot = build({
      kvs: Array.from({ length: MAX_RESOURCES + 2 }, (_, index) => ({
        dimensions: { date: "2026-10-05", namespaceId: `ns${index}` },
        max: { byteCount: (index + 1) * 10 },
      })),
    });
    const series = snapshot.metrics["kv.storage"];
    expect(Object.keys(series?.by ?? {})).toHaveLength(MAX_RESOURCES + 1);
    expect(series?.by[OTHER_KEY]?.[4]).toBe(30);
  });

  it("adds payload and metadata for R2, keeping the tiers apart", () => {
    const snapshot = build({
      r2s: [
        { dimensions: { date: "2026-10-05", bucketName: "b", storageClass: "Standard" }, max: { payloadSize: 900, metadataSize: 100 } },
        { dimensions: { date: "2026-10-05", bucketName: "b", storageClass: "InfrequentAccess" }, max: { payloadSize: 70, metadataSize: 0 } },
      ],
    });
    expect(snapshot.metrics["r2.storage"]?.total[4]).toBe(1000);
    expect(snapshot.metrics["r2ia.storage"]?.total[4]).toBe(70);
  });
});

describe("many resources", () => {
  it("folds everything past the largest into one line without losing any of the total", () => {
    const count = MAX_RESOURCES + 5;
    const snapshot = build({
      workers: Array.from({ length: count }, (_, index) => ({
        dimensions: { date: "2026-10-01", scriptName: `w${index}` },
        sum: { requests: index + 1, errors: 0, cpuTimeUs: 0 },
      })),
    });
    const series = snapshot.metrics["workers.requests"];
    expect(Object.keys(series?.by ?? {})).toHaveLength(MAX_RESOURCES + 1);
    // The five smallest are 1 + 2 + 3 + 4 + 5.
    expect(series?.by[OTHER_KEY]?.[0]).toBe(15);
    expect(series?.total[0]).toBe((count * (count + 1)) / 2);
  });
});

describe("awkward names", () => {
  it("keeps a Worker whose name collides with something on Object", () => {
    const snapshot = build({
      workers: ["__proto__", "constructor"].map((scriptName) => ({
        dimensions: { date: "2026-10-01", scriptName },
        sum: { requests: 2, errors: 0, cpuTimeUs: 0 },
      })),
    });
    const by = snapshot.metrics["workers.requests"]?.by ?? {};
    expect(Object.keys(by).sort()).toEqual(["__proto__", "constructor"]);
    expect(JSON.parse(JSON.stringify(by))).toHaveProperty("constructor", [2, 0, 0, 0, 0]);
  });
});

describe("spans", () => {
  it("covers the history in windows no longer than the API allows, newest first", () => {
    expect(spans("2026-10-09")).toEqual([
      { from: "2026-09-10", to: "2026-10-09" },
      { from: "2026-08-11", to: "2026-09-09" },
      { from: "2026-07-13", to: "2026-08-10" },
    ]);
  });

  it("does not reach past the history asked for", () => {
    expect(spans("2026-10-09", 10, 30)).toEqual([{ from: "2026-09-30", to: "2026-10-09" }]);
    expect(spans("2026-10-09", 31, 30)).toEqual([
      { from: "2026-09-10", to: "2026-10-09" },
      { from: "2026-09-09", to: "2026-09-09" },
    ]);
  });
});
