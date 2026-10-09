import { afterEach, describe, expect, it, vi } from "vitest";

import { rangeDays } from "../shared/dates";
import type { Snapshot, StoredAlerts } from "../shared/types";
import { issueSession } from "../worker/access";
import {
  NO_ALERTS,
  accountAlert,
  alertAccount,
  alertTokens,
  alertsView,
  destination,
  ntfyTarget,
  send,
  testNotice,
  type AccountLedger,
} from "../worker/alerts";
import { app } from "../worker/app";
import type { Env } from "../worker/env";
import { Store } from "../worker/store";
import { fakeFetch, fakeKv } from "./helpers";

const ACCOUNT = { id: "4".repeat(32), name: "Acme", renewalDay: 1 };
const NOW = Date.parse("2026-10-09T12:00:00Z");
const NTFY = "https://ntfy.sh/acme-usage-7f3k";
const HOOK = "https://hooks.example.com/services/T0/B0/abc";

/** A month where Workers requests run at `perDay`: 290K ends near the allowance, 400K over it, 1.5M is already over. */
function snapshotOf(perDay: number): Snapshot {
  const days = rangeDays("2026-08-25", "2026-10-09");
  return {
    v: 1,
    accountId: ACCOUNT.id,
    fetchedAt: new Date(NOW).toISOString(),
    days,
    metrics: { "workers.requests": { total: days.map(() => perDay), by: { site: days.map(() => perDay) } } },
    extras: {},
    warnings: [],
  };
}

function stored(overrides: Partial<StoredAlerts> = {}): StoredAlerts {
  return {
    events: { willExceed: true, exceeded: true, watch: false, token: true },
    ntfyUrl: NTFY,
    ntfyToken: null,
    webhookUrl: null,
    webhookSecret: null,
    locale: "en",
    origin: "https://usage.example.workers.dev",
    ...overrides,
  };
}

