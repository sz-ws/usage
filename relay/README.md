# Usage sign-in relay

Cloudflare sends a browser back from sign-in only to an address registered in
advance, and every usage page has an address of its own. So they share this
one: a static page that takes Cloudflare's answer and, when the reader agrees,
passes it on to the usage page that started the sign-in.

## What it receives

Cloudflare opens `/callback` with a one-time `code` (or an `error`) and the
`state` the usage page made, which names that page's origin. The code is no use
without a verifier that never leaves the usage page.

The page shows the origin and waits. When the reader presses the button, the
browser posts `code` (or `error`) and `state` to `<origin>/connect/return`.
The origin has to be `https`, or `http` on `localhost` or `127.0.0.1`.
`error_description` is neither shown nor passed on.

## What it stores

Nothing. There is no server code, no cookie and no storage, and Worker logs are
off. The page takes the query out of the address bar as soon as it has read it,
sends no referrer, and is served with `Cache-Control: no-store`.

## Files

- `public/callback.html`, `public/callback.js`: the page and its wiring.
- `public/decide.js`: what to show for an answer. Run by `test/relay.test.ts`.
- `public/text.js`: the sentences. A language is one more object there.
- `public/_headers`: the content security policy and the other headers.

## Deploy

```sh
pnpm exec wrangler deploy -c relay/wrangler.jsonc
```

The Worker is `usage-connect`. Give it a custom domain when you deploy; the
address registered with Cloudflare is then `https://<that domain>/callback`.
