import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

/**
 * French. A metric's name takes its article wherever it sits in a sentence
 * ("les requêtes Workers", "du stockage R2"), so the article comes from NOUN:
 * the name's gender and number. Product names such as "Workers" and "KV" take
 * no article and keep their capitals.
 */

const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Requêtes Workers",
    short: "Requêtes",
    note: "Inclut Pages Functions. Les requêtes vers les ressources statiques ne sont pas comptées.",
  },
  "workers.cpuMs": { label: "Temps CPU Workers", short: "Temps CPU" },
  "d1.rowsRead": { label: "Lignes lues D1", short: "Lignes lues" },
  "d1.rowsWritten": { label: "Lignes écrites D1", short: "Lignes écrites" },
  "d1.storage": { label: "Stockage D1", short: "Stockage" },
  "kv.reads": { label: "Lectures KV", short: "Lectures" },
  "kv.writes": { label: "Écritures KV", short: "Écritures" },
  "kv.deletes": { label: "Suppressions KV", short: "Suppressions" },
  "kv.lists": { label: "Requêtes de liste KV", short: "Requêtes de liste" },
  "kv.storage": { label: "Stockage KV", short: "Stockage" },
  "r2.classA": {
    label: "Opérations R2 Class A",
    short: "Class A",
    note: "Les opérations d'écriture et de liste, comme les téléversements, les listes et les copies.",
  },
  "r2.classB": {
    label: "Opérations R2 Class B",
    short: "Class B",
    note: "Les opérations de lecture, comme la récupération d'un objet ou de ses métadonnées.",
  },
  "r2.storage": { label: "Stockage R2", short: "Stockage" },
  "r2ia.classA": {
    label: "Opérations R2 Infrequent Access Class A",
    short: "Class A",
    note: "Infrequent Access n'a pas de quota inclus. Chaque opération est facturée.",
  },
  "r2ia.classB": {
    label: "Opérations R2 Infrequent Access Class B",
    short: "Class B",
    note: "Infrequent Access n'a pas de quota inclus. Chaque opération est facturée.",
  },
  "r2ia.storage": {
    label: "Stockage R2 Infrequent Access",
    short: "Stockage",
    note: "Infrequent Access n'a pas de quota inclus. Chaque octet stocké est facturé.",
  },
  "do.requests": { label: "Requêtes Durable Objects", short: "Requêtes" },
  "do.duration": { label: "Durée Durable Objects", short: "Durée" },
  "do.rowsRead": { label: "Lignes lues Durable Objects", short: "Lignes lues" },
  "do.rowsWritten": { label: "Lignes écrites Durable Objects", short: "Lignes écrites" },
  "do.storage": { label: "Stockage Durable Objects", short: "Stockage" },
  "queues.operations": { label: "Opérations Queues", short: "Opérations" },
  "ai.neurons": {
    label: "Neurons Workers AI",
    short: "Neurons",
    note: "10 000 Neurons par jour sont inclus. Le compteur repart à zéro à minuit UTC, et ce qui dépasse est facturé.",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "Stockage D1",
  kv: "KV",
  kvs: "Stockage KV",
  r2: "R2",
  r2s: "Stockage R2",
  doi: "Requêtes Durable Objects",
  dop: "Durable Objects",
  doq: "Stockage Durable Objects",
  queues: "Queues",
  ai: "Workers AI",
};

/** A name's gender and number. `english` names (Neurons) keep their own capitals. */
interface Gender {
  feminine: boolean;
  plural: boolean;
  english?: boolean;
}

/**
 * Gender and number of each metric's name. Stockage and Temps are masculine,
 * Durée is the one feminine singular, and Neurons (English, so no gender of its
 * own) takes the masculine plural. The singulars are the same set as en.ts.
 */
