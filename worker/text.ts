import type { Locale } from "../shared/i18n";
import type { SecretName } from "./env";

/**
 * The words on the pages the Worker draws itself: signing in, letting an agent
 * connect, and a deployment that is not finished. The usage page has its own
 * dictionary in shared/i18n; these never reach the browser bundle.
 */

export interface PageText {
  lang: string;
  product: string;

  signIn: {
    title: string;
    keyLabel: string;
    keyHint: string;
    submit: string;
    wrongKey: string;
    tooMany: string;
  };

  consent: {
    title: (client: string) => string;
    scope: string;
    publishedBy: (domain: string) => string;
    selfNamed: string;
    sentTo: (host: string) => string;
    /** For an app that is reached through links of its own kind (`cursor:`), not a web address. */
    sentToApp: (scheme: string) => string;
    loopback: string;
    allow: string;
    deny: string;
  };

  setup: {
    title: string;
    lead: string;
    missing: Record<SecretName, string>;
    shortKey: (minimum: number) => string;
    where: string;
  };

  problem: {
    title: string;
    invalid: string;
    expired: string;
    unverified: string;
    startAgain: string;
  };
}

const en: PageText = {
  lang: "en",
  product: "Cloudflare usage",

  signIn: {
    title: "Sign in",
    keyLabel: "Access key",
    keyHint: "The ACCESS_KEY you set when you deployed.",
    submit: "Sign in",
    wrongKey: "That is not the access key.",
    tooMany: "Too many attempts. Try again in a minute.",
  },

  consent: {
    title: (client) => `Let ${client} read your Cloudflare usage?`,
    scope: "It will be able to read your usage figures and forecasts. It cannot change anything.",
    publishedBy: (domain) => `Published by ${domain}.`,
    selfNamed: "The name comes from the app itself and is not verified.",
    sentTo: (host) => `Access will be sent to ${host}.`,
    sentToApp: (scheme) => `Access will be sent to the app on this computer that opens ${scheme} links.`,
    loopback: "Continue only if you just started connecting from an app on this computer.",
    allow: "Allow",
    deny: "Deny",
  },

  setup: {
    title: "Finish setting up",
    lead: "Set these on the Worker to continue:",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN: a Cloudflare API token with the Account Analytics: Read permission.",
      ACCESS_KEY: "ACCESS_KEY: the password you will sign in with.",
    },
    shortKey: (minimum) => `ACCESS_KEY: at least ${minimum} characters.`,
    where: "In the Cloudflare dashboard: this Worker → Settings → Variables and Secrets.",
  },

  problem: {
    title: "Connection failed",
    invalid: "The request is not valid.",
    expired: "The request expired or was already used.",
    unverified: "The app asking to connect could not be verified.",
    startAgain: "Try connecting again from the app.",
  },
};

const zhTW: PageText = {
  lang: "zh-Hant",
  product: "Cloudflare 用量",

  signIn: {
    title: "登入",
    keyLabel: "存取金鑰",
    keyHint: "部署時設定的 ACCESS_KEY。",
    submit: "登入",
    wrongKey: "金鑰不對。",
    tooMany: "嘗試太多次了，一分鐘後再試。",
  },

  consent: {
    title: (client) => `讓 ${client} 讀取你的 Cloudflare 用量？`,
    scope: "它可以讀取你的用量數字和預估，不能更改任何東西。",
    publishedBy: (domain) => `由 ${domain} 發行。`,
    selfNamed: "這個名稱是 app 自己填的，沒有經過驗證。",
    sentTo: (host) => `存取權會交給 ${host}。`,
    sentToApp: (scheme) => `存取權會交給這台電腦上負責開啟 ${scheme} 連結的 app。`,
    loopback: "你剛剛才從這台電腦上的 app 開始連線的話再繼續。",
    allow: "允許",
    deny: "拒絕",
  },

  setup: {
    title: "設定還沒完成",
    lead: "在 Worker 上設好這些就可以繼續：",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN：有 Account Analytics: Read 權限的 Cloudflare API token。",
      ACCESS_KEY: "ACCESS_KEY：登入用的密碼。",
    },
    shortKey: (minimum) => `ACCESS_KEY：至少要 ${minimum} 個字元。`,
    where: "在 Cloudflare dashboard：這個 Worker → Settings → Variables and Secrets。",
  },

  problem: {
    title: "連線失敗",
    invalid: "這個請求無效。",
    expired: "這個請求過期了，或是已經用過。",
    unverified: "無法確認要求連線的 app 是誰。",
    startAgain: "回到那個 app 再連線一次。",
  },
};

const TEXT: Readonly<Record<Locale, PageText>> = { en, "zh-TW": zhTW };

export function pageText(locale: Locale): PageText {
  return TEXT[locale];
}
