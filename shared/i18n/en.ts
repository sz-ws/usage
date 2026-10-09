import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

export type { ErrorCode, Messages, MetricText } from "./messages";

/** Names follow Cloudflare's pricing pages, so a figure here can be held against the one there. */
const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Workers requests",
    short: "Requests",
    note: "Includes Pages Functions. Requests for static assets are not counted.",
  },
  "workers.cpuMs": { label: "Workers CPU time", short: "CPU time" },
  "d1.rowsRead": { label: "D1 rows read", short: "Rows read" },
  "d1.rowsWritten": { label: "D1 rows written", short: "Rows written" },
  "d1.storage": { label: "D1 storage", short: "Storage" },
  "kv.reads": { label: "KV reads", short: "Reads" },
  "kv.writes": { label: "KV writes", short: "Writes" },
  "kv.deletes": { label: "KV deletes", short: "Deletes" },
  "kv.lists": { label: "KV list requests", short: "Lists" },
  "kv.storage": { label: "KV storage", short: "Storage" },
  "r2.classA": {
    label: "R2 Class A operations",
    short: "Class A",
    note: "Operations that write or list, such as uploads, listings and copies.",
  },
  "r2.classB": {
    label: "R2 Class B operations",
    short: "Class B",
    note: "Operations that read, such as fetching an object or its metadata.",
  },
  "r2.storage": { label: "R2 storage", short: "Storage" },
  "r2ia.classA": {
    label: "R2 Infrequent Access Class A operations",
    short: "Class A",
    note: "Infrequent Access has no included allowance. Every operation is billed.",
  },
  "r2ia.classB": {
    label: "R2 Infrequent Access Class B operations",
    short: "Class B",
    note: "Infrequent Access has no included allowance. Every operation is billed.",
  },
  "r2ia.storage": {
    label: "R2 Infrequent Access storage",
    short: "Storage",
    note: "Infrequent Access has no included allowance. Every byte stored is billed.",
  },
  "do.requests": { label: "Durable Objects requests", short: "Requests" },
  "do.duration": { label: "Durable Objects duration", short: "Duration" },
  "do.rowsRead": { label: "Durable Objects rows read", short: "Rows read" },
  "do.rowsWritten": { label: "Durable Objects rows written", short: "Rows written" },
  "do.storage": { label: "Durable Objects storage", short: "Storage" },
  "queues.operations": { label: "Queues operations", short: "Operations" },
  "ai.neurons": {
    label: "Workers AI neurons",
    short: "Neurons",
    note: "10,000 neurons a day are included. The count resets at 00:00 UTC, and usage over that is billed.",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "D1 storage",
  kv: "KV",
  kvs: "KV storage",
  r2: "R2",
  r2s: "R2 storage",
  doi: "Durable Objects requests",
  dop: "Durable Objects",
  doq: "Durable Objects storage",
  queues: "Queues",
  ai: "Workers AI",
};

/** Every other name is a plural ("Workers requests are…"); these take "is". */
const SINGULAR: ReadonlySet<MetricId> = new Set<MetricId>([
  "workers.cpuMs",
  "d1.storage",
  "kv.storage",
  "r2.storage",
  "r2ia.storage",
  "do.duration",
  "do.storage",
]);

const label = (id: MetricId): string => metrics[id].label;
const one = (id: MetricId): boolean => SINGULAR.has(id);
const is = (id: MetricId): string => (one(id) ? "is" : "are");
const was = (id: MetricId): string => (one(id) ? "was" : "were");
const has = (id: MetricId): string => (one(id) ? "has" : "have");
const its = (id: MetricId): string => (one(id) ? "its" : "their");
const itWas = (id: MetricId): string => (one(id) ? "it was" : "they were");

const count = (value: number, noun: string): string => `${value} ${noun}${value === 1 ? "" : "s"}`;

/** "A", "A and B", "A, B and C". */
function listed(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}

/** Up to two metrics by name; past that, the first two and how many more. */
function labels(ids: readonly MetricId[]): string {
  const all = ids.map(label);
  return all.length <= 2 ? listed(all) : `${all.slice(0, 2).join(", ")} and ${count(all.length - 2, "other")}`;
}

