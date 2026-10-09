import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalyticsError, readUsage } from "../worker/cloudflare";

const NOW = Date.parse("2026-10-09T12:00:00Z");

interface Call {
  from: string;
  to: string;
  recent: boolean;
  authorization: string | null;
}

/** Stands in for the GraphQL Analytics API; `answer` decides what each window gets. */
function analytics(answer: (call: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { query: string; variables: { from: string; to: string } };
      const call: Call = {
        from: body.variables.from,
        to: body.variables.to,
        recent: body.query.includes("aiInferenceAdaptiveGroups"),
        authorization: new Headers(init.headers).get("authorization"),
      };
      calls.push(call);
      return answer(call);
    }),
  );
  return calls;
}

const window = (data: Record<string, unknown>) => Response.json({ data: { viewer: { accounts: [data] } } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readUsage", () => {
  it("reads 89 days in windows the API accepts, and the short-lived datasets for 31", async () => {
    const calls = analytics(() => window({}));
    const read = await readUsage("token-1", "account", NOW);

    expect(read.days).toHaveLength(89);
    expect(read.days[0]).toBe("2026-07-13");
    expect(read.days[88]).toBe("2026-10-09");
    expect(read.warnings).toEqual([]);

    expect(calls.filter((call) => !call.recent).map(({ from, to }) => ({ from, to }))).toEqual([
      { from: "2026-09-10", to: "2026-10-09" },
      { from: "2026-08-11", to: "2026-09-09" },
      { from: "2026-07-13", to: "2026-08-10" },
    ]);
    expect(calls.filter((call) => call.recent)).toEqual([
      { from: "2026-09-09", to: "2026-10-09", recent: true, authorization: "Bearer token-1" },
    ]);
  });

  it("carries on without Workers AI when only that request fails, and says so", async () => {
    analytics((call) =>
      call.recent ? Response.json({ data: null, errors: [{ message: "not enabled" }] }) : window({ d1: [] }),
    );
    const read = await readUsage("t", "account", NOW);
    expect(read.windows).toHaveLength(4);
    expect(read.warnings).toEqual([{ kind: "recent-unavailable", reason: "not enabled" }]);
  });

  it("fails as a whole when a core window cannot be read", async () => {
    analytics((call) => (call.from === "2026-08-11" ? new Response("no", { status: 429 }) : window({})));
    await expect(readUsage("t", "account", NOW)).rejects.toThrow(AnalyticsError);
  });

  it("fails when the API reports an error or has no data for the account", async () => {
    analytics(() => Response.json({ data: null, errors: [{ message: "cannot request data older than 90 days" }] }));
    await expect(readUsage("t", "account", NOW)).rejects.toThrow("cannot request data older than 90 days");

    analytics(() => Response.json({ data: { viewer: { accounts: [] } } }));
    await expect(readUsage("t", "account", NOW)).rejects.toThrow(AnalyticsError);
  });

  it("warns when a dataset hit the row limit, since the rest was cut off", async () => {
    const full = Array.from({ length: 10_000 }, () => ({}));
    analytics((call) => (call.to === "2026-10-09" && !call.recent ? window({ workers: full, d1: [{}] }) : window({})));
    const read = await readUsage("t", "account", NOW);
    expect(read.warnings).toEqual([{ kind: "clipped", datasets: ["workers"] }]);
  });
});
