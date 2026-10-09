import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

/**
 * A metric name is always a subject (nominative) or follows "für" (accusative),
 * and written bare, so it never needs a case ending. A dative would need one:
 * "KV-Lesevorgänge" becomes "KV-Lesevorgängen". The verb follows the number of
 * the name, which `agree` reads from SINGULAR. Resource names (Worker, bucket,
 * database) are the owner's own text and are placed freely.
 */

/** Names follow Cloudflare's pricing pages, so a figure here can be held against the one there. */
const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Workers-Anfragen",
    short: "Anfragen",
    note: "Enthält Pages Functions. Anfragen nach statischen Dateien zählen nicht.",
  },
  "workers.cpuMs": { label: "Workers-CPU-Zeit", short: "CPU-Zeit" },
  "d1.rowsRead": { label: "D1-Zeilen (gelesen)", short: "Zeilen (gelesen)" },
  "d1.rowsWritten": { label: "D1-Zeilen (geschrieben)", short: "Zeilen (geschrieben)" },
  "d1.storage": { label: "D1-Speicher", short: "Speicher" },
  "kv.reads": { label: "KV-Lesevorgänge", short: "Lesevorgänge" },
  "kv.writes": { label: "KV-Schreibvorgänge", short: "Schreibvorgänge" },
  "kv.deletes": { label: "KV-Löschvorgänge", short: "Löschvorgänge" },
  "kv.lists": { label: "KV-Listenabfragen", short: "Listenabfragen" },
  "kv.storage": { label: "KV-Speicher", short: "Speicher" },
  "r2.classA": {
    label: "R2-Operationen (Class A)",
    short: "Class A",
    note: "Operationen, die schreiben oder auflisten, etwa Uploads, Auflistungen und Kopien.",
  },
  "r2.classB": {
    label: "R2-Operationen (Class B)",
    short: "Class B",
    note: "Operationen, die lesen, etwa das Abrufen eines Objekts oder seiner Metadaten.",
  },
  "r2.storage": { label: "R2-Speicher", short: "Speicher" },
  "r2ia.classA": {
    label: "R2-Operationen (Infrequent Access, Class A)",
    short: "Class A",
    note: "Infrequent Access hat kein enthaltenes Kontingent. Jede Operation wird berechnet.",
  },
  "r2ia.classB": {
    label: "R2-Operationen (Infrequent Access, Class B)",
    short: "Class B",
    note: "Infrequent Access hat kein enthaltenes Kontingent. Jede Operation wird berechnet.",
  },
  "r2ia.storage": {
    label: "R2-Speicher (Infrequent Access)",
    short: "Speicher",
    note: "Infrequent Access hat kein enthaltenes Kontingent. Jedes gespeicherte Byte wird berechnet.",
  },
  "do.requests": { label: "Durable-Objects-Anfragen", short: "Anfragen" },
  "do.duration": { label: "Durable-Objects-Laufzeit", short: "Laufzeit" },
  "do.rowsRead": { label: "Durable-Objects-Zeilen (gelesen)", short: "Zeilen (gelesen)" },
  "do.rowsWritten": { label: "Durable-Objects-Zeilen (geschrieben)", short: "Zeilen (geschrieben)" },
  "do.storage": { label: "Durable-Objects-Speicher", short: "Speicher" },
  "queues.operations": { label: "Queues-Operationen", short: "Operationen" },
  "ai.neurons": {
    label: "Workers-AI-Neurons",
    short: "Neurons",
    note: "10.000 Neurons pro Tag sind enthalten. Der Zähler wird um 00:00 UTC zurückgesetzt. Was darüber liegt, wird berechnet.",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "D1-Speicher",
  kv: "KV",
  kvs: "KV-Speicher",
  r2: "R2",
  r2s: "R2-Speicher",
  doi: "Durable-Objects-Anfragen",
  dop: "Durable Objects",
  doq: "Durable-Objects-Speicher",
  queues: "Queues",
  ai: "Workers AI",
};

/** The metrics whose name is singular. Every other name is plural and takes the plural verb. */
const SINGULAR: ReadonlySet<MetricId> = new Set<MetricId>([
  "workers.cpuMs",
  "d1.storage",
  "kv.storage",
  "r2.storage",
  "r2ia.storage",
  "do.duration",
  "do.storage",
]);

const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

const FINE = "Kein Kontingent wird in diesem Zeitraum überschritten";

const label = (id: MetricId): string => metrics[id].label;

/** The verb for a subject made of these metrics: the singular only for one singular name. */
function agree(ids: readonly MetricId[], singular: string, plural: string): string {
  const [only] = ids;
  return ids.length === 1 && only !== undefined && SINGULAR.has(only) ? singular : plural;
}

