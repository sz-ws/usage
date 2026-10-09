import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { HTML_LANG, LOCALES, messages, pickLocale, type Locale, type Messages } from "../shared/i18n";

const QUERY = "lang";
const REMEMBERED = "usage:locale";

/** The language picked on an earlier visit. Null when none was, or the browser keeps no storage. */
function remembered(): Locale | null {
  try {
    const value = localStorage.getItem(REMEMBERED);
    return LOCALES.find((locale) => locale === value) ?? null;
  } catch {
    return null;
  }
}

/** A link that asks for a language wins, then the reader's earlier choice, then the first of the browser's languages there is a dictionary for. */
function initialLocale(): Locale {
  const asked = new URLSearchParams(window.location.search).get(QUERY);
  if (asked !== null) return pickLocale(asked);
  return remembered() ?? pickLocale(navigator.languages?.join(",") ?? navigator.language);
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  m: Messages;
}

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrent] = useState(initialLocale);
  const m = messages(locale);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(REMEMBERED, next);
    } catch {
      // Without storage the choice lasts until the page is closed.
    }
    // A `?lang=` left in the address would bring the old language back on the next load.
    const url = new URL(window.location.href);
    if (url.searchParams.has(QUERY)) {
      url.searchParams.delete(QUERY);
      window.history.replaceState(null, "", url);
    }
    setCurrent(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
    document.title = m.title;
  }, [locale, m]);

  const state = useMemo(() => ({ locale, setLocale, m }), [locale, setLocale, m]);
  return <LocaleContext value={state}>{children}</LocaleContext>;
}

function useLocaleState(): LocaleState {
  const state = useContext(LocaleContext);
  if (!state) throw new Error("useMessages and useLocale need a <LocaleProvider> above them");
  return state;
}

/** The dictionary of the language the page is in. */
export function useMessages(): Messages {
  return useLocaleState().m;
}

export function useLocale(): readonly [Locale, (locale: Locale) => void] {
  const { locale, setLocale } = useLocaleState();
  return [locale, setLocale];
}
