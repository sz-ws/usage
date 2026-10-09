# Agents, MCP and the JSON API

## MCP

The Worker is an MCP server at `https://<your-worker>/mcp`, with two read-only
tools:

| Tool | Answers |
| --- | --- |
| `usage_report` | Whether each account will stay inside its plan: the verdict, every metric against its allowance, the projection, the estimated overage, the largest resources, and what changed lately. |
| `metric_history` | One metric day by day for up to 90 days, in total and per resource. For "which Worker spiked on Tuesday?" |

### Connecting

**Claude (web, desktop, mobile)**: Settings → Connectors → Add custom
connector, and paste the `/mcp` address.

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

Each of these sends your browser to the Worker. You sign in with the access
key, see which app is asking and where its access will go, and allow or deny.

**An agent that cannot open a browser** sends the access key as a bearer token:

```sh
claude mcp add --transport http usage https://<your-worker>/mcp \
  --header "Authorization: Bearer $ACCESS_KEY"
```

### What an agent gets

An agent you allow gets a token of its own that reads usage and does nothing
else: it cannot change the billing day, and it never sees the Cloudflare API
token. Its own token stops working when you change `ACCESS_KEY`.

Both tools take `lang` (`en`, `zh-TW`, `zh-CN`, `ja`, `ko`, `es`, `fr`, `de`,
`pt-BR`) for the language of the sentences in the answer. `usage_report` takes
`fresh: true` to read from Cloudflare first.

## JSON

```sh
curl -H "Authorization: Bearer $ACCESS_KEY" https://<your-worker>/api/v1/usage
```

| Query | Effect |
| --- | --- |
| `account=<name or id>` | One account only. |
| `fresh=1` | Read from Cloudflare first, unless that happened in the last minute. Takes several seconds. |
| `lang=<code>` | Language of the sentences. Defaults to `Accept-Language`, then English. |

A successful answer:

```json
{
  "success": true,
  "data": { "generatedAt": "…", "accounts": [], "tokenProblems": [] },
  "error": null
}
```

A failed one is `{ "success": false, "data": null, "error": "<code>" }` with
401, 404, 405, 429 or 503. The fields of an account are typed in
[`worker/report.ts`](../worker/report.ts).

Signed in, you can open the same address in a browser; the page links to it at
the foot.
