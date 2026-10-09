import { afterEach, describe, expect, it, vi } from "vitest";

import { directoryOf, findAccount } from "../worker/accounts";
import { readNames } from "../worker/names";
import { Store, type Directory } from "../worker/store";
import { fakeFetch, fakeKv } from "./helpers";

const A = "a".repeat(32);
const B = "b".repeat(32);
const NOW = Date.parse("2026-10-09T12:00:00Z");
const ACCOUNTS = "https://api.cloudflare.com/client/v4/accounts";

/** Cloudflare's account list, answering by which token asked. */
function cloudflare(byToken: Record<string, { id: string; name: string }[] | number>) {
  const fake = fakeFetch({
    [ACCOUNTS]: (request) => {
      const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
      const answer = byToken[token];
      if (answer === undefined) return new Response(null, { status: 401 });
      if (typeof answer === "number") return new Response(null, { status: answer });
      return Response.json({ success: true, result: answer, result_info: { total_pages: 1 } });
    },
  });
  vi.stubGlobal("fetch", fake.fetcher);
  return fake;
}

afterEach(() => vi.unstubAllGlobals());

describe("finding the accounts", () => {
  it("asks each token what it can see and remembers which token reads which account", async () => {
    cloudflare({ one: [{ id: B, name: "Work" }], two: [{ id: A, name: "Personal" }] });
    const { kv, read } = fakeKv();

    const directory = await directoryOf(new Store(kv), ["one", "two"], NOW);

    expect(directory.accounts).toEqual([
      { id: A, name: "Personal", token: 1 },
      { id: B, name: "Work", token: 0 },
    ]);
    expect(directory.problems).toEqual([]);
    expect(read<Directory>("usage:directory")?.accounts).toHaveLength(2);
  });

  it("never stores a token", async () => {
    cloudflare({ "secret-token-value": [{ id: A, name: "Personal" }] });
    const { kv, keys, read } = fakeKv();
    await directoryOf(new Store(kv), ["secret-token-value"], NOW);
    for (const key of keys()) expect(JSON.stringify(read(key))).not.toContain("secret-token-value");
  });

  it("uses what it has for six hours, then asks again", async () => {
    const fake = cloudflare({ one: [{ id: A, name: "Personal" }] });
    const store = new Store(fakeKv().kv);

    await directoryOf(store, ["one"], NOW);
    await directoryOf(store, ["one"], NOW + 5 * 3_600_000);
    expect(fake.calls).toHaveLength(1);

    await directoryOf(store, ["one"], NOW + 7 * 3_600_000);
    expect(fake.calls).toHaveLength(2);
  });

  it("asks again at once when told to, and when the tokens have changed", async () => {
    const fake = cloudflare({ one: [{ id: A, name: "Personal" }], two: [{ id: B, name: "Work" }] });
    const store = new Store(fakeKv().kv);

    await directoryOf(store, ["one"], NOW);
    await directoryOf(store, ["one"], NOW + 1000, { fresh: true });
    expect(fake.calls).toHaveLength(2);

    const changed = await directoryOf(store, ["two"], NOW + 2000);
    expect(changed.accounts.map((account) => account.name)).toEqual(["Work"]);
  });

  it("reports a token Cloudflare refuses, and one that sees no account", async () => {
    cloudflare({ good: [{ id: A, name: "Personal" }], refused: 403, empty: [] });
    const directory = await directoryOf(new Store(fakeKv().kv), ["good", "refused", "empty"], NOW);

    expect(directory.accounts).toHaveLength(1);
    expect(directory.problems).toEqual([
      { token: 2, status: 403 },
      { token: 3, status: 200 },
    ]);
  });

  it("keeps the accounts it knew when Cloudflare cannot be reached", async () => {
    cloudflare({ one: [{ id: A, name: "Personal" }] });
    const store = new Store(fakeKv().kv);
    await directoryOf(store, ["one"], NOW);

    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const later = await directoryOf(store, ["one"], NOW + 7 * 3_600_000);

    expect(later.accounts).toEqual([{ id: A, name: "Personal", token: 0 }]);
    expect(later.problems).toEqual([{ token: 1, status: null }]);
  });

  it("lists an account once when two tokens can both see it", async () => {
    cloudflare({ one: [{ id: A, name: "Personal" }], two: [{ id: A, name: "Personal" }] });
    const directory = await directoryOf(new Store(fakeKv().kv), ["one", "two"], NOW);
    expect(directory.accounts).toEqual([{ id: A, name: "Personal", token: 0 }]);
  });

  it("follows the pages of a long account list", async () => {
    const page = (start: number) =>
      Array.from({ length: 50 }, (_, index) => ({
        id: (start + index).toString(16).padStart(32, "0"),
        name: `Account ${start + index}`,
      }));
    const fake = fakeFetch({
      [ACCOUNTS]: (request) => {
        const number = Number(new URL(request.url).searchParams.get("page"));
        return Response.json({ result: page((number - 1) * 50), result_info: { total_pages: 2 } });
      },
    });
    vi.stubGlobal("fetch", fake.fetcher);

    const directory = await directoryOf(new Store(fakeKv().kv), ["one"], NOW);
    expect(directory.accounts).toHaveLength(100);
    expect(fake.calls).toHaveLength(2);
  });

  it("finds an account by id or by name, whatever the case", async () => {
    cloudflare({ one: [{ id: A, name: "Personal" }] });
    const directory = await directoryOf(new Store(fakeKv().kv), ["one"], NOW);

    expect(findAccount(directory, A)?.name).toBe("Personal");
    expect(findAccount(directory, " personal ")?.id).toBe(A);
    expect(findAccount(directory, "nobody")).toBeUndefined();
  });
});

