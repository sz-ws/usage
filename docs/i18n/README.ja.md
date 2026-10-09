# Usage

お使いの Cloudflare アカウントは今期、Workers Paid プランの枠内に収まりますか？ 収まらない場合、いくらかかりますか？

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md)

![使用量ページ：Workers リクエストは、プランの枠の1,000万件を10月19日に超える見込みです。グラフ、ペース、推定超過料金が製品一覧の横に並んでいます](../screenshot.png)

お使いの Cloudflare アカウントにデプロイする Worker です。Cloudflare Analytics からアカウントの使用量を読み取り、プランの枠と比べて、今期末の各製品の見込みを推定します。ページで見ることも、JSON で取得することも、MCP 経由でエージェントに問い合わせることもできます。お使いの使用量は Cloudflare からお使いの Worker に届くだけで、ほかのどこにも行きません。テレメトリーはなく、これを見る私たちのサーバーもありません。

## わかること

- **超過するかどうか。** Workers リクエストと CPU 時間、D1、KV、R2、Durable Objects、Queues、Workers AI：今期はここまでの使用量、プランの枠、期末予測。
- **かかる費用。** 超過分を、Cloudflare の掲載料金に基づいてドルで示します。
- **誰が使っているか。** 各数字を Worker、データベース、ネームスペース、バケット、キュー、モデルごとに示します。
- **変化したこと。** 今週リクエストが3倍になった Worker。40日後にプランの枠を超える見込みのストレージ。
- **見るべきとき。** 製品が今のペースで超過しそうになると、ntfy または webhook でプッシュ通知します。
- **複数のアカウント**、アカウントごとに1つのタブ。
- **9言語。**

## アカウントなしで試す

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # 架空のデータ、http://localhost:8798
```

## デプロイ

**Workers Paid** のプランを使っている Cloudflare アカウントが必要です。Workers Paid 以外の費用はかかりません。1日4回 Cloudflare から読み取り、結果を KV に保存します。その使用量は、すでにプランに含まれる枠のごく一部です。

1. **Deploy to Cloudflare を押してください。** 必要な KV namespace を作成します。トークンを作る必要も、パスワードを決める必要もありません。
2. **Worker のアドレスを開き、「Cloudflareで続ける」を2回押してください。** 1回目はアカウントを探すため、2回目はページがその使用量を読めるようにするためです。許可する範囲で見えるのは使用量だけで、保存されている内容は見えません。データベース、KV の値、R2 のオブジェクトは読み取れず、何かを変更することもできません。
3. **請求の更新日を設定します。** Cloudflare ダッシュボードの Manage Account → Billing → Subscriptions にあります。

ログインで求められるものと、保存されるもの：[docs/sign-in.md](../sign-in.md)（英語）。API トークンを使う場合、クローンから、または独自のドメインで使う場合：[docs/deploy.md](../deploy.md)（英語）。

## エージェントに接続する

この Worker は MCP サーバーでもあり、アドレスは `https://<お使いの Worker>/mcp` です。Claude では、このアドレスをカスタムコネクタとして追加します。Claude Code では次のように実行します：

```sh
claude mcp add --transport http usage https://<お使いの Worker>/mcp
```

お使いの Worker からログインと許可を求められ、エージェントは自分専用の読み取り専用トークンを受け取ります。その他のクライアント、ツール、JSON API：[docs/agents.md](../agents.md)（英語）。

## ドキュメント

以下のドキュメントは英語です。

- [デプロイと設定](../deploy.md)
- [Cloudflare でのログイン](../sign-in.md)
- [エージェント、MCP、JSON API](../agents.md)
- [ntfy または webhook による通知](../alerts.md)
- [仕組みと、数字の出どころ](../how-it-works.md)
- [開発と、言語の追加](../development.md)

## ライセンス

[Apache-2.0](../../LICENSE)

独立したプロジェクトで、Cloudflare, Inc. とは提携しておらず、同社の承認も受けていません。Cloudflare と Cloudflare のロゴは、Cloudflare, Inc. の商標です。
