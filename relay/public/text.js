/*
 * Every sentence the relay shows. A language is one object in TEXT, under the
 * tag a browser asks for it by; pickLanguage reads the tags from there, so
 * adding a language is adding its object. test/relay.test.ts checks that each
 * one has the same strings as English.
 *
 * `approved` and `refused` are the two answers Cloudflare sends back, named as
 * decide.js names them.
 */

const en = {
  lang: "en",
  product: "Usage",

  home: {
    title: "Usage sign-in",
    body: "When you sign in to a usage page you host yourself, Cloudflare sends you here and you continue to your own page. Nothing is stored here.",
    link: "Usage on GitHub",
  },

  approved: {
    title: "Continue signing in",
    lead: "You are signing in to:",
    warning:
      "Continue only if this is the address of your own usage page. Whoever runs that address will be able to read your Cloudflare usage.",
    submit: "Continue",
    stop: "To stop, close this tab.",
  },

  refused: {
    title: "Sign-in did not finish",
    lead: "To try again, go back to:",
    warning: "Go back only if this is the address of your own usage page.",
    submit: "Go back",
    stop: "Or close this tab.",
  },

  problem: {
    title: "Sign-in did not finish",
    body: "This address only finishes a sign-in that a usage page started. To sign in, open your usage page and start there.",
  },
};

const zhTW = {
  lang: "zh-Hant",
  product: "Usage",

  home: {
    title: "Usage 登入",
    body: "登入你自架的用量頁面時，Cloudflare 會先把你送到這裡，你再從這裡回到自己的頁面。這裡不會儲存任何資料。",
    link: "Usage 的 GitHub 專案",
  },

  approved: {
    title: "繼續登入",
    lead: "你要登入的是：",
    warning: "確定這是你自己的用量頁面網址再繼續。管理這個網址的人會看得到你的 Cloudflare 用量。",
    submit: "繼續",
    stop: "不想繼續的話，關掉這個分頁就好。",
  },

  refused: {
    title: "登入沒有完成",
    lead: "要再試一次的話，回到：",
    warning: "確定這是你自己的用量頁面網址再回去。",
    submit: "回去",
    stop: "或直接關掉這個分頁。",
  },

  problem: {
    title: "登入沒有完成",
    body: "這個網址只能完成從用量頁面開始的登入。要登入的話，打開你的用量頁面，從那裡開始。",
  },
};

export const TEXT = { en, "zh-TW": zhTW };

export const DEFAULT_LANGUAGE = "en";

/** Where Chinese is written in Traditional characters, by region or by the script a tag names. */
const TRADITIONAL = new Set(["tw", "hk", "mo", "hant"]);

/** The language in TEXT that serves one tag ("en-GB", "zh-Hant-HK"). Null when none does. */
function languageFor(tag) {
  const lower = String(tag).trim().toLowerCase();
  if (lower === "") return null;

  const tags = Object.keys(TEXT);
  const exact = tags.find((known) => known.toLowerCase() === lower);
  if (exact) return exact;

  const [language, ...rest] = lower.split("-");
  if (language === "zh") {
    const written = rest.some((part) => TRADITIONAL.has(part)) ? "zh-TW" : "zh-CN";
    return Object.hasOwn(TEXT, written) ? written : null;
  }
  return tags.find((known) => known.toLowerCase().split("-")[0] === language) ?? null;
}

/**
 * The language for `navigator.languages`: the first one listed that there is
 * text for, or English. The same rule the usage page follows.
 */
export function pickLanguage(languages) {
  for (const tag of languages ?? []) {
    const found = languageFor(tag);
    if (found) return found;
  }
  return DEFAULT_LANGUAGE;
}
