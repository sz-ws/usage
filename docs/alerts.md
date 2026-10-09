# Alerts

A message when something changes for the worse, through
[ntfy](https://ntfy.sh) or a webhook. Open **Alerts** in the top bar, choose
what you want to hear about, fill in one or both addresses, and press **Send a
test**.

## What you are told, and when

| Choice | You hear when |
| --- | --- |
| On course to go over | a product's projection for the billing period passes its allowance |
| Has gone over | a product's usage has passed its allowance |
| On course to pass 80% | a product's projection passes 80% of its allowance (off by default) |
| An API token stops working | Cloudflare refuses a token, or it can no longer see any account |

The Worker checks after each scheduled reading, four times a day, so an alert
can be up to six hours behind the change.

Each product is reported once at each level in a billing period. A product
that goes from "on course to go over" to "has gone over" is reported twice; one
that hovers around a line is reported the first time it crosses and not again.
A new billing period starts the count afresh. If no channel accepts a message,
it is tried again on the next check.

Alerts are written in the language the page was in when you saved them.

## ntfy

Give the address of a topic, such as `https://ntfy.sh/acme-usage-7f3k`. On
ntfy.sh anyone who knows a topic's name can read it, so pick one that cannot be
guessed, or use a protected topic and fill in its access token. A server of
your own works as long as it is reached over https.

An alert has the account and the verdict as its title, one line for each
product that changed, and opens the page when tapped.

## Webhook

The address receives a `POST` with a JSON body:

```json
{
  "event": "usage.alert",
  "sentAt": "2026-10-09T12:00:00.000Z",
  "text": "Acme: Included Workers requests will run out on Oct 19.\nWorkers requests: Will go over (projected 102%)\nEstimated extra charges: $0.06.",
  "title": "Acme: Included Workers requests will run out on Oct 19.",
  "url": "https://<your-worker>/?account=Acme",
  "account": { "id": "…", "name": "Acme" },
  "period": { "start": "2026-09-20", "end": "2026-10-20" },
  "estimatedOverageUsd": 0.06,
  "metrics": [
    {
      "id": "workers.requests",
      "label": "Workers requests",
      "unit": "count",
      "mode": "cycle",
      "status": "will-exceed",
      "used": 6600000,
      "allowance": 10000000,
      "projected": 10200000,
      "projectedRatio": 1.02,
      "estimatedOverageUsd": 0.06
    }
  ]
}
```

`event` is `usage.alert`, `usage.token_problem` (with `tokens` in place of the
account fields) or `usage.test`. `status` is `watch`, `will-exceed` or
`exceeded`. `period.end` is the first day of the next period.

`text` holds the whole message as plain text, which is the field Slack-style
receivers display. A Discord webhook takes the same body at its `/slack`
address. Neither has been tried against the real service.

### Checking where it came from

With a signing secret set, each request carries
`X-Usage-Signature: sha256=<hex>`, the HMAC-SHA256 of the raw body under that
secret:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function isFromUsage(rawBody, header, secret) {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

## What is kept

The addresses, the access token and the signing secret are stored in the
Worker's KV namespace, in your account. The page is shown the addresses and
whether a credential is set, never the credential itself. Removing an address
removes its credential. Redirects are not followed, and only https addresses
are accepted.
