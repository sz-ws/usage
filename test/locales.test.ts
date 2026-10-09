import { describe, expect, it } from "vitest";

import { METRIC_IDS } from "../shared/catalog";
import { DEFAULT_LOCALE, HTML_LANG, LOCALES, LOCALE_NAMES, messages, type Locale } from "../shared/i18n";
import type { Warning } from "../shared/types";
import { MIN_ACCESS_KEY_LENGTH } from "../worker/env";
import { pageText } from "../worker/text";

/**
 * Every language is held to the same checks, so a dictionary that compiles but
 * says "undefined" somewhere, leaves a sentence in English, or lacks an entry
 * for one metric is caught here rather than by a reader.
 */

/** The keys of a dictionary with the kind of thing at each: a missing or mistyped entry shows up as a difference. */
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

/** Every function a dictionary holds, by path. */
function functions(value: unknown, path = ""): [string, (params: unknown) => unknown][] {
  if (typeof value === "function") return [[path, value as (params: unknown) => unknown]];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, inner]) => functions(inner, path ? `${path}.${key}` : key));
}

/** Stand-ins for every parameter a sentence can take, already formatted the way the page passes them. */
const SAMPLE: Record<string, unknown> = {
  parts: ["A.", "B."],
  month: 10,
  days: 3,
  hours: 5,
  ended: false,
  count: 3,
  multiple: "2.3",
  name: "my-worker",
  left: "3d",
  usd: "$1.20",
  metrics: ["kv.writes", "r2.storage", "d1.rowsRead"],
  share: "53%",
  stored: false,
  msPerRequest: 12,
  change: "+12%",
  grower: "api",
  amount: "1.2M",
  percent: "12%",
  more: true,
  used: "16M ms",
  allowance: "30M ms",
  others: true,
  figures: "16M / 30M",
  caption: "x",
  value: "60%",
  projected: "60%",
  extra: true,
  units: "1M",
  ms: "12",
  start: "9/13",
  end: "10/12",
  ago: "5m",
  reason: "R.",
  detail: "Authentication error",
  token: 2,
  status: 403,
  channel: "ntfy",
};

/** `day` is a day of the month in two places and an already written date everywhere else. */
const NUMERIC_DAY = new Set(["day", "shortDay", "verdict.timeline"]);

/** Other values worth a second pass: the singular, the empty, the "no" side of each either-or. */
const VARIANTS: Record<string, unknown>[] = [
  {},
  { count: 1, days: 1, hours: 1, stored: true, more: false, others: false, extra: false },
  { count: 0, days: 0, hours: 0, ended: true, msPerRequest: null, grower: null, reason: null, status: null },
  { status: 200, metrics: ["workers.cpuMs"] },
  { metrics: ["workers.requests", "r2.storage"] },
];

function paramsFor(path: string, metric: string, variant: Record<string, unknown>): unknown {
  const values: Record<string, unknown> = {
    ...SAMPLE,
    day: NUMERIC_DAY.has(path) ? 13 : "D13",
    metric,
    ...variant,
  };
  return new Proxy(values, {
    get(target, key) {
      if (typeof key !== "string") return undefined;
      if (!(key in target)) throw new Error(`${path} reads "${key}", which this test has no sample for`);
      return target[key];
    },
  });
}

const WARNINGS: Warning[] = [
  { kind: "recent-unavailable", reason: "quota exceeded" },
  { kind: "clipped", datasets: ["workers", "d1s", "kv"] },
  { kind: "clipped", datasets: ["r2s"] },
  { kind: "r2-unknown", actions: ["FrobnicateBucket", "TwiddleObject"] },
  { kind: "stale" },
];