describe("names for resources the analytics only know by id", () => {
  const base = `${ACCOUNTS}/${A}`;

  it("collects whatever the token is allowed to list", async () => {
    const fake = fakeFetch({
      [`${base}/d1/database`]: () => Response.json({ result: [{ uuid: "db-1", name: "orders" }] }),
      [`${base}/storage/kv/namespaces`]: () => Response.json({ result: [{ id: "kv-1", title: "cache" }] }),
      [`${base}/workers/durable_objects/namespaces`]: () =>
        Response.json({
          result: [
            { id: "do-1", script: "chat", class: "Room", name: "chat_Room" },
            { id: "do-2", name: "legacy" },
          ],
        }),
      [`${base}/queues`]: () => Response.json({ result: [{ queue_id: "q-1", queue_name: "emails" }] }),
    });
    vi.stubGlobal("fetch", fake.fetcher);

    expect(await readNames("token", A, {})).toEqual({
      "db-1": "orders",
      "kv-1": "cache",
      "do-1": "chat · Room",
      "do-2": "legacy",
      "q-1": "emails",
    });
    expect(fake.calls.every((call) => call.headers.get("authorization") === "Bearer token")).toBe(true);
  });

  it("keeps the names it knew when a list is refused, fails or makes no sense", async () => {
    const fake = fakeFetch({
      [`${base}/d1/database`]: () => new Response(null, { status: 403 }),
      [`${base}/storage/kv/namespaces`]: () => Response.json({ result: "nonsense" }),
      [`${base}/workers/durable_objects/namespaces`]: () => {
        throw new Error("network down");
      },
      [`${base}/queues`]: () => Response.json({ result: [{ queue_id: "q-1", queue_name: "emails" }, { queue_id: 7 }] }),
    });
    vi.stubGlobal("fetch", fake.fetcher);

    expect(await readNames("token", A, { "db-1": "orders" })).toEqual({ "db-1": "orders", "q-1": "emails" });
  });

  it("reads a long list page by page and stops when a page repeats", async () => {
    const full = (page: number) =>
      Array.from({ length: 100 }, (_, index) => ({ id: `kv-${page}-${index}`, title: `ns ${page}-${index}` }));
    const fake = fakeFetch({
      [`${base}/storage/kv/namespaces`]: (request) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return Response.json({ result: page === 1 ? full(1) : page === 2 ? full(2).slice(0, 10) : [] });
      },
      // Ignores `page`: the same hundred rows every time.
      [`${base}/queues`]: () =>
        Response.json({
          result: Array.from({ length: 100 }, (_, index) => ({ queue_id: `q-${index}`, queue_name: `q ${index}` })),
        }),
      [base]: () => new Response(null, { status: 403 }),
    });
    vi.stubGlobal("fetch", fake.fetcher);

    const names = await readNames("token", A, {});
    expect(Object.keys(names).filter((id) => id.startsWith("kv-"))).toHaveLength(110);
    expect(Object.keys(names).filter((id) => id.startsWith("q-"))).toHaveLength(100);
    expect(fake.calls.filter((call) => call.url.includes("/queues"))).toHaveLength(2);
  });
});
