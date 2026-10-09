import type { Unit } from "./catalog";
import { DAY_MS, type IsoDate } from "./dates";
import type { Messages } from "./i18n/messages";

/**
 * Quantities use the K / M / B suffixes Cloudflare's own pricing pages use, so
 * a figure here can be held against "10 million requests" without converting.
 */
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const precise = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatNumber(value: number): string {
  const size = Math.abs(value);
  if (size >= 1000) return compact.format(value);
  if (size >= 100 || Number.isInteger(value)) return whole.format(value);
  return precise.format(value);
}

const BYTE_STEPS: ReadonlyArray<readonly [number, string]> = [
  [1e12, "TB"],
  [1e9, "GB"],
  [1e6, "MB"],
  [1e3, "KB"],
];

function formatBytes(bytes: number): string {
  const size = Math.abs(bytes);
  for (const [step, suffix] of BYTE_STEPS) {
    if (size >= step) {
      const scaled = bytes / step;
      return `${Math.abs(scaled) >= 100 ? whole.format(scaled) : precise.format(scaled)} ${suffix}`;
    }
  }
  return `${whole.format(bytes)} B`;
}

export function formatAmount(value: number, unit: Unit): string {
  switch (unit) {
    case "bytes":
      return formatBytes(value);
    case "ms":
      return `${formatNumber(value)} ms`;
    case "gbs":
      return `${formatNumber(value)} GB-s`;
    case "count":
    case "neurons":
      return formatNumber(value);
  }
}

export function formatPercent(ratio: number): string {
  const percent = ratio * 100;
  if (percent === 0) return "0%";
  if (percent < 0.1) return "<0.1%";
  if (percent < 10) return `${percent.toFixed(1)}%`;
  // 99.6% is still under: rounding it to 100% would contradict "will not go over".
  if (percent < 100) return `${Math.min(99, Math.round(percent))}%`;
  return `${Math.round(percent)}%`;
}

export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.005) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}

/** `2026-10-12` as a day of the year in words: "Oct 12". */
export function formatDay(day: IsoDate, m: Messages): string {
  return m.day({ month: Number(day.slice(5, 7)), day: Number(day.slice(8, 10)) });
}

/** `2026-10-12` in figures, for axes and tight columns: 10/12, or 12/10 where the day comes first. */
export function formatShortDay(day: IsoDate, m: Messages): string {
  return m.shortDay({ month: Number(day.slice(5, 7)), day: Number(day.slice(8, 10)) });
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export function formatTimeLeft(ms: number, m: Messages): string {
  if (ms <= 0) return m.timeLeft({ days: 0, hours: 0, ended: true });
  return m.timeLeft({
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor((ms % DAY_MS) / HOUR_MS),
    ended: false,
  });
}

export function formatAgo(ms: number, m: Messages): string {
  if (ms < MINUTE_MS) return m.ago.justNow;
  if (ms < HOUR_MS) return m.ago.minutes({ count: Math.floor(ms / MINUTE_MS) });
  if (ms < DAY_MS) return m.ago.hours({ count: Math.floor(ms / HOUR_MS) });
  return m.ago.days({ count: Math.floor(ms / DAY_MS) });
}

/**
 * How `now` compares with `before`: +12%, −8%, or a multiple ("2.3×") once it
 * has more than doubled. Null when there is nothing to compare against.
 */
export function formatChange(now: number, before: number, m: Messages): string | null {
  if (before <= 0) return null;
  const ratio = now / before;
  if (ratio >= 2) return m.change.times({ multiple: ratio >= 10 ? String(Math.round(ratio)) : ratio.toFixed(1) });
  const percent = Math.round((ratio - 1) * 100);
  if (percent === 0) return m.change.flat;
  return percent > 0 ? `+${percent}%` : `−${Math.abs(percent)}%`;
}

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;
const LATIN = /[A-Za-z0-9%$]/;

/**
 * Joins the parts of a Chinese sentence, with a space wherever Chinese text
 * meets Latin letters or digits. Names and figures are dropped into sentences
 * all over the Chinese dictionary (shared/i18n/zh-TW.ts); this keeps the
 * spacing in one place. Other languages have no use for it.
 */
export function glue(...parts: string[]): string {
  return parts.reduce((text, part) => {
    const last = text.at(-1);
    const first = part[0];
    if (last === undefined || first === undefined) return text + part;
    const meets = (HAN.test(last) && LATIN.test(first)) || (LATIN.test(last) && HAN.test(first));
    return meets ? `${text} ${part}` : text + part;
  }, "");
}
