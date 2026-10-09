import { describe, expect, it } from "vitest";

import { CATALOG, METRIC_IDS } from "../shared/catalog";
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  LOCALES,
  errorText,
  isErrorCode,
  messages,
  metricText,
  pickLocale,
} from "../shared/i18n";
import type { Warning } from "../shared/types";

const en = messages("en");
const zh = messages("zh-TW");

const HAN = /[㐀-鿿豈-﫿]/;

describe("pickLocale", () => {
  it("reads a ?lang= value", () => {
    expect(pickLocale("en")).toBe("en");
    expect(pickLocale("zh-TW")).toBe("zh-TW");
    expect(pickLocale("zh")).toBe("zh-TW");
    expect(pickLocale("ZH-tw")).toBe("zh-TW");
    expect(pickLocale(" zh-Hant ")).toBe("zh-TW");
  });

  it("treats every Chinese as Traditional Chinese, the only one there is", () => {
    expect(pickLocale("zh-CN")).toBe("zh-TW");
    expect(pickLocale("zh-Hans-SG")).toBe("zh-TW");
    expect(pickLocale("zh-HK")).toBe("zh-TW");
  });

  it("goes by the first language of an Accept-Language header", () => {
    expect(pickLocale("zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("zh-TW");
    expect(pickLocale("en-US,en;q=0.9,zh-TW;q=0.8")).toBe("en");
    expect(pickLocale("ja,zh-TW;q=0.9")).toBe("en");
  });

  it("falls back to English for anything else, and for nothing", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(pickLocale("fr-FR")).toBe("en");
    expect(pickLocale("*")).toBe("en");
    expect(pickLocale("")).toBe("en");
    expect(pickLocale(null)).toBe("en");
    expect(pickLocale(undefined)).toBe("en");
  });
});

describe("the dictionaries", () => {
  /** The keys of a dictionary, with what kind of thing sits at each: a missing or mistyped entry shows up as a difference. */
  function shape(value: unknown): unknown {
    if (value === null) return "null";
    if (typeof value !== "object") return typeof value;
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, inner]) => [key, shape(inner)]));
  }

  /** Every string a dictionary holds as a plain property, by path. */
  function strings(value: unknown, path = ""): [string, string][] {
    if (typeof value === "string") return [[path, value]];
    if (value === null || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, inner]) => strings(inner, path ? `${path}.${key}` : key));
  }

  it("has one for every locale", () => {
    expect(LOCALES).toEqual(["en", "zh-TW"]);
    expect(messages("en")).not.toBe(messages("zh-TW"));
    expect(HTML_LANG).toEqual({ en: "en", "zh-TW": "zh-Hant" });
  });

  it("have the same keys all the way down", () => {
    expect(shape(zh)).toEqual(shape(en));
  });

  it("name every metric in the catalog, and nothing else", () => {
    for (const m of [en, zh]) {
      expect(Object.keys(m.metrics).sort()).toEqual([...METRIC_IDS].sort());
      for (const def of CATALOG) {
        expect(metricText(def.id, m).label).not.toBe("");
        expect(metricText(def.id, m).short).not.toBe("");
        expect(m.products[def.product]).toBeTruthy();
        expect(m.resources[def.resource]).toBeTruthy();
      }
    }
  });

  it("keep Chinese out of the English one", () => {
    expect(strings(en).filter(([, text]) => HAN.test(text))).toEqual([]);
  });

  it("leave no English sentence untranslated in the Chinese one", () => {
    const english = new Map(strings(en));
    // Names that are the same in every language: products, units, and Cloudflare's own nouns.
    const same = strings(zh).filter(([path, text]) => text !== "" && english.get(path) === text);
    expect(same.map(([path]) => path).sort()).toEqual(
      [
        "metrics.ai.neurons.short",
        "products.Workers",
        "products.D1",
        "products.KV",
        "products.R2",
        "products.Durable Objects",
        "products.Queues",
        "products.Workers AI",
        "resources.worker",
        "datasets.workers",
        "datasets.pages",
        "datasets.d1",
        "datasets.kv",
        "datasets.r2",
        "datasets.dop",
        "datasets.queues",
        "datasets.ai",
      ].sort(),
    );
  });
});

