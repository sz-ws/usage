#!/usr/bin/env node
/**
 * The page with made-up data, for looking at it without a Cloudflare account:
 *
 *   pnpm demo            # builds the page, then http://localhost:8798
 *
 * It serves the built page and answers the page's API from the fixture below.
 * There is no sign-in and nothing is read from Cloudflare. The README's
 * screenshot is taken from this.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 8798);
const DAY_MS = 86_400_000;
const HISTORY_DAYS = 89;

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The same series every run: a screenshot taken twice should match. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const now = Date.now();
const days = Array.from({ length: HISTORY_DAYS }, (_, index) => iso(now - (HISTORY_DAYS - 1 - index) * DAY_MS));
/** How far through the current UTC day it is, so today reads as a day in progress. */
const todayShare = (now % DAY_MS) / DAY_MS;

/**
 * A daily series: `base` a day, quieter at weekends, drifting by `growth` over
 * the history, with a little noise.
 */
function flow(seed, base, { growth = 0, weekend = 0.75, noise = 0.12 } = {}) {
  const random = seeded(seed);
  return days.map((day, index) => {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const rest = weekday === 0 || weekday === 6 ? weekend : 1;
    const drift = 1 + growth * (index / (HISTORY_DAYS - 1));
    const value = base * rest * drift * (1 + (random() - 0.5) * 2 * noise);
    return Math.round(index === HISTORY_DAYS - 1 ? value * todayShare : value);
  });
}

/** A stored amount: from `start` to `end` across the history. */
function level(start, end) {
  return days.map((_, index) => Math.round(start + (end - start) * (index / (HISTORY_DAYS - 1))));
}

/** Splits a series between resources by share. */
function split(total, shares) {
  const by = {};
  for (const [key, share] of Object.entries(shares)) by[key] = total.map((value) => Math.round(value * share));
  return { total, by };
}

const GB = 1e9;
const MB = 1e6;

const DB_ORDERS = "0f3c9a52-7d41-4be8-9a6e-2c5d81f4b7a0";
const DB_ANALYTICS = "6b1e4d87-23fa-4c09-b5d2-9e7a30c1f845";
const KV_SESSIONS = "a41c7e9b5d2f48c6b03e8f1d6a927c54";
const KV_CACHE = "d95b02f7e1c84a3f9b6d4e70a2c813f6";
const DO_ROOMS = "3e8a1f6c9b2d4750a4c7e9f01b6d825a";
const QUEUE_EMAILS = "7c2f9d4b8e1a4063b5d7f0a39c6e1b82";

const names = {
  [DB_ORDERS]: "orders",
  [DB_ANALYTICS]: "analytics",
  [KV_SESSIONS]: "sessions",
  [KV_CACHE]: "page-cache",
  [DO_ROOMS]: "realtime · Room",
  [QUEUE_EMAILS]: "outgoing-email",
};

const requests = flow(11, 262_000, { growth: 0.42 });