/** The verb for a list of metrics: only a single name can make it singular. */
const are = (ids: readonly MetricId[]): string => {
  const [only] = ids;
  return ids.length === 1 && only !== undefined ? is(only) : "are";
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FINE = "Nothing will go over this period";

export const en: Messages = {
  title: "Cloudflare usage",
  language: "Language",

  metrics,
  products: {
    Workers: "Workers",
    D1: "D1",
    KV: "KV",
    R2: "R2",
    "R2 Infrequent Access": "R2 Infrequent Access",
    "Durable Objects": "Durable Objects",
    Queues: "Queues",
    "Workers AI": "Workers AI",
  },
  resources: {
    worker: "Worker",
    database: "Database",
    namespace: "Namespace",
    bucket: "Bucket",
    queue: "Queue",
    model: "Model",
  },
  datasets,

  outlook: { cycle: "projected", level: "period average", daily: "today" },
  status: {
    exceeded: "Over",
    "will-exceed": "Will go over",
    watch: "Near allowance",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(" "),

  day: ({ month, day }) => `${MONTHS[month - 1] ?? ""} ${day}`,
  shortDay: ({ month, day }) => `${month}/${day}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0 hours";
    if (days === 0) return hours === 0 ? "less than 1 hour" : count(hours, "hour");
    return hours === 0 ? count(days, "day") : `${count(days, "day")} ${count(hours, "hour")}`;
  },
  ago: {
    justNow: "just now",
    minutes: ({ count: minutes }) => `${minutes} min ago`,
    hours: ({ count: hours }) => `${hours} hr ago`,
    days: ({ count: days }) => `${count(days, "day")} ago`,
  },
  change: {
    flat: "no change",
    times: ({ multiple }) => `${multiple}×`,
  },

  names: {
    other: "Other",
    unattributed: "Unattributed requests",
    pages: ({ name }) => `${name} (Pages)`,
  },

  headline: {
    renewal: ({ day, left }) => `Renews ${day}, in ${left}.`,
    noUsage: "No usage yet this period.",
    cost: ({ usd }) => `Estimated extra charges: ${usd}.`,
    over: ({ metrics: ids }) => `${labels(ids)} ${are(ids)} over the included allowance.`,
    overDaily: ({ metrics: ids }) => `${labels(ids)} went over the daily allowance this period.`,
    alsoOver: ({ metrics: ids }) => `${labels(ids)} will also go over this period.`,
    runsOutOn: ({ metric, day }) => `Included ${label(metric)} will run out on ${day}.`,
    willGoOver: ({ metric }) => `${label(metric)} will go over the included allowance this period.`,
    fine: `${FINE}.`,
    fineBut: {
      cycle: ({ metric, share }) => `${FINE}, but ${label(metric)} will reach ${share} of the allowance.`,
      level: ({ metric, share }) => `${FINE}, but ${label(metric)} will average ${share} of the allowance.`,
      daily: ({ metric, share }) => `${FINE}, but ${label(metric)} will reach ${share} of the daily allowance.`,
    },
    closest: {
      cycle: ({ metric, share }) =>
        `${label(metric)} ${is(metric)} closest to ${its(metric)} allowance, projected at ${share}.`,
      level: ({ metric, share }) =>
        `${label(metric)} ${is(metric)} closest to ${its(metric)} allowance, averaging ${share} over the period.`,
      daily: ({ metric, share }) =>
        `${label(metric)} ${is(metric)} closest to ${its(metric)} allowance, at about ${share} of it a day.`,
    },
  },

  findings: {
    heading: "Key points",
    tone: { over: "Over: ", watch: "Watch: ", note: "Note: " },
    share: ({ metric, name, share, stored, msPerRequest }) => {
      if (stored) return `${share} of ${label(metric)} is in ${name}.`;
      const each = msPerRequest === null ? "" : `, at an average of ${msPerRequest} ms per request`;
      return `${share} of ${label(metric)} came from ${name}${each}.`;
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : `, and ${grower} grew the most`;
      return `${label(metric)} over the last ${days} days ${was(metric)} ${change} the ${days} days before${who}.`;
    },
    spike: ({ metric, day, change, amount }) =>
      `${label(metric)} on ${day} ${was(metric)} ${change} a usual day (${amount}).`,
    errors: ({ name, days, share, count: failed }) =>
      `${share} of requests to ${name} failed in the last ${days} days (${failed} requests).`,
    storedOver: ({ metric }) =>
      `${label(metric)} is now over the included allowance, but this period's average is not. If it stays at this level, it will be billed next period.`,
    storedWillPass: ({ metric, day }) =>
      `At its recent rate of growth, ${label(metric)} will go over the included allowance on ${day}.`,
    periodTimes: ({ metric, change }) =>
      `${label(metric)} ${is(metric)} ${change} what ${itWas(metric)} at this point last period.`,
    periodDiff: ({ metric, percent, more }) =>
      `${label(metric)} ${is(metric)} ${percent} ${more ? "higher" : "lower"} than at this point last period.`,
    daysOver: ({ metric, days, usd }) =>
      `${label(metric)} went over the daily allowance on ${count(days, "day")} this period. The excess comes to about ${usd}.`,
    busiestDay: ({ metric, day, share }) =>
      `The busiest day for ${label(metric)} this period was ${day}, at ${share} of the daily allowance.`,
    metered: ({ metric, usd }) =>
      `${label(metric)} ${has(metric)} no included allowance, so this period costs about ${usd}.`,
  },

  metricList: {
    heading: "Usage",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / ${allowance} a day`,
    cost: "cost this period",
    more: ({ count: total, others }) => {
      const what = others ? "more" : "in use";
      return total === 1 ? `1 ${what}, under 1%` : `${total} ${what}, all under 1%`;
    },
    unused: ({ days, metrics: ids }) => `Not used in the last ${days} days: ${ids.map(label).join(", ")}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}, ${figures}, ${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `${used} used, projected ${projected}`,
    level: ({ used, projected }) => `${used} of the allowance stored now, period average ${projected}`,
    daily: ({ used }) => `${used} of the daily allowance used today`,
  },

  detail: {
    pane: ({ metric }) => `${label(metric)} details`,
    price: {
      perGbMonth: ({ usd, extra }) => `${usd} per ${extra ? "extra " : ""}GB-month`,
      per: ({ usd, units, extra }) => `${usd} per ${extra ? "extra " : ""}${units}`,
    },
    facts: {
      soFar: "So far this period",
      periodEndAtPace: ({ days }) => `At ${days}-day pace`,
      lastPeriodSamePoint: "Last period at this point",
      thisPeriod: ({ change }) => `${change} this period`,
      lastPeriodTotal: "All of last period",
      runsOut: "Allowance runs out",
      notThisPeriod: "Not this period",
      storedNow: "Stored now",
      periodAverage: "Period average (billed)",
      perDay: ({ days }) => `Last ${days} days, per day`,
      unchanged: "No change",
      grew: ({ amount }) => `Up ${amount}`,
      shrank: ({ amount }) => `Down ${amount}`,
      storedAtEnd: "Stored at period end",
      endOfLastPeriod: "At the end of last period",
      storedPasses: "Goes over the allowance",
      notWithinYear: "Not within a year",
      notGrowing: "Not growing",
      today: "Today",
      dailyAverage: ({ days }) => `Last ${days} days, daily average`,
      busiestDay: ({ day }) => `Busiest day this period (${day})`,
      daysOver: "Days over the daily allowance",
      dayCount: ({ count: days }) => count(days, "day"),
      none: "None",
      overage: "Estimated overage",
      costThisPeriod: "Estimated cost this period",
    },
    breakdown: {
      now: "Now",
      thisPeriod: "Used",
      share: "Share",
      againstDaysAgo: ({ days }) => `vs ${days} days ago`,
      againstDaysBefore: ({ days }) => `vs prior ${days} days`,
      appeared: "new",
      perRequest: ({ ms }) => `${ms} ms per request`,
      failed: ({ share }) => `${share} failed`,
      other: "Other",
      more: ({ count: rest }) => `${rest} more`,
    },
    daily: {
      summary: "Daily figures",
      date: "Date",
      thatDay: "Daily",
      stored: "Stored",
      running: "Running total",
    },
  },

  chart: {
    thisPeriod: "This period",
    projected: "Projected",
    lastPeriod: "Last period",
    allowance: "Included allowance",
    keys: ({ metric }) => `${label(metric)}. Use the left and right arrow keys to move through the days.`,
    running: "Running total",
    thatDay: "That day",
    sameDayLastPeriod: "Last period",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}, day ${day} of ${days}`,
    renewal: { before: "Renewal day", after: "" },
  },

  topbar: {
    accounts: "Accounts",
    accountTone: { ok: null, watch: " (near allowance)", over: " (over)" },
    updating: "Updating",
    noData: "No data yet",
    // Beside the refresh control the time says enough, and a phone has no room for more.
    updated: ({ ago }) => `${ago.charAt(0).toUpperCase()}${ago.slice(1)}`,
    refresh: "Refresh",
  },

  app: {
    loading: "Loading",
    loadFailed: "The data did not load. Reload the page to try again.",
    noAccounts: "No Cloudflare account is set up yet.",
    refreshFailed: ({ reason }) => (reason === null ? "Usage was not updated." : `Usage was not updated. ${reason}`),
    unreachable: "Cloudflare could not be reached.",
    retry: "Try again",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "The renewal day was not saved. Try again."
        : `The renewal day was not saved, so it is still ${day}. Try again.`,
    firstRead: "Reading usage for the first time. This takes about 10 seconds.",
    noData: "No usage data yet.",
  },

  footer: {
    estimate:
      "Usage figures are Cloudflare Analytics estimates and can differ slightly from the bill. CPU time from Pages Functions is not included.",
    prices: { before: "Allowances and prices are the ", between: " and ", after: " list prices as of Oct 9, 2026." },
    json: { before: "The same figures as JSON: ", between: ", ", all: "all accounts" },
    agent: { before: "For an agent, the MCP address is ", after: "." },
    signOut: "Sign out",
  },

  setup: {
    title: "Which day does your bill renew?",
    lead: "Usage is counted from that day each month. The date is in the Cloudflare dashboard under Manage Account → Billing → Subscriptions, beside Workers Paid.",
    save: "Save",
  },

  alerts: {
    title: "Alerts",
    lead: "Checked four times a day. You hear about a product once each time it gets worse, not on every check.",
    when: "Tell me when",
    events: {
      willExceed: "a product is on course to go over this period",
      exceeded: "a product has gone over",
      watch: "a product is on course to pass 80% of its allowance",
      token: "an API token stops working",
    },
    ntfy: {
      url: "ntfy topic address",
      hint: "For example https://ntfy.sh/a-name-only-you-know. Anyone who knows the topic can read it.",
      token: "Access token",
    },
    webhook: {
      url: "Webhook address",
      hint: "Receives a JSON POST when there is something to tell you.",
      secret: "Signing secret",
    },
    optional: "optional",
    kept: "Saved. Type to replace it.",
    save: "Save",
    saved: "Saved.",
    notSaved: "The alerts were not saved. Try again.",
    invalidAddress: ({ channel }) => `The ${channel} address has to start with https:// and, for ntfy, end with a topic.`,
    test: "Send a test",
    noChannel: "Add an ntfy topic or a webhook and save first.",
    delivered: ({ channel }) => `${channel}: delivered.`,
    failed: ({ channel, status }) =>
      status === null ? `${channel}: could not be reached.` : `${channel}: refused (${status}).`,
    close: "Close",
    testTitle: "Test from your usage page",
    testBody: "Alerts will arrive here.",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `Cloudflare could not be reached with API token ${token}.`;
    if (status === 200) return `API token ${token} works but cannot see any account.`;
    return `Cloudflare refused API token ${token} (${status}). Check that it has Account Analytics: Read and has not expired.`;
  },

  reconnect: "Reconnect",
  about: "About",

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `Workers AI usage could not be read (${w.reason}).`;
      case "clipped":
        return `Usage data for ${listed(w.datasets.map((name) => datasets[name]))} is incomplete, so actual usage is higher than shown.`;
      case "r2-unknown":
        return `Some R2 operations could not be classified as Class A or Class B and are not counted: ${w.actions.join(", ")}.`;
      case "stale":
        return "The latest update failed. These figures are from the previous update.";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics returned an error.",
    "unknown-account": "This account is no longer available. Reload the page.",
    "no-token": "No Cloudflare API token is set for this account.",
    "invalid-request": "The request was not accepted. Reload the page and try again.",
    "rate-limited": "Too many requests. Wait a minute and try again.",
    unauthenticated: "Your sign-in has expired. Sign in again.",
    reconnect: "Cloudflare no longer accepts this page's sign-in, so the figures have stopped updating.",
    unavailable: "The service is unavailable right now. Try again in a moment.",
    unknown: "Something went wrong. Try again.",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics returned an error (${detail}).`,
};
