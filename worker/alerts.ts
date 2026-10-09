import { isConfigured } from "../shared/account";
import type { MetricId, Mode, Unit } from "../shared/catalog";
import { formatPercent, formatUsd } from "../shared/format";
import { byUrgency, evaluateSnapshot, totalOverageUsd, type Evaluation, type Status } from "../shared/forecast";
import { messages, pickLocale, type Messages } from "../shared/i18n";
import { headline, overallTone, type Tone } from "../shared/insights";
import type { IsoDate } from "../shared/dates";
import type { AlertEvents, AlertsView, Snapshot, StoredAlerts, TokenProblem } from "../shared/types";
import type { Store } from "./store";

/**
 * Telling the owner when something changes for the worse, through ntfy or a
 * webhook.
 *
 * A product is reported when it reaches a level it has not been reported at in
 * the current billing period: near its allowance, on course to go over, over.
 * The scheduled run checks four times a day, so the same news never arrives
 * twice, and a product that goes back and forth across a line is only
 * mentioned the first time.
 */

export const NO_ALERTS: AlertsView = {
  events: { willExceed: true, exceeded: true, watch: false, token: true },
  ntfy: { url: null, hasToken: false },
  webhook: { url: null, hasSecret: false },
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_URL_LENGTH = 500;

/** What the page is told: where alerts go and whether a credential is set, never the credential. */
export function alertsView(stored: StoredAlerts | undefined): AlertsView {
  if (!stored) return NO_ALERTS;
  return {
    events: stored.events,
    ntfy: { url: stored.ntfyUrl, hasToken: stored.ntfyToken !== null },
    webhook: { url: stored.webhookUrl, hasSecret: stored.webhookSecret !== null },
  };
}

/** An address alerts may be sent to: https, with a host, and of a sane length. Null when it is not one. */
export function destination(value: string | null | undefined): URL | null {
  if (!value || value.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  return url;
}

const TOPIC = /^[-_A-Za-z0-9]{1,64}$/;

/** A topic address split the way ntfy wants it published: the server, and the topic's name. */
export function ntfyTarget(value: string | null | undefined): { server: string; topic: string } | null {
  const url = destination(value);
  if (!url) return null;
  const parts = url.pathname.split("/").filter((part) => part.length > 0);
  const topic = parts.pop();
  if (!topic || !TOPIC.test(topic)) return null;
  return { server: `${url.origin}/${parts.join("/")}`.replace(/\/$/, ""), topic };
}

export interface Delivery {
  ok: boolean;
  /** The HTTP status, or null when the address could not be reached. */
  status: number | null;
}

async function post(url: string, headers: Record<string, string>, body: string): Promise<Delivery> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      // Not followed: an address that answers with a redirect is reported as not delivered.
      // (Workers has no "error" mode; "manual" hands the redirect back instead of taking it.)
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

async function signature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** One thing to tell the owner, in words for ntfy and as data for a webhook. */
export interface Notice {
  event: "usage.alert" | "usage.token_problem" | "usage.test";
  title: string;
  lines: string[];
  /** How urgent it is, which sets the priority ntfy shows it with. */
  tone: Tone;
  /** Where a tap on the alert leads. */
  url: string;
  /** What a webhook gets besides the words. */
  data: Record<string, unknown>;
}

const NTFY_PRIORITY: Readonly<Record<Tone, number>> = { ok: 3, watch: 3, over: 4 };

export interface Deliveries {
  ntfy: Delivery | null;
  webhook: Delivery | null;
}

/** Sends one notice to every channel that is set up. Null for a channel that is not. */
export async function send(stored: StoredAlerts, notice: Notice, nowMs: number): Promise<Deliveries> {
  const message = notice.lines.join("\n");
  const target = ntfyTarget(stored.ntfyUrl);
  const webhook = destination(stored.webhookUrl);

  const toNtfy = async (): Promise<Delivery | null> => {
    if (!target) return null;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (stored.ntfyToken) headers.authorization = `Bearer ${stored.ntfyToken}`;
    // Published as JSON to the server, so a title in any script arrives intact.
    const body = JSON.stringify({
      topic: target.topic,
      title: notice.title,
      message,
      priority: NTFY_PRIORITY[notice.tone],
      tags: notice.tone === "over" ? ["warning"] : [],
      click: notice.url,
    });
    return post(target.server, headers, body);
  };

  const toWebhook = async (): Promise<Delivery | null> => {
    if (!webhook) return null;
    const body = JSON.stringify({
      event: notice.event,
      sentAt: new Date(nowMs).toISOString(),
      // `text` alone is what Slack and compatible receivers show.
      text: [notice.title, message].filter((part) => part.length > 0).join("\n"),
      title: notice.title,
      url: notice.url,
      ...notice.data,
    });
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "usage-alerts" };
    if (stored.webhookSecret) headers["x-usage-signature"] = `sha256=${await signature(stored.webhookSecret, body)}`;
    return post(webhook.href, headers, body);
  };

  const [ntfy, hook] = await Promise.all([toNtfy(), toWebhook()]);
  return { ntfy, webhook: hook };
}

function anyDelivered(result: Deliveries): boolean {
  return result.ntfy?.ok === true || result.webhook?.ok === true;
}

function hasChannel(stored: StoredAlerts | undefined): stored is StoredAlerts {
  return stored !== undefined && (ntfyTarget(stored.ntfyUrl) !== null || destination(stored.webhookUrl) !== null);
}

function wordsFor(stored: StoredAlerts): Messages {
  return messages(pickLocale(stored.locale));
}

export function testNotice(stored: StoredAlerts): Notice {
  const m = wordsFor(stored);
  return {
    event: "usage.test",
    title: m.alerts.testTitle,
    lines: [m.alerts.testBody],
    tone: "ok",
    url: stored.origin,
    data: {},
  };
}

/** How far along a product is, as a number that only goes up when things get worse. */
const LEVEL: Readonly<Partial<Record<Status, number>>> = { watch: 1, "will-exceed": 2, exceeded: 3 };

const EVENT_FOR: Readonly<Partial<Record<Status, keyof AlertEvents>>> = {
  watch: "watch",
  "will-exceed": "willExceed",
  exceeded: "exceeded",
};

/** What has been reported for one account in one billing period. A new period starts it empty. */
export interface AccountLedger {
  period: IsoDate;
  levels: Partial<Record<MetricId, number>>;
}

interface MetricChange {
  id: MetricId;
  label: string;
  unit: Unit;
  mode: Mode;
  status: Status;
  used: number;
  allowance: number;
  projected: number;
  projectedRatio: number;
  estimatedOverageUsd: number;
}

export interface AccountAlert {
  notice: Notice;
  ledger: AccountLedger;
}

/**
 * What there is to say about an account since the owner was last told, and the
 * ledger as it stands once that has been said. Null when there is nothing new.
 */
export function accountAlert(
  account: { id: string; name: string; renewalDay: number | null },
  snapshot: Snapshot,
  stored: StoredAlerts,
  previous: AccountLedger | null,
  nowMs: number,
): AccountAlert | null {
  if (!isConfigured(account)) return null;

  const m = wordsFor(stored);
  const report = evaluateSnapshot(snapshot, account.renewalDay);
  const levels = previous?.period === report.cycle.start ? { ...previous.levels } : {};

  const changed: Evaluation[] = [];
  for (const entry of byUrgency(report.evaluations)) {
    const level = LEVEL[entry.status];
    const event = EVENT_FOR[entry.status];
    if (level === undefined || event === undefined || !stored.events[event]) continue;
    if (level <= (levels[entry.def.id] ?? 0)) continue;
    levels[entry.def.id] = level;
    changed.push(entry);
  }
  if (changed.length === 0) return null;

  const lines = changed.map(
    (entry) =>
      `${m.metrics[entry.def.id].label}: ${m.status[entry.status] ?? ""} (${m.outlook[entry.def.mode]} ${formatPercent(entry.projectedRatio)})`,
  );
  const overage = totalOverageUsd(report.evaluations);
  if (overage > 0) lines.push(m.headline.cost({ usd: formatUsd(overage) }));

  const metrics: MetricChange[] = changed.map((entry) => ({
    id: entry.def.id,
    label: m.metrics[entry.def.id].label,
    unit: entry.def.unit,
    mode: entry.def.mode,
    status: entry.status,
    used: entry.used,
    allowance: entry.def.allowance,
    projected: Math.round(entry.projected * 100) / 100,
    projectedRatio: Math.round(entry.projectedRatio * 10_000) / 10_000,
    estimatedOverageUsd: Math.round(entry.overageUsd * 10_000) / 10_000,
  }));

  return {
    notice: {
      event: "usage.alert",
      title: `${account.name}: ${headline(report, nowMs, m).title}`,
      lines,
      tone: overallTone(changed),
      url: `${stored.origin}/?account=${encodeURIComponent(account.name)}`,
      data: {
        account: { id: account.id, name: account.name },
        period: { start: report.cycle.start, end: report.cycle.end },
        estimatedOverageUsd: Math.round(overage * 10_000) / 10_000,
        metrics,
      },
    },
    ledger: { period: report.cycle.start, levels },
  };
}

/**
 * Tells the owner what is new about one account. The ledger is only moved on
 * once a channel has taken the message, so a failed send is tried again on the
 * next run instead of being lost.
 */
export async function alertAccount(
  store: Store,
  account: { id: string; name: string; renewalDay: number | null },
  snapshot: Snapshot,
  nowMs: number,
): Promise<void> {
  const stored = (await store.settings()).alerts;
  if (!hasChannel(stored)) return;

  const alert = accountAlert(account, snapshot, stored, await store.alerted<AccountLedger>(account.id), nowMs);
  if (!alert) return;

  const result = await send(stored, alert.notice, nowMs);
  if (anyDelivered(result)) await store.saveAlerted(account.id, alert.ledger);
  else console.error("alert not delivered", account.id, result.ntfy?.status ?? null, result.webhook?.status ?? null);
}

/** Token problems already reported, by the token's position. Cleared when a token works again. */
type TokenLedger = Record<string, number | null>;

/** Tells the owner about a token that has stopped working, once for as long as it stays broken. */
export async function alertTokens(store: Store, problems: readonly TokenProblem[], nowMs: number): Promise<void> {
  const stored = (await store.settings()).alerts;
  if (!hasChannel(stored) || !stored.events.token) return;

  const reported = (await store.alerted<TokenLedger>("tokens")) ?? {};
  const fresh = problems.filter((problem) => !Object.hasOwn(reported, String(problem.token)));
  const current: TokenLedger = Object.fromEntries(problems.map((problem) => [String(problem.token), problem.status]));
  const recovered = Object.keys(reported).some((token) => !Object.hasOwn(current, token));
  if (fresh.length === 0) {
    if (recovered) await store.saveAlerted("tokens", current);
    return;
  }

  const m = wordsFor(stored);
  const lines = fresh.map((problem) => m.tokenProblem(problem));
  const notice: Notice = {
    event: "usage.token_problem",
    title: lines[0] ?? "",
    lines: lines.slice(1),
    tone: "over",
    url: stored.origin,
    data: { tokens: fresh },
  };

  const result = await send(stored, notice, nowMs);
  if (anyDelivered(result)) await store.saveAlerted("tokens", current);
  else console.error("token alert not delivered", result.ntfy?.status ?? null, result.webhook?.status ?? null);
}
