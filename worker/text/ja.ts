import type { PageText } from "./types";

export const ja: PageText = {
  lang: "ja",
  product: "Cloudflare 使用量",

  signIn: {
    title: "ログイン",
    keyLabel: "アクセスキー",
    keyHint: "デプロイ時に設定したACCESS_KEYの値です。",
    submit: "ログイン",
    wrongKey: "アクセスキーが正しくありません。",
    tooMany: "試行回数が多すぎます。1分ほど待ってから、もう一度試してください。",
  },

  consent: {
    title: (client) => `${client}がCloudflareの使用量を読み取ることを許可しますか？`,
    scope: "使用量の数字と予測を読み取れるようになります。何かを変更することはできません。",
    publishedBy: (domain) => `提供元は${domain}です。`,
    selfNamed: "名前はアプリ自身が名乗ったもので、確認されていません。",
    sentTo: (host) => `アクセス情報は${host}に送られます。`,
    sentToApp: (scheme) => `アクセス情報は、このコンピューターで${scheme}リンクを開くアプリに送られます。`,
    loopback: "このコンピューター上のアプリから接続を始めた場合だけ、続けてください。",
    allow: "許可",
    deny: "拒否",
  },

  setup: {
    title: "セットアップを完了してください",
    lead: "続けるには、Workerに次の値を設定してください：",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN：「Account Analytics: Read」の権限を持つCloudflare API トークンです。",
      ACCESS_KEY: "ACCESS_KEY：ログインに使うパスワードです。",
    },
    shortKey: (minimum) => `ACCESS_KEY：${minimum}文字以上が必要です。`,
    where: "Cloudflare ダッシュボードで、このWorkerの「Settings → Variables and Secrets」を開きます。",
  },

  problem: {
    title: "接続に失敗しました",
    invalid: "リクエストが正しくありません。",
    expired: "リクエストの有効期限が切れているか、すでに使用されています。",
    unverified: "接続を求めているアプリを確認できませんでした。",
    startAgain: "アプリから、もう一度接続してください。",
  },
};
