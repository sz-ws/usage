import type { PageText } from "./types";

export const zhTW: PageText = {
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