/** Receivers that take everything, recording what they were sent. */
function receivers(status = 200) {
  const fake = fakeFetch({
    "https://ntfy.sh": () => new Response("{}", { status }),
    "https://hooks.example.com": () => new Response("ok", { status }),
  });
  vi.stubGlobal("fetch", fake.fetcher);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("an address alerts may be sent to", () => {
  it("is an https address without credentials in it", () => {
    expect(destination(HOOK)?.href).toBe(HOOK);
    expect(destination("  https://example.com/hook  ")?.href).toBe("https://example.com/hook");
    for (const value of [
      null,
      "",
      "example.com/hook",
      "http://example.com/hook",
      "ftp://example.com/hook",
      "javascript:alert(1)",
      "https://user:pass@example.com/hook",
      `https://example.com/${"x".repeat(600)}`,
    ]) {
      expect(destination(value), String(value).slice(0, 40)).toBeNull();
    }
  });

  it("splits an ntfy address into the server and the topic", () => {
    expect(ntfyTarget(NTFY)).toEqual({ server: "https://ntfy.sh", topic: "acme-usage-7f3k" });
    expect(ntfyTarget("https://ntfy.example.com/push/alerts_1/")).toEqual({
      server: "https://ntfy.example.com/push",
      topic: "alerts_1",
    });
    for (const value of ["https://ntfy.sh", "https://ntfy.sh/", "https://ntfy.sh/bad topic", "http://ntfy.sh/topic", "ntfy.sh/topic"]) {
      expect(ntfyTarget(value), value).toBeNull();
    }
  });
});

describe("what the page is told about alerts", () => {
  it("is the addresses and whether a credential is set, never the credential", () => {
    const view = alertsView(stored({ ntfyToken: "tk_secret_token", webhookUrl: HOOK, webhookSecret: "signing-secret" }));
    expect(view).toEqual({
      events: { willExceed: true, exceeded: true, watch: false, token: true },
      ntfy: { url: NTFY, hasToken: true },
      webhook: { url: HOOK, hasSecret: true },
    });
    expect(JSON.stringify(view)).not.toContain("tk_secret_token");
    expect(JSON.stringify(view)).not.toContain("signing-secret");
    expect(alertsView(undefined)).toEqual(NO_ALERTS);
  });
});

describe("what there is to say about an account", () => {
  it("is nothing while usage is far from the allowance, or the billing day is not set", () => {
    expect(accountAlert(ACCOUNT, snapshotOf(100_000), stored(), null, NOW)).toBeNull();
    expect(accountAlert({ ...ACCOUNT, renewalDay: null }, snapshotOf(1_500_000), stored(), null, NOW)).toBeNull();
  });

  it("is a product on course to go over, said once", () => {
    const first = accountAlert(ACCOUNT, snapshotOf(400_000), stored(), null, NOW);
    expect(first?.notice.event).toBe("usage.alert");
    expect(first?.notice.title.startsWith("Acme: ")).toBe(true);
    expect(first?.notice.lines[0]).toMatch(/^Workers requests: Will go over \(projected 1\d\d%\)$/);
    expect(first?.notice.tone).toBe("over");
    expect(first?.notice.url).toBe("https://usage.example.workers.dev/?account=Acme");
    expect(first?.ledger).toEqual({ period: "2026-10-01", levels: { "workers.requests": 2 } });

    // The next check finds the same thing and says nothing.
    expect(accountAlert(ACCOUNT, snapshotOf(400_000), stored(), first?.ledger ?? null, NOW)).toBeNull();
  });

  it("speaks again when the product gets worse, and not when it gets better", () => {
    const told: AccountLedger = { period: "2026-10-01", levels: { "workers.requests": 2 } };

    const worse = accountAlert(ACCOUNT, snapshotOf(1_500_000), stored(), told, NOW);
    expect(worse?.notice.lines[0]).toMatch(/^Workers requests: Over /);
    expect(worse?.ledger.levels["workers.requests"]).toBe(3);

    expect(accountAlert(ACCOUNT, snapshotOf(290_000), stored({ events: { ...stored().events, watch: true } }), told, NOW)).toBeNull();
  });

  it("starts afresh in a new billing period", () => {
    const lastPeriod: AccountLedger = { period: "2026-09-01", levels: { "workers.requests": 3 } };
    const alert = accountAlert(ACCOUNT, snapshotOf(400_000), stored(), lastPeriod, NOW);
    expect(alert?.ledger).toEqual({ period: "2026-10-01", levels: { "workers.requests": 2 } });
  });

  it("only mentions what the owner asked to hear about", () => {
    const quiet = stored({ events: { willExceed: false, exceeded: false, watch: false, token: true } });
    expect(accountAlert(ACCOUNT, snapshotOf(400_000), quiet, null, NOW)).toBeNull();
    expect(accountAlert(ACCOUNT, snapshotOf(1_500_000), quiet, null, NOW)).toBeNull();

    // Near the allowance is off unless asked for.
    expect(accountAlert(ACCOUNT, snapshotOf(290_000), stored(), null, NOW)).toBeNull();
    const near = accountAlert(ACCOUNT, snapshotOf(290_000), stored({ events: { ...stored().events, watch: true } }), null, NOW);
    expect(near?.notice.lines[0]).toMatch(/^Workers requests: Near allowance \(projected 9\d%\)$/);
    expect(near?.notice.tone).toBe("watch");
  });

  it("gives a webhook the figures behind the words, and the cost when there is one", () => {
    const alert = accountAlert(ACCOUNT, snapshotOf(400_000), stored(), null, NOW);
    const data = alert?.notice.data as {
      account: unknown;
      period: unknown;
      estimatedOverageUsd: number;
      metrics: { id: string; status: string; allowance: number; projectedRatio: number }[];
    };
    expect(data.account).toEqual({ id: ACCOUNT.id, name: "Acme" });
    expect(data.period).toEqual({ start: "2026-10-01", end: "2026-11-01" });
    expect(data.metrics[0]).toMatchObject({ id: "workers.requests", status: "will-exceed", allowance: 10_000_000 });
    expect(data.metrics[0]?.projectedRatio).toBeGreaterThan(1);
    expect(data.estimatedOverageUsd).toBeGreaterThan(0);
    expect(alert?.notice.lines.at(-1)).toMatch(/^Estimated extra charges: \$\d/);
  });

  it("is written in the language the owner saved the alerts in", () => {
    const alert = accountAlert(ACCOUNT, snapshotOf(400_000), stored({ locale: "zh-TW" }), null, NOW);
    expect(alert?.notice.lines[0]).toMatch(/^Workers 請求: 會超額/);
  });
});

describe("sending", () => {
  const notice = accountAlert(ACCOUNT, snapshotOf(400_000), stored(), null, NOW)!.notice;

  it("publishes to ntfy as JSON, with the topic, the link and the token", async () => {
    const fake = receivers();
    const result = await send(stored({ ntfyToken: "tk_abc" }), notice, NOW);

    expect(result).toEqual({ ntfy: { ok: true, status: 200 }, webhook: null });
    const [call] = fake.calls;
    expect(call?.url).toBe("https://ntfy.sh/");
    expect(call?.headers.get("authorization")).toBe("Bearer tk_abc");
    // Workers only knows "follow" and "manual"; "error" would make every send fail there.
    expect(call?.redirect).toBe("manual");
    expect(await call?.json()).toEqual({
      topic: "acme-usage-7f3k",
      title: notice.title,
      message: notice.lines.join("\n"),
      priority: 4,
      tags: ["warning"],
      click: "https://usage.example.workers.dev/?account=Acme",
    });
  });

  it("posts a webhook its words and figures, signed when there is a secret", async () => {
    const fake = receivers();
    const result = await send(stored({ ntfyUrl: null, webhookUrl: HOOK, webhookSecret: "signing-secret" }), notice, NOW);

    expect(result).toEqual({ ntfy: null, webhook: { ok: true, status: 200 } });
    const [call] = fake.calls;
    expect(call?.url).toBe(HOOK);
    const body = await call!.text();
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({
      event: "usage.alert",
      sentAt: "2026-10-09T12:00:00.000Z",
      title: notice.title,
      url: "https://usage.example.workers.dev/?account=Acme",
      account: { name: "Acme" },
    });
    expect(payload.text).toBe(`${notice.title}\n${notice.lines.join("\n")}`);

    // Anyone holding the secret can check the body came from here.
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("signing-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(call?.headers.get("x-usage-signature")).toBe(`sha256=${expected}`);
  });

  it("leaves the signature off without a secret, and reports each channel on its own", async () => {
    const fake = fakeFetch({
      "https://ntfy.sh": () => new Response("no", { status: 403 }),
      "https://hooks.example.com": () => {
        throw new Error("network down");
      },
    });
    vi.stubGlobal("fetch", fake.fetcher);

    const result = await send(stored({ webhookUrl: HOOK }), notice, NOW);
    expect(result).toEqual({ ntfy: { ok: false, status: 403 }, webhook: { ok: false, status: null } });
    expect(fake.calls.find((call) => call.url === HOOK)?.headers.has("x-usage-signature")).toBe(false);
  });

  it("sends a test that says what it is", async () => {
    const fake = receivers();
    await send(stored(), testNotice(stored()), NOW);
    expect(await fake.calls[0]?.json()).toMatchObject({ title: "Test from your usage page", priority: 3, tags: [] });
  });
});

describe("the scheduled check", () => {
  it("tells the owner once, and remembers having done so", async () => {
    const fake = receivers();
    const { kv, read } = fakeKv({ "usage:settings": { accounts: {}, alerts: stored() } });
    const store = new Store(kv);

    await alertAccount(store, ACCOUNT, snapshotOf(400_000), NOW);
    await alertAccount(store, ACCOUNT, snapshotOf(400_000), NOW);

    expect(fake.calls).toHaveLength(1);
    expect(read<AccountLedger>(`usage:alerted:${ACCOUNT.id}`)?.levels["workers.requests"]).toBe(2);
  });

  it("tries again next time when nothing took the message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = receivers(500);
    const { kv, read } = fakeKv({ "usage:settings": { accounts: {}, alerts: stored() } });
    const store = new Store(kv);

    await alertAccount(store, ACCOUNT, snapshotOf(400_000), NOW);
    expect(failing.calls).toHaveLength(1);
    expect(read(`usage:alerted:${ACCOUNT.id}`)).toBeUndefined();

    const working = receivers();
    await alertAccount(store, ACCOUNT, snapshotOf(400_000), NOW);
    expect(working.calls).toHaveLength(1);
    expect(read(`usage:alerted:${ACCOUNT.id}`)).toBeDefined();
  });

  it("does nothing when no channel is set up", async () => {
    const fake = receivers();
    const none = new Store(fakeKv().kv);
    await alertAccount(none, ACCOUNT, snapshotOf(1_500_000), NOW);

    const empty = new Store(fakeKv({ "usage:settings": { accounts: {}, alerts: stored({ ntfyUrl: null }) } }).kv);
    await alertAccount(empty, ACCOUNT, snapshotOf(1_500_000), NOW);
    expect(fake.calls).toHaveLength(0);
  });

  it("reports a token that stops working once, and again only after it has worked in between", async () => {
    const fake = receivers();
    const store = new Store(fakeKv({ "usage:settings": { accounts: {}, alerts: stored() } }).kv);
    const broken = [{ token: 2, status: 403 }];

    await alertTokens(store, broken, NOW);
    await alertTokens(store, broken, NOW);
    expect(fake.calls).toHaveLength(1);
    expect(await fake.calls[0]?.json()).toMatchObject({ title: expect.stringContaining("API token 2"), priority: 4 });

    await alertTokens(store, [], NOW);
    await alertTokens(store, broken, NOW);
    expect(fake.calls).toHaveLength(2);
  });

  it("keeps quiet about tokens when the owner turned that off", async () => {
    const fake = receivers();
    const quiet = stored({ events: { ...stored().events, token: false } });
    const store = new Store(fakeKv({ "usage:settings": { accounts: {}, alerts: quiet } }).kv);
    await alertTokens(store, [{ token: 1, status: 401 }], NOW);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("setting alerts from the page", () => {
  const ORIGIN = "https://usage.example.workers.dev";
  const KEY = "a-long-enough-access-key";
  const form = {
    events: { willExceed: true, exceeded: true, watch: true, token: false },
    ntfyUrl: NTFY,
    ntfyToken: "tk_first",
    webhookUrl: HOOK,
    webhookSecret: "first-secret",
    locale: "ja",
  };

  async function call(kv: KVNamespace, method: string, path: string, body?: unknown, origin = ORIGIN) {
    const request = new Request(`${ORIGIN}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        origin,
        cookie: `__Host-usage-session=${await issueSession(KEY, Date.now())}`,
      },
    });
    const env = { ANALYTICS_TOKEN: "cfat_x", ACCESS_KEY: KEY, OAUTH_KV: kv } as unknown as Env;
    return app.fetch(request as Parameters<typeof app.fetch>[0], env);
  }

  it("keeps what was set, and answers with the view that has no credentials in it", async () => {
    const { kv, read } = fakeKv();
    const response = await call(kv, "PUT", "/api/alerts", form);
    expect(response.status).toBe(200);

    const answer = await response.text();
    expect(JSON.parse(answer)).toEqual({
      alerts: { events: form.events, ntfy: { url: NTFY, hasToken: true }, webhook: { url: HOOK, hasSecret: true } },
    });
    expect(answer).not.toContain("tk_first");
    expect(answer).not.toContain("first-secret");

    expect(read<{ alerts: StoredAlerts }>("usage:settings")?.alerts).toMatchObject({
      ntfyToken: "tk_first",
      webhookSecret: "first-secret",
      locale: "ja",
      origin: ORIGIN,
    });
  });

  it("keeps a credential that is left out, replaces one that is given, and drops one whose address is removed", async () => {
    const { kv, read } = fakeKv();
    await call(kv, "PUT", "/api/alerts", form);
    const settings = () => read<{ alerts: StoredAlerts }>("usage:settings")?.alerts;

    const { ntfyToken: _token, webhookSecret: _secret, ...withoutCredentials } = form;
    await call(kv, "PUT", "/api/alerts", withoutCredentials);
    expect(settings()).toMatchObject({ ntfyToken: "tk_first", webhookSecret: "first-secret" });

    await call(kv, "PUT", "/api/alerts", { ...withoutCredentials, ntfyToken: "tk_second" });
    expect(settings()?.ntfyToken).toBe("tk_second");

    await call(kv, "PUT", "/api/alerts", { ...withoutCredentials, webhookUrl: null });
    expect(settings()).toMatchObject({ webhookUrl: null, webhookSecret: null, ntfyToken: "tk_second" });
  });

  it("refuses an address it could never send to, and a form that is not one", async () => {
    const { kv, read } = fakeKv();
    const ntfy = await call(kv, "PUT", "/api/alerts", { ...form, ntfyUrl: "https://ntfy.sh" });
    expect(await ntfy.json()).toEqual({ error: "invalid-ntfy-address" });

    const hook = await call(kv, "PUT", "/api/alerts", { ...form, webhookUrl: "http://10.0.0.1/hook" });
    expect(await hook.json()).toEqual({ error: "invalid-webhook-address" });

    expect((await call(kv, "PUT", "/api/alerts", { ...form, locale: "tlh" })).status).toBe(400);
    expect((await call(kv, "PUT", "/api/alerts", { ...form, events: {} })).status).toBe(400);
    expect(read("usage:settings")).toBeUndefined();
  });

  it("is not set by another site", async () => {
    const { kv } = fakeKv();
    expect((await call(kv, "PUT", "/api/alerts", form, "https://evil.example")).status).toBe(403);
  });

  it("sends a test to what is saved, and says so when nothing is", async () => {
    const { kv } = fakeKv();
    const none = await call(kv, "POST", "/api/alerts/test", {});
    expect(none.status).toBe(400);
    expect(await none.json()).toEqual({ error: "no-channel" });

    const fake = receivers();
    await call(kv, "PUT", "/api/alerts", form);
    const sent = await call(kv, "POST", "/api/alerts/test", {});
    expect(await sent.json()).toEqual({ ntfy: { ok: true, status: 200 }, webhook: { ok: true, status: 200 } });
    expect(fake.calls).toHaveLength(2);
    // Written in the language the alerts were saved in.
    const toNtfy = fake.calls.find((entry) => entry.url === "https://ntfy.sh/");
    expect(((await toNtfy?.json()) as { title: string }).title).toMatch(/[\u3040-\u30ff]/);
  });
});
