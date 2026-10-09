# Usage

Will this Cloudflare account stay inside its Workers Paid plan this billing
period, and what will it cost if it does not?

One Worker, deployed to your own account. It reads the account's usage from
Cloudflare Analytics, holds it against what the plan includes, and says where
each product will stand when the period closes. You can read the answer on a
page, fetch it as JSON, or let an agent ask for it over MCP.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

## What you get

- **Every metered product, against its allowance.** Workers requests and CPU
  time, D1, KV, R2 (Standard and Infrequent Access), Durable Objects, Queues and
  Workers AI: used so far, included, and projected to the end of the billing
  period at the pace of the last 7 and 30 days.
- **What going over would cost**, in dollars, at Cloudflare's list prices.
- **Who is using it.** Each figure broken down by Worker, database, namespace,
  bucket, queue or model, with the change from the previous period.
- **What changed.** A Worker whose requests tripled this week, storage that
  will pass its allowance in 40 days, one database doing 90% of the reads.
- **Several accounts** side by side.
- English and 繁體中文.

## Deploy

The account you deploy to needs **Workers Paid**. Reading 90 days of analytics
takes more CPU than the 10 ms a Workers Free request is allowed.

1. Press the button above. It copies this repository to your GitHub account,
   creates a KV namespace and asks for two secrets:

   | Secret | What to put in it |
   | --- | --- |
   | `ANALYTICS_TOKEN` | A Cloudflare API token with one permission, **Account Analytics: Read**. [Create it with this link](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage), which fills the form in. |
   | `ACCESS_KEY` | The password for your page, 24 characters or more. `openssl rand -base64 32` makes a good one. |

2. Open the Worker's address and sign in with the access key.
3. Set the day your bill renews. It is the date under **Manage Account →
   Billing → Subscriptions** in the Cloudflare dashboard, next to Workers Paid.

The first reading takes a few seconds. After that the Worker reads again four
times a day, and whenever you press refresh.

### From a clone instead

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm run deploy                               # creates the KV namespace the first time
pnpm exec wrangler secret put ANALYTICS_TOKEN
pnpm exec wrangler secret put ACCESS_KEY
```

### More than one account

Create a token in each account and put them all in `ANALYTICS_TOKEN`, separated
by commas. The page shows one tab per account. A user token that covers several
accounts works too
([this link](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A&zoneId=all&name=usage)
fills in that form).

## Connect an agent

The Worker is also an MCP server at `https://<your-worker>/mcp`, with two
read-only tools:

| Tool | Answers |
| --- | --- |
| `usage_report` | Whether each account will stay inside its plan: the verdict, every metric against its allowance, the projection, the estimated overage, the largest resources, and what changed lately. |
| `metric_history` | One metric day by day for up to 90 days, in total and per resource. For "which Worker spiked on Tuesday?" |

**Claude (web, desktop, mobile)**: Settings → Connectors → Add custom
connector, and paste the `/mcp` address. A page on your Worker asks for the
access key and whether to allow it.

**Claude Code**

```sh
claude mcp add --transport http usage https://<your-worker>/mcp
```

then `/mcp` inside Claude Code to sign in.

**Cursor, VS Code and other clients that read `mcp.json`**

```json
{
  "mcpServers": {
    "usage": { "url": "https://<your-worker>/mcp" }
  }
}
```

**An agent that cannot open a browser** sends the access key as a bearer token:

```sh
claude mcp add --transport http usage https://<your-worker>/mcp \
  --header "Authorization: Bearer $ACCESS_KEY"
```

An agent you allow gets a token of its own that reads usage and does nothing
else. Changing `ACCESS_KEY` disconnects every agent and signs out every browser.

## JSON

```sh
curl -H "Authorization: Bearer $ACCESS_KEY" https://<your-worker>/api/v1/usage
```

| Query | Effect |
| --- | --- |
| `account=<name or id>` | One account only. |
| `fresh=1` | Read from Cloudflare first, unless that happened in the last minute. Takes several seconds. |
| `lang=en` or `lang=zh-TW` | Language of the sentences. Defaults to `Accept-Language`, then English. |

Answers are `{ "success": true, "data": { "generatedAt", "accounts": [...] }, "error": null }`,
or `{ "success": false, "data": null, "error": "<code>" }` with 401, 404, 405,
429 or 503. The fields are typed in [`worker/report.ts`](worker/report.ts).
Signed in, you can open the same address in a browser.

## What the token can see

**Account Analytics: Read** shows how much was used: counts of requests, rows,
operations and bytes. It cannot read a database, a KV value or an R2 object, and
it cannot change anything.

Analytics names Workers and R2 buckets, and gives only ids for D1 databases, KV
namespaces, Durable Object namespaces and Queues. With the token above, those
show the first characters of their id. To see names, add any of these read
permissions to the token; the Worker uses them to list names and for nothing
else, but each allows more than that:

| Permission | Names | Also allows |
| --- | --- | --- |
| D1: Read | databases | querying every database |
| Workers KV Storage: Read | KV namespaces | reading every stored value |
| Workers Scripts: Read | Durable Object namespaces | downloading every Worker's code |
| Queues: Read | queues | — |

## Where the numbers come from

- Usage is Cloudflare's GraphQL Analytics API, which samples. Expect small
  differences from the invoice.
- Allowances and prices are Cloudflare's list prices for Workers Paid, R2 and
  Workers AI as read on 2026-10-09. They live in
  [`shared/catalog.ts`](shared/catalog.ts) with the pages they came from.
- The billing day is yours to set: a token this narrow cannot read the
  subscription.
- Not tracked: Pages Functions CPU time (absent from the analytics), Workers
  Logs, Workers Builds minutes, Vectorize, Browser Rendering, Email.
- Workers Free accounts are not handled. Their limits reset daily and need a
  different reading of the same numbers.

## How it is put together

```
browser ─ session cookie ─┐
script  ─ access key ─────┼─▶ Worker ─▶ KV: readings, settings, agent sign-ins
agent   ─ OAuth token ────┘      └────▶ Cloudflare GraphQL Analytics API
```

| Path | What |
| --- | --- |
| `shared/` | Metrics and prices (`catalog.ts`), billing periods (`cycle.ts`), projections (`forecast.ts`), the sentences (`insights.ts`, `i18n/`). Pure and tested; runs in the browser and in the Worker. |
| `worker/` | Sign-in (`access.ts`), the page that lets an agent connect (`authorize.ts`), the MCP server (`mcp.ts`), the JSON report (`report.ts`), analytics queries (`cloudflare.ts`, `shape.ts`), KV (`store.ts`). |
| `src/` | The page: React and plain CSS. |
| `test/` | vitest. |

Everything sits behind the access key. Sessions are signed cookies bound to the
host; the JSON API and the MCP endpoint are rate limited per IP; agents sign in
through OAuth 2.1 ([`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider))
and the MCP server is the official [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Development

```sh
pnpm install
cp .dev.vars.example .dev.vars   # fill in the two values
pnpm dev                         # builds the page, then http://localhost:8797
pnpm dev:web                     # Vite on :5183 with hot reload, proxying /api to the Worker
pnpm check                       # typecheck and tests
```

## License

[Apache-2.0](LICENSE)
