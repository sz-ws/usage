import type { MetricId } from "../catalog";
import type { DatasetName } from "../types";
import type { Messages, MetricText } from "./messages";

/**
 * Korean particles change with the sound a word ends in. The helpers below pick
 * them for metric labels, which are fixed text. Figures and names from the API
 * are never followed by a particle: sentences put 의, 에, 에서 or 입니다 after
 * them, and those do not change.
 */

/** Whether a word's last sound is a consonant. Digits and capital letters read as Korean numbers and letter names. */
function endsInConsonant(word: string): boolean {
  const last = word.trimEnd().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // 영 일 삼 육 칠 팔 end in a consonant; 이 사 오 구 do not.
  if (/[013678]/.test(last)) return true;
  if (/[0-9]/.test(last)) return false;
  // 에프 엘 엠 엔 알 에스 엑스 end in a consonant. Other capitals, and lowercase words, end in a vowel.
  return /[FLMNRSX]/.test(last);
}

const topic = (word: string): string => `${word}${endsInConsonant(word) ? "은" : "는"}`;
const subject = (word: string): string => `${word}${endsInConsonant(word) ? "이" : "가"}`;
const conj = (word: string): string => `${word}${endsInConsonant(word) ? "과" : "와"}`;

/** Names follow Cloudflare's pricing pages, so a figure here can be held against the one there. */
const metrics: Record<MetricId, MetricText> = {
  "workers.requests": {
    label: "Workers 요청",
    short: "요청",
    note: "Pages Functions 요청을 포함합니다. 정적 자산 요청은 집계하지 않습니다.",
  },
  "workers.cpuMs": { label: "Workers CPU 시간", short: "CPU 시간" },
  "d1.rowsRead": { label: "D1 읽은 행", short: "읽은 행" },
  "d1.rowsWritten": { label: "D1 쓴 행", short: "쓴 행" },
  "d1.storage": { label: "D1 스토리지", short: "스토리지" },
  "kv.reads": { label: "KV 읽기", short: "읽기" },
  "kv.writes": { label: "KV 쓰기", short: "쓰기" },
  "kv.deletes": { label: "KV 삭제", short: "삭제" },
  "kv.lists": { label: "KV 목록 요청", short: "목록 요청" },
  "kv.storage": { label: "KV 스토리지", short: "스토리지" },
  "r2.classA": {
    label: "R2 Class A 작업",
    short: "Class A",
    note: "업로드, 목록 조회, 복사처럼 쓰거나 목록을 만드는 작업입니다.",
  },
  "r2.classB": {
    label: "R2 Class B 작업",
    short: "Class B",
    note: "객체 가져오기나 메타데이터 조회처럼 읽는 작업입니다.",
  },
  "r2.storage": { label: "R2 스토리지", short: "스토리지" },
  "r2ia.classA": {
    label: "R2 Infrequent Access Class A 작업",
    short: "Class A",
    note: "Infrequent Access에는 기본 제공량이 없고, 모든 작업에 요금이 붙습니다.",
  },
  "r2ia.classB": {
    label: "R2 Infrequent Access Class B 작업",
    short: "Class B",
    note: "Infrequent Access에는 기본 제공량이 없고, 모든 작업에 요금이 붙습니다.",
  },
  "r2ia.storage": {
    label: "R2 Infrequent Access 스토리지",
    short: "스토리지",
    note: "Infrequent Access에는 기본 제공량이 없고, 저장한 모든 바이트에 요금이 붙습니다.",
  },
  "do.requests": { label: "Durable Objects 요청", short: "요청" },
  "do.duration": { label: "Durable Objects 실행 시간", short: "실행 시간" },
  "do.rowsRead": { label: "Durable Objects 읽은 행", short: "읽은 행" },
  "do.rowsWritten": { label: "Durable Objects 쓴 행", short: "쓴 행" },
  "do.storage": { label: "Durable Objects 스토리지", short: "스토리지" },
  "queues.operations": { label: "Queues 작업", short: "작업" },
  "ai.neurons": {
    label: "Workers AI 뉴런",
    short: "뉴런",
    note: "하루 10,000 뉴런이 포함됩니다. 집계는 UTC 00:00에 초기화되며, 그 이상의 사용량은 과금됩니다.",
  },
};

