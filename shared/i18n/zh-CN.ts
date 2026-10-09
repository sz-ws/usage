import type { MetricId } from "../catalog";
import { glue } from "../format";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Workers 请求",
    short: "请求",
    note: "包含 Pages Functions。静态资源的请求不计入。",
  },
  "workers.cpuMs": { label: "Workers CPU 时间", short: "CPU 时间" },
  "d1.rowsRead": { label: "D1 读取行数", short: "读取行数" },
  "d1.rowsWritten": { label: "D1 写入行数", short: "写入行数" },
  "d1.storage": { label: "D1 存储", short: "存储" },
  "kv.reads": { label: "KV 读取", short: "读取" },
  "kv.writes": { label: "KV 写入", short: "写入" },
  "kv.deletes": { label: "KV 删除", short: "删除" },
  "kv.lists": { label: "KV 列表请求", short: "列表" },
  "kv.storage": { label: "KV 存储", short: "存储" },
  "r2.classA": {
    label: "R2 Class A 操作",
    short: "Class A",
    note: "写入或列出对象的操作，例如上传、列出和复制。",
  },
  "r2.classB": {
    label: "R2 Class B 操作",
    short: "Class B",
    note: "读取类操作，例如获取对象或其元数据。",
  },
  "r2.storage": { label: "R2 存储", short: "存储" },
  "r2ia.classA": {
    label: "R2 Infrequent Access Class A 操作",
    short: "Class A",
    note: "Infrequent Access 没有套餐内额度，每次操作都计费。",
  },
  "r2ia.classB": {
    label: "R2 Infrequent Access Class B 操作",
    short: "Class B",
    note: "Infrequent Access 没有套餐内额度，每次操作都计费。",
  },
  "r2ia.storage": {
    label: "R2 Infrequent Access 存储",
    short: "存储",
    note: "Infrequent Access 没有套餐内额度，每个字节的存储都计费。",
  },
  "do.requests": { label: "Durable Objects 请求", short: "请求" },
  "do.duration": { label: "Durable Objects 时长", short: "时长" },
  "do.rowsRead": { label: "Durable Objects 读取行数", short: "读取行数" },
  "do.rowsWritten": { label: "Durable Objects 写入行数", short: "写入行数" },
  "do.storage": { label: "Durable Objects 存储", short: "存储" },
  "queues.operations": { label: "Queues 操作", short: "操作" },
  "ai.neurons": {
    label: "Workers AI Neurons",
    short: "Neurons",
    note: "每天包含 10,000 Neurons。计数按 UTC 00:00 重置，超出的用量计费。",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "D1 存储",
  kv: "KV",
  kvs: "KV 存储",
  r2: "R2",
  r2s: "R2 存储",
  doi: "Durable Objects 请求",
  dop: "Durable Objects",
  doq: "Durable Objects 存储",
  queues: "Queues",
  ai: "Workers AI",
};

const label = (id: MetricId): string => metrics[id].label;

function labels(ids: readonly MetricId[]): string {
  const all = ids.map(label);
  return all.length <= 2
    ? all.join("、")
    : glue(all.slice(0, 2).join("、"), "等", String(all.length), "项");
}

const FINE = "本账期不会超额";

