# Usage

你的 Cloudflare 账户本账期会不会超出 Workers Paid 的套餐内额度？如果超出，要多付多少钱？

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · **简体中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md)

![用量页面：Workers 请求预计在 10 月 19 日超过套餐内的 1000 万次，累计图、当前速度和预估超额费用位于产品列表旁边](../screenshot.png)

一个部署在你自己 Cloudflare 账户里的 Worker。它从 Cloudflare Analytics 读取账户的用量，与套餐内额度比较，推算账期结束时每个产品会落在哪里。可以打开页面查看，用 JSON 获取，或让智能体通过 MCP 查询。数据不会离开你的账户：没有遥测，也没有第三方服务。

## 它会告诉你什么

- **会不会超额。** Workers 请求和 CPU 时间、D1、KV、R2、Durable Objects、Queues 和 Workers AI：目前已用、套餐内额度，以及账期末预估。
- **会花多少钱。** 按 Cloudflare 标价算出的超额费用，以美元计。
- **是谁在用。** 每个数字都能拆到 Worker、数据库、命名空间、存储桶、队列或模型。
- **哪里变了。** 这周请求量增至三倍的 Worker。40 天后会超过套餐内额度的存储。
- **什么时候该看。** 有产品照目前速度会超额时，通过 ntfy 或 webhook 推送给你。
- **多个账户**，每个账户一个标签页。
- **九种语言。**

## 没有账户也能先看

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # 模拟数据，http://localhost:8798
```

## 部署

需要一个使用 **Workers Paid** 套餐的 Cloudflare 账户。除了 Workers Paid 之外，运行它不需要另外付费：它每天向 Cloudflare 读取四次，结果存在 KV 里，只占套餐内额度的一小部分。

1. **按 Deploy to Cloudflare。** 它会创建所需的 KV namespace，并要求填写两个密钥。
   - `ANALYTICS_TOKEN`：一个只有 **Account Analytics: Read** 权限的 API token。[这个链接](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage)会帮你把表单填好。这个 token 只显示用了多少，不显示存储的内容：它读不到数据库、KV 的值或 R2 的对象，也不能更改任何东西。
   - `ACCESS_KEY`：页面的访问密钥，至少 24 个字符。`openssl rand -base64 32` 可以生成一个。
2. **打开 Worker 的地址**，用访问密钥登录。
3. **设置账单每月几号续费。** 这个日期在 Cloudflare 控制台的 Manage Account → Billing → Subscriptions 里。

从克隆的代码部署、同时查看多个账户，或使用你自己的域名：[docs/deploy.md](../deploy.md)（英文）。

## 接入智能体

这个 Worker 同时也是 MCP 服务器，地址是 `https://<你的 Worker>/mcp`。在 Claude 中，把这个地址添加为自定义连接器；在 Claude Code 中运行：

```sh
claude mcp add --transport http usage https://<你的 Worker>/mcp
```

你的 Worker 会请你登录并确认允许，智能体拿到的是它自己的只读 token。其他客户端、工具和 JSON API：[docs/agents.md](../agents.md)（英文）。

## 文档

以下文档为英文。

- [部署与配置](../deploy.md)
- [智能体、MCP 与 JSON API](../agents.md)
- [通过 ntfy 或 webhook 发送的提醒](../alerts.md)
- [工作原理，以及数字从哪里来](../how-it-works.md)
- [开发，以及添加语言](../development.md)

## 许可证

[Apache-2.0](../../LICENSE)
