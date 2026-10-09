import type { MetricId } from "../catalog";
import { glue } from "../format";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Workers 請求",
    short: "請求",
    note: "包含 Pages Functions。靜態資源的請求不算。",
  },
  "workers.cpuMs": { label: "Workers CPU 時間", short: "CPU 時間" },
  "d1.rowsRead": { label: "D1 讀取列數", short: "讀取列數" },
  "d1.rowsWritten": { label: "D1 寫入列數", short: "寫入列數" },
  "d1.storage": { label: "D1 儲存", short: "儲存" },
  "kv.reads": { label: "KV 讀取", short: "讀取" },
  "kv.writes": { label: "KV 寫入", short: "寫入" },
  "kv.deletes": { label: "KV 刪除", short: "刪除" },
  "kv.lists": { label: "KV 列出", short: "列出" },
  "kv.storage": { label: "KV 儲存", short: "儲存" },
  "r2.classA": {
    label: "R2 A 類操作",
    short: "A 類操作",
    note: "上傳、列出、複製這類會改動或列舉的操作。",
  },
  "r2.classB": {
    label: "R2 B 類操作",
    short: "B 類操作",
    note: "讀取物件與查詢資訊。",
  },
  "r2.storage": { label: "R2 儲存", short: "儲存" },
  "r2ia.classA": {
    label: "R2 低頻 A 類操作",
    short: "A 類操作",
    note: "低頻存取沒有免費額度，從第一次操作開始計費。",
  },
  "r2ia.classB": {
    label: "R2 低頻 B 類操作",
    short: "B 類操作",
    note: "低頻存取沒有免費額度，從第一次操作開始計費。",
  },
  "r2ia.storage": {
    label: "R2 低頻儲存",
    short: "儲存",
    note: "低頻存取沒有免費額度，從第一個位元組開始計費。",
  },
  "do.requests": { label: "Durable Objects 請求", short: "請求" },
  "do.duration": { label: "Durable Objects 運行時間", short: "運行時間" },
  "do.rowsRead": { label: "Durable Objects 讀取列數", short: "讀取列數" },
  "do.rowsWritten": { label: "Durable Objects 寫入列數", short: "寫入列數" },
  "do.storage": { label: "Durable Objects 儲存", short: "儲存" },
  "queues.operations": { label: "Queues 操作", short: "操作" },
  "ai.neurons": {
    label: "Workers AI Neurons",
    short: "Neurons",
    note: "每天 10,000 個免費，台灣時間早上 8 點（UTC 午夜）重算；只有當天超過的部分計費。",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "D1 儲存",
  kv: "KV",
  kvs: "KV 儲存",
  r2: "R2",
  r2s: "R2 儲存",
  doi: "Durable Objects 請求",
  dop: "Durable Objects",
  doq: "Durable Objects 儲存",
  queues: "Queues",
  ai: "Workers AI",
};

const label = (id: MetricId): string => metrics[id].label;

function labels(ids: readonly MetricId[]): string {
  const all = ids.map(label);
  return all.length <= 2
    ? all.join("、")
    : glue(all.slice(0, 2).join("、"), "等", String(all.length), "項");
}

const FINE = "這期不會超額";

