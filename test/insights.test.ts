import { describe, expect, it } from "vitest";

import type { MetricId } from "../shared/catalog";
import { rangeDays } from "../shared/dates";
import { evaluateSnapshot } from "../shared/forecast";
import { messages, type Messages } from "../shared/i18n";
import { findings, headline, resourceName } from "../shared/insights";
import type { Series, Snapshot } from "../shared/types";

const DAYS = rangeDays("2026-07-13", "2026-10-09");
const NOW = Date.parse("2026-10-09T12:00:00Z");
const RENEWAL_DAY = 13;
const en = messages("en");
const zh = messages("zh-TW");

type Daily = (day: string, index: number) => number;

function series(total: Daily, by: Record<string, Daily> = {}): Series {
  return {
    total: DAYS.map(total),
    by: Object.fromEntries(Object.entries(by).map(([key, fn]) => [key, DAYS.map(fn)])),
  };
}

function snapshotOf(metrics: Partial<Record<MetricId, Series>>, extras: Snapshot["extras"] = {}): Snapshot {
  return { v: 1, accountId: "a", fetchedAt: new Date(NOW).toISOString(), days: DAYS, metrics, extras, warnings: [] };
}

function headlineOf(metrics: Partial<Record<MetricId, Series>>, m: Messages = zh) {
  return headline(evaluateSnapshot(snapshotOf(metrics), RENEWAL_DAY), NOW, m);
}

function findingsOf(snapshot: Snapshot, names: Record<string, string> = {}, m: Messages = zh) {
  return findings(snapshot, evaluateSnapshot(snapshot, RENEWAL_DAY), names, m);
}

/** The findings as sentences, in the given language. */
function textsOf(snapshot: Snapshot, m: Messages, names: Record<string, string> = {}): string[] {
  return findingsOf(snapshot, names, m).map((finding) => finding.text);
}

describe("headline", () => {
  it("says so when nothing will go over, and names what is closest", () => {
    const result = headlineOf({ "workers.cpuMs": series(() => 500_000), "workers.requests": series(() => 10_000) });
    expect(result.tone).toBe("ok");
    expect(result.title).toBe("這期不會超額。");
    expect(result.detail).toBe("10 月 13 日續約，還有 3 天 12 小時。最接近上限的是 Workers CPU 時間，期末預估 51%。");
  });

  it("says the same in English, with a verb that agrees with the metric's name", () => {
    const one = headlineOf({ "workers.cpuMs": series(() => 500_000), "workers.requests": series(() => 10_000) }, en);
    expect(one.title).toBe("Nothing will go over this period.");
    expect(one.detail).toBe(
      "Renews Oct 13, in 3 days 12 hours. Workers CPU time is closest to its allowance, projected at 51%.",
    );
    const many = headlineOf({ "workers.requests": series(() => 150_000) }, en);
    expect(many.detail).toBe(
      "Renews Oct 13, in 3 days 12 hours. Workers requests are closest to their allowance, projected at 46%.",
    );
  });

  it("flags a projection that comes close", () => {
    const result = headlineOf({ "workers.cpuMs": series(() => 900_000) });
    expect(result.tone).toBe("watch");
    expect(result.title).toBe("這期不會超額，Workers CPU 時間會用到 92%。");
    expect(headlineOf({ "workers.cpuMs": series(() => 900_000) }, en).title).toBe(
      "Nothing will go over this period, but Workers CPU time will reach 92% of the allowance.",
    );
  });

  it("names the day the first allowance runs out, then the others and the cost", () => {
    const result = headlineOf({
      "workers.cpuMs": series(() => 1_000_000),
      "kv.writes": series(() => 36_500),
    });
    expect(result.tone).toBe("over");
    expect(result.title).toBe("KV 寫入會在 10 月 9 日用完。");
    expect(result.detail).toContain("Workers CPU 時間也會在這期用完。");
    expect(result.detail).toContain("預估超額費用 $");

    const english = headlineOf(
      { "workers.cpuMs": series(() => 1_000_000), "kv.writes": series(() => 36_500) },
      en,
    );
    expect(english.title).toBe("Included KV writes will run out on Oct 9.");
    expect(english.detail).toBe(
      "Renews Oct 13, in 3 days 12 hours. Workers CPU time will also go over this period. Estimated extra charges: $0.58.",
    );
  });

  it("leads with what is already over", () => {
    const result = headlineOf({ "kv.writes": series(() => 50_000), "workers.cpuMs": series(() => 1_000_000) });
    expect(result.tone).toBe("over");
    expect(result.title).toBe("KV 寫入已經超過內含額度。");
    expect(result.detail).toContain("Workers CPU 時間也會在這期用完。");

    const english = headlineOf({ "kv.writes": series(() => 50_000), "workers.cpuMs": series(() => 1_000_000) }, en);
    expect(english.title).toBe("KV writes are over the included allowance.");
    expect(english.detail).toContain("Workers CPU time will also go over this period.");
    expect(headlineOf({ "workers.cpuMs": series(() => 2_000_000) }, en).title).toBe(
      "Workers CPU time is over the included allowance.",
    );
  });

  it("has a plain answer for an account with no usage", () => {
    expect(headlineOf({}).title).toBe("這期還沒有用量。");
    expect(headlineOf({}, en)).toEqual({
      tone: "ok",
      title: "No usage yet this period.",
      detail: "Renews Oct 13, in 3 days 12 hours.",
    });
  });
});

