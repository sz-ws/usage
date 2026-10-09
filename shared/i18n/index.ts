import type { MetricId } from "../catalog";
import { en } from "./en";
import type { ErrorCode, Messages, MetricText } from "./messages";
import { zhTW } from "./zh-TW";

export type { ErrorCode, Messages, MetricText } from "./en";

export type Locale = "en" | "zh-TW";

export const LOCALES: readonly Locale[] = ["en", "zh-TW"];
export const DEFAULT_LOCALE: Locale = "en";

/** The value of `<html lang>` for each locale. */
export const HTML_LANG: Readonly<Record<Locale, string>> = { en: "en", "zh-TW": "zh-Hant" };

const DICTIONARIES: Readonly<Record<Locale, Messages>> = { en, "zh-TW": zhTW };

/**
 * The locale for a `?lang=` value or an Accept-Language header. Anything that
 * starts with "zh" is Traditional Chinese, the only Chinese there is here;
 * everything else, and nothing at all, is the default.
 */
export function pickLocale(input: string | null | undefined): Locale {
  return input?.trim().toLowerCase().startsWith("zh") ? "zh-TW" : DEFAULT_LOCALE;
}

export function messages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/** A metric's name, short name and note in the reader's language. */
export function metricText(id: MetricId, m: Messages): MetricText {
  return m.metrics[id];
}

/** Whether the API's error code is one the dictionaries have a sentence for. */
export function isErrorCode(code: string, m: Messages): code is ErrorCode {
  return Object.hasOwn(m.errors, code);
}

/**
 * The sentence for a failed API call. `detail` is what Cloudflare said, which
 * only an `analytics` failure carries.
 */
export function errorText(code: string, m: Messages, detail?: string | null): string {
  if (code === "analytics" && detail) return m.analyticsError({ detail });
  return isErrorCode(code, m) ? m.errors[code] : m.errors.unknown;
}
