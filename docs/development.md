# Development

```sh
pnpm install
pnpm demo                        # the page with made-up data, http://localhost:8798
cp .dev.vars.example .dev.vars   # fill in the two values for the real thing
pnpm dev                         # builds the page, then http://localhost:8797
pnpm dev:web                     # Vite on :5183 with hot reload, proxying /api to the Worker
pnpm check                       # typecheck and tests
```

`pnpm demo` needs no Cloudflare account and no secrets. It is also where the
README's screenshot comes from.

For `pnpm dev:web`, keep `pnpm dev:worker` running and sign in on :8797 first;
the session cookie is for `localhost`, whatever the port.

## Layout

| Path | What |
| --- | --- |
| `shared/` | Metrics and prices (`catalog.ts`), billing periods (`cycle.ts`), projections (`forecast.ts`), the sentences (`insights.ts`, `i18n/`). Pure and tested; runs in the browser and in the Worker. |
| `worker/` | Sign-in (`access.ts`), the page that lets an agent connect (`authorize.ts`), the MCP server (`mcp.ts`), the JSON report (`report.ts`), analytics queries (`cloudflare.ts`, `shape.ts`), KV (`store.ts`). |
| `src/` | The page: React and plain CSS. |
| `test/` | vitest. |
| `scripts/demo.mjs` | The made-up data behind `pnpm demo`. |

## Adding a language

1. Copy `shared/i18n/en.ts` and `worker/text/en.ts` to files named after the
   language tag (`it.ts`), and translate them. Sentences are functions, so word
   order, plurals and agreement are yours to get right for the language.
2. Add the tag to the four lists in `shared/i18n/index.ts` and to
   `worker/text/index.ts`.
3. Run `pnpm check`. The type checker names any entry that is missing, and
   `test/locales.test.ts` builds every sentence for every metric in every
   language.
4. Translate `README.md` into `docs/i18n/README.<tag>.md` and add it to the
   language line at the top of each README.

## When Cloudflare changes prices

Allowances and prices are in `shared/catalog.ts`, with the date they were read
and the pages they came from. The page's footer states the same date, in each
dictionary's `footer.prices`.