/** "A", "A und B", "A, B und C". */
function listed(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" und ");
  return `${items.slice(0, -1).join(", ")} und ${items.at(-1) ?? ""}`;
}

/** Up to two metrics by name; past that, the first two and how many more. */
function labels(ids: readonly MetricId[]): string {
  const all = ids.map(label);
  if (all.length <= 2) return listed(all);
  const rest = all.length - 2;
  return `${all.slice(0, 2).join(", ")} und ${rest === 1 ? "eine weitere" : `${rest} weitere`}`;
}

/** "in den letzten 7 Tagen", or "im letzten Tag". */
const inLast = (days: number): string => (days === 1 ? "im letzten Tag" : `in den letzten ${days} Tagen`);

/** A count of days after a word that takes the dative: "in 3 Tagen", "vor 1 Tag". */
const daysDative = (days: number): string => (days === 1 ? "1 Tag" : `${days} Tagen`);

const hoursOf = (hours: number): string => `${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;

/** Ends a sentence with one full stop; an abbreviated date ("13. Okt.") already ends with one. */
const endSentence = (text: string): string => (text.endsWith(".") ? text : `${text}.`);

export const de: Messages = {
  title: "Cloudflare-Nutzung",
  language: "Sprache",

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
    database: "Datenbank",
    namespace: "Namespace",
    bucket: "Bucket",
    queue: "Queue",
    model: "Modell",
  },
  datasets,

  outlook: { cycle: "Prognose", level: "Zeitraumdurchschnitt", daily: "heute" },
  status: {
    exceeded: "Überschritten",
    "will-exceed": "Wird überschritten",
    watch: "Nahe am Kontingent",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(" "),

  day: ({ month, day }) => `${day}. ${MONTHS[month - 1] ?? ""}`,
  shortDay: ({ month, day }) => `${day}.${month}.`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0 Stunden";
    if (days === 0) return hours === 0 ? "weniger als 1 Stunde" : hoursOf(hours);
    return hours === 0 ? daysDative(days) : `${daysDative(days)} und ${hoursOf(hours)}`;
  },
  ago: {
    justNow: "gerade eben",
    minutes: ({ count: minutes }) => `vor ${minutes} Min.`,
    hours: ({ count: hours }) => `vor ${hours} Std.`,
    days: ({ count: days }) => `vor ${daysDative(days)}`,
  },
  change: {
    flat: "unverändert",
    times: ({ multiple }) => `${multiple}×`,
  },

  names: {
    other: "Sonstige",
    unattributed: "Nicht zugeordnete Anfragen",
    pages: ({ name }) => `${name} (Pages)`,
  },

  headline: {
    renewal: ({ day, left }) => `Das Abo verlängert sich am ${day}, in ${left}.`,
    noUsage: "In diesem Zeitraum gibt es noch keine Nutzung.",
    cost: ({ usd }) => `Geschätzte Mehrkosten: ${usd}.`,
    over: ({ metrics: ids }) => `${labels(ids)} ${agree(ids, "überschreitet", "überschreiten")} das enthaltene Kontingent.`,
    overDaily: ({ metrics: ids }) =>
      `${labels(ids)} ${agree(ids, "hat", "haben")} das tägliche Kontingent in diesem Zeitraum überschritten.`,
    alsoOver: ({ metrics: ids }) =>
      `${labels(ids)} ${agree(ids, "wird", "werden")} in diesem Zeitraum auch das enthaltene Kontingent überschreiten.`,
    runsOutOn: ({ metric, day }) => endSentence(`Das enthaltene Kontingent für ${label(metric)} reicht nur bis zum ${day}`),
    willGoOver: ({ metric }) =>
      `${label(metric)} ${agree([metric], "wird", "werden")} in diesem Zeitraum das enthaltene Kontingent überschreiten.`,
    fine: `${FINE}.`,
    fineBut: {
      cycle: ({ metric, share }) =>
        `${FINE}, aber ${label(metric)} ${agree([metric], "wird", "werden")} ${share} des Kontingents erreichen.`,
      level: ({ metric, share }) =>
        `${FINE}, aber ${label(metric)} ${agree([metric], "wird", "werden")} im Durchschnitt bei ${share} des Kontingents liegen.`,
      daily: ({ metric, share }) =>
        `${FINE}, aber ${label(metric)} ${agree([metric], "wird", "werden")} pro Tag etwa ${share} des täglichen Kontingents erreichen.`,
    },
    closest: {
      cycle: ({ metric, share }) =>
        `${label(metric)} ${agree([metric], "kommt", "kommen")} dem Kontingent am nächsten, mit einer Prognose von ${share}.`,
      level: ({ metric, share }) =>
        `${label(metric)} ${agree([metric], "kommt", "kommen")} dem Kontingent am nächsten, im Durchschnitt des Zeitraums bei ${share}.`,
      daily: ({ metric, share }) =>
        `${label(metric)} ${agree([metric], "kommt", "kommen")} dem Kontingent am nächsten, pro Tag bei etwa ${share} des täglichen Kontingents.`,
    },
  },

  findings: {
    heading: "Wichtige Punkte",
    tone: { over: "Überschritten: ", watch: "Beobachten: ", note: "Hinweis: " },
    share: ({ metric, name, share, stored, msPerRequest }) => {
      if (stored) return `${label(metric)} ${agree([metric], "liegt", "liegen")} zu ${share} in ${name}.`;
      const each = msPerRequest === null ? "" : `, im Schnitt ${msPerRequest} ms pro Anfrage`;
      return `${label(metric)} ${agree([metric], "geht", "gehen")} zu ${share} auf ${name} zurück${each}.`;
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : `, am stärksten gewachsen ist ${grower}`;
      return `${label(metric)} ${agree([metric], "war", "waren")} ${inLast(days)} ${change} so viel wie in den ${days} Tagen davor${who}.`;
    },
    spike: ({ metric, day, change, amount }) =>
      `${label(metric)} ${agree([metric], "war", "waren")} am ${day} ${change} so viel wie an einem üblichen Tag (${amount}).`,
    errors: ({ name, days, share, count }) =>
      `${share} der Anfragen an ${name} sind ${inLast(days)} fehlgeschlagen (${count} Anfragen).`,
    storedOver: ({ metric }) =>
      `${label(metric)} ${agree([metric], "liegt", "liegen")} jetzt über dem enthaltenen Kontingent, der Durchschnitt dieses Zeitraums aber noch nicht. Bleibt das so, wird die Überschreitung im nächsten Zeitraum berechnet.`,
    storedWillPass: ({ metric, day }) =>
      `Mit dem bisherigen Wachstum ${agree([metric], "wird", "werden")} ${label(metric)} am ${day} das enthaltene Kontingent überschreiten.`,
    periodTimes: ({ metric, change }) =>
      `${label(metric)} ${agree([metric], "ist", "sind")} ${change} so viel wie zum gleichen Zeitpunkt im letzten Zeitraum.`,
    periodDiff: ({ metric, percent, more }) =>
      `${label(metric)} ${agree([metric], "ist", "sind")} ${percent} ${more ? "höher" : "niedriger"} als zum gleichen Zeitpunkt im letzten Zeitraum.`,
    daysOver: ({ metric, days, usd }) =>
      `${label(metric)} ${agree([metric], "hat", "haben")} das tägliche Kontingent an ${daysDative(days)} in diesem Zeitraum überschritten. Die Überschreitung kostet rund ${usd}.`,
    busiestDay: ({ metric, day, share }) =>
      `Der Spitzentag für ${label(metric)} in diesem Zeitraum war der ${day}, mit ${share} des täglichen Kontingents.`,
    metered: ({ metric, usd }) =>
      `${label(metric)} ${agree([metric], "hat", "haben")} kein enthaltenes Kontingent, deshalb kostet dieser Zeitraum rund ${usd}.`,
  },

  metricList: {
    heading: "Nutzung",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / ${allowance} pro Tag`,
    cost: "Kosten in diesem Zeitraum",
    more: ({ count, others }) => {
      if (others) return count === 1 ? "Eine weitere, unter 1%" : `${count} weitere, alle unter 1%`;
      return count === 1 ? "Eine in Benutzung, unter 1%" : `${count} in Benutzung, alle unter 1%`;
    },
    unused: ({ days, metrics: ids }) => `Nicht genutzt ${inLast(days)}: ${ids.map(label).join(", ")}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}, ${figures}, ${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `${used} verbraucht, Prognose ${projected}`,
    level: ({ used, projected }) => `${used} des Kontingents jetzt belegt, Zeitraumdurchschnitt ${projected}`,
    daily: ({ used }) => `${used} des täglichen Kontingents heute verbraucht`,
  },

  detail: {
    pane: ({ metric }) => `Details: ${label(metric)}`,
    price: {
      perGbMonth: ({ usd, extra }) => `${usd} pro GB-Monat${extra ? " über dem Kontingent" : ""}`,
      per: ({ usd, units, extra }) => `${usd} pro ${units}${extra ? " über dem Kontingent" : ""}`,
    },
    facts: {
      soFar: "Bisher in diesem Zeitraum",
      periodEndAtPace: ({ days }) => `Zeitraumende im ${days}-Tage-Tempo`,
      lastPeriodSamePoint: "Letzter Zeitraum am selben Punkt",
      thisPeriod: ({ change }) => `${change} in diesem Zeitraum`,
      lastPeriodTotal: "Gesamter letzter Zeitraum",
      runsOut: "Kontingent aufgebraucht",
      notThisPeriod: "Nicht in diesem Zeitraum",
      storedNow: "Jetzt gespeichert",
      periodAverage: "Zeitraumdurchschnitt (abgerechnet)",
      perDay: ({ days }) => `Letzte ${days} Tage, pro Tag`,
      unchanged: "Keine Änderung",
      grew: ({ amount }) => `Plus ${amount}`,
      shrank: ({ amount }) => `Minus ${amount}`,
      storedAtEnd: "Am Zeitraumende gespeichert",
      endOfLastPeriod: "Am Ende des letzten Zeitraums",
      storedPasses: "Überschreitung des Kontingents",
      notWithinYear: "Nicht innerhalb eines Jahres",
      notGrowing: "Wächst nicht",
      today: "Heute",
      dailyAverage: ({ days }) => `Letzte ${days} Tage, Tagesdurchschnitt`,
      busiestDay: ({ day }) => `Spitzentag dieses Zeitraums (${day})`,
      daysOver: "Tage über dem täglichen Kontingent",
      dayCount: ({ count: days }) => (days === 1 ? "1 Tag" : `${days} Tage`),
      none: "Keine",
      overage: "Geschätzte Mehrkosten",
      costThisPeriod: "Geschätzte Kosten in diesem Zeitraum",
    },
    breakdown: {
      now: "Jetzt",
      thisPeriod: "Genutzt",
      share: "Anteil",
      againstDaysAgo: ({ days }) => `ggü. vor ${days} Tagen`,
      againstDaysBefore: ({ days }) => `ggü. den ${days} Tagen davor`,
      appeared: "neu",
      perRequest: ({ ms }) => `${ms} ms pro Anfrage`,
      failed: ({ share }) => `${share} fehlgeschlagen`,
      other: "Sonstige",
      more: ({ count: rest }) => (rest === 1 ? "Eine weitere" : `${rest} weitere`),
    },
    daily: {
      summary: "Tageswerte",
      date: "Datum",
      thatDay: "Tageswert",
      stored: "Gespeichert",
      running: "Laufende Summe",
    },
  },

  chart: {
    thisPeriod: "Dieser Zeitraum",
    projected: "Prognose",
    lastPeriod: "Letzter Zeitraum",
    allowance: "Enthaltenes Kontingent",
    keys: ({ metric }) => `${label(metric)}. Mit den Pfeiltasten links und rechts durch die Tage blättern.`,
    running: "Laufende Summe",
    thatDay: "Dieser Tag",
    sameDayLastPeriod: "Letzter Zeitraum, gleicher Tag",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}, Tag ${day} von ${days}`,
    renewal: { before: "Abrechnungstag", after: "" },
  },

  topbar: {
    accounts: "Konten",
    accountTone: { ok: null, watch: " (nahe am Kontingent)", over: " (überschritten)" },
    updating: "Wird aktualisiert",
    noData: "Noch keine Daten",
    updated: ({ ago }) => `Stand: ${ago}`,
    refresh: "Aktualisieren",
  },

  app: {
    loading: "Lädt",
    loadFailed: "Die Daten konnten nicht geladen werden. Lade die Seite neu.",
    noAccounts: "Noch kein Cloudflare-Konto eingerichtet.",
    refreshFailed: ({ reason }) =>
      reason === null ? "Die Nutzung wurde nicht aktualisiert." : `Die Nutzung wurde nicht aktualisiert. ${reason}`,
    unreachable: "Cloudflare ist nicht erreichbar.",
    retry: "Erneut versuchen",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "Der Verlängerungstag wurde nicht gespeichert. Versuch es erneut."
        : `Der Verlängerungstag wurde nicht gespeichert, er ist deshalb noch der ${day}. Versuch es erneut.`,
    firstRead: "Die Nutzung wird zum ersten Mal abgerufen. Das dauert etwa 10 Sekunden.",
    noData: "Noch keine Nutzungsdaten.",
  },

  footer: {
    estimate:
      "Die Nutzungswerte sind Schätzungen von Cloudflare Analytics und können leicht von der Rechnung abweichen. CPU-Zeit aus Pages Functions ist nicht enthalten.",
    prices: {
      before: "Kontingente und Preise entsprechen den Listenpreisen von ",
      between: " und ",
      after: " vom 9. Okt. 2026.",
    },
    json: { before: "Dieselben Zahlen als JSON: ", between: ", ", all: "alle Konten" },
    agent: { before: "Für einen Agenten lautet die MCP-Adresse ", after: "." },
    signOut: "Abmelden",
  },

  setup: {
    title: "An welchem Tag verlängert sich dein Abo?",
    lead: "Die Nutzung wird jeden Monat ab diesem Tag gezählt. Das Datum findest du im Cloudflare-Dashboard unter Manage Account → Billing → Subscriptions, neben Workers Paid.",
    save: "Speichern",
  },

  alerts: {
    title: "Benachrichtigungen",
    lead: "Geprüft wird viermal am Tag. Du hörst von einem Produkt jedes Mal, wenn sich die Lage verschlechtert, nicht bei jeder Prüfung.",
    when: "Benachrichtige mich, wenn",
    events: {
      willExceed: "ein Produkt in diesem Zeitraum voraussichtlich das Kontingent überschreitet",
      exceeded: "ein Produkt das Kontingent überschritten hat",
      watch: "ein Produkt voraussichtlich über 80% seines Kontingents kommen wird",
      token: "ein API-Token nicht mehr funktioniert",
    },
    ntfy: {
      url: "ntfy-Themenadresse",
      hint: "Zum Beispiel https://ntfy.sh/ein-name-nur-du-kennst. Wer das Thema kennt, kann die Nachrichten mitlesen.",
      token: "Zugriffstoken",
    },
    webhook: {
      url: "Webhook-Adresse",
      hint: "Empfängt einen JSON POST, wenn es etwas zu melden gibt.",
      secret: "Signaturschlüssel",
    },
    optional: "optional",
    kept: "Gespeichert. Zum Ersetzen einfach neu eingeben.",
    save: "Speichern",
    saved: "Gespeichert.",
    notSaved: "Die Benachrichtigungen wurden nicht gespeichert. Versuch es erneut.",
    invalidAddress: ({ channel }) =>
      `Die Adresse für ${channel} muss mit https:// beginnen und bei ntfy mit einem Thema enden.`,
    test: "Testnachricht senden",
    noChannel: "Trag zuerst ein ntfy-Thema oder einen Webhook ein und speichere.",
    delivered: ({ channel }) => `${channel}: zugestellt.`,
    failed: ({ channel, status }) =>
      status === null ? `${channel}: nicht erreichbar.` : `${channel}: abgelehnt (${status}).`,
    close: "Schließen",
    testTitle: "Test aus deiner Nutzungsseite",
    testBody: "Benachrichtigungen kommen hier an.",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `Mit API-Token ${token} war Cloudflare nicht erreichbar.`;
    if (status === 200) return `API-Token ${token} funktioniert, sieht aber kein Konto.`;
    return `Cloudflare hat API-Token ${token} abgelehnt (${status}). Prüfe, ob er die Berechtigung Account Analytics: Read hat und nicht abgelaufen ist.`;
  },

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `Die Nutzung von Workers AI konnte nicht gelesen werden (${w.reason}).`;
      case "clipped":
        return `Die Nutzungsdaten für ${listed(w.datasets.map((name) => datasets[name]))} sind unvollständig, die tatsächliche Nutzung ist daher höher als angezeigt.`;
      case "r2-unknown":
        return `Einige R2-Operationen konnten nicht als Class A oder Class B eingestuft werden und sind nicht mitgezählt: ${w.actions.join(", ")}.`;
      case "stale":
        return "Die letzte Aktualisierung ist fehlgeschlagen. Diese Zahlen stammen von der vorherigen Aktualisierung.";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics hat einen Fehler gemeldet.",
    "unknown-account": "Dieses Konto ist nicht mehr verfügbar. Lade die Seite neu.",
    "no-token": "Für dieses Konto ist kein Cloudflare-API-Token hinterlegt.",
    "invalid-request": "Die Anfrage wurde nicht angenommen. Lade die Seite neu und versuch es erneut.",
    "rate-limited": "Zu viele Anfragen. Warte eine Minute und versuch es erneut.",
    unauthenticated: "Deine Anmeldung ist abgelaufen. Melde dich erneut an.",
    unavailable: "Der Dienst ist gerade nicht verfügbar. Versuch es gleich noch einmal.",
    unknown: "Etwas ist schiefgelaufen. Versuch es erneut.",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics hat einen Fehler gemeldet (${detail}).`,
};
