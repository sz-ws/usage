import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Solicitudes de Workers",
    short: "Solicitudes",
    note: "Incluye Pages Functions. No se cuentan las solicitudes a recursos estáticos.",
  },
  "workers.cpuMs": { label: "Tiempo de CPU de Workers", short: "Tiempo de CPU" },
  "d1.rowsRead": { label: "Filas leídas de D1", short: "Filas leídas" },
  "d1.rowsWritten": { label: "Filas escritas en D1", short: "Filas escritas" },
  "d1.storage": { label: "Almacenamiento de D1", short: "Almacenamiento" },
  "kv.reads": { label: "Lecturas de KV", short: "Lecturas" },
  "kv.writes": { label: "Escrituras de KV", short: "Escrituras" },
  "kv.deletes": { label: "Eliminaciones de KV", short: "Eliminaciones" },
  "kv.lists": { label: "Solicitudes de listado de KV", short: "Listados" },
  "kv.storage": { label: "Almacenamiento de KV", short: "Almacenamiento" },
  "r2.classA": {
    label: "Operaciones de Class A de R2",
    short: "Class A",
    note: "Operaciones que escriben o listan, como subidas, listados y copias.",
  },
  "r2.classB": {
    label: "Operaciones de Class B de R2",
    short: "Class B",
    note: "Operaciones que leen, como obtener un objeto o sus metadatos.",
  },
  "r2.storage": { label: "Almacenamiento de R2", short: "Almacenamiento" },
  "r2ia.classA": {
    label: "Operaciones de Class A de R2 Infrequent Access",
    short: "Class A",
    note: "Infrequent Access no tiene límite incluido. Cada operación se cobra.",
  },
  "r2ia.classB": {
    label: "Operaciones de Class B de R2 Infrequent Access",
    short: "Class B",
    note: "Infrequent Access no tiene límite incluido. Cada operación se cobra.",
  },
  "r2ia.storage": {
    label: "Almacenamiento de R2 Infrequent Access",
    short: "Almacenamiento",
    note: "Infrequent Access no tiene límite incluido. Se cobra cada byte almacenado.",
  },
  "do.requests": { label: "Solicitudes de Durable Objects", short: "Solicitudes" },
  "do.duration": { label: "Duración de Durable Objects", short: "Duración" },
  "do.rowsRead": { label: "Filas leídas de Durable Objects", short: "Filas leídas" },
  "do.rowsWritten": { label: "Filas escritas en Durable Objects", short: "Filas escritas" },
  "do.storage": { label: "Almacenamiento de Durable Objects", short: "Almacenamiento" },
  "queues.operations": { label: "Operaciones de Queues", short: "Operaciones" },
  "ai.neurons": {
    label: "Neurons de Workers AI",
    short: "Neurons",
    note: "Se incluyen 10 000 Neurons al día. El conteo se reinicia a las 00:00 UTC, y el uso por encima de eso se cobra.",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "Almacenamiento de D1",
  kv: "KV",
  kvs: "Almacenamiento de KV",
  r2: "R2",
  r2s: "Almacenamiento de R2",
  doi: "Solicitudes de Durable Objects",
  dop: "Durable Objects",
  doq: "Almacenamiento de Durable Objects",
  queues: "Queues",
  ai: "Workers AI",
};

/** The article a dataset takes inside a list; product names take none. */
const DATASET_ARTICLE: Record<DatasetName, string> = {
  workers: "",
  pages: "",
  d1: "",
  d1s: "el",
  kv: "",
  kvs: "el",
  r2: "",
  r2s: "el",
  doi: "las",
  dop: "",
  doq: "el",
  queues: "",
  ai: "",
};

/**
 * Gender and number of each metric's name. The first letter is the gender
 * (f or m), the second the number (s or p): "fp" is "Solicitudes de Workers",
 * "ms" is "Tiempo de CPU de Workers". Verbs, adjectives and articles that refer
 * to a metric read from here, never from the name's shape.
 */
type Agreement = "fs" | "fp" | "ms" | "mp";

