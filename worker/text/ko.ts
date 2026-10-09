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
