import { HTML_LANG, LOCALES, LOCALE_NAMES, type Locale } from "../../shared/i18n";
import { useLocale, useMessages } from "../locale";

/** A plain menu: with this many languages, a row of buttons would crowd the bar. */
export function LanguageSwitch() {
  const [locale, setLocale] = useLocale();
  const m = useMessages();

  return (
    <label className="lang">
      <span className="visually-hidden">{m.language}</span>
      <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={HTML_LANG[option]}>
            {LOCALE_NAMES[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
