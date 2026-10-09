# Usage

你的 Cloudflare 帳號這期會不會超過 Workers Paid 的內含額度？超過的話要多付多少？

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · **繁體中文** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md)

![用量頁面：Workers 請求預估在 10 月 19 日用完內含的 1,000 萬次，旁邊是累計圖、目前的速度和預估的超額費用](../screenshot.png)

一個部署在你自己 Cloudflare 帳號裡的 Worker。它從 Cloudflare Analytics 讀出帳號的用量，跟方案內含的額度比，推算帳期結束時每個產品會落在哪裡。可以開頁面看、用 JSON 抓，或讓 agent 透過 MCP 問。資料不會離開你的帳號：沒有遙測，也沒有第三方服務。

## 它會告訴你

- **會不會超額。** Workers 請求與 CPU 時間、D1、KV、R2、Durable Objects、Queues、Workers AI：目前用了多少、內含多少、照現在的速度期末會到哪。
- **要多付多少。** 依 Cloudflare 的牌價算出超額的金額。
- **是誰在用。** 每個數字都拆到 Worker、資料庫、namespace、bucket、queue 或模型。
- **哪裡變了。** 這週請求變成三倍的 Worker；再 40 天就會超過額度的儲存。
- **什麼時候該看。** 有產品照目前速度會超額時，透過 ntfy 或 webhook 通知你。
- **多個帳號**，一個帳號一個分頁。
- **九種語言。**

## 沒有帳號也能先看

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # 假資料，http://localhost:8798
```

## 部署

需要一個 **Workers Paid** 的 Cloudflare 帳號。除此之外不用另外付錢：它一天向 Cloudflare 讀四次，結果存在 KV，只佔方案內含額度的一小部分。

1. **按 Deploy to Cloudflare。** 它會建好需要的 KV namespace，並要兩個密鑰。
   - `ANALYTICS_TOKEN`：只有一個權限 **Account Analytics: Read** 的 API token。[這個連結](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage)會幫你把表單填好。這個 token 只看得到用了多少，看不到存了什麼：它讀不到資料庫、KV 的值或 R2 的檔案，也不能更改任何東西。
   - `ACCESS_KEY`：頁面的密碼，至少 24 個字元。用 `openssl rand -base64 32` 產生一組。
2. **打開 Worker 的網址**，用存取金鑰登入。
3. **設定帳單每月幾號續約。** 在 Cloudflare dashboard 的 Manage Account → Billing → Subscriptions。

從 clone 部署、同時看多個帳號、用自己的網域：[docs/deploy.md](../deploy.md)（英文）。

## 接上 agent

這個 Worker 同時是 MCP 伺服器，位址是 `https://<你的 Worker>/mcp`。在 Claude 裡把這個位址加成自訂連接器；在 Claude Code：

```sh
claude mcp add --transport http usage https://<你的 Worker>/mcp
```

Worker 會請你登入並決定要不要允許，agent 拿到的是它自己的唯讀 token。其他用戶端、工具和 JSON API：[docs/agents.md](../agents.md)（英文）。

## 文件

以下文件是英文。

- [部署與設定](../deploy.md)
- [Agent、MCP 與 JSON API](../agents.md)
- [透過 ntfy 或 webhook 的警告](../alerts.md)
- [運作方式，以及數字的來源](../how-it-works.md)
- [開發，以及新增語言](../development.md)

## 授權

[Apache-2.0](../../LICENSE)
