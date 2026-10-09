import type { MetricId, Mode, Product, ResourceKind } from "../catalog";
import type { Status } from "../forecast";
import type { DatasetName, TokenProblem, Warning } from "../types";

/**
 * Every sentence the page, the JSON report and the agents' tools can say.
 *
 * A property is a finished string. A function builds a sentence around the
 * figures, names and dates it is given, because the two languages order them
 * differently: nothing outside a dictionary joins fragments into a sentence.
 * Amounts, shares, prices and days arrive already formatted (shared/format.ts);
 * a metric arrives as its id, so each language can use its own name for it and
 * make the verb agree.
 */

export interface MetricText {
  /** The full name: "Workers CPU time". */
  label: string;
  /** The name without the product, for use under a product heading: "CPU time". */
  short: string;
  /** What counts toward it, in the reader's terms. */
  note?: string;
}

/** The codes the API answers a failed call with. `unknown` stands in for any other. */
export type ErrorCode =
  | "analytics"
  | "unknown-account"
  | "no-token"
  | "invalid-request"
  | "rate-limited"
  | "unauthenticated"
  | "reconnect"
  | "unavailable"
  | "unknown";

type OfMetric = { metric: MetricId };
type Share = { metric: MetricId; share: string };

export interface Messages {
  /** The name of the page, and of its browser tab. */
  title: string;
  /** Names the language switch for assistive technology. */
  language: string;

  metrics: Record<MetricId, MetricText>;
  products: Record<Product, string>;
  /** The noun for one row of a metric's breakdown. */
  resources: Record<ResourceKind, string>;
  datasets: Record<DatasetName, string>;

  /** What a metric's share of its allowance is a share of. Sits beside the figure, so it is not capitalised. */
  outlook: Record<Mode, string>;
  /** The word shown beside a metric that needs attention. Null when it does not. */
  status: Record<Status, string | null>;

  /** Sentences that follow one another in a paragraph. */
  sentences: (p: { parts: readonly string[] }) => string;

  /** "Oct 13". */
  day: (p: { month: number; day: number }) => string;
  /** The same day in figures, for chart axes and tight columns: "10/13", in the order the language writes it. */
  shortDay: (p: { month: number; day: number }) => string;
  /** "3 days 12 hours". `ended` when there is none left. */
  timeLeft: (p: { days: number; hours: number; ended: boolean }) => string;
  ago: {
    justNow: string;
    minutes: (p: { count: number }) => string;
    hours: (p: { count: number }) => string;
    days: (p: { count: number }) => string;
  };
  /** How one figure compares with an earlier one, beyond the plain +12% / −8%. */
  change: {
    flat: string;
    /** `multiple` is "2.3" or "12". */
    times: (p: { multiple: string }) => string;
  };

  /** Rows of a breakdown that are not a resource with a name of its own. */
  names: {
    other: string;
    unattributed: string;
    pages: (p: { name: string }) => string;
  };

  headline: {
    renewal: (p: { day: string; left: string }) => string;
    noUsage: string;
    cost: (p: { usd: string }) => string;
    over: (p: { metrics: readonly MetricId[] }) => string;
    overDaily: (p: { metrics: readonly MetricId[] }) => string;
    alsoOver: (p: { metrics: readonly MetricId[] }) => string;
    runsOutOn: (p: { metric: MetricId; day: string }) => string;
    willGoOver: (p: OfMetric) => string;
    fine: string;
    /** Nothing goes over, and one metric comes close enough to name in the title. */
    fineBut: Record<Mode, (p: Share) => string>;
    /** The metric nearest its allowance, when none is close. */
    closest: Record<Mode, (p: Share) => string>;
  };

  findings: {
    heading: string;
    /** Read out before a finding in place of the mark that shows its level. */
    tone: Record<"over" | "watch" | "note", string>;
    /** One resource is behind most of a metric. `stored` when the metric is an amount held, not used. */
    share: (p: { metric: MetricId; name: string; share: string; stored: boolean; msPerRequest: number | null }) => string;
    surge: (p: { metric: MetricId; days: number; change: string; grower: string | null }) => string;
    spike: (p: { metric: MetricId; day: string; change: string; amount: string }) => string;
    errors: (p: { name: string; days: number; share: string; count: string }) => string;
    storedOver: (p: OfMetric) => string;
    storedWillPass: (p: { metric: MetricId; day: string }) => string;
    periodTimes: (p: { metric: MetricId; change: string }) => string;
    periodDiff: (p: { metric: MetricId; percent: string; more: boolean }) => string;
    daysOver: (p: { metric: MetricId; days: number; usd: string }) => string;
    busiestDay: (p: { metric: MetricId; day: string; share: string }) => string;
    metered: (p: { metric: MetricId; usd: string }) => string;
  };

  metricList: {
    heading: string;
    /** Used against included. */
    figures: (p: { used: string; allowance: string }) => string;
    figuresDaily: (p: { used: string; allowance: string }) => string;
    /** The caption of a metric that has no allowance, where the figure is its cost. */
    cost: string;
    /** The line the small metrics wait behind. `others` when larger ones are listed above it. */
    more: (p: { count: number; others: boolean }) => string;
    unused: (p: { days: number; metrics: readonly MetricId[] }) => string;
    /** A row read out in one go. */
    row: (p: { metric: MetricId; figures: string; caption: string; value: string }) => string;
  };

