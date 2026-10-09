import { HTML_LANG, LOCALES, type Locale } from "../../shared/i18n";
import { useLocale, useMessages } from "../locale";

/** Each language is offered under its own name, so a reader who landed in the wrong one can still find theirs. */
const NAMES: Readonly<Record<Locale, { short: string; full: string }>> = {
  en: { short: "EN", full: "English" },
  "zh-TW": { short: "中文", full: "中文" },
};

export function LanguageSwitch() {
  const [locale, setLocale] = useLocale();
  const m = useMessages();

  return (
    <div className="lang" role="group" aria-label={m.language}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={HTML_LANG[option]}
          aria-label={NAMES[option].full}
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
        >
          {NAMES[option].short}
        </button>
      ))}
    </div>
  );
}