const snapshot = {
  v: 1,
  accountId: "de30de30de30de30de30de30de30de30",
  fetchedAt: new Date(now - 4 * 60_000).toISOString(),
  days,
  metrics: {
    "workers.requests": split(requests, { storefront: 0.54, api: 0.31, "image-resizer": 0.1, webhooks: 0.05 }),
    "workers.cpuMs": split(flow(12, 505_000, { growth: 0.1 }), {
      storefront: 0.38,
      api: 0.29,
      "image-resizer": 0.27,
      webhooks: 0.06,
    }),
    "d1.rowsRead": split(flow(13, 176_000_000, { growth: 0.15 }), { [DB_ORDERS]: 0.72, [DB_ANALYTICS]: 0.28 }),
    "d1.rowsWritten": split(flow(14, 410_000), { [DB_ORDERS]: 0.35, [DB_ANALYTICS]: 0.65 }),
    "d1.storage": split(level(1.42 * GB, 1.86 * GB), { [DB_ORDERS]: 0.4, [DB_ANALYTICS]: 0.6 }),
    "kv.reads": split(flow(15, 118_000, { growth: 0.2 }), { [KV_SESSIONS]: 0.46, [KV_CACHE]: 0.54 }),
    "kv.writes": split(flow(16, 9_200), { [KV_SESSIONS]: 0.7, [KV_CACHE]: 0.3 }),
    "kv.deletes": split(flow(17, 1_100), { [KV_SESSIONS]: 1 }),
    "kv.lists": split(flow(18, 240), { [KV_CACHE]: 1 }),
    "kv.storage": split(level(180 * MB, 226 * MB), { [KV_SESSIONS]: 0.2, [KV_CACHE]: 0.8 }),
    "r2.classA": split(flow(19, 12_400), { media: 0.83, backups: 0.17 }),
    "r2.classB": split(flow(20, 91_000, { growth: 0.25 }), { media: 0.97, backups: 0.03 }),
    "r2.storage": split(level(4.1 * GB, 7.3 * GB), { media: 0.78, backups: 0.22 }),
    "do.requests": split(flow(21, 14_200), { realtime: 1 }),
    "do.duration": split(flow(22, 4_150), { [DO_ROOMS]: 1 }),
    "queues.operations": split(flow(23, 11_300), { [QUEUE_EMAILS]: 1 }),
    "ai.neurons": split(flow(24, 3_100, { weekend: 0.5, noise: 0.3 }), {
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast": 0.81,
      "@cf/baai/bge-m3": 0.19,
    }),
  },
  extras: {
    "workers.errors": split(
      requests.map((value) => Math.round(value * 0.004)),
      { storefront: 0.2, api: 0.7, webhooks: 0.1 },
    ),
  },
  warnings: [],
};

/** A billing day about two thirds of a period back, so the chart has a past and a future. */
const renewalDay = new Date(now - 19 * DAY_MS).getUTCDate();

let state = {
  accounts: [{ id: snapshot.accountId, name: "Acme", renewalDay: Math.min(renewalDay, 28), snapshot, names }],
  problems: [],
  alerts: {
    events: { willExceed: true, exceeded: true, watch: false, token: true },
    ntfy: { url: null, hasToken: false },
    webhook: { url: null, hasSecret: false },
  },
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function json(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function bodyOf(request) {
  let text = "";
  for await (const chunk of request) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

if (!existsSync(join(ROOT, "index.html"))) {
  console.error("dist/ is missing. Run `pnpm build` first, or use `pnpm demo`.");
  process.exit(1);
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/api/state") return json(response, state);
  if (url.pathname === "/api/refresh") return json(response, { snapshot, names });
  if (url.pathname === "/api/settings") {
    const { renewalDay: day } = await bodyOf(request);
    state = { ...state, accounts: state.accounts.map((account) => ({ ...account, renewalDay: day })) };
    return json(response, { accountId: snapshot.accountId, renewalDay: day });
  }
  if (url.pathname === "/api/alerts") {
    const form = await bodyOf(request);
    state = {
      ...state,
      alerts: {
        events: form.events ?? state.alerts.events,
        ntfy: { url: form.ntfyUrl ?? null, hasToken: Boolean(form.ntfyToken) },
        webhook: { url: form.webhookUrl ?? null, hasSecret: Boolean(form.webhookSecret) },
      },
    };
    return json(response, { alerts: state.alerts });
  }
  // Nothing is sent anywhere from the demo.
  if (url.pathname === "/api/alerts/test") return json(response, { error: "no-channel" }, 400);
  if (url.pathname.startsWith("/api/")) return json(response, { error: "not-found" }, 404);
  if (url.pathname === "/signout") {
    response.writeHead(303, { location: "/" });
    return response.end();
  }

  // Static files, with the page itself for any other address.
  const wanted = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  const inside = wanted.startsWith(ROOT) && existsSync(wanted) && statSync(wanted).isFile();
  const file = inside ? wanted : join(ROOT, "index.html");
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Demo data at http://localhost:${PORT} (nothing here is real)`);
});
