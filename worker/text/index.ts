import type { Locale } from "../../shared/i18n";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { ko } from "./ko";
import { ptBR } from "./pt-BR";
import type { PageText } from "./types";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

export type { PageText } from "./types";

const TEXT: Readonly<Record<Locale, PageText>> = {
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

export function pageText(locale: Locale): PageText {
  return TEXT[locale];
}
