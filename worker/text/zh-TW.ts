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

  connect: {
    connectTitle: "連接 Cloudflare",
    connectLead: "分兩步完成，每一步都會到 Cloudflare 的頁面請你確認。",
    reconnectTitle: "重新連接 Cloudflare",
    reconnectLead: "和第一次一樣的兩個步驟，你的設定和歷史紀錄都會保留。",
    findTitle: "找出你的帳號",
    findText: "Cloudflare 會告訴這個頁面你有哪些帳號、各叫什麼名字。拿到答案後，這項存取權會立刻交還。",
    findAgain: "重新選擇",
    grantTitle: "允許讀取用量",
    grantText: "這個頁面看得到每個帳號用了多少，看不到裡面存的內容，也不能更改任何東西。",
    grantSame: "在 Cloudflare 選同樣的帳號。",
    button: "前往 Cloudflare 繼續",
    signInLead: "用能存取這個 Worker 所在帳號的 Cloudflare 登入。",
    signInButton: "用 Cloudflare 登入",
    askedTitle: "Cloudflare 會要求的權限",
    askedSettings:
      "Account Settings: Read，只在第一步。它列出你的帳號和成員，讀到名稱後就會交還。",
    askedAnalytics: "Account Analytics: Read，兩步都有。它顯示每個產品用了多少，只有第二步的那一份會留下。",
    problemTitle: "登入沒有完成",
    tryAgain: "再試一次",
    problems: {
      expired: "這次登入超過十分鐘，或是在另一個瀏覽器開始的。",
      declined: "在 Cloudflare 的頁面上沒有允許存取。",
      failed: "Cloudflare 沒有回應，稍後再試。",
      noAccounts: "在 Cloudflare 的頁面上沒有選帳號。請選這個 Worker 所在的帳號。",
      notFound: "你選的帳號裡沒有一個在執行這個 Worker。如果是幾分鐘內才部署的，等一分鐘再試。",
      notAllowed: "這個 Cloudflare 登入讀不到這個 Worker 所在的帳號。請在 Cloudflare 的頁面上選這個 Worker 所在的帳號。",
      otherAccount: "這個頁面連接的帳號，和你選的不是同一個。",
      notKept: "Cloudflare 沒有讓這個頁面保持連線，請再試一次。",
      tooMany: "嘗試太多次了，一分鐘後再試。",
    },
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
