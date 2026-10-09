import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

/** Names follow Cloudflare's product names, with the generic noun in Portuguese: "Solicitações do Workers". */
const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Solicitações do Workers",
    short: "Solicitações",
    note: "Inclui Pages Functions. As solicitações de arquivos estáticos não contam.",
  },
  "workers.cpuMs": { label: "Tempo de CPU do Workers", short: "Tempo de CPU" },
  "d1.rowsRead": { label: "Linhas lidas do D1", short: "Linhas lidas" },
  "d1.rowsWritten": { label: "Linhas gravadas do D1", short: "Linhas gravadas" },
  "d1.storage": { label: "Armazenamento do D1", short: "Armazenamento" },
  "kv.reads": { label: "Leituras do KV", short: "Leituras" },
  "kv.writes": { label: "Gravações do KV", short: "Gravações" },
  "kv.deletes": { label: "Exclusões do KV", short: "Exclusões" },
  "kv.lists": { label: "Solicitações de listagem do KV", short: "Listagens" },
  "kv.storage": { label: "Armazenamento do KV", short: "Armazenamento" },
  "r2.classA": {
    label: "Operações Class A do R2",
    short: "Class A",
    note: "Operações que gravam ou listam, como uploads, listagens e cópias.",
  },
  "r2.classB": {
    label: "Operações Class B do R2",
    short: "Class B",
    note: "Operações que leem, como buscar um objeto ou os seus metadados.",
  },
  "r2.storage": { label: "Armazenamento do R2", short: "Armazenamento" },
  "r2ia.classA": {
    label: "Operações Class A do R2 Infrequent Access",
    short: "Class A",
    note: "O Infrequent Access não tem franquia incluída. Cada operação é cobrada.",
  },
  "r2ia.classB": {
    label: "Operações Class B do R2 Infrequent Access",
    short: "Class B",
    note: "O Infrequent Access não tem franquia incluída. Cada operação é cobrada.",
  },
  "r2ia.storage": {
    label: "Armazenamento do R2 Infrequent Access",
    short: "Armazenamento",
    note: "O Infrequent Access não tem franquia incluída. Cada byte armazenado é cobrado.",
  },
  "do.requests": { label: "Solicitações do Durable Objects", short: "Solicitações" },
  "do.duration": { label: "Duração do Durable Objects", short: "Duração" },
  "do.rowsRead": { label: "Linhas lidas do Durable Objects", short: "Linhas lidas" },
  "do.rowsWritten": { label: "Linhas gravadas do Durable Objects", short: "Linhas gravadas" },
  "do.storage": { label: "Armazenamento do Durable Objects", short: "Armazenamento" },
  "queues.operations": { label: "Operações do Queues", short: "Operações" },
  "ai.neurons": {
    label: "Neurons do Workers AI",
    short: "Neurons",
    note: "São incluídos 10.000 neurons por dia. A contagem zera às 00:00 UTC, e o uso além disso é cobrado.",
  },
};

/** Each name is read after "Os dados de uso", so it carries its article and any "de" contraction. */
const datasets: Record<DatasetName, string> = {
  workers: "do Workers",
  pages: "do Pages Functions",
  d1: "do D1",
  d1s: "do armazenamento do D1",
  kv: "do KV",
  kvs: "do armazenamento do KV",
  r2: "do R2",
  r2s: "do armazenamento do R2",
  doi: "das solicitações do Durable Objects",
  dop: "do Durable Objects",
  doq: "do armazenamento do Durable Objects",
  queues: "do Queues",
  ai: "do Workers AI",
};

/**
 * The head noun of each metric's name: its gender and number. Verbs take the
 * number; articles take both. No adjective or participle agrees with a name,
 * so nothing else in a sentence needs this.
 */
const NOUN: Record<MetricId, { feminine: boolean; plural: boolean }> = {
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
  "ai.neurons": { feminine: false, plural: true },
};

const label = (id: MetricId): string => metrics[id].label;

/** The article for a metric's name: "o", "a", "os" or "as". */
const article = (id: MetricId): string => {
  const { feminine, plural } = NOUN[id];
  if (feminine) return plural ? "as" : "a";
  return plural ? "os" : "o";
};