const NOUN: Record<MetricId, Gender> = {
  "workers.requests": { feminine: true, plural: true },
  "workers.cpuMs": { feminine: false, plural: false },
  "d1.rowsRead": { feminine: true, plural: true },
  "d1.rowsWritten": { feminine: true, plural: true },
  "d1.storage": { feminine: false, plural: false },
  "kv.reads": { feminine: true, plural: true },
  "kv.writes": { feminine: true, plural: true },
  "kv.deletes": { feminine: true, plural: true },
  "kv.lists": { feminine: true, plural: true },
  "kv.storage": { feminine: false, plural: false },
  "r2.classA": { feminine: true, plural: true },
  "r2.classB": { feminine: true, plural: true },
  "r2.storage": { feminine: false, plural: false },
  "r2ia.classA": { feminine: true, plural: true },
  "r2ia.classB": { feminine: true, plural: true },
  "r2ia.storage": { feminine: false, plural: false },
  "do.requests": { feminine: true, plural: true },
  "do.duration": { feminine: true, plural: false },
  "do.rowsRead": { feminine: true, plural: true },
  "do.rowsWritten": { feminine: true, plural: true },
  "do.storage": { feminine: false, plural: false },
  "queues.operations": { feminine: true, plural: true },
  "ai.neurons": { feminine: false, plural: true, english: true },
};

/** Dataset names that begin with a common noun take an article; product names do not. */
const DATASET_NOUN: Partial<Record<DatasetName, Gender>> = {
  d1s: { feminine: false, plural: false },
  kvs: { feminine: false, plural: false },
  r2s: { feminine: false, plural: false },
  doq: { feminine: false, plural: false },
  doi: { feminine: true, plural: true },
};

/** Where a name sits: opening a sentence, inside one, or after "de". */
type Position = "start" | "mid" | "de";

interface Forms {
  /** Masculine singular. */
  ms: string;
  /** Feminine singular. */
  fs: string;
  /** Masculine plural. */
  mp: string;
  /** Feminine plural. */
  fp: string;
}

const VOWEL = /^[AEIOUÂÊÉÈÎÔÛ]/i;
const PLURAL_ARTICLE: Record<Position, string> = { start: "Les", mid: "les", de: "des" };

/**
 * A name with the article it takes where it sits: "Les requêtes Workers" opening
 * a sentence, "les requêtes Workers" inside one, "des requêtes Workers" after
 * "de". The noun's first letter goes lower case; an English name keeps its own.
 */
function phrase(text: string, gender: Gender, at: Position): string {
  const word = gender.english ? text : text.charAt(0).toLowerCase() + text.slice(1);
  if (gender.plural) return `${PLURAL_ARTICLE[at]} ${word}`;
  if (VOWEL.test(word)) return `${at === "start" ? "L'" : at === "de" ? "de l'" : "l'"}${word}`;
  if (at === "de") return `${gender.feminine ? "de la" : "du"} ${word}`;
  if (at === "start") return `${gender.feminine ? "La" : "Le"} ${word}`;
  return `${gender.feminine ? "la" : "le"} ${word}`;
}

const label = (id: MetricId): string => metrics[id].label;

/** A metric's name with its article, in the place it sits. */
const art = (id: MetricId, at: Position): string => phrase(label(id), NOUN[id], at);

/** A dataset's name with its article where it takes one. */
const dataset = (name: DatasetName, at: Position): string => {
  const gender = DATASET_NOUN[name];
  return gender ? phrase(datasets[name], gender, at) : datasets[name];
};

/** The form that agrees in number with one metric's name. */
const num = (id: MetricId, singular: string, pluralForm: string): string =>
  NOUN[id].plural ? pluralForm : singular;

/** The form that agrees in gender and number with one metric's name. */
const agree = (id: MetricId, forms: Forms): string => {
  const { feminine, plural } = NOUN[id];
  if (plural) return feminine ? forms.fp : forms.mp;
  return feminine ? forms.fs : forms.ms;
};

/** The verb for a list of metrics: singular only when the list is one singular name. */
const group = (ids: readonly MetricId[], singular: string, pluralForm: string): string => {
  const [only] = ids;
  return ids.length === 1 && only !== undefined && !NOUN[only].plural ? singular : pluralForm;
};

/** "1 jour", "3 jours". Zero takes the singular in French. */
const quantity = (value: number, one: string, many: string): string => `${value} ${value <= 1 ? one : many}`;

/** A sentence that may already end in a full stop, as an abbreviated date does. */
const close = (text: string): string => (text.endsWith(".") ? text : `${text}.`);

/** "A", "A et B", "A, B et C". */
function listed(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" et ");
  return `${items.slice(0, -1).join(", ")} et ${items.at(-1) ?? ""}`;
}

/** Up to two metrics by name, each with its article; past that, the first two and how many more. */
function labels(ids: readonly MetricId[]): string {
  const all = ids.map((id, index) => art(id, index === 0 ? "start" : "mid"));
  return all.length <= 2
    ? listed(all)
    : `${all.slice(0, 2).join(", ")} et ${quantity(all.length - 2, "autre", "autres")}`;
}

