import { describe, expect, it } from "vitest";

import {
  formatAgo,
  formatAmount,
  formatChange,
  formatDay,
  formatPercent,
  formatShortDay,
  formatTimeLeft,
  formatUsd,
  glue,
} from "../shared/format";
import { messages } from "../shared/i18n";

const en = messages("en");
const zh = messages("zh-TW");

describe("formatAmount", () => {
  it("writes counts the way Cloudflare's pricing does", () => {
    expect(formatAmount(72, "count")).toBe("72");
    expect(formatAmount(453_300, "count")).toBe("453.3K");
    expect(formatAmount(10_000_000, "count")).toBe("10M");
    expect(formatAmount(25_000_000_000, "count")).toBe("25B");
  });

  it("keeps small fractions readable", () => {
    expect(formatAmount(0.059, "gbs")).toBe("0.06 GB-s");
    expect(formatAmount(248.96, "neurons")).toBe("249");
    expect(formatAmount(15_900_000, "ms")).toBe("15.9M ms");
  });

  it("uses decimal storage units, as the bill does", () => {
    expect(formatAmount(0, "bytes")).toBe("0 B");
    expect(formatAmount(13_885_440, "bytes")).toBe("13.89 MB");
    expect(formatAmount(1_032_268_535, "bytes")).toBe("1.03 GB");
    expect(formatAmount(10e9, "bytes")).toBe("10 GB");
  });
});

describe("formatPercent", () => {
  it("shows more precision the smaller the share", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.0004)).toBe("<0.1%");
    expect(formatPercent(0.051)).toBe("5.1%");
    expect(formatPercent(0.6)).toBe("60%");
    expect(formatPercent(0.996)).toBe("99%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(1.4)).toBe("140%");
  });
});

describe("formatUsd", () => {
  it("never rounds a real charge down to nothing", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.001)).toBe("<$0.01");
    expect(formatUsd(1.239)).toBe("$1.24");
  });
});

describe("dates and durations", () => {
  const hour = 3_600_000;

  it("writes days without leading zeros", () => {
    expect(formatDay("2026-10-03", zh)).toBe("10 月 3 日");
    expect(formatDay("2026-10-03", en)).toBe("Oct 3");
    expect(formatDay("2026-01-31", en)).toBe("Jan 31");
    expect(formatShortDay("2026-09-13")).toBe("9/13");
  });

  it("describes the time left", () => {
    expect(formatTimeLeft(3 * 24 * hour + 11 * hour, zh)).toBe("3 天 11 小時");
    expect(formatTimeLeft(2 * 24 * hour, zh)).toBe("2 天");
    expect(formatTimeLeft(5 * hour, zh)).toBe("5 小時");
    expect(formatTimeLeft(60_000, zh)).toBe("不到 1 小時");
    expect(formatTimeLeft(-1, zh)).toBe("0 小時");
  });

  it("describes the time left in English, counting one of a thing as one", () => {
    expect(formatTimeLeft(3 * 24 * hour + 11 * hour, en)).toBe("3 days 11 hours");
    expect(formatTimeLeft(24 * hour + hour, en)).toBe("1 day 1 hour");
    expect(formatTimeLeft(2 * 24 * hour, en)).toBe("2 days");
    expect(formatTimeLeft(5 * hour, en)).toBe("5 hours");
    expect(formatTimeLeft(60_000, en)).toBe("less than 1 hour");
    expect(formatTimeLeft(-1, en)).toBe("0 hours");
  });

  it("describes how long ago", () => {
    expect(formatAgo(5_000, zh)).toBe("剛剛");
    expect(formatAgo(3 * 60_000, zh)).toBe("3 分鐘前");
    expect(formatAgo(2 * 3_600_000, zh)).toBe("2 小時前");
    expect(formatAgo(26 * 3_600_000, zh)).toBe("1 天前");
  });

  it("describes how long ago in English", () => {
    expect(formatAgo(5_000, en)).toBe("just now");
    expect(formatAgo(3 * 60_000, en)).toBe("3 min ago");
    expect(formatAgo(2 * 3_600_000, en)).toBe("2 hr ago");
    expect(formatAgo(26 * 3_600_000, en)).toBe("1 day ago");
    expect(formatAgo(3 * 24 * 3_600_000, en)).toBe("3 days ago");
  });
});

describe("formatChange", () => {
  it("uses a percentage for small moves and a multiple for large ones", () => {
    expect(formatChange(105, 100, zh)).toBe("+5%");
    expect(formatChange(62, 100, zh)).toBe("−38%");
    expect(formatChange(100, 100, zh)).toBe("持平");
    expect(formatChange(230, 100, zh)).toBe("2.3 倍");
    expect(formatChange(1200, 100, zh)).toBe("12 倍");
  });

  it("writes the same figures in English", () => {
    expect(formatChange(105, 100, en)).toBe("+5%");
    expect(formatChange(62, 100, en)).toBe("−38%");
    expect(formatChange(100, 100, en)).toBe("no change");
    expect(formatChange(230, 100, en)).toBe("2.3×");
    expect(formatChange(1200, 100, en)).toBe("12×");
  });

  it("has nothing to say without a baseline", () => {
    expect(formatChange(10, 0, zh)).toBeNull();
    expect(formatChange(10, 0, en)).toBeNull();
  });
});

describe("glue", () => {
  it("puts a space where Chinese meets Latin letters or digits", () => {
    expect(glue("最接近上限的是", "Workers CPU 時間", "，期末預估", "60%", "。")).toBe(
      "最接近上限的是 Workers CPU 時間，期末預估 60%。",
    );
    expect(glue("media-bucket", "佔了", "R2 儲存", "的", "86%")).toBe("media-bucket 佔了 R2 儲存的 86%");
    expect(glue("預估超額費用", "$0.42", "。")).toBe("預估超額費用 $0.42。");
  });

  it("leaves punctuation and same-script joins alone", () => {
    expect(glue("出錯（", "188", "次）。")).toBe("出錯（188 次）。");
    expect(glue("這期", "不會超額。")).toBe("這期不會超額。");
    expect(glue("", "Workers", "")).toBe("Workers");
  });
});
