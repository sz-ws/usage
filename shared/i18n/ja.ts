import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Workers リクエスト",
    short: "リクエスト",
    note: "Pages Functionsを含みます。静的アセットへのリクエストはカウントされません。",
  },
  "workers.cpuMs": { label: "Workers CPU 時間", short: "CPU 時間" },
  "d1.rowsRead": { label: "D1 読み取り行数", short: "読み取り行数" },
  "d1.rowsWritten": { label: "D1 書き込み行数", short: "書き込み行数" },
  "d1.storage": { label: "D1 ストレージ", short: "ストレージ" },
  "kv.reads": { label: "KV 読み取り", short: "読み取り" },
  "kv.writes": { label: "KV 書き込み", short: "書き込み" },
  "kv.deletes": { label: "KV 削除", short: "削除" },
  "kv.lists": { label: "KV 一覧取得リクエスト", short: "一覧取得" },
  "kv.storage": { label: "KV ストレージ", short: "ストレージ" },
  "r2.classA": {
    label: "R2 Class A 操作",
    short: "Class A",
    note: "書き込みや一覧取得を伴う操作です。アップロード、一覧取得、コピーなどが該当します。",
  },
  "r2.classB": {
    label: "R2 Class B 操作",
    short: "Class B",
    note: "データを読み取る操作です。オブジェクトやそのメタデータの取得などが該当します。",
  },
  "r2.storage": { label: "R2 ストレージ", short: "ストレージ" },
  "r2ia.classA": {
    label: "R2 Infrequent Access Class A 操作",
    short: "Class A",
    note: "Infrequent Accessにはプランの枠がなく、すべての操作が課金されます。",
  },
  "r2ia.classB": {
    label: "R2 Infrequent Access Class B 操作",
    short: "Class B",
    note: "Infrequent Accessにはプランの枠がなく、すべての操作が課金されます。",
  },
  "r2ia.storage": {
    label: "R2 Infrequent Access ストレージ",
    short: "ストレージ",
    note: "Infrequent Accessにはプランの枠がなく、保存されているすべてのバイトが課金されます。",
  },
  "do.requests": { label: "Durable Objects リクエスト", short: "リクエスト" },
  "do.duration": { label: "Durable Objects 稼働時間", short: "稼働時間" },
  "do.rowsRead": { label: "Durable Objects 読み取り行数", short: "読み取り行数" },
  "do.rowsWritten": { label: "Durable Objects 書き込み行数", short: "書き込み行数" },
  "do.storage": { label: "Durable Objects ストレージ", short: "ストレージ" },
  "queues.operations": { label: "Queues 操作", short: "操作" },
  "ai.neurons": {
    label: "Workers AI ニューロン",
    short: "ニューロン",
    note: "毎日10,000ニューロンまで含まれます。カウントはUTCの0時にリセットされ、それを超えた分が課金されます。",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "D1 ストレージ",
  kv: "KV",
  kvs: "KV ストレージ",
  r2: "R2",
  r2s: "R2 ストレージ",
  doi: "Durable Objects リクエスト",
  dop: "Durable Objects",
  doq: "Durable Objects ストレージ",
  queues: "Queues",
  ai: "Workers AI",
};

const label = (id: MetricId): string => metrics[id].label;

/** "A", "A、B", or "A、Bほか2件". */
function labels(ids: readonly MetricId[]): string {
  const all = ids.map(label);
  return all.length <= 2 ? all.join("、") : `${all.slice(0, 2).join("、")}ほか${all.length - 2}件`;
}

const FINE = "今期は超過しない見込みです";

