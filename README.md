# Usage

Will your Cloudflare account stay inside its Workers Paid plan this billing
period, and what will it cost if it does not?

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

**English** · [繁體中文](docs/i18n/README.zh-TW.md) · [简体中文](docs/i18n/README.zh-CN.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Español](docs/i18n/README.es.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Português](docs/i18n/README.pt-BR.md)

![The usage page: Workers requests are projected to pass the included 10 million on October 19, with the chart, the pace and the estimated overage beside the list of products](docs/screenshot.png)

One Worker in your own Cloudflare account. It reads the account's usage from
Cloudflare Analytics, compares it with what the plan includes, and projects
where each product will stand when the period closes. Read it on a page, fetch
it as JSON, or let an agent ask over MCP. Your usage goes from Cloudflare to
your Worker and nowhere else: there is no telemetry, and no server of ours
that sees it.

## What it tells you

- **Whether you will go over.** Workers requests and CPU time, D1, KV, R2,
  Durable Objects, Queues and Workers AI: used so far, included, and projected
  to the end of the billing period.
- **What it will cost.** The overage in dollars, at Cloudflare's list prices.
- **Who is using it.** Each figure by Worker, database, namespace, bucket, queue
  or model.
- **What changed.** A Worker whose requests tripled this week. Storage that
  will pass its allowance in 40 days.
- **When to look.** A push through ntfy or a webhook when a product is on
  course to go over.
- **Several accounts**, one tab each.
- **Nine languages.**

## Try it without an account

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # made-up data on http://localhost:8798
```

## Deploy

You need a Cloudflare account on **Workers Paid**. Running this costs nothing
beyond that: it reads Cloudflare four times a day and keeps the result in KV, a
small fraction of what the plan already includes.

1. **Press Deploy to Cloudflare.** It creates the KV namespace the Worker
   needs. There is no token to create and no password to choose.
2. **Open the Worker's address and press Continue with Cloudflare**, twice:
   once to find your accounts, once to let the page read their usage. What
   you allow shows how much was used and nothing that is stored: it cannot
   read a database, a KV value or an R2 object, and it cannot change anything.
3. **Set the day your bill renews.** It is under Manage Account → Billing →
   Subscriptions in the Cloudflare dashboard.

What signing in asks for and keeps: [docs/sign-in.md](docs/sign-in.md). With
an API token instead, from a clone, or on your own domain:
[docs/deploy.md](docs/deploy.md).

## Connect an agent

The Worker is also an MCP server at `https://<your-worker>/mcp`. In Claude, add
that address as a custom connector. In Claude Code:

```sh
claude mcp add --transport http usage https://<your-worker>/mcp
```

Your Worker asks you to sign in and allow it, and the agent gets a read-only
token of its own. Other clients, the tools and the JSON API:
[docs/agents.md](docs/agents.md).

## Documentation

- [Deploying and configuring](docs/deploy.md)
- [Signing in with Cloudflare](docs/sign-in.md)
- [Agents, MCP and the JSON API](docs/agents.md)
- [Alerts through ntfy or a webhook](docs/alerts.md)
- [How it works, and where the numbers come from](docs/how-it-works.md)
- [Development, and adding a language](docs/development.md)

## License

[Apache-2.0](LICENSE)

An independent project, not affiliated with or endorsed by Cloudflare, Inc.
Cloudflare and the Cloudflare logo are trademarks of Cloudflare, Inc.
