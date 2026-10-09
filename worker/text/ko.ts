import type { PageText } from "./types";

export const ko: PageText = {
  lang: "ko",
  product: "Cloudflare 사용량",

  signIn: {
    title: "로그인",
    keyLabel: "액세스 키",
    keyHint: "배포할 때 설정한 ACCESS_KEY 값입니다.",
    submit: "로그인",
    wrongKey: "액세스 키가 맞지 않습니다.",
    tooMany: "시도 횟수가 너무 많습니다. 1분 뒤에 다시 시도하세요.",
  },

  connect: {
    connectTitle: "Cloudflare 연결",
    connectLead: "두 단계로 진행합니다. 각 단계마다 Cloudflare 페이지에서 따로 허용해야 합니다.",
    reconnectTitle: "Cloudflare 다시 연결",
    reconnectLead: "처음 연결할 때와 같은 두 단계입니다. 설정과 기록은 그대로 유지됩니다.",
    findTitle: "계정 찾기",
    findText: "Cloudflare가 이 페이지에 어떤 계정이 있는지와 각 계정의 이름을 알려줍니다. 이 접근 권한은 답을 받는 즉시 반환됩니다.",
    findAgain: "계정 다시 선택",
    grantTitle: "이 페이지에 사용량 읽기 허용",
    grantText: "이 페이지는 계정마다 얼마나 사용했는지 볼 수 있습니다. 저장된 내용은 볼 수 없으며, 아무것도 변경할 수 없습니다.",
    grantSame: "Cloudflare에서 같은 계정을 선택하세요.",
    button: "Cloudflare로 계속하기",
    signInLead: "이 Worker의 계정에 접근 권한이 있는 Cloudflare 로그인을 사용하세요.",
    signInButton: "Cloudflare로 로그인",
    askedTitle: "Cloudflare가 요청하는 권한",
    askedSettings: "Account Settings: Read는 1단계에서만 요청합니다. 계정과 멤버 목록을 읽는 데 쓰며, 이름을 읽고 나면 반환됩니다.",
    askedAnalytics: "Account Analytics: Read는 두 단계 모두에서 요청합니다. 제품마다 얼마나 썼는지 보여 주며, 2단계에서 받은 권한만 유지됩니다.",
    problemTitle: "연결이 완료되지 않았습니다",
    tryAgain: "다시 시도",
    problems: {
      expired: "로그인에 10분 넘게 걸렸거나, 다른 브라우저에서 시작되었습니다.",
      declined: "Cloudflare 페이지에서 접근 권한이 허용되지 않았습니다.",
      failed: "Cloudflare가 응답하지 않았습니다. 잠시 후 다시 시도하세요.",
      noAccounts: "Cloudflare 페이지에서 계정이 선택되지 않았습니다. 이 Worker가 실행되는 계정을 선택하세요.",
      notFound: "선택한 계정 중에는 이 Worker를 실행하는 계정이 없습니다. 몇 분 전에 배포했다면 1분 정도 기다린 뒤 다시 시도하세요.",
      notAllowed: "이 Cloudflare 로그인으로는 이 Worker의 계정을 읽을 수 없습니다. Cloudflare 페이지에서 이 Worker가 실행되는 계정을 선택하세요.",
      otherAccount: "이 페이지는 선택한 계정과 다른 계정에 연결되어 있습니다.",
      notKept: "Cloudflare가 이 페이지를 연결된 상태로 두지 않았습니다. 다시 시도하세요.",
      tooMany: "시도 횟수가 너무 많습니다. 1분 뒤에 다시 시도하세요.",
    },
  },

  consent: {
    title: (client) => `${client}에 Cloudflare 사용량 읽기를 허용하시겠습니까?`,
    scope: "이 앱은 사용량과 예측 수치를 읽을 수 있습니다. 아무것도 변경할 수 없습니다.",
    publishedBy: (domain) => `${domain}에서 배포한 앱입니다.`,
    selfNamed: "이름은 앱이 직접 정한 것이며 확인되지 않았습니다.",
    sentTo: (host) => `접근 권한이 ${host}에 전달됩니다.`,
    sentToApp: (scheme) => `이 컴퓨터에서 ${scheme} 링크를 여는 앱에 접근 권한이 전달됩니다.`,
    loopback: "방금 이 컴퓨터의 앱에서 연결을 시작한 경우에만 계속하세요.",
    allow: "허용",
    deny: "거부",
  },

  setup: {
    title: "설정을 마치세요",
    lead: "계속하려면 Worker에 다음 값을 설정하세요:",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN: Account Analytics: Read 권한이 있는 Cloudflare API 토큰입니다.",
      ACCESS_KEY: "ACCESS_KEY: 로그인할 때 입력할 비밀번호입니다.",
    },
    shortKey: (minimum) => `ACCESS_KEY: 최소 ${minimum}자 이상이어야 합니다.`,
    where: "Cloudflare 대시보드에서 이 Worker → Settings → Variables and Secrets 순서로 이동하세요.",
  },

  problem: {
    title: "연결에 실패했습니다",
    invalid: "요청이 올바르지 않습니다.",
    expired: "요청이 만료되었거나 이미 사용되었습니다.",
    unverified: "연결을 요청한 앱을 확인할 수 없습니다.",
    startAgain: "앱에서 다시 연결을 시도하세요.",
  },
};
