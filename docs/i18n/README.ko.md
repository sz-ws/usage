# Usage

여러분의 Cloudflare 계정은 이번 기간에 Workers Paid 요금제의 기본 제공량 안에 머뭅니까? 넘는다면 비용이 얼마나 나옵니까?

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · **한국어** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md)

![사용량 페이지: Workers 요청이 10월 19일에 기본 제공량인 1,000만 건을 넘을 것으로 예상되며, 제품 목록 옆에 차트, 속도, 예상 초과 요금이 보입니다](../screenshot.png)

Cloudflare 계정 안에 배포하는 Worker 하나입니다. Cloudflare Analytics에서 계정의 사용량을 읽어 요금제의 기본 제공량과 대조하고, 기간이 끝날 때 각 제품이 어디에 있을지 예측합니다. 페이지에서 보거나, JSON으로 받거나, 에이전트가 MCP로 물어보게 할 수 있습니다. 여러분의 사용량은 Cloudflare에서 여러분의 Worker로만 가고, 그 밖의 어디로도 가지 않습니다: 원격 측정도 없고, 이를 볼 수 있는 저희 서버도 없습니다.

## 알려주는 것

- **초과 여부.** Workers 요청과 Workers CPU 시간, D1, KV, R2, Durable Objects, Queues, Workers AI: 지금까지 사용량, 기본 제공량, 기간 말 예상치.
- **예상 요금.** Cloudflare 공식 가격표 기준의 초과 금액(달러).
- **누가 쓰는지.** 각 수치를 Worker, 데이터베이스, 네임스페이스, 버킷, 큐 또는 모델별로 보여 줍니다.
- **무엇이 바뀌었는지.** 이번 주에 요청이 세 배로 늘어난 Worker. 40일 뒤 기본 제공량을 넘을 스토리지.
- **언제 볼지.** 제품이 초과 추세일 때 ntfy 또는 webhook으로 알림을 보냅니다.
- **여러 계정**, 계정마다 탭 하나.
- **아홉 개 언어.**

## 계정 없이 써 보기

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # 가상 데이터, http://localhost:8798
```

## 배포

**Workers Paid** 요금제의 Cloudflare 계정이 필요합니다. Workers Paid 요금제 외에는 추가 비용이 없습니다. Cloudflare를 하루에 네 번 읽고 결과를 KV에 저장합니다. KV에 저장하는 결과는 요금제에 이미 포함된 양의 아주 작은 일부입니다.

1. **Deploy to Cloudflare 버튼을 누르세요.** Worker에 필요한 KV 네임스페이스를 만듭니다. 만들 토큰도 없고, 고를 비밀번호도 없습니다.
2. **Worker 주소를 열고 Cloudflare로 계속하기를 두 번 누르세요.** 한 번은 여러분의 계정을 찾기 위해서, 한 번은 페이지가 그 사용량을 읽도록 하기 위해서입니다. 여러분이 허락하는 것은 얼마나 썼는지만 보여 주고, 저장된 것은 아무것도 보여 주지 않습니다. 데이터베이스, KV 값, R2 객체를 읽을 수 없고, 아무것도 바꿀 수 없습니다.
3. **청구가 갱신되는 날을 설정하세요.** Cloudflare 대시보드의 Manage Account → Billing → Subscriptions에 있습니다.

로그인할 때 요청하는 것과 보관하는 것: [docs/sign-in.md](../sign-in.md) (영어). API 토큰을 대신 쓰거나, 클론에서 배포하거나, 자신의 도메인을 쓴다면: [docs/deploy.md](../deploy.md) (영어).

## 에이전트 연결

이 Worker는 `https://<내 Worker>/mcp` 주소에서 MCP 서버이기도 합니다. Claude에서는 이 주소를 사용자 지정 커넥터로 추가하세요. Claude Code에서는 이렇게 하세요:

```sh
claude mcp add --transport http usage https://<내 Worker>/mcp
```

Worker가 로그인하고 허용하라고 요청합니다. 그러면 에이전트는 자체 읽기 전용 토큰을 받습니다. 다른 클라이언트, 도구, JSON API는 [docs/agents.md](../agents.md) (영어)에서 확인하세요.

## 문서

아래 문서는 영어입니다.

- [배포와 설정](../deploy.md)
- [Cloudflare로 로그인하기](../sign-in.md)
- [에이전트, MCP, JSON API](../agents.md)
- [ntfy 또는 webhook으로 받는 알림](../alerts.md)
- [작동 방식과 숫자의 출처](../how-it-works.md)
- [개발과 언어 추가](../development.md)

## 라이선스

[Apache-2.0](../../LICENSE)

독립 프로젝트이며, Cloudflare, Inc.와 제휴하거나 그 승인을 받은 것이 아닙니다. Cloudflare와 Cloudflare 로고는 Cloudflare, Inc.의 상표입니다.
