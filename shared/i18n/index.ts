import type { MetricId } from "../catalog";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { ko } from "./ko";
import type { ErrorCode, Messages, MetricText } from "./messages";
import { ptBR } from "./pt-BR";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

export type { ErrorCode, Messages, MetricText } from "./messages";

/**
 * To add a language: write `<tag>.ts` here and in worker/text/ (copy `en.ts`
 * in each), then add the tag to the four lists below and to worker/text/index.ts.
 * The type checker and test/locales.test.ts say what is missing.
 */
export const LOCALES = ["en", "zh-TW", "zh-CN", "ja", "ko", "es", "fr", "de", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The value of `<html lang>` for each locale. */
export const HTML_LANG: Readonly<Record<Locale, string>> = {
  en: "en",
  "zh-TW": "zh-Hant",
  "zh-CN": "zh-Hans",
  ja: "ja",
  ko: "ko",
  es: "es",
  fr: "fr",
  de: "de",
  "pt-BR": "pt-BR",
};

/** Each language under its own name, so a reader who landed in the wrong one can still find theirs. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  "zh-TW": "繁體中文",
  "zh-CN": "简体中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português",
};

const DICTIONARIES: Readonly<Record<Locale, Messages>> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  ja,
  ko,
  es,
  fr,
  de,
  "pt-BR": ptBR,
};

/** Where Chinese is written in Traditional characters, by region or by the script a tag names. */
const TRADITIONAL = new Set(["tw", "hk", "mo", "hant"]);

/** The locale that serves one language tag ("pt", "zh-Hant-HK", "fr-CA"). Null when none does. */
function localeFor(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase();
  if (lower === "") return null;

  const exact = LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (exact) return exact;

  const [language, ...rest] = lower.split("-");
  if (language === "zh") return rest.some((part) => TRADITIONAL.has(part)) ? "zh-TW" : "zh-CN";
  return LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === language) ?? null;
}

/**
 * The locale for a `?lang=` value or an Accept-Language header: the first
 * language listed that there is a dictionary for, or the default. Browsers list
 * languages in order of preference, so the weights after `;` add nothing.
 */
export function pickLocale(input: string | null | undefined): Locale {
  for (const entry of (input ?? "").split(",")) {
    const found = localeFor(entry.split(";")[0] ?? "");
    if (found) return found;
  }
  return DEFAULT_LOCALE;
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