export const ja: Messages = {
  title: "Cloudflare 使用量",
  language: "言語",

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
    database: "データベース",
    namespace: "ネームスペース",
    bucket: "バケット",
    queue: "キュー",
    model: "モデル",
  },
  datasets,

  outlook: { cycle: "期末予測", level: "期間平均", daily: "今日" },
  status: {
    exceeded: "超過",
    "will-exceed": "超過の見込み",
    watch: "枠に近い",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(""),

  day: ({ month, day }) => `${month}月${day}日`,
  shortDay: ({ month, day }) => `${month}/${day}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0時間";
    if (days === 0) return hours === 0 ? "1時間未満" : `${hours}時間`;
    return hours === 0 ? `${days}日` : `${days}日${hours}時間`;
  },
  ago: {
    justNow: "たった今",
    minutes: ({ count }) => `${count}分前`,
    hours: ({ count }) => `${count}時間前`,
    days: ({ count }) => `${count}日前`,
  },
  change: {
    flat: "横ばい",
    times: ({ multiple }) => `${multiple}倍`,
  },

  names: {
    other: "その他",
    unattributed: "特定できないリクエスト",
    pages: ({ name }) => `${name}（Pages）`,
  },

  headline: {
    renewal: ({ day, left }) => `${day}に更新、残り${left}。`,
    noUsage: "今期はまだ使用量がありません。",
    cost: ({ usd }) => `推定超過料金は${usd}です。`,
    over: ({ metrics: ids }) => `${labels(ids)}はプランの枠を超えています。`,
    overDaily: ({ metrics: ids }) => `${labels(ids)}は今期、1日の枠を超えた日がありました。`,
    alsoOver: ({ metrics: ids }) => `${labels(ids)}も今期中に枠を超える見込みです。`,
    runsOutOn: ({ metric, day }) => `${label(metric)}のプランの枠は${day}に使い切る見込みです。`,
    willGoOver: ({ metric }) => `${label(metric)}は今期、プランの枠を超える見込みです。`,
    fine: `${FINE}。`,
    fineBut: {
      cycle: ({ metric, share }) => `${FINE}が、${label(metric)}は期末に枠の${share}に達する見込みです。`,
      level: ({ metric, share }) => `${FINE}が、${label(metric)}の期間平均は枠の${share}になる見込みです。`,
      daily: ({ metric, share }) => `${FINE}が、${label(metric)}は1日の枠の${share}に達する見込みです。`,
    },
    closest: {
      cycle: ({ metric, share }) => `最も枠に近いのは${label(metric)}で、期末予測は${share}です。`,
      level: ({ metric, share }) => `最も枠に近いのは${label(metric)}で、期間平均は${share}です。`,
      daily: ({ metric, share }) => `最も枠に近いのは${label(metric)}で、1日の枠の約${share}を使っています。`,
    },
  },

  findings: {
    heading: "要点",
    tone: { over: "超過：", watch: "注意：", note: "補足：" },
    share: ({ metric, name, share, stored, msPerRequest }) => {
      if (stored) return `${label(metric)}のうち${share}は${name}にあります。`;
      const from = `${label(metric)}のうち${share}は${name}からのもの`;
      return msPerRequest === null
        ? `${from}です。`
        : `${from}で、1リクエストあたり平均${msPerRequest} msです。`;
    },
    surge: ({ metric, days, change, grower }) => {
      const first = `${label(metric)}の直近${days}日間は、その前の${days}日間と比べて${change}でした。`;
      return grower === null ? first : `${first}増加が最も大きかったのは${grower}です。`;
    },
    spike: ({ metric, day, change, amount }) =>
      `${day}の${label(metric)}は、通常の1日と比べて${change}でした（${amount}）。`,
    errors: ({ name, days, share, count }) =>
      `${name}へのリクエストのうち${share}が、直近${days}日間で失敗しました（${count}件）。`,
    storedOver: ({ metric }) =>
      `${label(metric)}は現在、プランの枠を超えていますが、今期の期間平均はまだ超えていません。この水準が続くと、次期から課金されます。`,
    storedWillPass: ({ metric, day }) => `直近の増加ペースでいくと、${label(metric)}は${day}にプランの枠を超えます。`,
    periodTimes: ({ metric, change }) => `${label(metric)}は前期の同じ時点と比べて${change}です。`,
    periodDiff: ({ metric, percent, more }) =>
      `${label(metric)}は前期の同じ時点より${percent}${more ? "多い" : "少ない"}です。`,
    daysOver: ({ metric, days, usd }) =>
      `${label(metric)}は今期、1日の枠を超えた日が${days}日ありました。超過分は約${usd}です。`,
    busiestDay: ({ metric, day, share }) =>
      `今期の${label(metric)}が最も多かった日は${day}で、1日の枠の${share}でした。`,
    metered: ({ metric, usd }) => `${label(metric)}にはプランの枠がないため、今期の費用は約${usd}です。`,
  },

  metricList: {
    heading: "使用量",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / 1日${allowance}`,
    cost: "今期の費用",
    more: ({ count, others }) => {
      if (others) return count === 1 ? "ほか1件は1%未満" : `ほか${count}件はいずれも1%未満`;
      return count === 1 ? "使用中の1件は1%未満" : `使用中の${count}件はいずれも1%未満`;
    },
    unused: ({ days, metrics: ids }) => `直近${days}日は使用がありません：${ids.map(label).join("、")}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}、${figures}、${caption}：${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `${used}使用済み、期末予測は${projected}`,
    level: ({ used, projected }) => `現在の保存量は枠の${used}、期間平均は${projected}`,
    daily: ({ used }) => `今日は1日の枠の${used}を使用済み`,
  },

  detail: {
    pane: ({ metric }) => `${label(metric)}の詳細`,
    price: {
      perGbMonth: ({ usd, extra }) => `${extra ? "超過分は" : ""}GB-monthあたり${usd}`,
      per: ({ usd, units, extra }) => `${extra ? "超過分は" : ""}${units}あたり${usd}`,
    },
    facts: {
      soFar: "今期はここまで",
      periodEndAtPace: ({ days }) => `期末（${days}日ペース）`,
      lastPeriodSamePoint: "前期の同じ時点",
      thisPeriod: ({ change }) => `前期同時点比${change}`,
      lastPeriodTotal: "前期の合計",
      runsOut: "枠を使い切る日",
      notThisPeriod: "今期中はなし",
      storedNow: "現在の保存量",
      periodAverage: "期間平均（課金基準）",
      perDay: ({ days }) => `直近${days}日、1日あたり`,
      unchanged: "変化なし",
      grew: ({ amount }) => `${amount}増加`,
      shrank: ({ amount }) => `${amount}減少`,
      storedAtEnd: "期末の保存量",
      endOfLastPeriod: "前期末時点",
      storedPasses: "枠を超える見込み日",
      notWithinYear: "1年以内はなし",
      notGrowing: "増加なし",
      today: "今日",
      dailyAverage: ({ days }) => `直近${days}日、1日平均`,
      busiestDay: ({ day }) => `今期の最多日（${day}）`,
      daysOver: "1日の枠を超えた日数",
      dayCount: ({ count }) => `${count}日`,
      none: "なし",
      overage: "推定超過料金",
      costThisPeriod: "今期の推定費用",
    },
    breakdown: {
      now: "現在",
      thisPeriod: "使用量",
      share: "割合",
      againstDaysAgo: ({ days }) => `${days}日前比`,
      againstDaysBefore: ({ days }) => `直前${days}日比`,
      appeared: "新規",
      perRequest: ({ ms }) => `1リクエストあたり${ms} ms`,
      failed: ({ share }) => `${share}失敗`,
      other: "その他",
      more: ({ count: rest }) => `他${rest}件`,
    },
    daily: {
      summary: "日ごとの数値",
      date: "日付",
      thatDay: "1日分",
      stored: "保存量",
      running: "累計",
    },
  },

  chart: {
    thisPeriod: "今期",
    projected: "予測",
    lastPeriod: "前期",
    allowance: "プランの枠",
    keys: ({ metric }) => `${label(metric)}。左右の矢印キーで日付を移動できます。`,
    running: "累計",
    thatDay: "その日",
    sameDayLastPeriod: "前期の同じ日",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}〜${end}、${days}日中${day}日目`,
    renewal: { before: "毎月", after: "日に更新" },
  },

  topbar: {
    accounts: "アカウント",
    accountTone: { ok: null, watch: "（枠に近い）", over: "（超過）" },
    updating: "更新中",
    noData: "データなし",
    // Beside the refresh control the time alone says enough, as it does in en.
    updated: ({ ago }) => `${ago}更新`,
    refresh: "更新",
  },

  app: {
    loading: "読み込み中",
    loadFailed: "データを読み込めませんでした。ページを再読み込みしてください。",
    noAccounts: "Cloudflare アカウントがまだ設定されていません。",
    refreshFailed: ({ reason }) =>
      reason === null ? "使用量を更新できませんでした。" : `使用量を更新できませんでした。${reason}`,
    unreachable: "Cloudflareに接続できませんでした。",
    retry: "もう一度試す",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "更新日を保存できませんでした。もう一度試してください。"
        : `更新日を保存できなかったため、${day}日のままです。もう一度試してください。`,
    firstRead: "初めて使用量を読み取っています。約10秒かかります。",
    noData: "使用量のデータはまだありません。",
  },

  footer: {
    estimate:
      "使用量はCloudflare Analyticsの推定値で、請求額とわずかに異なることがあります。Pages FunctionsのCPU時間は含まれていません。",
    prices: { before: "枠と価格は2026年10月9日時点の", between: "と", after: "の掲載料金です。" },
    json: { before: "同じ数字のJSON：", between: "、", all: "すべてのアカウント" },
    agent: { before: "エージェント向けのMCP アドレスは", after: "です。" },
    signOut: "ログアウト",
  },

  setup: {
    title: "請求は毎月何日に更新されますか？",
    lead: "使用量は毎月その日から数えます。日付は Cloudflare ダッシュボードの「Manage Account → Billing → Subscriptions」で、Workers Paidの横に表示されています。",
    save: "保存",
  },

  alerts: {
    title: "通知設定",
    lead: "1日4回確認します。状態が悪くなったときに1回だけ通知し、確認のたびに届くことはありません。",
    when: "通知するタイミング",
    events: {
      willExceed: "今期中に、いずれかのサービスが枠を超える見込みになったとき",
      exceeded: "いずれかのサービスが枠を超えたとき",
      watch: "いずれかのサービスがプランの枠の80%を超える見込みになったとき",
      token: "API トークンが使えなくなったとき",
    },
    ntfy: {
      url: "ntfy トピックアドレス",
      hint: "例：https://ntfy.sh/a-name-only-you-know。トピックを知っている人なら誰でも読めます。",
      token: "アクセストークン",
    },
    webhook: {
      url: "Webhook アドレス",
      hint: "お知らせがあるときにJSON POSTを受け取ります。",
      secret: "署名用シークレット",
    },
    optional: "任意",
    kept: "保存済みです。入力すると置き換えます。",
    save: "保存",
    saved: "保存しました。",
    notSaved: "通知設定を保存できませんでした。もう一度試してください。",
    invalidAddress: ({ channel }) =>
      `${channel}のアドレスはhttps://で始まる必要があります。ntfyの場合は、末尾にトピック名が必要です。`,
    test: "テストを送る",
    noChannel: "先にntfyのトピックかWebhookを追加して、保存してください。",
    delivered: ({ channel }) => `${channel}：届きました。`,
    failed: ({ channel, status }) =>
      status === null ? `${channel}：接続できませんでした。` : `${channel}：拒否されました（${status}）。`,
    close: "閉じる",
    testTitle: "使用量ページからのテスト",
    testBody: "通知はここに届きます。",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `API トークン（${token}番目）でCloudflareに接続できませんでした。`;
    if (status === 200) return `API トークン（${token}番目）は使えますが、アカウントが1つも見えません。`;
    return `API トークン（${token}番目）をCloudflareが拒否しました（${status}）。「Account Analytics: Read」の権限があり、期限切れでないか確認してください。`;
  },

  reconnect: "再接続",
  about: "このページについて",

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `Workers AIの使用量を読み取れませんでした（${w.reason}）。`;
      case "clipped":
        return `${w.datasets.map((name) => datasets[name]).join("、")}の使用量データが不完全なため、実際の使用量は表示より多くなっています。`;
      case "r2-unknown":
        return `Class AとClass Bのどちらにも分類できないR2 操作は集計していません：${w.actions.join(", ")}。`;
      case "stale":
        return "直近の更新に失敗しました。表示している数字は、その前の更新時のものです。";
    }
  },

  errors: {
    analytics: "Cloudflare Analyticsがエラーを返しました。",
    "unknown-account": "このアカウントは利用できなくなりました。ページを再読み込みしてください。",
    "no-token": "このアカウントにはCloudflare API トークンが設定されていません。",
    "invalid-request": "リクエストが受け付けられませんでした。ページを再読み込みして、もう一度試してください。",
    "rate-limited": "リクエストが多すぎます。1分待ってから、もう一度試してください。",
    unauthenticated: "ログインの有効期限が切れました。もう一度ログインしてください。",
    reconnect: "Cloudflareがこのページのログインを受け付けなくなったため、数字の更新が止まっています。",
    unavailable: "現在サービスを利用できません。しばらくしてから、もう一度試してください。",
    unknown: "問題が発生しました。もう一度試してください。",
  },
  analyticsError: ({ detail }) => `Cloudflare Analyticsがエラーを返しました（${detail}）。`,
};