const datasets: Record<DatasetName, string> = {
  workers: "Workers",
  pages: "Pages Functions",
  d1: "D1",
  d1s: "D1 스토리지",
  kv: "KV",
  kvs: "KV 스토리지",
  r2: "R2",
  r2s: "R2 스토리지",
  doi: "Durable Objects 요청",
  dop: "Durable Objects",
  doq: "Durable Objects 스토리지",
  queues: "Queues",
  ai: "Workers AI",
};

const label = (id: MetricId): string => metrics[id].label;

/** "Workers 요청과 D1 읽은 행", or "Workers 요청과 D1 읽은 행 외 N개" past two. */
function labels(ids: readonly MetricId[]): string {
  const all = ids.map(label);
  const [first = "", second = ""] = all;
  if (all.length <= 1) return first;
  if (all.length === 2) return `${conj(first)} ${second}`;
  return `${conj(first)} ${second} 외 ${all.length - 2}개`;
}

/** "A, B 및 C". */
function listed(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" 및 ");
  return `${items.slice(0, -1).join(", ")} 및 ${items.at(-1) ?? ""}`;
}

/** The start of the "nothing goes over" sentences. Each adds 습니다. or 지만, and the rest. */
const FINE_STEM = "이번 기간에 기본 제공량을 넘는 항목은 없";