/** "est le plus proche de son quota", or "sont les plus proches de leur quota". */
const closest = (id: MetricId): string =>
  `${art(id, "start")} ${agree(id, {
    ms: "est le plus proche",
    fs: "est la plus proche",
    mp: "sont les plus proches",
    fp: "sont les plus proches",
  })} ${num(id, "de son", "de leur")} quota`;

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const dayOfMonth = (day: number): string => (day === 1 ? "1er" : String(day));

const SUPERIOR: Forms = { ms: "supérieur", fs: "supérieure", mp: "supérieurs", fp: "supérieures" };
const INFERIOR: Forms = { ms: "inférieur", fs: "inférieure", mp: "inférieurs", fp: "inférieures" };

const FINE = "Rien ne dépassera le quota inclus cette période";

const OTHER = "Autres";
const UNATTRIBUTED = "Requêtes non attribuées";
/** Resource names that are plural, so the verb after them is too. */
const PLURAL_NAMES: readonly string[] = [OTHER, UNATTRIBUTED];
const resourceVerb = (name: string, singular: string, plural: string): string =>
  PLURAL_NAMES.includes(name) ? plural : singular;

export const fr: Messages = {
  title: "Consommation Cloudflare",
  language: "Langue",

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
    database: "Base de données",
    namespace: "Espace de noms",
    bucket: "Compartiment",
    queue: "File d'attente",
    model: "Modèle",
  },
  datasets,

  outlook: { cycle: "prévu", level: "moyenne sur la période", daily: "aujourd'hui" },
  status: {
    exceeded: "Dépassé",
    "will-exceed": "Va dépasser",
    watch: "Près du quota",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(" "),

  day: ({ month, day }) => `${dayOfMonth(day)} ${MONTHS[month - 1] ?? ""}`,
  shortDay: ({ month, day }) => `${day}/${month}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return quantity(0, "heure", "heures");
    if (days === 0) return hours === 0 ? "moins d'une heure" : quantity(hours, "heure", "heures");
    const dayPart = quantity(days, "jour", "jours");
    return hours === 0 ? dayPart : `${dayPart} ${quantity(hours, "heure", "heures")}`;
  },
  ago: {
    justNow: "à l'instant",
    minutes: ({ count: minutes }) => `il y a ${minutes} min`,
    hours: ({ count: hours }) => `il y a ${hours} h`,
    days: ({ count: days }) => `il y a ${quantity(days, "jour", "jours")}`,
  },
  change: {
    flat: "aucune variation",
    times: ({ multiple }) => `${multiple}×`,
  },

  names: {
    other: OTHER,
    unattributed: UNATTRIBUTED,
    pages: ({ name }) => `${name} (Pages)`,
  },

  headline: {
    renewal: ({ day, left }) => `Renouvellement le ${day}, dans ${left}.`,
    noUsage: "Aucune consommation sur cette période pour l'instant.",
    cost: ({ usd }) => `Frais supplémentaires estimés : ${usd}.`,
    over: ({ metrics: ids }) => `${labels(ids)} ${group(ids, "dépasse", "dépassent")} le quota inclus.`,
    overDaily: ({ metrics: ids }) =>
      `${labels(ids)} ${group(ids, "a dépassé", "ont dépassé")} le quota quotidien pendant cette période.`,
    alsoOver: ({ metrics: ids }) =>
      `${labels(ids)} ${group(ids, "dépassera", "dépasseront")} aussi le quota inclus cette période.`,
    runsOutOn: ({ metric, day }) => close(`Le quota inclus ${art(metric, "de")} sera épuisé le ${day}`),
    willGoOver: ({ metric }) =>
      `${art(metric, "start")} ${num(metric, "dépassera", "dépasseront")} le quota inclus cette période.`,
    fine: `${FINE}.`,
    fineBut: {
      cycle: ({ metric, share }) =>
        `${FINE}, mais ${art(metric, "mid")} ${num(metric, "atteindra", "atteindront")} ${share} du quota inclus.`,
      level: ({ metric, share }) =>
        `${FINE}, mais ${art(metric, "mid")} ${num(metric, "sera", "seront")} en moyenne à ${share} du quota inclus.`,
      daily: ({ metric, share }) =>
        `${FINE}, mais ${art(metric, "mid")} ${num(metric, "atteindra", "atteindront")} ${share} du quota quotidien.`,
    },
    closest: {
      cycle: ({ metric, share }) => close(`${closest(metric)}, avec une prévision de ${share}`),
      level: ({ metric, share }) => close(`${closest(metric)}, avec une moyenne de ${share} sur la période`),
      daily: ({ metric, share }) => close(`${closest(metric)}, soit environ ${share} du quota chaque jour`),
    },
  },

  findings: {
    heading: "Points clés",
    tone: { over: "Dépassement : ", watch: "À surveiller : ", note: "Remarque : " },
    // A resource name can be plural ("Requêtes non attribuées"), so the verb follows the name's number.
    share: ({ metric, name, share, stored, msPerRequest }) => {
      const verb = stored
        ? resourceVerb(name, "contient", "contiennent")
        : resourceVerb(name, "représente", "représentent");
      const each = msPerRequest === null ? "" : `, avec une moyenne de ${msPerRequest} ms par requête`;
      return close(`${name} ${verb} ${share} ${art(metric, "de")}${each}`);
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : `, et la plus forte hausse vient de ${grower}`;
      return close(
        `${art(metric, "start")} sur les ${days} derniers jours : ${change} par rapport aux ${days} jours précédents${who}`,
      );
    },
    spike: ({ metric, day, change, amount }) =>
      close(`${art(metric, "start")} le ${day} : ${change} par rapport à un jour habituel (${amount})`),
    errors: ({ name, days, share, count: failed }) =>
      close(
        `${share} des requêtes vers ${name} ont échoué au cours des ${days} derniers jours (échecs : ${failed})`,
      ),
    storedOver: ({ metric }) =>
      `${art(metric, "start")} ${num(metric, "dépasse maintenant", "dépassent maintenant")} le quota inclus, mais la moyenne sur la période ne le dépasse pas encore. Si ce niveau se maintient, le dépassement sera facturé à la période suivante.`,
    storedWillPass: ({ metric, day }) =>
      close(
        `Au rythme de croissance récent, ${art(metric, "mid")} ${num(metric, "dépassera", "dépasseront")} le quota inclus le ${day}`,
      ),
    periodTimes: ({ metric, change }) =>
      `${art(metric, "start")} : ${change} par rapport au même moment de la période précédente.`,
    periodDiff: ({ metric, percent, more }) =>
      `${art(metric, "start")} ${num(metric, "est", "sont")} ${agree(metric, more ? SUPERIOR : INFERIOR)} de ${percent} à ce même moment de la période précédente.`,
    daysOver: ({ metric, days, usd }) =>
      `${art(metric, "start")} ${num(metric, "a dépassé", "ont dépassé")} le quota quotidien pendant ${quantity(days, "jour", "jours")} cette période. Le dépassement s'élève à environ ${usd}.`,
    busiestDay: ({ metric, day, share }) =>
      `Le jour le plus chargé pour ${art(metric, "mid")} cette période a été le ${day}, à ${share} du quota quotidien.`,
    metered: ({ metric, usd }) =>
      `${art(metric, "start")} ${num(metric, "n'a", "n'ont")} pas de quota inclus, donc cette période coûte environ ${usd}.`,
  },

  metricList: {
    heading: "Consommation",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / ${allowance} par jour`,
    cost: "coût sur la période",
    more: ({ count: total, others }) => {
      if (others) return total === 1 ? "1 autre, à moins de 1 %" : `${total} autres, tous à moins de 1 %`;
      return total === 1 ? "1 utilisé, à moins de 1 %" : `${total} utilisés, tous à moins de 1 %`;
    },
    unused: ({ days, metrics: ids }) =>
      `Sans consommation ces ${days} derniers jours : ${ids.map((id) => art(id, "mid")).join(", ")}`,
    // A row of the list, read as a label: the name stands alone.
    row: ({ metric, figures, caption, value }) => `${label(metric)}, ${figures}, ${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `${used} utilisé, prévu à ${projected}`,
    level: ({ used, projected }) => `${used} du quota stocké actuellement, moyenne de ${projected} sur la période`,
    daily: ({ used }) => `${used} du quota quotidien utilisé aujourd'hui`,
  },

  detail: {
    pane: ({ metric }) => `Détails ${art(metric, "de")}`,
    price: {
      perGbMonth: ({ usd, extra }) => `${usd} par GB-mois${extra ? " au-delà du quota inclus" : ""}`,
      per: ({ usd, units, extra }) => `${usd} par ${units}${extra ? " au-delà du quota inclus" : ""}`,
    },
    facts: {
      soFar: "Jusqu'ici cette période",
      periodEndAtPace: ({ days }) => `Fin de période au rythme de ${days} jours`,
      lastPeriodSamePoint: "Période précédente au même moment",
      thisPeriod: ({ change }) => `${change} sur la période`,
      lastPeriodTotal: "Total de la période précédente",
      runsOut: "Épuisement du quota inclus",
      notThisPeriod: "Pas cette période",
      storedNow: "Stocké actuellement",
      periodAverage: "Moyenne sur la période (facturée)",
      perDay: ({ days }) => `${days} derniers jours, par jour`,
      unchanged: "Aucune variation",
      grew: ({ amount }) => `En hausse de ${amount}`,
      shrank: ({ amount }) => `En baisse de ${amount}`,
      storedAtEnd: "Stocké en fin de période",
      endOfLastPeriod: "À la fin de la période précédente",
      storedPasses: "Dépassement du quota inclus",
      notWithinYear: "Pas d'ici un an",
      notGrowing: "Pas de croissance",
      today: "Aujourd'hui",
      dailyAverage: ({ days }) => `${days} derniers jours, moyenne quotidienne`,
      busiestDay: ({ day }) => `Jour le plus chargé de la période (${day})`,
      daysOver: "Jours au-delà du quota quotidien",
      dayCount: ({ count: days }) => quantity(days, "jour", "jours"),
      none: "Aucun",
      overage: "Dépassement estimé",
      costThisPeriod: "Coût estimé de la période",
    },
    breakdown: {
      now: "Maintenant",
      thisPeriod: "Consommé",
      share: "Part",
      againstDaysAgo: ({ days }) => `vs il y a ${days} jours`,
      againstDaysBefore: ({ days }) => `vs ${days} jours précédents`,
      appeared: "nouveau",
      perRequest: ({ ms }) => `${ms} ms par requête`,
      failed: ({ share }) => `${share} en échec`,
      other: "Autres",
      more: ({ count: rest }) => quantity(rest, "autre", "autres"),
    },
    daily: {
      summary: "Chiffres par jour",
      date: "Date",
      thatDay: "Par jour",
      stored: "Stocké",
      running: "Total cumulé",
    },
  },

  chart: {
    thisPeriod: "Cette période",
    projected: "Prévu",
    lastPeriod: "Période précédente",
    allowance: "Quota inclus",
    keys: ({ metric }) => `${art(metric, "start")}. Utilisez les flèches gauche et droite pour parcourir les jours.`,
    running: "Total cumulé",
    thatDay: "Ce jour-là",
    sameDayLastPeriod: "Même jour, période précédente",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}, jour ${day} sur ${days}`,
    renewal: { before: "Jour de renouvellement", after: "" },
  },

  topbar: {
    accounts: "Comptes",
    accountTone: { ok: null, watch: " (près du quota)", over: " (quota dépassé)" },
    updating: "Mise à jour en cours",
    noData: "Pas encore de données",
    // Beside the refresh control the time says enough, and a phone has no room for more.
    updated: ({ ago }) => `${ago.charAt(0).toUpperCase()}${ago.slice(1)}`,
    refresh: "Actualiser",
  },

  app: {
    loading: "Chargement",
    loadFailed: "Les données n'ont pas pu être chargées. Rechargez la page pour réessayer.",
    noAccounts: "Aucun compte Cloudflare n'est encore configuré.",
    refreshFailed: ({ reason }) =>
      reason === null
        ? "La consommation n'a pas été mise à jour."
        : `La consommation n'a pas été mise à jour. ${reason}`,
    unreachable: "Impossible de joindre Cloudflare.",
    retry: "Réessayer",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "Le jour de renouvellement n'a pas été enregistré. Réessayez."
        : `Le jour de renouvellement n'a pas été enregistré, il reste donc le ${dayOfMonth(day)}. Réessayez.`,
    firstRead: "Première lecture de la consommation. Cela prend environ 10 secondes.",
    noData: "Pas encore de données de consommation.",
  },

  footer: {
    estimate:
      "Les chiffres de consommation sont des estimations de Cloudflare Analytics et peuvent légèrement différer de la facture. Le temps CPU venant de Pages Functions n'est pas inclus.",
    prices: {
      before: "Les quotas et les prix sont les tarifs publics de ",
      between: " et ",
      after: " au 9 octobre 2026.",
    },
    json: { before: "Les mêmes chiffres en JSON : ", between: ", ", all: "tous les comptes" },
    agent: { before: "Pour un agent, l'adresse MCP est ", after: "." },
    signOut: "Se déconnecter",
  },

  setup: {
    title: "Quel jour du mois votre abonnement est-il renouvelé ?",
    lead: "La consommation est comptée à partir de ce jour, chaque mois. La date se trouve dans le tableau de bord Cloudflare, sous Manage Account → Billing → Subscriptions, à côté de Workers Paid.",
    save: "Enregistrer",
  },

  alerts: {
    title: "Alertes",
    lead: "Vérification quatre fois par jour. Vous êtes prévenu une fois chaque fois qu'un produit s'aggrave, pas à chaque vérification.",
    when: "M'avertir quand",
    events: {
      willExceed: "un produit est en voie de dépasser son quota sur cette période",
      exceeded: "un produit a dépassé son quota",
      watch: "un produit est en voie de dépasser 80 % de son quota",
      token: "un jeton API cesse de fonctionner",
    },
    ntfy: {
      url: "Adresse du topic ntfy",
      hint: "Par exemple https://ntfy.sh/un-nom-que-vous-seul-connaissez. Quiconque connaît le topic peut le lire.",
      token: "Jeton d'accès",
    },
    webhook: {
      url: "Adresse du Webhook",
      hint: "Reçoit un JSON POST quand il y a quelque chose à vous signaler.",
      secret: "Secret de signature",
    },
    optional: "facultatif",
    kept: "Enregistré. Saisissez une valeur pour la remplacer.",
    save: "Enregistrer",
    saved: "Enregistré.",
    notSaved: "Les alertes n'ont pas été enregistrées. Réessayez.",
    invalidAddress: ({ channel }) =>
      `L'adresse ${channel} doit commencer par https:// et, pour ntfy, se terminer par un topic.`,
    test: "Envoyer un test",
    noChannel: "Ajoutez un topic ntfy ou un webhook, puis enregistrez.",
    delivered: ({ channel }) => `${channel} : reçu.`,
    failed: ({ channel, status }) =>
      status === null ? `${channel} : injoignable.` : `${channel} : refusé (${status}).`,
    close: "Fermer",
    testTitle: "Test depuis votre page de consommation",
    testBody: "Les alertes arriveront ici.",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `Impossible de joindre Cloudflare avec le jeton API n° ${token}.`;
    if (status === 200) return `Le jeton API n° ${token} fonctionne, mais il ne voit aucun compte.`;
    return `Cloudflare a refusé le jeton API n° ${token} (${status}). Vérifiez qu'il a la permission Account Analytics: Read et qu'il n'a pas expiré.`;
  },

  reconnect: "Se reconnecter",
  about: "À propos",

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `La consommation de Workers AI n'a pas pu être lue (${w.reason}).`;
      case "clipped":
        return `Les données de consommation sont incomplètes pour ${listed(w.datasets.map((name) => dataset(name, "mid")))} : la consommation réelle est plus élevée que celle affichée.`;
      case "r2-unknown":
        return `Certaines opérations R2 n'ont pas pu être classées comme Class A ou Class B et ne sont pas comptées : ${w.actions.join(", ")}.`;
      case "stale":
        return "La dernière mise à jour a échoué. Ces chiffres datent de la mise à jour précédente.";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics a renvoyé une erreur.",
    "unknown-account": "Ce compte n'est plus disponible. Rechargez la page.",
    "no-token": "Aucun jeton API Cloudflare n'est défini pour ce compte.",
    "invalid-request": "La requête n'a pas été acceptée. Rechargez la page et réessayez.",
    "rate-limited": "Trop de requêtes. Attendez une minute, puis réessayez.",
    unauthenticated: "Votre connexion a expiré. Connectez-vous à nouveau.",
    reconnect: "Cloudflare n'accepte plus la connexion de cette page, donc les chiffres ne sont plus mis à jour.",
    unavailable: "Le service est indisponible pour le moment. Réessayez dans un instant.",
    unknown: "Une erreur est survenue. Réessayez.",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics a renvoyé une erreur (${detail}).`,
};