const AGREE: Record<MetricId, Agreement> = {
  "workers.requests": "fp",
  "workers.cpuMs": "ms",
  "d1.rowsRead": "fp",
  "d1.rowsWritten": "fp",
  "d1.storage": "ms",
  "kv.reads": "fp",
  "kv.writes": "fp",
  "kv.deletes": "fp",
  "kv.lists": "fp",
  "kv.storage": "ms",
  "r2.classA": "fp",
  "r2.classB": "fp",
  "r2.storage": "ms",
  "r2ia.classA": "fp",
  "r2ia.classB": "fp",
  "r2ia.storage": "ms",
  "do.requests": "fp",
  "do.duration": "fs",
  "do.rowsRead": "fp",
  "do.rowsWritten": "fp",
  "do.storage": "ms",
  "queues.operations": "fp",
  "ai.neurons": "mp",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Product names keep their capitals in the middle of a sentence; common nouns do not. */
const PRODUCT_START: ReadonlySet<string> = new Set(["Workers", "Pages", "D1", "KV", "R2", "Durable", "Queues"]);

const FINE = "Ningún uso superará el límite incluido este período";

const label = (id: MetricId): string => metrics[id].label;
const isPlural = (id: MetricId): boolean => AGREE[id].endsWith("p");
const isFeminine = (id: MetricId): boolean => AGREE[id].startsWith("f");

/** The form that agrees with one metric's name. */
const agree = (id: MetricId, singular: string, plural: string): string => (isPlural(id) ? plural : singular);

/** The form that agrees with a list of metrics: one name agrees with itself, more than one is plural. */
const agreeAll = (ids: readonly MetricId[], singular: string, plural: string): string => {
  const [only] = ids;
  return ids.length === 1 && only !== undefined ? agree(only, singular, plural) : plural;
};

/** A name in the middle of a sentence: a common noun drops its capital, a product name keeps it. */
const mid = (text: string): string => {
  const [first = ""] = text.split(" ");
  return PRODUCT_START.has(first) ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
};

const cap = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** "el", "la", "los" or "las": the article that goes with one metric's name. */
const article = (id: MetricId): string => {
  if (isPlural(id)) return isFeminine(id) ? "las" : "los";
  return isFeminine(id) ? "la" : "el";
};

/** The name with its article, opening a sentence: "El tiempo de CPU de Workers". */
const definite = (id: MetricId): string => `${cap(article(id))} ${mid(label(id))}`;

/** The name with its article, inside a sentence: "el tiempo de CPU de Workers". */
const inside = (id: MetricId): string => `${article(id)} ${mid(label(id))}`;

/** The name after "de", contracted as Spanish contracts it: "del tiempo de CPU de Workers", "de las solicitudes de Workers". */
const ofThe = (id: MetricId): string => {
  if (isPlural(id)) return `de ${article(id)} ${mid(label(id))}`;
  return isFeminine(id) ? `de la ${mid(label(id))}` : `del ${mid(label(id))}`;
};

/** A dataset inside a list: "Workers", "el almacenamiento de D1", "las solicitudes de Durable Objects". */
const datasetInside = (name: DatasetName): string => {
  const word = DATASET_ARTICLE[name];
  return word === "" ? datasets[name] : `${word} ${mid(datasets[name])}`;
};

/** The metric nearest its allowance, as the subject of its sentence: "El tiempo de CPU de Workers es el que más se acerca". */
const nearestLabel = (id: MetricId): string => {
  const which = isFeminine(id) ? agree(id, "la que", "las que") : agree(id, "el que", "los que");
  return `${definite(id)} ${agree(id, "es", "son")} ${which} más ${agree(id, "se acerca", "se acercan")}`;
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "los últimos 7 días", or "el último día". */
const lastDays = (n: number): string => (n === 1 ? "el último día" : `los últimos ${n} días`);

/** "de los últimos 7 días", or "del último día". */
const pace = (n: number): string => (n === 1 ? "del último día" : `de los últimos ${n} días`);

/** "frente a los 7 días anteriores", or "frente al día anterior". */
const against = (n: number): string => (n === 1 ? "frente al día anterior" : `frente a los ${n} días anteriores`);

/** "A", "A y B", "A, B y C". */
function listed(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" y ");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1] ?? ""}`;
}

/** Up to two metrics by name, each with its article; past that, the first two and how many more. */
function labels(ids: readonly MetricId[]): string {
  const names = ids.map((id, i) => (i === 0 ? definite(id) : inside(id)));
  if (names.length <= 2) return listed(names);
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}

export const es: Messages = {
  title: "Uso de Cloudflare",
  language: "Idioma",

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
    database: "Base de datos",
    namespace: "Espacio de nombres",
    bucket: "Bucket",
    queue: "Cola",
    model: "Modelo",
  },
  datasets,

  outlook: { cycle: "previsto al cierre", level: "promedio del período", daily: "hoy" },
  status: {
    exceeded: "Excedido",
    "will-exceed": "Superará el límite",
    watch: "Cerca del límite",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(" "),

  day: ({ month, day }) => `${day} ${MONTHS[month - 1] ?? ""}`,
  shortDay: ({ month, day }) => `${day}/${month}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0 horas";
    if (days === 0) return hours === 0 ? "menos de 1 hora" : plural(hours, "hora", "horas");
    return hours === 0
      ? plural(days, "día", "días")
      : `${plural(days, "día", "días")} y ${plural(hours, "hora", "horas")}`;
  },
  ago: {
    justNow: "hace un momento",
    minutes: ({ count: minutes }) => `hace ${minutes} min`,
    hours: ({ count: hours }) => `hace ${hours} h`,
    days: ({ count: days }) => `hace ${plural(days, "día", "días")}`,
  },
  change: {
    flat: "sin cambios",
    times: ({ multiple }) => `${multiple}×`,
  },

  names: {
    other: "Otros",
    unattributed: "Solicitudes sin atribuir",
    pages: ({ name }) => `${name} (Pages)`,
  },

  headline: {
    renewal: ({ day, left }) => `Se renueva el ${day}, en ${left}.`,
    noUsage: "Aún no hay uso en este período.",
    cost: ({ usd }) => `Cargos adicionales estimados: ${usd}.`,
    over: ({ metrics: ids }) => `${labels(ids)} ${agreeAll(ids, "supera", "superan")} el límite incluido.`,
    overDaily: ({ metrics: ids }) =>
      `${labels(ids)} ${agreeAll(ids, "ha superado", "han superado")} el límite diario en este período.`,
    alsoOver: ({ metrics: ids }) =>
      `${labels(ids)} ${agreeAll(ids, "también superará", "también superarán")} el límite incluido este período.`,
    runsOutOn: ({ metric, day }) => `El límite incluido ${ofThe(metric)} se agotará el ${day}.`,
    willGoOver: ({ metric }) =>
      `${definite(metric)} ${agree(metric, "superará", "superarán")} el límite incluido este período.`,
    fine: `${FINE}.`,
    fineBut: {
      cycle: ({ metric, share }) =>
        `${FINE}, pero ${inside(metric)} ${agree(metric, "alcanzará", "alcanzarán")} el ${share} del límite incluido.`,
      level: ({ metric, share }) =>
        `${FINE}, pero el promedio ${ofThe(metric)} será del ${share} del límite incluido.`,
      daily: ({ metric, share }) =>
        `${FINE}, pero ${inside(metric)} ${agree(metric, "alcanzará", "alcanzarán")} el ${share} del límite diario.`,
    },
    closest: {
      cycle: ({ metric, share }) =>
        `${nearestLabel(metric)} a su límite incluido, con una previsión del ${share} al cierre.`,
      level: ({ metric, share }) =>
        `${nearestLabel(metric)} a su límite incluido, con un promedio del ${share} en el período.`,
      daily: ({ metric, share }) =>
        `${nearestLabel(metric)} a su límite diario, con alrededor del ${share} de él al día.`,
    },
  },

  findings: {
    heading: "Puntos clave",
    tone: { over: "Excedido: ", watch: "Atención: ", note: "Nota: " },
    share: ({ metric, name, share, stored, msPerRequest }) => {
      if (stored) return `El ${share} ${ofThe(metric)} está en ${name}.`;
      const each = msPerRequest === null ? "" : `, con un promedio de ${msPerRequest} ms por solicitud`;
      return `El ${share} ${ofThe(metric)} viene de ${name}${each}.`;
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : `, y ${grower} creció más`;
      return `${definite(metric)} en ${lastDays(days)} ${agree(metric, "fue", "fueron")} ${change} ${against(days)}${who}.`;
    },
    spike: ({ metric, day, change, amount }) =>
      `El ${day}, ${inside(metric)} ${agree(metric, "fue", "fueron")} ${change} un día normal (${amount}).`,
    errors: ({ name, days, share, count: failed }) =>
      `El ${share} de las solicitudes a ${name} fallaron en ${lastDays(days)}: ${failed} en total.`,
    storedOver: ({ metric }) =>
      `${definite(metric)} ${agree(metric, "ya supera", "ya superan")} el límite incluido, pero su promedio de este período no lo supera. Si se mantiene en este nivel, se cobrará el próximo período.`,
    storedWillPass: ({ metric, day }) =>
      `Al ritmo de crecimiento reciente, ${inside(metric)} ${agree(metric, "superará", "superarán")} el límite incluido el ${day}.`,
    periodTimes: ({ metric, change }) =>
      `${definite(metric)} ${agree(metric, "es", "son")} ${change} lo que ${agree(metric, "era", "eran")} en este punto del período anterior.`,
    periodDiff: ({ metric, percent, more }) =>
      `${definite(metric)} ${agree(metric, "es", "son")} un ${percent} ${more ? "más" : "menos"} que en este punto del período anterior.`,
    daysOver: ({ metric, days, usd }) =>
      `${definite(metric)} ${agree(metric, "superó", "superaron")} el límite diario en ${plural(days, "día", "días")} de este período. El exceso suma unos ${usd}.`,
    busiestDay: ({ metric, day, share }) =>
      `El día de mayor uso ${ofThe(metric)} este período fue el ${day}, con el ${share} del límite diario.`,
    metered: ({ metric, usd }) =>
      `${definite(metric)} ${agree(metric, "no tiene", "no tienen")} límite incluido, así que este período cuesta unos ${usd}.`,
  },

  metricList: {
    heading: "Uso",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / ${allowance} al día`,
    cost: "costo de este período",
    more: ({ count: total, others }) => {
      const what = others ? "más" : "en uso";
      return total === 1 ? `1 ${what}, por debajo del 1%` : `${total} ${what}, todas por debajo del 1%`;
    },
    unused: ({ days, metrics: ids }) => `Sin uso en ${lastDays(days)}: ${listed(ids.map(inside))}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}, ${figures}, ${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `${used} usado, previsto ${projected}`,
    level: ({ used, projected }) => `${used} del límite almacenado ahora, promedio del período ${projected}`,
    daily: ({ used }) => `${used} del límite diario usado hoy`,
  },

  detail: {
    pane: ({ metric }) => `Detalles ${ofThe(metric)}`,
    price: {
      perGbMonth: ({ usd, extra }) => `${usd} por GB al mes${extra ? " que pase del límite incluido" : ""}`,
      per: ({ usd, units, extra }) => `${usd} por cada ${units}${extra ? " que pase del límite incluido" : ""}`,
    },
    facts: {
      soFar: "Hasta ahora en este período",
      periodEndAtPace: ({ days }) => `Al ritmo ${pace(days)}`,
      lastPeriodSamePoint: "Período anterior, al mismo punto",
      thisPeriod: ({ change }) => `${change} en este período`,
      lastPeriodTotal: "Todo el período anterior",
      runsOut: "Se agota el límite incluido",
      notThisPeriod: "No en este período",
      storedNow: "Almacenado ahora",
      periodAverage: "Promedio del período (base de facturación)",
      perDay: ({ days }) => `${cap(lastDays(days))}, por día`,
      unchanged: "Sin cambios",
      grew: ({ amount }) => `Aumento de ${amount}`,
      shrank: ({ amount }) => `Disminución de ${amount}`,
      storedAtEnd: "Almacenado al cierre del período",
      endOfLastPeriod: "Al cierre del período anterior",
      storedPasses: "Supera el límite incluido",
      notWithinYear: "No en el próximo año",
      notGrowing: "No está creciendo",
      today: "Hoy",
      dailyAverage: ({ days }) => `Promedio diario ${pace(days)}`,
      busiestDay: ({ day }) => `Día de mayor uso este período (${day})`,
      daysOver: "Días por encima del límite diario",
      dayCount: ({ count: days }) => plural(days, "día", "días"),
      none: "Ninguno",
      overage: "Exceso estimado",
      costThisPeriod: "Costo estimado de este período",
    },
    breakdown: {
      now: "Ahora",
      thisPeriod: "Usado",
      share: "Parte",
      againstDaysAgo: ({ days }) => `frente a hace ${plural(days, "día", "días")}`,
      againstDaysBefore: ({ days }) => against(days),
      appeared: "nuevo",
      perRequest: ({ ms }) => `${ms} ms por solicitud`,
      failed: ({ share }) => `${share} con error`,
      other: "Otros",
      more: ({ count: rest }) => `${rest} más`,
    },
    daily: {
      summary: "Cifras diarias",
      date: "Fecha",
      thatDay: "Diario",
      stored: "Almacenado",
      running: "Total acumulado",
    },
  },

  chart: {
    thisPeriod: "Este período",
    projected: "Previsto",
    lastPeriod: "Período anterior",
    allowance: "Límite incluido",
    keys: ({ metric }) => `${definite(metric)}. Usa las flechas izquierda y derecha para recorrer los días.`,
    running: "Total acumulado",
    thatDay: "Ese día",
    sameDayLastPeriod: "Período anterior, mismo día",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}, día ${day} de ${days}`,
    renewal: { before: "Se renueva el día", after: "de cada mes" },
  },

  topbar: {
    accounts: "Cuentas",
    accountTone: { ok: null, watch: " (cerca del límite)", over: " (excedido)" },
    updating: "Actualizando",
    noData: "Sin datos todavía",
    updated: ({ ago }) => `${ago.charAt(0).toUpperCase()}${ago.slice(1)}`,
    refresh: "Actualizar",
  },

  app: {
    loading: "Cargando",
    loadFailed: "No se cargaron los datos. Recarga la página para intentarlo de nuevo.",
    noAccounts: "Todavía no hay ninguna cuenta de Cloudflare configurada.",
    refreshFailed: ({ reason }) => (reason === null ? "No se actualizó el uso." : `No se actualizó el uso. ${reason}`),
    unreachable: "No se pudo conectar con Cloudflare.",
    retry: "Intentar de nuevo",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "No se guardó el día de renovación. Inténtalo de nuevo."
        : `No se guardó el día de renovación, así que sigue siendo el día ${day}. Inténtalo de nuevo.`,
    firstRead: "Leyendo el uso por primera vez. Esto tarda unos 10 segundos.",
    noData: "Todavía no hay datos de uso.",
  },

  footer: {
    estimate:
      "Las cifras de uso son estimaciones de Cloudflare Analytics y pueden diferir un poco de la factura. No se incluye el tiempo de CPU de Pages Functions.",
    prices: {
      before: "Los límites y los precios provienen de las listas de precios de ",
      between: " y ",
      after: ", vigentes al 9 oct 2026.",
    },
    json: { before: "Las mismas cifras en JSON: ", between: ", ", all: "todas las cuentas" },
    agent: { before: "Para un agente, la dirección del MCP es ", after: "." },
    signOut: "Cerrar sesión",
  },

  setup: {
    title: "¿Qué día se renueva tu factura?",
    lead: "El uso se cuenta desde ese día de cada mes. La fecha está en el dashboard de Cloudflare, en Manage Account → Billing → Subscriptions, junto a Workers Paid.",
    save: "Guardar",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `No se pudo conectar con Cloudflare usando el token de API ${token}.`;
    if (status === 200) return `El token de API ${token} funciona, pero no puede ver ninguna cuenta.`;
    return `Cloudflare rechazó el token de API ${token} (${status}). Revisa que tenga el permiso Account Analytics: Read y que no haya caducado.`;
  },

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `No se pudo leer el uso de Workers AI (${w.reason}).`;
      case "clipped":
        return `Los datos de uso de ${listed(w.datasets.map(datasetInside))} están incompletos, así que el uso real es mayor que el que se muestra.`;
      case "r2-unknown":
        return `Algunas operaciones de R2 no se pudieron clasificar como Class A o Class B y no se cuentan: ${w.actions.join(", ")}.`;
      case "stale":
        return "La última actualización falló. Estas cifras son de la actualización anterior.";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics devolvió un error.",
    "unknown-account": "Esta cuenta ya no está disponible. Recarga la página.",
    "no-token": "Esta cuenta no tiene configurado un token de API de Cloudflare.",
    "invalid-request": "La solicitud no fue aceptada. Recarga la página e inténtalo de nuevo.",
    "rate-limited": "Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.",
    unauthenticated: "Tu sesión caducó. Vuelve a iniciar sesión.",
    unavailable: "El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
    unknown: "Algo salió mal. Inténtalo de nuevo.",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics devolvió un error (${detail}).`,
};