  /** What a meter shows, for a reader who cannot see it. */
  meter: Record<Mode, (p: { used: string; projected: string }) => string>;

  detail: {
    /** Names the side column that holds one metric's detail. */
    pane: (p: OfMetric) => string;
    /** What usage costs. `extra` when the price applies only to what goes past an allowance. */
    price: {
      perGbMonth: (p: { usd: string; extra: boolean }) => string;
      /** `units` is "1M", "1M ms" or "1M GB-s". */
      per: (p: { usd: string; units: string; extra: boolean }) => string;
    };
    facts: {
      soFar: string;
      periodEndAtPace: (p: { days: number }) => string;
      lastPeriodSamePoint: string;
      /** This period against the same point of the last one. `change` is "+5%", "2.3×"… */
      thisPeriod: (p: { change: string }) => string;
      lastPeriodTotal: string;
      runsOut: string;
      notThisPeriod: string;
      storedNow: string;
      periodAverage: string;
      perDay: (p: { days: number }) => string;
      unchanged: string;
      grew: (p: { amount: string }) => string;
      shrank: (p: { amount: string }) => string;
      storedAtEnd: string;
      endOfLastPeriod: string;
      storedPasses: string;
      notWithinYear: string;
      notGrowing: string;
      today: string;
      dailyAverage: (p: { days: number }) => string;
      busiestDay: (p: { day: string }) => string;
      daysOver: string;
      dayCount: (p: { count: number }) => string;
      none: string;
      overage: string;
      costThisPeriod: string;
    };
    breakdown: {
      now: string;
      thisPeriod: string;
      share: string;
      /** A stored amount against the same amount 7 days earlier. */
      againstDaysAgo: (p: { days: number }) => string;
      /** The last 7 days against the 7 before them. */
      againstDaysBefore: (p: { days: number }) => string;
      /** A resource with nothing to compare against, because it was not there before. */
      appeared: string;
      perRequest: (p: { ms: string }) => string;
      failed: (p: { share: string }) => string;
      other: string;
      more: (p: { count: number }) => string;
    };
    daily: {
      summary: string;
      date: string;
      thatDay: string;
      stored: string;
      running: string;
    };
  };

  chart: {
    thisPeriod: string;
    projected: string;
    lastPeriod: string;
    allowance: string;
    /** Names the chart and says how to read it from the keyboard. */
    keys: (p: OfMetric) => string;
    running: string;
    thatDay: string;
    sameDayLastPeriod: string;
  };

  verdict: {
    /** "9/13–10/12, day 27 of 30". */
    timeline: (p: { start: string; end: string; day: number; days: number }) => string;
    /** The words on either side of the control that picks the day of the month. */
    renewal: { before: string; after: string };
  };

  topbar: {
    accounts: string;
    /** Read out after an account's name in place of the mark beside it. */
    accountTone: Record<"ok" | "watch" | "over", string | null>;
    updating: string;
    noData: string;
    updated: (p: { ago: string }) => string;
    refresh: string;
  };

  app: {
    loading: string;
    loadFailed: string;
    noAccounts: string;
    /** `reason` is a sentence of its own, or null when nothing more is known. */
    refreshFailed: (p: { reason: string | null }) => string;
    unreachable: string;
    retry: string;
    /** `day` is the day it went back to; null when there was none before. */
    renewalNotSaved: (p: { day: number | null }) => string;
    firstRead: string;
    noData: string;
  };

  footer: {
    estimate: string;
    /** Around two links: the Workers price list and the R2 one. */
    prices: { before: string; between: string; after: string };
    /** Around two links: this account's JSON, then every account's (`all`). */
    json: { before: string; between: string; all: string };
    /** Around the address an agent connects to. */
    agent: { before: string; after: string };
    signOut: string;
  };

  /** Shown in place of an account's usage until its billing day is known. */
  setup: {
    title: string;
    lead: string;
    save: string;
  };

  /** Choosing what to be told about, and where: the dialog behind the top bar's button. */
  alerts: {
    /** The button that opens the dialog, and the dialog's heading. */
    title: string;
    lead: string;
    /** Heads the list of things to be told about; each `events` entry finishes its sentence. */
    when: string;
    events: Record<"willExceed" | "exceeded" | "watch" | "token", string>;
    ntfy: { url: string; hint: string; token: string };
    webhook: { url: string; hint: string; secret: string };
    /** Marks a field that may be left empty. */
    optional: string;
    /** Shown in place of a credential that is already saved. */
    kept: string;
    save: string;
    saved: string;
    notSaved: string;
    /** `channel` is "ntfy" or "Webhook". */
    invalidAddress: (p: { channel: string }) => string;
    test: string;
    noChannel: string;
    delivered: (p: { channel: string }) => string;
    /** `status` is an HTTP status, or null when the address could not be reached. */
    failed: (p: { channel: string; status: number | null }) => string;
    close: string;
    /** The test message itself. */
    testTitle: string;
    testBody: string;
  };

  /** An API token that did not work, by its position in ANALYTICS_TOKEN. */
  tokenProblem: (p: TokenProblem) => string;
  /** The link beside `errors.reconnect`, which leads to connecting Cloudflare again. */
  reconnect: string;
  /** Opens, and heads, the panel that says what the numbers are, where else to read them, and signs out. */
  about: string;

  warning: (w: Warning) => string;

  errors: Record<ErrorCode, string>;
  /** `analytics`, with what Cloudflare said. */
  analyticsError: (p: { detail: string }) => string;
}
