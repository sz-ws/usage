# Signing in with Cloudflare

A deployment reads your usage through your own Cloudflare sign-in. There is no
token to create and no access key to choose: you press a button and Cloudflare
asks you to allow it.

A deployment that has `ANALYTICS_TOKEN` set reads with the token instead and
never signs in with Cloudflare, as described in
[Deploying and configuring](deploy.md).

## What you need

Nothing beyond the deployment. On Cloudflare's pages the application is called
**Usage**, published from `usage.sz.ws`.

After you allow it, Cloudflare sends your browser to `usage.sz.ws/callback`.
That page shows the address of your Worker and waits. Press **Continue** if
the address is yours, and close the tab if it is not: whoever runs the address
shown there can read the usage you just allowed.

## Connecting

Open the Worker and press the button once for each of the two steps.

1. **Find your accounts.** Cloudflare's page asks for both permissions. Choose
   the accounts you want to see, including the one the Worker runs in. The
   page reads their names and then asks Cloudflare to end this access. Up to
   eight accounts are kept.
2. **Let the page read usage.** Cloudflare's page asks again, this time
   without Account Settings Read. Choose the same accounts. This is the access
   the Worker keeps, and Cloudflare lets the Worker renew it.

The permission that reads usage cannot list your accounts, and the one that
can also shows who an account's members are. So the page asks for that one
separately and holds it only long enough to learn the names.

After that, set the day your bill renews, as with any deployment.

If the first step says none of your accounts is running this Worker, wait a
minute and try again. The Worker recognises its own account by finding its own
requests in that account's analytics, and a request takes about a minute to
appear there, so the first visit to a new deployment comes too early. If it
keeps saying so, name the account yourself with the variable
`HOME_ACCOUNT_ID`. Under `wrangler dev` that variable is always needed.

## Coming back

A session lasts 30 days from the last time you opened the page, so a browser
you keep using stays signed in. In a new browser, or after 30 days away, press
**Sign in with Cloudflare**. Cloudflare asks once, for Account Analytics Read;
choose the account the Worker runs in.

Anyone whose Cloudflare login can read that account's analytics can sign in
this way, and nobody else can. Someone who signs in sees every account you
connected, and can connect the page again with accounts of their own choosing.

Taking a person out of the Cloudflare account stops them signing in. It does
not end a session they already have, which lasts as long as they keep opening
the page. Signing out clears the session from that browser only.

## What the Worker keeps

In its KV namespace, in your account, beside the readings, history and
settings every deployment keeps:

- the access that reads analytics, which the Worker renews with Cloudflare
  about once an hour while it is in use;
- the ids and names of the accounts you chose;
- a key that signs browser sessions.

It can read how much was used. It cannot read a database, a KV value or an R2
object, and it cannot change anything. It cannot list resource names either,
so D1 databases, KV namespaces and queues appear by their ids.

To withdraw the access, open
[Manage OAuth authorizations](https://dash.cloudflare.com/?to=/profile/access-management/authorization)
in your Cloudflare profile and revoke the client. Within the hour the page
says it needs to be connected again, and **Reconnect** takes you through the
two steps. Your settings and history are kept.

## Scripts and agents

Agents connect as they do on any deployment: add `https://<your-worker>/mcp`
to the client, sign in when the Worker asks, and allow it.

A script that calls `/api/v1/usage` needs something to send. Set `ACCESS_KEY`
(24 characters or more) and send it as a bearer token. On a deployment that
signs in with Cloudflare the key opens the JSON API and the MCP endpoint, and
nothing else: it is not a way into the page.

## When it does not apply

- An account administrator can turn off **Public OAuth App access** under
  Manage Account → Members → Settings, which stops sign-ins through a client
  that belongs to another account. Use [a client of your own](#a-client-of-your-own)
  or [an API token](deploy.md#with-an-api-token-instead).
- Signing in needs Cloudflare's own page each time, and that page always asks
  which account to use. There is no way to skip it.

## What passes through usage.sz.ws

Cloudflare only returns a sign-in to an address registered in advance, and
every deployment has an address of its own. So they share one: a static page,
the [`relay/`](../relay/README.md) folder of this repository as served at
`usage.sz.ws`. Cloudflare's one-time code passes through it, in your browser,
on the way to your Worker. The code is no use without a second value that
your Worker left in your browser and that the page never receives. Your usage
and the access itself go straight between your Worker and Cloudflare.

## A client of your own

To sign in without `usage.sz.ws`, register a client in your own Cloudflare
account. It has no secret, and Cloudflare then returns straight to your
Worker.

1. In the Cloudflare dashboard, open **Manage Account → OAuth clients** and
   select **Create client**.
2. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Client Name | anything, for example `Usage` |
   | Response Type | Code |
   | Grant type | Authorization Code, and add Refresh Token |
   | Token Authentication Method | None |
   | Redirect (Callback) URLs | `https://<your-worker>/connect/callback` |

3. On the next page choose two scopes: **Account Analytics Read** and
   **Account Settings Read**.
4. Leave the client private. A private client can be used by members of the
   account that owns it, which is everyone who should see this page.

Then give the Worker the client's id and the address you registered. They are
not secrets, so they go in `wrangler.jsonc`:

```jsonc
"vars": {
  "CF_OAUTH_CLIENT_ID": "<client id>",
  "CF_OAUTH_CALLBACK_URL": "https://<your-worker>/connect/callback"
}
```

Deploy with `pnpm run deploy`, and leave `ANALYTICS_TOKEN` unset.

The address in `CF_OAUTH_CALLBACK_URL` must be exactly the one registered with
the client, or Cloudflare refuses the sign-in. Open the Worker at that address
too: started from another of its hostnames, such as `workers.dev` beside a
custom domain, a sign-in cannot finish.

If the Worker still asks for `ANALYTICS_TOKEN` and `ACCESS_KEY`, one of the two
variables is not being read: the id is 32 lowercase hex characters, and the
address has no query string.

Under `wrangler dev`, a Worker on plain `http` can only sign in this way,
with `http://localhost:<port>/connect/callback` registered.
