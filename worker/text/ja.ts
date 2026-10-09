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

  connect: {
    connectTitle: "Cloudflareに接続",
    connectLead: "2つの手順があります。それぞれ、Cloudflareのページで確認してください。",
    reconnectTitle: "Cloudflareに再接続",
    reconnectLead: "初回と同じ2つの手順です。設定と履歴はそのまま残ります。",
    findTitle: "アカウントを探す",
    findText: "Cloudflareが、お持ちのアカウントとその名前をこのページに伝えます。この権限は、結果を受け取った時点で手放されます。",
    findAgain: "選び直す",
    grantTitle: "このページに使用量の読み取りを許可",
    grantText: "このページは、各アカウントの使用量を見られます。保存されているデータの中身は見られず、何かを変更することもできません。",
    grantSame: "Cloudflareでも同じアカウントを選んでください。",
    button: "Cloudflareで続ける",
    signInLead: "このWorkerのアカウントにアクセスできるCloudflareのログインを使ってください。",
    signInButton: "Cloudflareでログイン",
    askedTitle: "Cloudflareが求める権限",
    askedSettings:
      "Account Settings: Readは手順1でのみ使われます。お持ちのアカウントとそのメンバーの一覧を取得し、名前を読み取った時点で手放されます。",
    askedAnalytics:
      "Account Analytics: Readは両方の手順で使われます。各製品がどれだけ使われたかを示します。残るのは手順2で得た権限だけです。",
    problemTitle: "ログインが完了しませんでした",
    tryAgain: "もう一度試す",
    problems: {
      expired: "このログインは10分以上経過したか、別のブラウザーで始められたものです。",
      declined: "Cloudflareのページで、アクセスが許可されませんでした。",
      failed: "Cloudflareから応答がありませんでした。少し待ってから、もう一度試してください。",
      noAccounts: "Cloudflareのページでアカウントが選ばれませんでした。このWorkerがあるアカウントを選んでください。",
      notFound:
        "選んだアカウントのどれにも、このWorkerはありません。数分以内にデプロイした場合は、1分ほど待ってから、もう一度試してください。",
      notAllowed:
        "そのCloudflareのログインでは、このWorkerのアカウントにアクセスできません。Cloudflareのページで、このWorkerがあるアカウントを選んでください。",
      otherAccount: "このページは、選んだアカウントとは別のアカウントに接続されています。",
      notKept: "Cloudflareとの接続を維持できませんでした。もう一度試してください。",
      tooMany: "試行回数が多すぎます。1分ほど待ってから、もう一度試してください。",
    },
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