describe("sentences with figures in them", () => {
  it("writes a day in words", () => {
    expect(en.day({ month: 10, day: 13 })).toBe("Oct 13");
    expect(zh.day({ month: 10, day: 13 })).toBe("10 月 13 日");
  });

  it("joins the sentences of a paragraph the way each language does", () => {
    expect(en.sentences({ parts: ["One.", "Two."] })).toBe("One. Two.");
    expect(zh.sentences({ parts: ["一。", "二。"] })).toBe("一。二。");
  });

  it("lists up to two metrics by name, then counts the rest", () => {
    expect(en.headline.over({ metrics: ["kv.writes"] })).toBe("KV writes are over the included allowance.");
    expect(en.headline.over({ metrics: ["r2.storage"] })).toBe("R2 storage is over the included allowance.");
    expect(en.headline.over({ metrics: ["kv.writes", "r2.storage"] })).toBe(
      "KV writes and R2 storage are over the included allowance.",
    );
    expect(en.headline.over({ metrics: ["kv.writes", "r2.storage", "d1.rowsRead"] })).toBe(
      "KV writes, R2 storage and 1 other are over the included allowance.",
    );
    expect(zh.headline.over({ metrics: ["kv.writes", "r2.storage", "d1.rowsRead"] })).toBe(
      "KV 寫入、R2 儲存等 3 項已經超過內含額度。",
    );
  });

  it("says what a metric is measured in and what it costs", () => {
    expect(en.metricList.figuresDaily({ used: "249", allowance: "10K" })).toBe("249 / 10K a day");
    expect(zh.metricList.figuresDaily({ used: "249", allowance: "10K" })).toBe("249 ／ 每天 10K");
    expect(en.detail.price.per({ usd: "$0.3", units: "1M", extra: true })).toBe("$0.3 per extra 1M");
    expect(en.detail.price.per({ usd: "$9", units: "1M", extra: false })).toBe("$9 per 1M");
    expect(en.detail.price.perGbMonth({ usd: "$0.015", extra: true })).toBe("$0.015 per extra GB-month");
    expect(zh.detail.price.per({ usd: "$0.02", units: "1M ms", extra: true })).toBe("超過後每 1M ms $0.02");
    expect(zh.detail.price.perGbMonth({ usd: "$0.015", extra: true })).toBe("超過後每 GB 每月 $0.015");
    expect(zh.detail.price.perGbMonth({ usd: "$0.01", extra: false })).toBe("每 GB 每月 $0.01");
  });

  it("counts the small metrics waiting behind one line", () => {
    expect(en.metricList.more({ count: 9, others: true })).toBe("9 more, all under 1%");
    expect(en.metricList.more({ count: 1, others: true })).toBe("1 more, under 1%");
    expect(en.metricList.more({ count: 4, others: false })).toBe("4 in use, all under 1%");
    expect(zh.metricList.more({ count: 9, others: true })).toBe("另外 9 項都不到 1%");
    expect(zh.metricList.more({ count: 4, others: false })).toBe("4 項，都不到 1%");
  });
});

describe("warnings", () => {
  const cases: [Warning, string, string][] = [
    [
      { kind: "recent-unavailable", reason: "quota exceeded" },
      "Workers AI usage could not be read (quota exceeded).",
      "無法取得 Workers AI 的用量（quota exceeded）",
    ],
    [
      { kind: "clipped", datasets: ["workers", "d1s", "kv"] },
      "Usage data for Workers, D1 storage and KV is incomplete, so actual usage is higher than shown.",
      "Workers、D1 儲存、KV 的用量資料不完整，實際用量比顯示的多",
    ],
    [
      { kind: "clipped", datasets: ["r2s"] },
      "Usage data for R2 storage is incomplete, so actual usage is higher than shown.",
      "R2 儲存的用量資料不完整，實際用量比顯示的多",
    ],
    [
      { kind: "r2-unknown", actions: ["FrobnicateBucket", "TwiddleObject"] },
      "Some R2 operations could not be classified as Class A or Class B and are not counted: FrobnicateBucket, TwiddleObject.",
      "R2 有無法歸類的操作（FrobnicateBucket、TwiddleObject），沒有算進用量",
    ],
    [
      { kind: "stale" },
      "The latest update failed. These figures are from the previous update.",
      "最近一次更新沒有成功，這是上一次的數字",
    ],
  ];

  it.each(cases)("says %j in both languages", (warning, english, chinese) => {
    expect(en.warning(warning)).toBe(english);
    expect(zh.warning(warning)).toBe(chinese);
  });
});

describe("errorText", () => {
  it("has a sentence for every code the API answers with", () => {
    const codes = ["analytics", "unknown-account", "no-token", "invalid-request", "rate-limited", "unauthenticated", "unavailable"];
    for (const m of [en, zh]) {
      for (const code of codes) {
        expect(isErrorCode(code, m)).toBe(true);
        expect(errorText(code, m)).not.toBe(m.errors.unknown);
      }
    }
    expect(errorText("unauthenticated", en)).toBe("Your sign-in has expired. Sign in again.");
    expect(errorText("unauthenticated", zh)).toBe("登入狀態失效了，請重新登入。");
  });

  it("falls back for a code it has never heard of, without finding Object's own properties", () => {
    expect(errorText("teapot", en)).toBe(en.errors.unknown);
    expect(errorText("constructor", en)).toBe(en.errors.unknown);
    expect(isErrorCode("toString", zh)).toBe(false);
  });

  it("passes on what Cloudflare said about an analytics failure", () => {
    expect(errorText("analytics", en, "Authentication error")).toBe(
      "Cloudflare Analytics returned an error (Authentication error).",
    );
    expect(errorText("analytics", zh, "Authentication error")).toBe(
      "Cloudflare Analytics 回傳了錯誤（Authentication error）。",
    );
    expect(errorText("analytics", en, null)).toBe(en.errors.analytics);
    expect(errorText("rate-limited", en, "ignored")).toBe(en.errors["rate-limited"]);
  });
});