export const ko: Messages = {
  title: "Cloudflare 사용량",
  language: "언어",

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
    database: "데이터베이스",
    namespace: "네임스페이스",
    bucket: "버킷",
    queue: "큐",
    model: "모델",
  },
  datasets,

  outlook: { cycle: "기간 말 예상", level: "기간 평균", daily: "오늘" },
  status: {
    exceeded: "초과",
    "will-exceed": "초과 예정",
    watch: "기본 제공량 근접",
    metered: null,
    ok: null,
  },

  sentences: ({ parts }) => parts.join(" "),

  day: ({ month, day }) => `${month}월 ${day}일`,
  shortDay: ({ month, day }) => `${month}/${day}`,
  timeLeft: ({ days, hours, ended }) => {
    if (ended) return "0시간";
    if (days === 0) return hours === 0 ? "1시간 미만" : `${hours}시간`;
    return hours === 0 ? `${days}일` : `${days}일 ${hours}시간`;
  },
  ago: {
    justNow: "방금",
    minutes: ({ count }) => `${count}분 전`,
    hours: ({ count }) => `${count}시간 전`,
    days: ({ count }) => `${count}일 전`,
  },
  change: {
    flat: "변화 없음",
    times: ({ multiple }) => `${multiple}배`,
  },

  names: {
    other: "기타",
    unattributed: "출처 미상 요청",
    pages: ({ name }) => `${name} (Pages)`,
  },

  headline: {
    renewal: ({ day, left }) => `${day}에 갱신되며, ${left} 남았습니다.`,
    noUsage: "이번 기간 사용량이 아직 없습니다.",
    cost: ({ usd }) => `예상 추가 요금은 ${usd}입니다.`,
    over: ({ metrics: ids }) => `${subject(labels(ids))} 기본 제공량을 넘었습니다.`,
    overDaily: ({ metrics: ids }) => `${subject(labels(ids))} 이번 기간에 하루 기본 제공량을 넘었습니다.`,
    alsoOver: ({ metrics: ids }) => `${labels(ids)}도 이번 기간에 기본 제공량을 넘을 예정입니다.`,
    runsOutOn: ({ metric, day }) => `${label(metric)}의 기본 제공량은 ${day}에 소진됩니다.`,
    willGoOver: ({ metric }) => `${label(metric)}의 사용량이 이번 기간에 기본 제공량을 넘을 예정입니다.`,
    fine: `${FINE_STEM}습니다.`,
    fineBut: {
      cycle: ({ metric, share }) =>
        `${FINE_STEM}지만, ${label(metric)}의 사용량이 기간 말에 기본 제공량의 ${share}에 이를 것입니다.`,
      level: ({ metric, share }) => `${FINE_STEM}지만, ${label(metric)}의 기간 평균은 기본 제공량의 ${share}입니다.`,
      daily: ({ metric, share }) =>
        `${FINE_STEM}지만, ${label(metric)}의 하루 사용량이 하루 기본 제공량의 ${share}에 이를 것입니다.`,
    },
    closest: {
      cycle: ({ metric, share }) => `${subject(label(metric))} 기본 제공량에 가장 가깝고, 기간 말 예상은 ${share}입니다.`,
      level: ({ metric, share }) => `${subject(label(metric))} 기본 제공량에 가장 가깝고, 기간 평균은 ${share}입니다.`,
      daily: ({ metric, share }) =>
        `${subject(label(metric))} 기본 제공량에 가장 가깝고, 하루 사용량은 하루 기본 제공량의 약 ${share}입니다.`,
    },
  },

  findings: {
    heading: "핵심 내용",
    tone: { over: "초과: ", watch: "주의: ", note: "참고: " },
    share: ({ metric, name, share, stored, msPerRequest }) => {
      if (stored) return `${name}에 있는 ${label(metric)}의 비중은 ${share}입니다.`;
      const each = msPerRequest === null ? "" : ` (요청당 평균 ${msPerRequest} ms)`;
      return `${name}에서 나온 ${label(metric)}의 비중은 ${share}입니다${each}.`;
    },
    surge: ({ metric, days, change, grower }) => {
      const base = `최근 ${days}일 ${topic(label(metric))} 그 전 ${days}일과 비교해 ${change}입니다.`;
      return grower === null ? base : `${base} 가장 많이 늘어난 것은 ${grower}입니다.`;
    },
    spike: ({ metric, day, change, amount }) =>
      `${day}의 ${topic(label(metric))} 평소 하루의 ${change}입니다 (${amount}).`,
    errors: ({ name, days, share, count }) =>
      `최근 ${days}일 ${name} 요청의 실패율은 ${share}입니다 (실패 ${count}건).`,
    storedOver: ({ metric }) =>
      `${topic(label(metric))} 지금 기본 제공량을 넘었지만, 이번 기간 평균은 아직 넘지 않았습니다. 이 수준이 유지되면 다음 기간부터 과금됩니다.`,
    storedWillPass: ({ metric, day }) =>
      `최근 증가 속도가 이어지면, ${topic(label(metric))} ${day}에 기본 제공량을 넘게 됩니다.`,
    periodTimes: ({ metric, change }) => `${topic(label(metric))} 지난 기간 같은 시점의 ${change}입니다.`,
    periodDiff: ({ metric, percent, more }) =>
      `${topic(label(metric))} 지난 기간 같은 시점보다 ${percent} ${more ? "많습니다" : "적습니다"}.`,
    daysOver: ({ metric, days, usd }) =>
      `${topic(label(metric))} 이번 기간 ${days}일 동안 하루 기본 제공량을 넘었습니다. 초과분은 약 ${usd}입니다.`,
    busiestDay: ({ metric, day, share }) =>
      `이번 기간 가장 바빴던 날은 ${day}입니다. 그날 ${topic(label(metric))} 하루 기본 제공량의 ${share}입니다.`,
    metered: ({ metric, usd }) => `${topic(label(metric))} 기본 제공량이 없어 이번 기간 요금은 약 ${usd}입니다.`,
  },

  metricList: {
    heading: "사용량",
    figures: ({ used, allowance }) => `${used} / ${allowance}`,
    figuresDaily: ({ used, allowance }) => `${used} / 하루 ${allowance}`,
    cost: "이번 기간 요금",
    more: ({ count, others }) => {
      const head = others ? `외 ${count}개` : `${count}개 사용 중`;
      return count === 1 ? `${head}, 1% 미만` : `${head}, 모두 1% 미만`;
    },
    unused: ({ days, metrics: ids }) => `최근 ${days}일 동안 사용하지 않음: ${ids.map(label).join(", ")}`,
    row: ({ metric, figures, caption, value }) => `${label(metric)}, ${figures}, ${caption} ${value}`,
  },

  meter: {
    cycle: ({ used, projected }) => `${used} 사용, 기간 말 예상 ${projected}`,
    level: ({ used, projected }) => `지금 저장량은 기본 제공량의 ${used}, 기간 평균 ${projected}`,
    daily: ({ used }) => `오늘 하루 기본 제공량의 ${used} 사용`,
  },

  detail: {
    pane: ({ metric }) => `${label(metric)} 세부 정보`,
    price: {
      perGbMonth: ({ usd, extra }) => `${extra ? "초과분 " : ""}GB-month당 ${usd}`,
      per: ({ usd, units, extra }) => `${extra ? "초과분 " : ""}${units}당 ${usd}`,
    },
    facts: {
      soFar: "이번 기간 지금까지",
      periodEndAtPace: ({ days }) => `최근 ${days}일 속도 기준 기간 말`,
      lastPeriodSamePoint: "지난 기간 같은 시점",
      thisPeriod: ({ change }) => `이번 기간 ${change}`,
      lastPeriodTotal: "지난 기간 전체",
      runsOut: "기본 제공량 소진",
      notThisPeriod: "이번 기간에는 없음",
      storedNow: "지금 저장량",
      periodAverage: "기간 평균 (과금 기준)",
      perDay: ({ days }) => `최근 ${days}일, 하루당`,
      unchanged: "변화 없음",
      grew: ({ amount }) => `${amount} 증가`,
      shrank: ({ amount }) => `${amount} 감소`,
      storedAtEnd: "기간 말 저장량",
      endOfLastPeriod: "지난 기간 말",
      storedPasses: "기본 제공량을 넘음",
      notWithinYear: "1년 안에는 없음",
      notGrowing: "증가하지 않음",
      today: "오늘",
      dailyAverage: ({ days }) => `최근 ${days}일, 하루 평균`,
      busiestDay: ({ day }) => `이번 기간 가장 바쁜 날 (${day})`,
      daysOver: "하루 기본 제공량 초과 일수",
      dayCount: ({ count: days }) => `${days}일`,
      none: "없음",
      overage: "예상 초과 요금",
      costThisPeriod: "이번 기간 예상 요금",
    },
    breakdown: {
      now: "지금",
      thisPeriod: "사용량",
      share: "비중",
      againstDaysAgo: ({ days }) => `${days}일 전 대비`,
      againstDaysBefore: ({ days }) => `그 전 ${days}일 대비`,
      appeared: "신규",
      perRequest: ({ ms }) => `요청당 ${ms} ms`,
      failed: ({ share }) => `${share} 실패`,
      other: "기타",
      more: ({ count: rest }) => `외 ${rest}개`,
    },
    daily: {
      summary: "일별 수치",
      date: "날짜",
      thatDay: "일별",
      stored: "저장량",
      running: "누계",
    },
  },

  chart: {
    thisPeriod: "이번 기간",
    projected: "예상",
    lastPeriod: "지난 기간",
    allowance: "기본 제공량",
    keys: ({ metric }) => `${label(metric)}. 좌우 화살표 키로 날짜를 이동합니다.`,
    running: "누계",
    thatDay: "그날",
    sameDayLastPeriod: "지난 기간 같은 날",
  },

  verdict: {
    timeline: ({ start, end, day, days }) => `${start}–${end}, ${days}일 중 ${day}일째`,
    renewal: { before: "매월 ", after: "일에 갱신" },
  },

  topbar: {
    accounts: "계정",
    accountTone: { ok: null, watch: " (기본 제공량 근접)", over: " (초과)" },
    updating: "업데이트 중",
    noData: "아직 데이터 없음",
    // Beside the refresh control the time says enough, and a phone has no room for more.
    updated: ({ ago }) => ago,
    refresh: "새로고침",
  },

  app: {
    loading: "불러오는 중",
    loadFailed: "데이터를 불러오지 못했습니다. 페이지를 새로고침해 다시 시도하세요.",
    noAccounts: "아직 설정된 Cloudflare 계정이 없습니다.",
    refreshFailed: ({ reason }) =>
      reason === null ? "사용량을 업데이트하지 못했습니다." : `사용량을 업데이트하지 못했습니다. ${reason}`,
    unreachable: "Cloudflare에 연결할 수 없습니다.",
    retry: "다시 시도",
    renewalNotSaved: ({ day }) =>
      day === null
        ? "갱신일을 저장하지 못했습니다. 다시 시도하세요."
        : `갱신일을 저장하지 못해 여전히 ${day}일입니다. 다시 시도하세요.`,
    firstRead: "사용량을 처음 읽는 중입니다. 약 10초 걸립니다.",
    noData: "아직 사용량 데이터가 없습니다.",
  },

  footer: {
    estimate:
      "사용량 수치는 Cloudflare Analytics의 추정치이며 청구서와 약간 다를 수 있습니다. Pages Functions의 CPU 시간은 포함되지 않습니다.",
    prices: { before: "기본 제공량과 가격은 ", between: " 및 ", after: " 공식 가격표 기준, 2026년 10월 9일 시점입니다." },
    json: { before: "같은 수치의 JSON: ", between: ", ", all: "모든 계정" },
    agent: { before: "에이전트용 MCP 주소는 ", after: "입니다." },
    signOut: "로그아웃",
  },

  setup: {
    title: "청구는 매월 며칠에 갱신됩니까?",
    lead: "사용량은 매월 그 날짜를 기준으로 집계합니다. 날짜는 Cloudflare 대시보드에서 Manage Account → Billing → Subscriptions 메뉴의 Workers Paid 옆에 있습니다.",
    save: "저장",
  },

  alerts: {
    title: "알림",
    lead: "하루 네 번 확인합니다. 제품 상태가 나빠질 때마다 한 번만 알리고, 확인할 때마다 알리지는 않습니다.",
    when: "알림을 받을 경우",
    events: {
      willExceed: "어떤 제품이 이번 기간에 기본 제공량을 넘을 추세입니다.",
      exceeded: "어떤 제품이 기본 제공량을 넘었습니다.",
      watch: "어떤 제품이 기본 제공량의 80% 선을 넘을 추세입니다.",
      token: "어떤 API 토큰이 작동을 멈춥니다.",
    },
    ntfy: {
      url: "ntfy 토픽 주소",
      hint: "예: https://ntfy.sh/a-name-only-you-know. 토픽을 아는 사람은 누구나 읽을 수 있습니다.",
      token: "액세스 토큰",
    },
    webhook: {
      url: "Webhook 주소",
      hint: "알릴 일이 있을 때 JSON POST 요청을 받습니다.",
      secret: "서명 비밀키",
    },
    optional: "선택",
    kept: "저장되어 있습니다. 새로 입력하면 교체됩니다.",
    save: "저장",
    saved: "저장되었습니다.",
    notSaved: "알림 설정을 저장하지 못했습니다. 다시 시도하세요.",
    invalidAddress: ({ channel }) =>
      `${channel} 주소는 https://로 시작해야 하며, ntfy의 경우 토픽 이름으로 끝나야 합니다.`,
    test: "테스트 보내기",
    noChannel: "ntfy 토픽 주소나 Webhook 주소를 추가하고 먼저 저장하세요.",
    delivered: ({ channel }) => `${channel}: 전달되었습니다.`,
    failed: ({ channel, status }) =>
      status === null ? `${channel}: 연결할 수 없습니다.` : `${channel}: 서버가 거부했습니다 (${status}).`,
    close: "닫기",
    testTitle: "사용량 페이지에서 보낸 테스트",
    testBody: "알림이 여기로 도착합니다.",
  },

  tokenProblem: ({ token, status }) => {
    if (status === null) return `${token}번째 API 토큰으로 Cloudflare에 연결할 수 없습니다.`;
    if (status === 200) return `${token}번째 API 토큰은 작동하지만 계정이 보이지 않습니다.`;
    return `Cloudflare에서 ${token}번째 API 토큰을 거부했습니다 (${status}). Account Analytics: Read 권한이 있는지, 만료되지 않았는지 확인하세요.`;
  },

  warning: (w) => {
    switch (w.kind) {
      case "recent-unavailable":
        return `Workers AI 사용량을 읽지 못했습니다 (${w.reason}).`;
      case "clipped":
        return `${listed(w.datasets.map((name) => datasets[name]))} 데이터가 불완전해서 실제 사용량은 표시된 것보다 많습니다.`;
      case "r2-unknown":
        return `Class A 또는 Class B로 분류되지 않은 R2 작업은 집계되지 않았습니다: ${w.actions.join(", ")}.`;
      case "stale":
        return "가장 최근 업데이트가 실패했습니다. 이 수치는 이전 업데이트에서 가져온 것입니다.";
    }
  },

  errors: {
    analytics: "Cloudflare Analytics에서 오류가 발생했습니다.",
    "unknown-account": "이 계정을 더 이상 사용할 수 없습니다. 페이지를 새로고침하세요.",
    "no-token": "이 계정에 Cloudflare API 토큰이 설정되어 있지 않습니다.",
    "invalid-request": "요청이 받아들여지지 않았습니다. 페이지를 새로고침한 뒤 다시 시도하세요.",
    "rate-limited": "요청이 너무 많습니다. 1분 뒤에 다시 시도하세요.",
    unauthenticated: "로그인이 만료되었습니다. 다시 로그인하세요.",
    unavailable: "지금은 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하세요.",
    unknown: "문제가 발생했습니다. 다시 시도하세요.",
  },
  analyticsError: ({ detail }) => `Cloudflare Analytics에서 오류가 발생했습니다 (${detail}).`,
};