/**
 * A metric's name with its article, as a sentence needs it. "start" capitalises
 * the article, "mid" keeps it lower, and "of" joins it to a "de" before it, so
 * "da duração do Durable Objects" follows "A franquia incluída". Only the name's
 * first letter is lowered; product names keep their capitals.
 */
type Place = "start" | "mid" | "of";
function named(id: MetricId, place: Place): string {
  const text = label(id);
  const plain = `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  const art = article(id);
  if (place === "of") return `d${art} ${plain}`;
  if (place === "start") return `${art.charAt(0).toUpperCase()}${art.slice(1)} ${plain}`;
  return `${art} ${plain}`;
}

/** The verb for a list of metrics: only one singular name takes the singular form. */
const agree = (ids: readonly MetricId[], singular: string, plural: string): string => {
  const [only] = ids;
  return ids.length === 1 && only !== undefined && !NOUN[only].plural ? singular : plural;
};

const count = (value: number, singular: string, plural: string): string =>
  `${value} ${value === 1 ? singular : plural}`;

/** "A", "A e B", "A, B e C". */
function listed(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" e ");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1) ?? ""}`;
}

/** Up to two names, each with its article; past that, the first two and how many more. */
function labels(ids: readonly MetricId[]): string {
  const shown = ids.slice(0, 2).map((id, i) => named(id, i === 0 ? "start" : "mid"));
  if (ids.length <= 2) return listed(shown);
  return `${shown.join(", ")} e mais ${count(ids.length - 2, "métrica", "métricas")}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const FINE = "Nada vai ultrapassar a franquia neste período";

export const ptBR: Messages = {
  title: "Uso da Cloudflare",
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
    database: "Banco de dados",
    namespace: "Namespace",
    bucket: "Bucket",
    queue: "Fila",
    model: "Modelo",
  },
  datasets,

  outlook: { cycle: "previsto", level: "média do período", daily: "hoje" },
  status: {
    exceeded: "Acima da franquia",
    "will-exceed": "Vai exceder a franquia",
    watch: "Perto da franquia",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(" "),

  day: ({ month, day }) => `${day} de ${MONTHS[month - 1] ?? ""}`,
  shortDay: ({ month, day }) => `${day}/${month}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0 horas";
    if (days === 0) return hours === 0 ? "menos de 1 hora" : count(hours, "hora", "horas");
    return hours === 0
      ? count(days, "dia", "dias")
      : `${count(days, "dia", "dias")} e ${count(hours, "hora", "horas")}`;
  },
  ago: {
    justNow: "agora mesmo",
    minutes: ({ count: minutes }) => `há ${minutes} min`,
    hours: ({ count: hours }) => `há ${hours} h`,
    days: ({ count: days }) => `há ${count(days, "dia", "dias")}`,
  },
  change: {
    flat: "sem mudança",
    times: ({ multiple }) => `${multiple}×`,
  },

  names: {
    other: "Outros",
    unattributed: "Solicitações não atribuídas",
    pages: ({ name }) => `${name} (Pages)`,
  },

  headline: {
    renewal: ({ day, left }) => `Renova em ${day}, daqui a ${left}.`,
    noUsage: "Ainda não há uso neste período.",
    cost: ({ usd }) => `Cobranças extras estimadas: ${usd}.`,
    over: ({ metrics: ids }) => `${labels(ids)} ${agree(ids, "está", "estão")} acima da franquia incluída.`,
    overDaily: ({ metrics: ids }) =>
      `${labels(ids)} ${agree(ids, "ultrapassou", "ultrapassaram")} a franquia diária neste período.`,
    alsoOver: ({ metrics: ids }) =>
      `${labels(ids)} também ${agree(ids, "vai", "vão")} ultrapassar a franquia neste período.`,
    runsOutOn: ({ metric, day }) => `A franquia incluída ${named(metric, "of")} vai acabar em ${day}.`,
    willGoOver: ({ metric }) =>
      `${named(metric, "start")} ${agree([metric], "vai", "vão")} ultrapassar a franquia incluída neste período.`,
    fine: `${FINE}.`,
    fineBut: {
      cycle: ({ metric, share }) =>
        `${FINE}, mas ${named(metric, "mid")} ${agree([metric], "vai", "vão")} chegar a ${share} da franquia.`,
      level: ({ metric, share }) => `${FINE}, mas a média ${named(metric, "of")} vai ficar em ${share} da franquia.`,
      daily: ({ metric, share }) =>
        `${FINE}, mas ${named(metric, "mid")} ${agree([metric], "vai", "vão")} chegar a ${share} da franquia diária.`,
    },
    // The label stands alone after the colon: the sentence keeps it verbatim, as its test requires.
    closest: {
      cycle: ({ metric, share }) => `Mais perto da franquia: ${label(metric)}, com previsão de ${share}.`,
      level: ({ metric, share }) => `Mais perto da franquia: ${label(metric)}, com média de ${share} no período.`,
      daily: ({ metric, share }) =>
        `Mais perto da franquia: ${label(metric)}, usando cerca de ${share} da franquia diária a cada dia.`,
    },
  },

  findings: {
    heading: "Pontos principais",
    tone: { over: "Acima da franquia: ", watch: "Atenção: ", note: "Nota: " },
    share: ({ metric, name, share, stored, msPerRequest }) => {
      if (stored) return `${name} guarda ${share} ${named(metric, "of")}.`;
      const each = msPerRequest === null ? "" : `, com média de ${msPerRequest} ms por solicitação`;
      return `${name} responde por ${share} ${named(metric, "of")}${each}.`;
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : `, e ${grower} foi quem mais cresceu`;
      return `${named(metric, "start")} nos últimos ${days} dias ${agree([metric], "foi", "foram")} ${change} em relação aos ${days} dias anteriores${who}.`;
    },
    spike: ({ metric, day, change, amount }) =>
      `${named(metric, "start")} em ${day} ${agree([metric], "foi", "foram")} ${change} em relação a um dia comum (${amount}).`,
    errors: ({ name, days, share, count: failed }) =>
      `${share} das solicitações para ${name} falharam nos últimos ${days} dias (${failed} no total).`,
    storedOver: ({ metric }) =>
      `${named(metric, "start")} ${agree([metric], "está", "estão")} acima da franquia incluída agora, mas a média do período ainda está abaixo. Se continuar nesse nível, o excedente será cobrado no próximo período.`,
    storedWillPass: ({ metric, day }) =>
      `No ritmo de crescimento recente, ${named(metric, "mid")} ${agree([metric], "vai", "vão")} ultrapassar a franquia incluída em ${day}.`,
    periodTimes: ({ metric, change }) =>
      `${named(metric, "start")} ${agree([metric], "está", "estão")} ${change} em relação ao mesmo ponto do período anterior.`,
    periodDiff: ({ metric, percent, more }) =>
      `${named(metric, "start")} ${agree([metric], "está", "estão")} ${percent} ${more ? "acima" : "abaixo"} do mesmo ponto do período anterior.`,
    daysOver: ({ metric, days, usd }) =>
      `${named(metric, "start")} ${agree([metric], "ultrapassou", "ultrapassaram")} a franquia diária em ${count(days, "dia", "dias")} deste período. O excedente chega a cerca de ${usd}.`,
    busiestDay: ({ metric, day, share }) =>
      `O dia de maior uso ${named(metric, "of")} neste período foi ${day}, com ${share} da franquia diária.`,
    metered: ({ metric, usd }) =>
      `${named(metric, "start")} ${agree([metric], "não tem", "não têm")} franquia incluída, então este período custa cerca de ${usd}.`,
  },

  metricList: {
    heading: "Uso",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / ${allowance} por dia`,
    cost: "custo neste período",
    more: ({ count: total, others }) => {
      const noun = count(total, "métrica", "métricas");
      const tail = total === 1 ? "abaixo de 1%" : "todas abaixo de 1%";
      return others ? `mais ${noun}, ${tail}` : `${noun} em uso, ${tail}`;
    },
    unused: ({ days, metrics: ids }) =>
      `Sem uso nos últimos ${days} dias: ${ids.map((id) => named(id, "mid")).join(", ")}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}, ${figures}, ${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `Usado ${used}, previsto ${projected}`,
    level: ({ used, projected }) => `${used} da franquia armazenada agora, média do período de ${projected}`,
    daily: ({ used }) => `${used} da franquia diária usada hoje`,
  },

  detail: {
    pane: ({ metric }) => `Detalhes ${named(metric, "of")}`,
    price: {
      perGbMonth: ({ usd, extra }) => `${usd} por GB-mês${extra ? " além da franquia" : ""}`,
      per: ({ usd, units, extra }) => `${usd} por ${units}${extra ? " além da franquia" : ""}`,
    },
    facts: {
      soFar: "Até agora neste período",
      periodEndAtPace: ({ days }) => `No ritmo dos últimos ${days} dias`,
      lastPeriodSamePoint: "Período anterior até aqui",
      thisPeriod: ({ change }) => `${change} neste período`,
      lastPeriodTotal: "Período anterior inteiro",
      runsOut: "A franquia se esgota",
      notThisPeriod: "Não neste período",
      storedNow: "Armazenado agora",
      periodAverage: "Média do período (cobrada)",
      perDay: ({ days }) => `Últimos ${days} dias, por dia`,
      unchanged: "Sem mudança",
      grew: ({ amount }) => `Subiu ${amount}`,
      shrank: ({ amount }) => `Caiu ${amount}`,
      storedAtEnd: "Armazenado no fim do período",
      endOfLastPeriod: "No fim do período anterior",
      storedPasses: "Ultrapassa a franquia",
      notWithinYear: "Não em um ano",
      notGrowing: "Sem crescimento",
      today: "Hoje",
      dailyAverage: ({ days }) => `Últimos ${days} dias, média diária`,
      busiestDay: ({ day }) => `Dia de maior uso neste período (${day})`,
      daysOver: "Dias acima da franquia diária",
      dayCount: ({ count: days }) => count(days, "dia", "dias"),
      none: "Nenhum",
      overage: "Excedente estimado",
      costThisPeriod: "Custo estimado neste período",
    },
    breakdown: {
      now: "Agora",
      thisPeriod: "Uso",
      share: "Participação",
      againstDaysAgo: ({ days }) => `vs ${days} dias atrás`,
      againstDaysBefore: ({ days }) => `vs ${days} dias anteriores`,
      appeared: "Novo",
      perRequest: ({ ms }) => `${ms} ms por solicitação`,
      failed: ({ share }) => `${share} com falha`,
      other: "Outros",
      more: ({ count: rest }) => `mais ${rest}`,
    },
    daily: {
      summary: "Números diários",
      date: "Data",
      thatDay: "No dia",
      stored: "Armazenado",
      running: "Total acumulado",
    },
  },

  chart: {
    thisPeriod: "Este período",
    projected: "Previsto",
    lastPeriod: "Período anterior",
    allowance: "Franquia incluída",
    keys: ({ metric }) =>
      `${named(metric, "start")}. Use as setas para a esquerda e para a direita para percorrer os dias.`,
    running: "Total acumulado",
    thatDay: "Naquele dia",
    sameDayLastPeriod: "Período anterior",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}, dia ${day} de ${days}`,
    renewal: { before: "Renova no dia", after: "de cada mês" },
  },

  topbar: {
    accounts: "Contas",
    accountTone: { ok: null, watch: " (perto da franquia)", over: " (acima da franquia)" },
    updating: "Atualizando",
    noData: "Ainda sem dados",
    updated: ({ ago }) => `${ago.charAt(0).toUpperCase()}${ago.slice(1)}`,
    refresh: "Atualizar",
  },

  app: {
    loading: "Carregando",
    loadFailed: "Os dados não foram carregados. Recarregue a página para tentar de novo.",
    noAccounts: "Nenhuma conta da Cloudflare foi configurada ainda.",
    refreshFailed: ({ reason }) => (reason === null ? "O uso não foi atualizado." : `O uso não foi atualizado. ${reason}`),
    unreachable: "Não foi possível acessar a Cloudflare.",
    retry: "Tentar novamente",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "O dia de renovação não foi salvo. Tente novamente."
        : `O dia de renovação não foi salvo, então continua sendo o dia ${day}. Tente novamente.`,
    firstRead: "Lendo o uso pela primeira vez. Isso leva cerca de 10 segundos.",
    noData: "Ainda não há dados de uso.",
  },

  footer: {
    estimate:
      "Os números de uso são estimativas do Cloudflare Analytics e podem ser um pouco diferentes da fatura. O tempo de CPU do Pages Functions não está incluído.",
    prices: { before: "Franquias e preços seguem as listas de preços do ", between: " e do ", after: ", vigentes em 9 de out de 2026." },
    json: { before: "Os mesmos números em JSON: ", between: ", ", all: "todas as contas" },
    agent: { before: "Para um agente, o endereço MCP é ", after: "." },
    signOut: "Sair",
  },

  setup: {
    title: "Em que dia do mês a fatura é renovada?",
    lead: "O uso é contado a partir desse dia de cada mês. A data está no painel da Cloudflare, em Manage Account → Billing → Subscriptions, ao lado de Workers Paid.",
    save: "Salvar",
  },

  alerts: {
    title: "Alertas",
    lead: "Verificação feita quatro vezes por dia. Você recebe um aviso sobre um produto uma vez cada vez que a situação dele piora, e não a cada verificação.",
    when: "Avise-me quando",
    events: {
      willExceed: "um produto estiver a caminho de ultrapassar a franquia neste período",
      exceeded: "um produto ultrapassar a franquia",
      watch: "um produto estiver a caminho de passar de 80% da franquia",
      token: "um token de API parar de funcionar",
    },
    ntfy: {
      url: "Endereço do tópico no ntfy",
      hint: "Por exemplo, https://ntfy.sh/so-voce-conhece. Quem souber o tópico consegue ler as mensagens.",
      token: "Token de acesso",
    },
    webhook: {
      url: "Endereço do Webhook",
      hint: "Recebe um JSON POST quando há algo para avisar você.",
      secret: "Segredo de assinatura",
    },
    optional: "opcional",
    kept: "Salvo. Digite para substituir.",
    save: "Salvar",
    saved: "Salvo.",
    notSaved: "Os alertas não foram salvos. Tente novamente.",
    invalidAddress: ({ channel }) =>
      `O endereço do ${channel} precisa começar com https:// e, no caso do ntfy, terminar com um tópico.`,
    test: "Enviar teste",
    noChannel: "Adicione um tópico do ntfy ou um webhook e salve antes.",
    delivered: ({ channel }) => `${channel}: entregue.`,
    failed: ({ channel, status }) =>
      status === null ? `${channel}: não foi possível acessar.` : `${channel}: recusado (${status}).`,
    close: "Fechar",
    testTitle: "Teste da sua página de uso",
    testBody: "Os alertas vão chegar aqui.",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `Não foi possível acessar a Cloudflare com o token de API ${token}.`;
    if (status === 200) return `O token de API ${token} funciona, mas não vê nenhuma conta.`;
    return `A Cloudflare recusou o token de API ${token} (${status}). Confira se ele tem a permissão Account Analytics: Read e se ainda não expirou.`;
  },

  reconnect: "Reconectar",
  about: "Sobre",

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `Não foi possível ler o uso do Workers AI (${w.reason}).`;
      case "clipped":
        return `Os dados de uso ${listed(w.datasets.map((name) => datasets[name]))} estão incompletos, então o uso real é maior do que o mostrado.`;
      case "r2-unknown":
        return `Algumas operações do R2 não puderam ser classificadas como Class A ou Class B e não foram contadas: ${w.actions.join(", ")}.`;
      case "stale":
        return "A última atualização falhou. Estes números são da atualização anterior.";
    }
  },

  errors: {
    analytics: "O Cloudflare Analytics retornou um erro.",
    "unknown-account": "Esta conta não está mais disponível. Recarregue a página.",
    "no-token": "Nenhum token de API da Cloudflare está configurado para esta conta.",
    "invalid-request": "A solicitação não foi aceita. Recarregue a página e tente novamente.",
    "rate-limited": "Muitas solicitações. Espere um minuto e tente novamente.",
    unauthenticated: "Seu login expirou. Entre novamente.",
    reconnect: "A Cloudflare não aceita mais o login desta página, então os números deixaram de ser atualizados.",
    unavailable: "O serviço está indisponível no momento. Tente novamente em instantes.",
    unknown: "Algo deu errado. Tente novamente.",
  },
  analyticsError: ({ detail }) => `O Cloudflare Analytics retornou um erro (${detail}).`,
};
