# Signing in with Cloudflare

A deployment can read your usage through your own Cloudflare sign-in instead
of an API token. There is no token to create and no access key to choose. You
press a button and Cloudflare asks you to allow it.

A deployment works one way or the other. With `ANALYTICS_TOKEN` set it reads
with the token, as described in [Deploying and configuring](deploy.md).
Without it, and with an OAuth client configured, it works as described here.

## What you need

An OAuth client registered with Cloudflare. None is built in, so you create
one in your own account. It has no secret.

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
the client, or Cloudflare refuses the sign-in.

## Connecting

Open the Worker and press the button once for each of the two steps.

1. **Find your accounts.** Cloudflare's page asks for both permissions. Choose
   the accounts you want to see, including the one the Worker runs in. The
   page reads their names and gives this access back at once.
2. **Let the page read usage.** Cloudflare's page asks again, this time for
   Account Analytics Read alone. Choose the same accounts. This is the access
   the Worker keeps.

The permission that reads usage cannot list your accounts, and the one that
can also shows who an account's members are. So the page asks for that one
separately and holds it only long enough to learn the names.

After that, set the day your bill renews, as with any deployment.

If the first step says none of your accounts is running this Worker, wait a
minute and try again: a new deployment takes about that long to appear in
Cloudflare's analytics, which is how the Worker recognises its own account.
If it keeps saying so, name the account yourself with the variable
`HOME_ACCOUNT_ID`.

## Coming back

A session lasts 30 days from your last visit, so a browser you keep using
stays signed in. In a new browser, or after 30 days away, press **Sign in
with Cloudflare**. Cloudflare asks once, for Account Analytics Read; choose
the account the Worker runs in.

Anyone whose Cloudflare login can read that account's analytics can sign in
this way. Nobody else can.

## What the Worker keeps

In its KV namespace, in your account:

- the access that reads analytics, which Cloudflare renews each time the
  Worker uses it;
- the ids and names of the accounts you chose;
- a key that signs browser sessions.

It can read how much was used. It cannot read a database, a KV value or an R2
object, and it cannot change anything. It cannot list resource names either,
so D1 databases, KV namespaces and queues appear by their ids.

To withdraw the access, open
[Manage OAuth authorizations](https://dash.cloudflare.com/?to=/profile/access-management/authorization)
in your Cloudflare profile and revoke the client. The page then says it needs
to be connected again, and **Reconnect** takes you through the two steps.
Your settings and history are kept.

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
  that belongs to another account.
- Signing in needs Cloudflare's own page each time, and that page always asks
  which account to use. There is no way to skip it.

## One client for many deployments

Cloudflare only returns a sign-in to an address registered with the client,
and every deployment has an address of its own. A client meant for everyone
therefore registers one address, the relay in [`relay/`](../relay/README.md):
a static page that shows where the sign-in is going and, once you confirm,
passes Cloudflare's one-time code on to your Worker. The code is no use
without a second value that never leaves your Worker, and your usage and the
access itself go straight between your Worker and Cloudflare.

A client of your own does not use the relay.