export const zhCN: Messages = {
  title: "Cloudflare 用量",
  language: "语言",

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
    database: "数据库",
    namespace: "命名空间",
    bucket: "存储桶",
    queue: "队列",
    model: "模型",
  },
  datasets,

  outlook: { cycle: "账期末预估", level: "账期平均", daily: "今天" },
  status: {
    exceeded: "已超额",
    "will-exceed": "会超额",
    watch: "接近上限",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(""),

  day: ({ month, day }) => `${month} 月 ${day} 日`,
  shortDay: ({ month, day }) => `${month}/${day}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0 小时";
    if (days === 0) return hours === 0 ? "不到 1 小时" : `${hours} 小时`;
    return hours === 0 ? `${days} 天` : `${days} 天 ${hours} 小时`;
  },
  ago: {
    justNow: "刚刚",
    minutes: ({ count }) => `${count} 分钟前`,
    hours: ({ count }) => `${count} 小时前`,
    days: ({ count }) => `${count} 天前`,
  },
  change: {
    flat: "持平",
    times: ({ multiple }) => `${multiple} 倍`,
  },

  names: {
    other: "其他",
    unattributed: "未归属的请求",
    pages: ({ name }) => `${name}（Pages）`,
  },

  headline: {
    renewal: ({ day, left }) => glue(day, "续费，还有", left, "。"),
    noUsage: "本账期还没有用量。",
    cost: ({ usd }) => glue("预估超额费用", usd, "。"),
    over: ({ metrics: ids }) => glue(labels(ids), "已经超过套餐内额度。"),
    overDaily: ({ metrics: ids }) => glue(labels(ids), "本账期有几天超过每日额度。"),
    alsoOver: ({ metrics: ids }) => glue(labels(ids), "也会在本账期超过套餐内额度。"),
    runsOutOn: ({ metric, day }) => glue(label(metric), "的套餐内额度会在", day, "用完。"),
    willGoOver: ({ metric }) => glue(label(metric), "在本账期会超过套餐内额度。"),
    fine: `${FINE}。`,
    fineBut: {
      cycle: ({ metric, share }) => `${FINE}，${glue(label(metric), "会用到额度的", share, "。")}`,
      level: ({ metric, share }) => `${FINE}，${glue(label(metric), "的账期平均会占额度的", share, "。")}`,
      daily: ({ metric, share }) => `${FINE}，${glue(label(metric), "一天会用到每日额度的", share, "。")}`,
    },
    closest: {
      cycle: ({ metric, share }) => glue("最接近上限的是", label(metric), "，账期末预估会用到额度的", share, "。"),
      level: ({ metric, share }) => glue("最接近上限的是", label(metric), "，账期平均占额度的", share, "。"),
      daily: ({ metric, share }) =>
        glue("最接近上限的是", label(metric), "，一天大约用掉每日额度的", share, "。"),
    },
  },

  findings: {
    heading: "要点",
    tone: { over: "超额：", watch: "关注：", note: "补充：" },
    share: ({ metric, name, share, msPerRequest }) => {
      const text = glue(name, "占了", label(metric), "的", share);
      return msPerRequest === null ? `${text}。` : `${glue(text, "，平均每次请求", `${msPerRequest} ms`)}。`;
    },
    surge: ({ metric, days, change, grower }) => {
      const who = grower === null ? "" : glue("，增长最多的是", grower);
      return glue(label(metric), "最近", String(days), "天是前", String(days), "天的", change, who, "。");
    },
    spike: ({ metric, day, change, amount }) =>
      glue(day, "的", label(metric), "是平常一天的", change, `（${amount}）。`),
    errors: ({ name, days, share, count }) =>
      glue("最近", String(days), "天，", name, "的请求有", share, "失败（", count, "次）。"),
    storedOver: ({ metric }) =>
      glue(label(metric), "的存量已经超过套餐内额度，本账期的平均还没有。保持这个水平，下个账期会开始计费。"),
    storedWillPass: ({ metric, day }) =>
      glue("按最近的增长速度，", label(metric), "的存量会在", day, "超过套餐内额度。"),
    periodTimes: ({ metric, change }) => glue(label(metric), "是上个账期同一时间点的", change, "。"),
    periodDiff: ({ metric, percent, more }) =>
      glue(label(metric), more ? "比上个账期同一时间点多" : "比上个账期同一时间点少", percent, "。"),
    daysOver: ({ metric, days, usd }) =>
      glue(label(metric), "本账期有", String(days), "天超过每日额度，超出的部分大约", usd, "。"),
    busiestDay: ({ metric, day, share }) =>
      glue(label(metric), "本账期最高的一天是", day, "，用到每日额度的", share, "。"),
    metered: ({ metric, usd }) => glue(label(metric), "没有套餐内额度，本账期大约", usd, "。"),
  },

  metricList: {
    heading: "用量",
    figures: ({ used, allowance }) => `${used} ／ ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} ／ 每天 ${allowance}`,
    cost: "本账期费用",
    more: ({ count, others }) => (others ? `另外 ${count} 项都不到 1%` : `${count} 项，都不到 1%`),
    unused: ({ days, metrics: ids }) => glue("这", String(days), "天没有用到：", ids.map(label).join("、")),
    row: ({ metric, figures, caption, value }) => `${label(metric)}，${figures}，${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `已用 ${used}，账期末预估 ${projected}`,
    level: ({ used, projected }) => `现在存量是额度的 ${used}，账期平均 ${projected}`,
    daily: ({ used }) => `今天用了每日额度的 ${used}`,
  },

  detail: {
    pane: ({ metric }) => glue(label(metric), "的明细"),
    price: {
      perGbMonth: ({ usd, extra }) => `${extra ? "超出后" : ""}每 GB 每月 ${usd}`,
      per: ({ usd, units, extra }) => `${extra ? "超出后" : ""}每 ${units} ${usd}`,
    },
    facts: {
      soFar: "本账期到现在",
      periodEndAtPace: ({ days }) => `按最近 ${days} 天的速度，账期末`,
      lastPeriodSamePoint: "上个账期同一时间点",
      thisPeriod: ({ change }) => `本账期 ${change}`,
      lastPeriodTotal: "上个账期合计",
      runsOut: "套餐内额度用完",
      notThisPeriod: "本账期不会",
      storedNow: "现在存量",
      periodAverage: "账期平均，按此计费",
      perDay: ({ days }) => `最近 ${days} 天，每天`,
      unchanged: "没有变化",
      grew: ({ amount }) => `增加 ${amount}`,
      shrank: ({ amount }) => `减少 ${amount}`,
      storedAtEnd: "账期末存量",
      endOfLastPeriod: "上个账期结束时",
      storedPasses: "存量超过套餐内额度",
      notWithinYear: "一年内不会",
      notGrowing: "没有增长",
      today: "今天",
      dailyAverage: ({ days }) => `最近 ${days} 天，平均每天`,
      busiestDay: ({ day }) => `本账期最高的一天（${day}）`,
      daysOver: "本账期超过每日额度",
      dayCount: ({ count }) => `${count} 天`,
      none: "没有",
      overage: "预估超额费用",
      costThisPeriod: "本账期预估费用",
    },
    breakdown: {
      now: "现在",
      thisPeriod: "本账期",
      share: "占比",
      againstDaysAgo: ({ days }) => `比 ${days} 天前`,
      againstDaysBefore: ({ days }) => `近 ${days} 天比前 ${days} 天`,
      appeared: "新出现",
      perRequest: ({ ms }) => `每次请求 ${ms} ms`,
      failed: ({ share }) => `${share} 失败`,
      other: "其他",
      more: ({ count }) => `另外 ${count} 个`,
    },
    daily: {
      summary: "每天的数字",
      date: "日期",
      thatDay: "当天",
      stored: "存量",
      running: "累计",
    },
  },

  chart: {
    thisPeriod: "本账期",
    projected: "预估",
    lastPeriod: "上个账期",
    allowance: "套餐内额度",
    keys: ({ metric }) => `${label(metric)}。用左右方向键逐日查看。`,
    running: "累计",
    thatDay: "当天",
    sameDayLastPeriod: "上个账期同一天",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}，第 ${day}／${days} 天`,
    renewal: { before: "每月", after: "号续费" },
  },

  topbar: {
    accounts: "账户",
    accountTone: { ok: null, watch: "（接近上限）", over: "（超额）" },
    updating: "刷新中",
    noData: "还没有数据",
    updated: ({ ago }) => `${ago}更新`,
    refresh: "刷新",
  },

  app: {
    loading: "加载中",
    loadFailed: "数据没有加载成功，请刷新页面再试一次。",
    noAccounts: "还没有设置 Cloudflare 账户。",
    refreshFailed: ({ reason }) => (reason === null ? "用量没有更新成功。" : `用量没有更新成功：${reason}`),
    unreachable: "无法连接 Cloudflare。",
    retry: "再试一次",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "续费日没有保存成功，请再试一次。"
        : `续费日没有保存成功，已改回每月 ${day} 号，请再试一次。`,
    firstRead: "第一次读取用量，大约需要十秒。",
    noData: "还没有用量数据。",
  },

  footer: {
    estimate:
      "用量是 Cloudflare Analytics 的估算值，和账单会有些微差距，也没有计入 Pages Functions 的 CPU 时间。",
    prices: { before: "额度和价格是 2026 年 10 月 9 日的 ", between: " 与 ", after: " 标价。" },
    json: { before: "同样的数字以 JSON 提供：", between: "、", all: "全部账户" },
    agent: { before: "给智能体用的 MCP 地址是 ", after: "。" },
    signOut: "退出登录",
  },

  setup: {
    title: "账单每月几号续费？",
    lead: "用量从每个月的这一天开始计算。这个日期在 Cloudflare 控制台的 Manage Account → Billing → Subscriptions 里，Workers Paid 那一行。",
    save: "保存",
  },

  alerts: {
    title: "提醒",
    lead: "每天检查四次。同一个产品每变严重一级只通知一次，不会每次检查都通知。",
    when: "出现以下情况时通知我",
    events: {
      willExceed: "某个产品按目前速度本账期会超额",
      exceeded: "某个产品已经超额",
      watch: "某个产品按目前速度会超过额度的 80%",
      token: "某个 API token 失效",
    },
    ntfy: {
      url: "ntfy 主题地址",
      hint: "例如 https://ntfy.sh/只有你知道的名字。知道主题的人都能读到。",
      token: "访问令牌",
    },
    webhook: {
      url: "Webhook 地址",
      hint: "有事要通知你时，会收到一个 JSON POST 请求。",
      secret: "签名密钥",
    },
    optional: "选填",
    kept: "已保存。输入新的即可替换。",
    save: "保存",
    saved: "已保存。",
    notSaved: "提醒设置没有保存成功，请再试一次。",
    invalidAddress: ({ channel }) => `${channel} 的地址必须以 https:// 开头；ntfy 的地址要以主题名结尾。`,
    test: "发送测试",
    noChannel: "先填写 ntfy 主题或 Webhook 地址，然后保存。",
    delivered: ({ channel }) => `${channel}：已送达。`,
    failed: ({ channel, status }) =>
      status === null ? `${channel}：无法连接。` : `${channel}：被拒绝（${status}）。`,
    close: "关闭",
    testTitle: "来自用量页面的测试",
    testBody: "提醒会发送到这里。",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `无法用第 ${token} 个 API token 连接 Cloudflare。`;
    if (status === 200) return `第 ${token} 个 API token 可以用，但看不到任何账户。`;
    return `Cloudflare 拒绝了第 ${token} 个 API token（${status}）。请确认它有 Account Analytics: Read 权限，并且没有过期。`;
  },

  reconnect: "重新连接",

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `无法读取 Workers AI 的用量（${w.reason}）。`;
      case "clipped":
        return glue(
          w.datasets.map((name) => datasets[name]).join("、"),
          "的用量数据不完整，实际用量比显示的多。",
        );
      case "r2-unknown":
        return `有些 R2 操作无法归为 Class A 或 Class B，没有计入用量：${w.actions.join("、")}。`;
      case "stale":
        return "最近一次更新没有成功，这是上一次的数据。";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics 返回了错误。",
    "unknown-account": "找不到这个账户，请刷新页面再试一次。",
    "no-token": "这个账户没有设置 Cloudflare API token。",
    "invalid-request": "请求没有被接受，请刷新页面再试一次。",
    "rate-limited": "请求太频繁了，请等一分钟再试。",
    unauthenticated: "登录状态已过期，请重新登录。",
    reconnect: "Cloudflare 不再接受这个页面的授权，用量已经停止更新。",
    unavailable: "服务暂时不可用，请稍后再试。",
    unknown: "出了点问题，请再试一次。",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics 返回了错误（${detail}）。`,
};