const BROKEN = /undefined|NaN|\[object|\bnull\b|\$\{/;

const HAN = /[㐀-鿿]/;
const KANA = /[぀-ヿ]/;
const HANGUL = /[가-힯]/;
/** Characters written differently in Traditional Chinese; none belongs in Simplified text. */
const TRADITIONAL_ONLY = /[帳續儲資庫設錄閱讀寫這個會還沒請點擊號與為過項額齊數據]/;
const SIMPLIFIED_ONLY = /[账续储资库设录阅读写这个会还没请点击号与为过项额]/;

describe.each(LOCALES)("the %s dictionary", (locale: Locale) => {
  const m = messages(locale);
  const en = messages(DEFAULT_LOCALE);

  it("has the same entries as the English one, all the way down", () => {
    expect(shape(m)).toEqual(shape(en));
    expect(Object.keys(m.metrics).sort()).toEqual([...METRIC_IDS].sort());
  });

  it("has no empty string where English has words", () => {
    const english = new Map(strings(en));
    const empty = strings(m).filter(([path, text]) => text.trim() === "" && (english.get(path) ?? "").trim() !== "");
    // A language may need no word after the day picker ("Renewal day [13]") or before it.
    expect(empty.map(([path]) => path).filter((path) => !path.startsWith("verdict.renewal."))).toEqual([]);
  });

  it("builds every sentence for every metric without a hole in it", () => {
    const failures: string[] = [];
    for (const [path, build] of functions(m)) {
      if (path === "warning") continue;
      for (const variant of VARIANTS) {
        for (const metric of METRIC_IDS) {
          let out: unknown;
          try {
            out = build(paramsFor(path, metric, variant));
          } catch (error) {
            failures.push(`${path} threw: ${String(error)}`);
            break;
          }
          if (typeof out !== "string" || out.trim() === "" || BROKEN.test(out)) {
            failures.push(`${path}(${metric}) -> ${JSON.stringify(out)}`);
            break;
          }
        }
      }
    }
    expect([...new Set(failures)]).toEqual([]);
  });

  it("words every warning", () => {
    for (const warning of WARNINGS) {
      const text = m.warning(warning);
      expect(text).not.toMatch(BROKEN);
      expect(text.length).toBeGreaterThan(5);
    }
    expect(m.warning(WARNINGS[3]!)).toContain("FrobnicateBucket");
    expect(m.warning(WARNINGS[0]!)).toContain("quota exceeded");
  });

  it("counts one and many differently where the language does, and never loses the number", () => {
    for (const total of [1, 2, 7]) {
      expect(m.ago.days({ count: total })).toContain(String(total));
      expect(m.detail.facts.dayCount({ count: total })).toContain(String(total));
      expect(m.metricList.more({ count: total, others: true })).toContain(String(total));
    }
    expect(m.timeLeft({ days: 3, hours: 7, ended: false })).toMatch(/3.*7/);
    expect(m.day({ month: 10, day: 13 })).toContain("13");
    expect(m.shortDay({ month: 10, day: 13 })).toMatch(/^(10\D13|13\D10)\D?$/);
  });

  it("puts the figures it is given into its sentences unchanged", () => {
    expect(m.headline.cost({ usd: "$4.20" })).toContain("$4.20");
    expect(m.headline.closest.cycle({ metric: "workers.cpuMs", share: "60%" })).toContain("60%");
    // A language may lower the name's first letter inside a sentence; the name itself must still be there.
    expect(m.headline.closest.cycle({ metric: "workers.cpuMs", share: "60%" }).toLowerCase()).toContain(
      m.metrics["workers.cpuMs"].label.toLowerCase(),
    );
    expect(m.findings.share({ metric: "r2.storage", name: "media-bucket", share: "86%", stored: true, msPerRequest: null })).toContain("media-bucket");
    expect(m.metricList.figures({ used: "16M ms", allowance: "30M ms" })).toMatch(/16M ms.*30M ms/);
    expect(m.tokenProblem({ token: 2, status: 403 })).toMatch(/2.*403|403.*2/);
    expect(m.analyticsError({ detail: "Authentication error" })).toContain("Authentication error");
  });

  it("is written in its own language", () => {
    const own = strings(m);
    const text = own.map(([, value]) => value).join(" ");
    if (locale === "en") {
      expect(text).not.toMatch(HAN);
      return;
    }

    // Product names and units are the same everywhere; sentences are not.
    const english = new Map(strings(en));
    const untranslated = own.filter(([path, value]) => value.split(/\s+/).length >= 4 && english.get(path) === value);
    expect(untranslated.map(([path]) => path)).toEqual([]);

    if (locale === "ja") expect(text).toMatch(KANA);
    if (locale === "ko") expect(text).toMatch(HANGUL);
    if (locale === "zh-TW") expect(text).not.toMatch(SIMPLIFIED_ONLY);
    if (locale === "zh-CN") expect(text).not.toMatch(TRADITIONAL_ONLY);
    if (!["ja", "ko", "zh-TW", "zh-CN"].includes(locale)) expect(text).not.toMatch(HAN);
    if (locale !== "ja") expect(text).not.toMatch(KANA);
    if (locale !== "ko") expect(text).not.toMatch(HANGUL);
  });

  it("names itself in the language menu and tells the browser what it is", () => {
    expect(LOCALE_NAMES[locale].length).toBeGreaterThan(0);
    expect(HTML_LANG[locale].length).toBeGreaterThan(0);
  });
});

describe.each(LOCALES)("the pages the Worker draws, in %s", (locale: Locale) => {
  const text = pageText(locale);
  const en = pageText(DEFAULT_LOCALE);

  it("have the same entries as the English ones", () => {
    expect(shape(text)).toEqual(shape(en));
    expect(text.lang).toBe(HTML_LANG[locale]);
  });

  it("build their sentences around what they are given", () => {
    expect(text.consent.title("Claude")).toContain("Claude");
    expect(text.consent.publishedBy("claude.ai")).toContain("claude.ai");
    expect(text.consent.sentTo("claude.ai")).toContain("claude.ai");
    expect(text.consent.sentToApp("cursor:")).toContain("cursor:");
    expect(text.setup.shortKey(MIN_ACCESS_KEY_LENGTH)).toContain(String(MIN_ACCESS_KEY_LENGTH));
    expect(text.setup.missing.ACCESS_KEY).toContain("ACCESS_KEY");
    expect(text.setup.missing.ANALYTICS_TOKEN).toContain("ANALYTICS_TOKEN");
    for (const [, value] of strings(text)) expect(value).not.toMatch(BROKEN);
  });

  it("are not left in English", () => {
    if (locale === "en") return;
    const english = new Map(strings(en));
    const same = strings(text).filter(([path, value]) => value.split(/\s+/).length >= 3 && english.get(path) === value);
    expect(same.map(([path]) => path)).toEqual([]);
  });
});
