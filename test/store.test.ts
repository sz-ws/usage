import { describe, expect, it } from "vitest";

import { rangeDays } from "../shared/dates";
import type { Snapshot } from "../shared/types";
import { Store, type History } from "../worker/store";
import { fakeKv } from "./helpers";

function snapshotOf(days: string[], requests: number[]): Snapshot {
  return {
    v: 1,
    accountId: "a",
    fetchedAt: "2026-10-09T12:00:00Z",
    days,
    metrics: {
      "workers.requests": { total: requests, by: {} },
      "kv.reads": { total: days.map(() => 0), by: {} },
    },
    extras: {},
    warnings: [],
  };
}

describe("snapshots and settings", () => {
  it("returns nothing for an account never read, or stored in another format", async () => {
    const { kv } = fakeKv({ "usage:snapshot:old": { v: 0 } });
    const store = new Store(kv);
    expect(await store.snapshot("a")).toBeNull();
    expect(await store.snapshot("old")).toBeNull();
    expect(await store.names("a")).toEqual({});
    expect(await store.settings()).toEqual({ accounts: {} });
  });

  it("stores a snapshot under its account", async () => {
    const { kv } = fakeKv();
    const store = new Store(kv);
    const snapshot = snapshotOf(["2026-10-09"], [5]);
    await store.saveSnapshot(snapshot);
    expect(await store.snapshot("a")).toEqual(snapshot);
  });

  it("sets one account's billing day without touching the others", async () => {
    const { kv, read } = fakeKv({ "usage:settings": { accounts: { b: { renewalDay: 7 } } } });
    expect(await new Store(kv).saveAccountSettings("a", { renewalDay: 20 })).toEqual({ renewalDay: 20 });
    expect(read("usage:settings")).toEqual({ accounts: { b: { renewalDay: 7 }, a: { renewalDay: 20 } } });
  });

  it("keeps resource names with the time they were looked up", async () => {
    const { kv } = fakeKv();
    const store = new Store(kv);
    expect(await store.namesRecord("a")).toBeNull();

    const record = { v: 1 as const, checkedAt: "2026-10-09T12:00:00.000Z", names: { "db-1": "orders" } };
    await store.saveNames("a", record);
    expect(await store.namesRecord("a")).toEqual(record);
    expect(await store.names("a")).toEqual({ "db-1": "orders" });
  });

  it("keeps everything under its own prefix, apart from the keys of the OAuth library", async () => {
    const { kv, keys } = fakeKv();
    const store = new Store(kv);
    await store.saveSnapshot(snapshotOf(["2026-10-09"], [5]));
    await store.saveAccountSettings("a", { renewalDay: 3 });
    await store.saveNames("a", { v: 1, checkedAt: "2026-10-09T12:00:00.000Z", names: {} });
    await store.saveDirectory({ v: 1, fetchedAt: "2026-10-09T12:00:00.000Z", tokens: "f", accounts: [], problems: [] });
    expect(keys().every((key) => key.startsWith("usage:"))).toBe(true);
  });
});

describe("archive", () => {
  const days = rangeDays("2026-07-10", "2026-07-14");

  it("keeps the totals of days the next snapshot no longer covers, leaving out zeros", async () => {
    const { kv, read } = fakeKv();
    await new Store(kv).archive(snapshotOf(days, [10, 0, 30, 40, 50]), "2026-07-13");
    expect(read<History>("usage:history:a")).toEqual({
      "2026-07-10": { "workers.requests": 10 },
      "2026-07-11": {},
      "2026-07-12": { "workers.requests": 30 },
    });
  });

  it("writes nothing when no day has aged out", async () => {
    const { kv, keys } = fakeKv();
    await new Store(kv).archive(snapshotOf(days, [1, 2, 3, 4, 5]), "2026-07-10");
    expect(keys()).toEqual([]);
  });

  it("does not overwrite a day already archived", async () => {
    const { kv, read } = fakeKv({ "usage:history:a": { "2026-07-10": { "workers.requests": 999 } } });
    await new Store(kv).archive(snapshotOf(days, [10, 20, 30, 40, 50]), "2026-07-12");
    expect(read<History>("usage:history:a")).toEqual({
      "2026-07-10": { "workers.requests": 999 },
      "2026-07-11": { "workers.requests": 20 },
    });
  });

  it("keeps the newest 800 days, oldest dropped first, in date order", async () => {
    const old = rangeDays("2024-01-01", "2026-03-10");
    const existing = Object.fromEntries(old.map((day) => [day, { "workers.requests": 1 }]));
    const { kv, read } = fakeKv({ "usage:history:a": existing });
    await new Store(kv).archive(snapshotOf(days, [10, 20, 30, 40, 50]), "2026-07-12");

    const kept = Object.keys(read<History>("usage:history:a") ?? {});
    expect(kept).toHaveLength(800);
    expect(kept[kept.length - 1]).toBe("2026-07-11");
    expect(kept).toEqual([...kept].sort());
    expect(kept).not.toContain("2024-01-01");
  });
});
