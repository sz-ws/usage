# Deploying and configuring

## What you need

A Cloudflare account on **Workers Paid**. Reading 90 days of analytics takes
more CPU than the 10 ms a Workers Free request is allowed, and the allowances
the page compares against are the Workers Paid ones.

## With the button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

The button copies this repository to your GitHub account, creates a KV
namespace, and deploys. Later pushes to your copy deploy themselves.

Then open the Worker's address and press **Continue with Cloudflare** for each
of the two steps: [Signing in with Cloudflare](sign-in.md) says what each one
asks for. Last, set the day your bill renews. That date is under **Manage
Account → Billing → Subscriptions** in the Cloudflare dashboard, beside
Workers Paid. Access this narrow cannot read the subscription, which is why
the page asks.

The first reading takes a few seconds. After that the Worker reads again four
times a day, and whenever you press refresh.

## From a clone

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm run deploy                               # creates the KV namespace the first time
```

Then open the Worker's address and connect it, as above.

## With an API token instead

A deployment that has an API token reads with it and opens with a password,
and does not sign in with Cloudflare at all. Choose this when only scripts and
agents will read it, when your account does not allow OAuth applications, or
when you would rather not sign in through `usage.sz.ws`.

| Secret | What to put in it |
| --- | --- |
| `ANALYTICS_TOKEN` | A Cloudflare API token with one permission, **Account Analytics: Read**. [Create it with this link](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage), which fills the form in. |
| `ACCESS_KEY` | The password for your page, 24 characters or more. `openssl rand -base64 32` makes a good one. |

```sh
pnpm exec wrangler secret put ANALYTICS_TOKEN
pnpm exec wrangler secret put ACCESS_KEY
```

Or add them in the Cloudflare dashboard, under the Worker's **Settings →
Variables and Secrets**. With a token and no key, every page says the key is
missing and nothing else is served.

## More than one account

Create a token in each account and put them all in `ANALYTICS_TOKEN`, separated
by commas. The page shows one tab per account. A user token that covers several
accounts works too
([this link](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A&zoneId=all&name=usage)
fills in that form).

Accounts are found by asking each token what it can see, so there are no
account ids to configure. A token that stops working is named at the top of the
page.

## Names instead of ids

Analytics names Workers and R2 buckets, and gives only ids for D1 databases, KV
namespaces, Durable Object namespaces and Queues. With the token above, those
show the first characters of their id.

To see names, add any of these read permissions to the token. The Worker uses
them to list names and for nothing else, but each allows more than that:

| Permission | Names | Also allows |
| --- | --- | --- |
| D1: Read | databases | querying every database |
| Workers KV Storage: Read | KV namespaces | reading every stored value |
| Workers Scripts: Read | Durable Object namespaces | downloading every Worker's code |
| Queues: Read | queues | nothing else |

Names are looked up once a day.

## Changing the access key

```sh
pnpm exec wrangler secret put ACCESS_KEY
```

or edit it in the dashboard under **Settings → Variables and Secrets**.
Changing it signs out every browser and disconnects every agent, which is also
how to do either on purpose.

## A custom domain

Add one to the Worker under **Settings → Domains & Routes**. Nothing in the
code names a host. An agent connected on the old address has to connect again:
its token was issued for that address.
