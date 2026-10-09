# How it works, and where the numbers come from

```
browser ─ session cookie ─┐
script  ─ access key ─────┼─▶ Worker ─▶ KV: readings, settings, agent sign-ins
agent   ─ OAuth token ────┘      └────▶ Cloudflare GraphQL Analytics API
```

Four times a day, and whenever you press refresh, the Worker asks Cloudflare's
GraphQL Analytics API for the last 90 days of usage, one row per day and per
resource, and stores the result in KV. The page, the JSON report and the MCP
tools all read that stored reading and do the same arithmetic on it.

## The three kinds of allowance

| Kind | Examples | What is compared with the allowance |
| --- | --- | --- |
| Adds up over the period | requests, CPU time, rows, operations | Used so far, plus the pace of the last 7 and of the last 30 days for the days that remain. The higher of the two is the projection. |
| A stored amount | D1, KV, R2 and Durable Objects storage | The period's average of each day's level, because that is what is billed. Growth is the typical daily change, with the single largest jump left out. |
| Resets every day | Workers AI neurons | Today's usage, and how many days of the period went over. |

## Where the numbers come from

- **Usage** is Cloudflare's GraphQL Analytics API, which samples. Expect small
  differences from the invoice.
- **Allowances and prices** are Cloudflare's list prices for Workers Paid, R2
  and Workers AI as read on 2026-10-09. They live in
  [`shared/catalog.ts`](../shared/catalog.ts) with the pages they came from.
- **The billing day** is yours to set: a token this narrow cannot read the
  subscription.

## What it does not cover

- Pages Functions CPU time, which the analytics do not report.
- Workers Logs, Workers Builds minutes, Vectorize, Browser Rendering, Email.
- Workers Free accounts. Their limits reset daily and need a different reading
  of the same numbers.
- Billing rounds some products up to the next unit (R2 operations, Durable
  Objects duration); the estimate here does not.

## Who can get in

On a deployment that reads with an API token, everything sits behind one
secret, `ACCESS_KEY`.

- **The page**: the key starts a session, a signed cookie bound to the host.
- **Scripts**: the key as a bearer token on `/api/v1/usage`.
- **Agents**: OAuth 2.1 through
  [`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider).
  The page that lets an agent connect only opens for someone signed in. Each
  agent gets its own token, tied to the key in force when it was allowed.

Changing the key ends every session and every agent's access. The JSON API, the
MCP endpoint and sign-in attempts are rate limited per caller. The Cloudflare
API token never leaves the Worker: it is not stored in KV, logged, or returned
by any endpoint.

A deployment that [signs in with Cloudflare](sign-in.md) has no key for the
page. A person gets a session when their own Cloudflare sign-in can read the
analytics of the account the Worker runs in; the Worker recognises that
account by finding its own version id in the account's Workers analytics.
Sessions are signed with a key the Worker made when it was connected, and
agents' tokens are tied to that key. Either way, a session lasts 30 days from
the owner's last visit.

The MCP server is the official
[TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