describe("findings", () => {
  it("names the resource behind most of a metric, with CPU per request for Workers", () => {
    const snapshot = snapshotOf({
      "workers.cpuMs": series(() => 500_000, { site: () => 400_000, api: () => 100_000 }),
      "workers.requests": series(() => 10_000, { site: () => 8_000, api: () => 2_000 }),
    });
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "site 佔了 Workers CPU 時間的 80%，平均每次請求 50 ms。",
    );
    expect(textsOf(snapshot, en)).toContain(
      "80% of Workers CPU time came from site, at an average of 50 ms per request.",
    );
  });

  it("uses the published name of a resource known only by id", () => {
    const id = "ada9faa6-f012-40cd-bc7f-aba60723c557";
    const snapshot = snapshotOf({ "d1.rowsWritten": series(() => 400_000, { [id]: () => 400_000 }) });
    expect(findingsOf(snapshot, { [id]: "access-production" })[0]?.text).toBe(
      "access-production 佔了 D1 寫入列數的 100%。",
    );
    expect(textsOf(snapshot, en, { [id]: "access-production" })[0]).toBe(
      "100% of D1 rows written came from access-production.",
    );
  });

  it("reports a week that doubled, and who grew most", () => {
    const busy: Daily = (day) => (day >= "2026-10-02" && day <= "2026-10-08" ? 300_000 : 100_000);
    const snapshot = snapshotOf({
      "workers.requests": series(busy, { quiet: () => 50_000, loud: (day, index) => busy(day, index) - 50_000 }),
    });
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "Workers 請求這 7 天是前 7 天的 3.0 倍，增加最多的是 loud。",
    );
    expect(textsOf(snapshot, en)).toContain(
      "Workers requests over the last 7 days were 3.0× the 7 days before, and loud grew the most.",
    );
  });

  it("reports a single day far above the usual", () => {
    const snapshot = snapshotOf({
      "workers.requests": series((day) => (day === "2026-10-05" ? 600_000 : 100_000)),
    });
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "10 月 5 日的 Workers 請求是平常一天的 6.0 倍（600K）。",
    );
    expect(textsOf(snapshot, en)).toContain("Workers requests on Oct 5 were 6.0× a usual day (600K).");
  });

  it("reports Workers that fail often, but not requests nobody owns", () => {
    const snapshot = snapshotOf(
      { "workers.requests": series(() => 2_000, { flaky: () => 1_000, __unknown__: () => 1_000 }) },
      { "workers.errors": series(() => 1_020, { flaky: () => 120, __unknown__: () => 900 }) },
    );
    const texts = findingsOf(snapshot).map((finding) => finding.text);
    expect(texts).toContain("flaky 這 7 天有 12% 的請求出錯（840 次）。");
    expect(texts.some((text) => text.includes("未歸屬"))).toBe(false);

    const english = textsOf(snapshot, en);
    expect(english).toContain("12% of requests to flaky failed in the last 7 days (840 requests).");
    expect(english.some((text) => text.includes("Unattributed") && text.includes("failed"))).toBe(false);
  });

  it("warns when storage will pass its allowance after this period", () => {
    // Stands at 9 GB on 10-09 and grows 20 MB a day: about 50 days to 10 GB.
    const snapshot = snapshotOf({
      "r2.storage": series((_, index) => 9e9 - (DAYS.length - 1 - index) * 20e6),
    });
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "照最近的增加速度，R2 儲存的存量會在 11 月 28 日超過內含額度。",
    );
    expect(textsOf(snapshot, en)).toContain(
      "At its recent rate of growth, R2 storage will go over the included allowance on Nov 28.",
    );
  });

  it("says when storage is over the allowance but this period's average is not", () => {
    const snapshot = snapshotOf({ "r2.storage": series((day) => (day >= "2026-10-05" ? 12e9 : 4e9)) });
    expect(headline(evaluateSnapshot(snapshot, RENEWAL_DAY), NOW, zh).tone).toBe("watch");
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "R2 儲存的存量已經超過內含額度，這期的平均還沒有。維持這個量，下一期會開始計費。",
    );
    expect(headline(evaluateSnapshot(snapshot, RENEWAL_DAY), NOW, en).title).toBe(
      "Nothing will go over this period, but R2 storage will average 61% of the allowance.",
    );
    expect(textsOf(snapshot, en)).toContain(
      "R2 storage is now over the included allowance, but this period's average is not. If it stays at this level, it will be billed next period.",
    );
  });

  it("says where a stored amount is, not where it came from", () => {
    const snapshot = snapshotOf({ "r2.storage": series(() => 3e9, { media: () => 2.4e9, backups: () => 0.6e9 }) });
    expect(textsOf(snapshot, en)).toContain("80% of R2 storage is in media.");
    expect(textsOf(snapshot, zh)).toContain("media 佔了 R2 儲存的 80%。");
  });

  it("does not give storage a run-out day in the headline", () => {
    // 11 GB all period: the average will end over, and there is no day it "runs out".
    // (27 days at 11 GB is 9.9 GB of the 30-day average so far, so it is not over yet.)
    const result = headlineOf({ "r2.storage": series(() => 11e9) });
    expect(result.tone).toBe("over");
    expect(result.title).toBe("R2 儲存這期會超過內含額度。");
    expect(result.detail).toContain("預估超額費用 $");
    expect(headlineOf({ "r2.storage": series(() => 11e9) }, en).title).toBe(
      "R2 storage will go over the included allowance this period.",
    );
  });

  it("compares with the same point of the previous period", () => {
    // 60K a day this period against 40K the period before; today is half over, so half a day's worth.
    const snapshot = snapshotOf({
      "workers.requests": series((day) =>
        day === "2026-10-09" ? 30_000 : day >= "2026-09-13" ? 60_000 : 40_000,
      ),
    });
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain("Workers 請求比上一期同一時間點多 50%。");
    expect(textsOf(snapshot, en)).toContain("Workers requests are 50% higher than at this point last period.");
  });

  it("puts a period that is far ahead of the last one as a multiple", () => {
    const snapshot = snapshotOf({
      "workers.cpuMs": series((day) => (day === "2026-10-09" ? 250_000 : day >= "2026-09-13" ? 500_000 : 200_000)),
    });
    expect(textsOf(snapshot, zh)).toContain("Workers CPU 時間是上一期同一時間點的 2.5 倍。");
    expect(textsOf(snapshot, en)).toContain("Workers CPU time is 2.5× what it was at this point last period.");
  });

  it("mentions a day that came close to a daily allowance, without holding it against today", () => {
    const snapshot = snapshotOf({ "ai.neurons": series((day) => (day === "2026-10-03" ? 9_300 : 200)) });
    const report = evaluateSnapshot(snapshot, RENEWAL_DAY);
    expect(headline(report, NOW, zh).tone).toBe("ok");
    expect(headline(report, NOW, zh).detail).toContain("最接近上限的是 Workers AI Neurons，一天大約用掉每日額度的 15%。");
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "Workers AI Neurons 這期最高的一天是 10 月 3 日，用到每日額度的 93%。",
    );
    expect(headline(report, NOW, en).detail).toContain(
      "Workers AI neurons are closest to their allowance, at about 15% of it a day.",
    );
    expect(textsOf(snapshot, en)).toContain(
      "The busiest day for Workers AI neurons this period was Oct 3, at 93% of the daily allowance.",
    );
  });

  it("reports days that went over a daily allowance and what they cost", () => {
    const snapshot = snapshotOf({
      "ai.neurons": series((day) => (day === "2026-10-01" || day === "2026-10-05" ? 14_000 : 200)),
    });
    const report = evaluateSnapshot(snapshot, RENEWAL_DAY);
    expect(headline(report, NOW, zh).title).toBe("Workers AI Neurons 這期有幾天超過每日額度。");
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "Workers AI Neurons 這期有 2 天超過每日額度，超出的部分大約 $0.09。",
    );
    expect(headline(report, NOW, en).title).toBe("Workers AI neurons went over the daily allowance this period.");
    expect(textsOf(snapshot, en)).toContain(
      "Workers AI neurons went over the daily allowance on 2 days this period. The excess comes to about $0.09.",
    );
  });

  it("prices usage that has no allowance", () => {
    const snapshot = snapshotOf({ "r2ia.storage": series(() => 3e9) });
    expect(findingsOf(snapshot).map((finding) => finding.text)).toContain(
      "R2 低頻儲存沒有免費額度，這期大約 $0.03。",
    );
    expect(textsOf(snapshot, en)).toContain(
      "R2 Infrequent Access storage has no included allowance, so this period costs about $0.03.",
    );
  });

  it("stays quiet about small, steady usage", () => {
    const snapshot = snapshotOf({ "kv.reads": series(() => 300, { ns: () => 300 }) });
    expect(findingsOf(snapshot)).toEqual([]);
    expect(textsOf(snapshot, en)).toEqual([]);
  });

  it("puts what is over before what is merely notable, and caps the list", () => {
    const snapshot = snapshotOf({
      "kv.writes": series(() => 50_000, { ns: () => 50_000 }),
      "workers.requests": series((day) => (day >= "2026-09-13" ? 60_000 : 40_000), { site: () => 60_000 }),
    });
    const found = findingsOf(snapshot);
    expect(found[0]?.tone).toBe("over");
    expect(found.length).toBeLessThanOrEqual(6);
  });

  it("returns nothing without data", () => {
    const empty: Snapshot = { ...snapshotOf({}), days: [] };
    expect(findings(empty, evaluateSnapshot(empty, RENEWAL_DAY), {}, zh)).toEqual([]);
    expect(findings(empty, evaluateSnapshot(empty, RENEWAL_DAY), {}, en)).toEqual([]);
  });
});

describe("resourceName", () => {
  it("prefers a published name, then a readable key, then a short id", () => {
    expect(resourceName("my-site", {}, zh)).toBe("my-site");
    expect(resourceName("0daa24cf167b4dd6a7db6e4651cb40a6", {}, zh)).toBe("0daa24cf");
    expect(resourceName("0daa24cf167b4dd6a7db6e4651cb40a6", { "0daa24cf167b4dd6a7db6e4651cb40a6": "sessions" }, zh)).toBe("sessions");
    expect(resourceName("pages:docs", {}, zh)).toBe("docs（Pages）");
    expect(resourceName("__other", {}, zh)).toBe("其他");
    expect(resourceName("__unknown__", {}, zh)).toBe("未歸屬的請求");
    expect(resourceName("constructor", {}, zh)).toBe("constructor");
    expect(resourceName("pages:docs", {}, en)).toBe("docs (Pages)");
    expect(resourceName("__other", {}, en)).toBe("Other");
    expect(resourceName("__unknown__", {}, en)).toBe("Unattributed requests");
  });
});
