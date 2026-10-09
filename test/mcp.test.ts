import { afterEach, describe, expect, it, vi } from "vitest";

import { rangeDays } from "../shared/dates";
import type { Snapshot } from "../shared/types";
import { keyFingerprint } from "../worker/access";
import type { Env } from "../worker/env";
import { mcp } from "../worker/mcp";
import { fakeFetch, fakeKv } from "./helpers";

const ACCOUNT = "4".repeat(32);
const KEY = "a-long-enough-access-key";
const URL_MCP = "https://usage.example.workers.dev/mcp";

function snapshotOf(): Snapshot {
  const today = new Date().toISOString().slice(0, 10);
  const days = rangeDays(new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10), today);
  return {
    v: 1,
    accountId: ACCOUNT,
    fetchedAt: new Date().toISOString(),
    days,
    metrics: {
      "workers.requests": {
        total: days.map((_, index) => 1000 + index),
        by: { site: days.map((_, index) => 900 + index), api: days.map(() => 100) },
      },
    },
    extras: {},
    warnings: [],
  };
}

function env(overrides: Partial<Env> = {}): Env {
  const { kv } = fakeKv({
    [`usage:snapshot:${ACCOUNT}`]: snapshotOf(),
    "usage:settings": { accounts: { [ACCOUNT]: { renewalDay: 13 } } },
  });
  return { ANALYTICS_TOKEN: "cfat_token", ACCESS_KEY: KEY, OAUTH_KV: kv, ...overrides } as unknown as Env;
}

type Reply = { result?: Record<string, unknown>; error?: unknown };

/** An answer arrives as plain JSON or as the last `data:` line of an event stream, by protocol version. */
function parse(text: string): Reply | null {
  try {
    return JSON.parse(text) as Reply;
  } catch {
    const last = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .at(-1);
    try {
      return last ? (JSON.parse(last.slice(5)) as Reply) : null;
    } catch {
      return null;
    }
  }
}

/** One JSON-RPC call, the way a client that has been let through by the OAuth provider sends it. */
async function call(method: string, params: unknown, props: unknown, bindings: Env = env()) {
  const request = new Request(URL_MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const ctx = { props, waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
  const response = await mcp.fetch(request as Parameters<typeof mcp.fetch>[0], bindings, ctx);
  return { response, body: parse(await response.text()) };
}

function toolText(body: { result?: Record<string, unknown> } | null): string {
  const content = body?.result?.content as { text: string }[] | undefined;
  return content?.[0]?.text ?? "";
}

function cloudflare() {
  const fake = fakeFetch({
    "https://api.cloudflare.com/client/v4/accounts?": () =>
      Response.json({ result: [{ id: ACCOUNT, name: "Personal" }] }),
  });
  vi.stubGlobal("fetch", fake.fetcher);
  return fake;
}

afterEach(() => vi.unstubAllGlobals());

describe("who the MCP endpoint answers", () => {
  const granted = async (key = KEY) => ({ via: "oauth", key: await keyFingerprint(key) });

  it("answers a client the owner allowed under the current key, and one that sent the key itself", async () => {
    for (const props of [await granted(), { via: "key" }]) {
      const { response, body } = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } }, props);
      expect(response.status).toBe(200);
      expect(body?.result?.serverInfo).toMatchObject({ name: "cloudflare-usage" });
    }
  });

  it("stops answering a client that was allowed under a key since changed", async () => {
    const { response } = await call("tools/list", {}, await granted("the-key-before-it-was-changed"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("invalid_token");
  });

  it("answers nobody without a grant it recognises", async () => {
    for (const props of [undefined, null, {}, { via: "oauth" }, { via: "admin" }, "key"]) {
      expect((await call("tools/list", {}, props)).response.status, JSON.stringify(props)).toBe(401);
    }
  });

  it("answers nobody while the deployment has no access key", async () => {
    const { response } = await call("tools/list", {}, { via: "key" }, env({ ACCESS_KEY: undefined }));
    expect(response.status).toBe(401);
  });
});

describe("the tools", () => {
  const props = { via: "key" };

  it("are two, both marked read-only, with the metric ids spelled out", async () => {
    const { body } = await call("tools/list", {}, props);
    const tools = body?.result?.tools as { name: string; annotations?: { readOnlyHint?: boolean }; inputSchema: unknown }[];
    expect(tools.map((tool) => tool.name)).toEqual(["usage_report", "metric_history"]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(JSON.stringify(tools[1]?.inputSchema)).toContain("workers.requests");
  });

  it("report every account's verdict, in the language asked for", async () => {
    cloudflare();
    const english = JSON.parse(toolText((await call("tools/call", { name: "usage_report", arguments: {} }, props)).body));
    expect(english.accounts[0]).toMatchObject({ name: "Personal", renewalDay: 13 });
    expect(english.accounts[0].headline.title).toMatch(/^[\x20-\x7e]+$/);
    expect(english.accounts[0].metrics[0]).toMatchObject({ id: "workers.requests", label: "Workers requests" });
    expect(english.tokenProblems).toEqual([]);

    const chinese = JSON.parse(
      toolText((await call("tools/call", { name: "usage_report", arguments: { account: "personal", lang: "zh-TW" } }, props)).body),
    );
    expect(chinese.accounts[0].headline.title).toMatch(/[一-鿿]/);
  });

  it("give one metric day by day, with the resources behind it, largest first", async () => {
    cloudflare();
    const { body } = await call(
      "tools/call",
      { name: "metric_history", arguments: { account: ACCOUNT, metric: "workers.requests", days: 7 } },
      props,
    );
    const history = JSON.parse(toolText(body));
    expect(history.days).toHaveLength(7);
    expect(history.total).toHaveLength(7);
    expect(history.total.at(-1)).toBe(1040);
    expect(history.metric).toMatchObject({ id: "workers.requests", unit: "count", mode: "cycle" });
    expect(history.resources.map((resource: { name: string }) => resource.name)).toEqual(["site", "api"]);
    expect(history.resources[0].values).toHaveLength(7);
  });

  it("say what was wrong with a request instead of failing", async () => {
    cloudflare();
    const unknownAccount = await call("tools/call", { name: "usage_report", arguments: { account: "nobody" } }, props);
    expect(unknownAccount.body?.result?.isError).toBe(true);
    expect(toolText(unknownAccount.body)).toContain("nobody");

    const unknownMetric = await call(
      "tools/call",
      { name: "metric_history", arguments: { account: "personal", metric: "workers.magic" } },
      props,
    );
    expect(unknownMetric.body?.result?.isError).toBe(true);
    expect(toolText(unknownMetric.body)).toContain("workers.requests");
  });

  it("have nothing to report while the deployment has no API token", async () => {
    const { body } = await call("tools/call", { name: "usage_report", arguments: {} }, props, env({ ANALYTICS_TOKEN: "" }));
    // Without a token the deployment is not set up, so the grant itself is refused before any tool runs.
    expect(body?.result).toBeUndefined();
  });
});