export const zhTW: Messages = {
  title: "Cloudflare 用量",
  language: "語言",

  metrics,
  products: {
    Workers: "Workers",
    D1: "D1",
    KV: "KV",
    R2: "R2",
    "R2 Infrequent Access": "R2 低頻存取",
    "Durable Objects": "Durable Objects",
    Queues: "Queues",
    "Workers AI": "Workers AI",
  },
  resources: {
    worker: "Worker",
    database: "資料庫",
    namespace: "命名空間",
    bucket: "儲存桶",
    queue: "佇列",
    model: "模型",
  },
  datasets,

  outlook: { cycle: "期末預估", level: "整期平均", daily: "今天" },
  status: {
    exceeded: "已超額",
    "will-exceed": "會超額",
    watch: "接近上限",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(""),

  day: ({ month, day }) => `${month} 月 ${day} 日`,
  shortDay: ({ month, day }) => `${month}/${day}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0 小時";
    if (days === 0) return hours === 0 ? "不到 1 小時" : `${hours} 小時`;
    return hours === 0 ? `${days} 天` : `${days} 天 ${hours} 小時`;
  },
  ago: {
    justNow: "剛剛",
    minutes: ({ count }) => `${count} 分鐘前`,
    hours: ({ count }) => `${count} 小時前`,
    days: ({ count }) => `${count} 天前`,
  },
  change: {
    flat: "持平",
    times: ({ multiple }) => `${multiple} 倍`,
  },

  names: {
    other: "其他",
    unattributed: "未歸屬的請求",
    pages: ({ name }) => `${name}（Pages）`,
  },

  headline: {
    renewal: ({ day, left }) => glue(day, "續約，還有", left, "。"),
    noUsage: "這期還沒有用量。",
    cost: ({ usd }) => glue("預估超額費用", usd, "。"),
    over: ({ metrics: ids }) => glue(labels(ids), "已經超過內含額度。"),
    overDaily: ({ metrics: ids }) => glue(labels(ids), "這期有幾天超過每日額度。"),
    alsoOver: ({ metrics: ids }) => glue(labels(ids), "也會在這期用完。"),
    runsOutOn: ({ metric, day }) => glue(label(metric), "會在", day, "用完。"),
    willGoOver: ({ metric }) => glue(label(metric), "這期會超過內含額度。"),
    fine: `${FINE}。`,
    fineBut: {
      cycle: ({ metric, share }) => `${FINE}，${glue(label(metric), "會用到", share, "。")}`,
      level: ({ metric, share }) => `${FINE}，${glue(label(metric), "的整期平均會到", share, "。")}`,
      daily: ({ metric, share }) => `${FINE}，${glue(label(metric), "一天會用到每日額度的", share, "。")}`,
    },
    closest: {
      cycle: ({ metric, share }) => glue("最接近上限的是", label(metric), "，", "期末預估", share, "。"),
      level: ({ metric, share }) => glue("最接近上限的是", label(metric), "，", "整期平均", share, "。"),
      daily: ({ metric, share }) =>
        glue("最接近上限的是", label(metric), "，一天大約用掉每日額度的", share, "。"),
    },
  },

  findings: {
    heading: "重點",
    tone: { over: "超額：", watch: "留意：", note: "補充：" },
    share: ({ metric, name, share, msPerRequest }) => {
      const text = glue(name, "佔了", label(metric), "的", share);
      return msPerRequest === null ? `${text}。` : `${glue(text, "，平均每次請求", `${msPerRequest} ms`)}。`;
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : glue("，增加最多的是", grower);
      return glue(label(metric), "這", String(days), "天是前", String(days), "天的", change, who, "。");
    },
    spike: ({ metric, day, change, amount }) =>
      glue(day, "的", label(metric), "是平常一天的", change, `（${amount}）。`),
    errors: ({ name, days, share, count }) =>
      glue(name, "這", String(days), "天有", share, "的請求出錯（", count, "次）。"),
    storedOver: ({ metric }) =>
      glue(label(metric), "的存量已經超過內含額度，這期的平均還沒有。維持這個量，下一期會開始計費。"),
    storedWillPass: ({ metric, day }) =>
      glue("照最近的增加速度，", label(metric), "的存量會在", day, "超過內含額度。"),
    periodTimes: ({ metric, change }) => glue(label(metric), "是上一期同一時間點的", change, "。"),
    periodDiff: ({ metric, percent, more }) =>
      glue(label(metric), more ? "比上一期同一時間點多" : "比上一期同一時間點少", percent, "。"),
    daysOver: ({ metric, days, usd }) =>
      glue(label(metric), "這期有", String(days), "天超過每日額度，超出的部分大約", usd, "。"),
    busiestDay: ({ metric, day, share }) =>
      glue(label(metric), "這期最高的一天是", day, "，用到每日額度的", share, "。"),
    metered: ({ metric, usd }) => glue(label(metric), "沒有免費額度，這期大約", usd, "。"),
  },

  metricList: {
    heading: "用量",
    figures: ({ used, allowance }) => `${used} ／ ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} ／ 每天 ${allowance}`,
    cost: "這期費用",
    more: ({ count, others }) => (others ? `另外 ${count} 項都不到 1%` : `${count} 項，都不到 1%`),
    unused: ({ days, metrics: ids }) => `這 ${days} 天沒有用到：${ids.map(label).join("、")}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}，${figures}，${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `已用 ${used}，期末預估 ${projected}`,
    level: ({ used, projected }) => `現在存量是額度的 ${used}，整期平均 ${projected}`,
    daily: ({ used }) => `今天用了每日額度的 ${used}`,
  },

  detail: {
    pane: ({ metric }) => `${label(metric)}的明細`,
    price: {
      perGbMonth: ({ usd, extra }) => `${extra ? "超過後" : ""}每 GB 每月 ${usd}`,
      per: ({ usd, units, extra }) => `${extra ? "超過後" : ""}每 ${units} ${usd}`,
    },
    facts: {
      soFar: "這期到現在",
      periodEndAtPace: ({ days }) => `照最近 ${days} 天的速度，期末`,
      lastPeriodSamePoint: "上一期同一時間點",
      thisPeriod: ({ change }) => `這期 ${change}`,
      lastPeriodTotal: "上一期整期",
      runsOut: "內含額度用完",
      notThisPeriod: "這期不會",
      storedNow: "現在存了",
      periodAverage: "這期平均，計費看這個",
      perDay: ({ days }) => `最近 ${days} 天，每天`,
      unchanged: "沒有變化",
      grew: ({ amount }) => `增加 ${amount}`,
      shrank: ({ amount }) => `減少 ${amount}`,
      storedAtEnd: "期末會存到",
      endOfLastPeriod: "上一期結束時",
      storedPasses: "存量超過內含額度",
      notWithinYear: "一年內不會",
      notGrowing: "沒有在增加",
      today: "今天",
      dailyAverage: ({ days }) => `最近 ${days} 天，平均每天`,
      busiestDay: ({ day }) => `這期最高的一天（${day}）`,
      daysOver: "這期超過每日額度",
      dayCount: ({ count }) => `${count} 天`,
      none: "沒有",
      overage: "預估超額費用",
      costThisPeriod: "這期預估費用",
    },
    breakdown: {
      now: "現在",
      thisPeriod: "這期",
      share: "佔比",
      againstDaysAgo: ({ days }) => `比 ${days} 天前`,
      againstDaysBefore: ({ days }) => `近 ${days} 天比前 ${days} 天`,
      appeared: "新出現",
      perRequest: ({ ms }) => `每次請求 ${ms} ms`,
      failed: ({ share }) => `${share} 出錯`,
      other: "其他",
      more: ({ count }) => `另外 ${count} 個`,
    },
    daily: {
      summary: "每天的數字",
      date: "日期",
      thatDay: "當天",
      stored: "存量",
      running: "累計",
    },
  },

  chart: {
    thisPeriod: "這期",
    projected: "預估",
    lastPeriod: "上一期",
    allowance: "內含額度",
    keys: ({ metric }) => `${label(metric)}，左右方向鍵逐日查看`,
    running: "累計",
    thatDay: "當天",
    sameDayLastPeriod: "上一期同一天",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}，第 ${day}／${days} 天`,
    renewal: { before: "每月", after: "號續約" },
  },

  topbar: {
    accounts: "帳號",
    accountTone: { ok: null, watch: "（接近上限）", over: "（超額）" },
    updating: "更新中",
    noData: "還沒有資料",
    updated: ({ ago }) => `${ago}更新`,
    refresh: "更新",
  },

  app: {
    loading: "讀取中",
    loadFailed: "資料沒載入成功，重新整理再試一次。",
    noAccounts: "還沒有設定 Cloudflare 帳號。",
    refreshFailed: ({ reason }) => (reason === null ? "用量沒更新成功。" : `用量沒更新成功：${reason}`),
    unreachable: "連不上 Cloudflare。",
    retry: "再試一次",
    renewalNotSaved: ({ day }) =>
      day === null ? "續約日沒存成功，請再試一次。" : `續約日沒存成功，已改回 ${day} 號，請再試一次。`,
    firstRead: "第一次讀取用量，大約十秒。",
    noData: "還沒有用量資料。",
  },

  footer: {
    estimate: "用量是 Cloudflare Analytics 的估計值，和帳單會有些微差距，也沒有算進 Pages Functions 的 CPU 時間。",
    prices: { before: "額度與價格是 2026 年 10 月 9 日 ", between: " 與 ", after: " 的牌價。" },
    json: { before: "同一份數字的 JSON：", between: "、", all: "全部帳號" },
    agent: { before: "給 agent 用的 MCP 位址是 ", after: "。" },
    signOut: "登出",
  },

  setup: {
    title: "帳單每月幾號續約？",
    lead: "用量從每個月的那一天開始算。日期在 Cloudflare dashboard 的 Manage Account → Billing → Subscriptions，Workers Paid 那一列。",
    save: "儲存",
  },

  alerts: {
    title: "警告",
    lead: "每天檢查四次。同一個產品每變嚴重一級只通知一次，不會每次檢查都通知。",
    when: "這些時候通知我",
    events: {
      willExceed: "有產品照目前速度這期會超額",
      exceeded: "有產品已經超額",
      watch: "有產品照目前速度會用到額度的 80%",
      token: "API token 失效",
    },
    ntfy: {
      url: "ntfy topic 位址",
      hint: "例如 https://ntfy.sh/只有你知道的名稱。知道 topic 的人都讀得到。",
      token: "存取 token",
    },
    webhook: {
      url: "Webhook 位址",
      hint: "有事要通知你的時候，會收到一則 JSON POST。",
      secret: "簽章密鑰",
    },
    optional: "選填",
    kept: "已儲存，輸入新的就會取代。",
    save: "儲存",
    saved: "已儲存。",
    notSaved: "警告設定沒存成功，請再試一次。",
    invalidAddress: ({ channel }) => `${channel} 的位址要以 https:// 開頭；ntfy 的結尾要是 topic 名稱。`,
    test: "送一則測試",
    noChannel: "先填 ntfy topic 或 webhook 並儲存。",
    delivered: ({ channel }) => `${channel}：已送達。`,
    failed: ({ channel, status }) => (status === null ? `${channel}：連不上。` : `${channel}：被拒絕（${status}）。`),
    close: "關閉",
    testTitle: "來自用量頁面的測試",
    testBody: "警告會送到這裡。",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `用第 ${token} 個 API token 連不上 Cloudflare。`;
    if (status === 200) return `第 ${token} 個 API token 可以用，但看不到任何帳號。`;
    return `Cloudflare 拒絕了第 ${token} 個 API token（${status}）。確認它有 Account Analytics: Read 權限，而且還沒過期。`;
  },

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `無法取得 Workers AI 的用量（${w.reason}）`;
      case "clipped":
        return glue(
          w.datasets.map((name) => datasets[name]).join("、"),
          "的用量資料不完整，實際用量比顯示的多",
        );
      case "r2-unknown":
        return `R2 有無法歸類的操作（${w.actions.join("、")}），沒有算進用量`;
      case "stale":
        return "最近一次更新沒有成功，這是上一次的數字";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics 回傳了錯誤。",
    "unknown-account": "找不到這個帳號，重新整理頁面再試一次。",
    "no-token": "這個帳號沒有設定 Cloudflare API token。",
    "invalid-request": "這個請求沒有被接受，重新整理頁面再試一次。",
    "rate-limited": "請求太頻繁了，等一分鐘再試。",
    unauthenticated: "登入狀態失效了，請重新登入。",
    unavailable: "服務暫時無法使用，稍後再試一次。",
    unknown: "出了點問題，再試一次。",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics 回傳了錯誤（${detail}）。`,
};
