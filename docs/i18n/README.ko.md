# Usage

여러분의 Cloudflare 계정은 이번 기간에 Workers Paid 요금제의 기본 제공량 안에 머뭅니까? 넘는다면 비용이 얼마나 나옵니까?

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · **한국어** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md)

![사용량 페이지: Workers 요청이 10월 19일에 기본 제공량인 1,000만 건을 넘을 것으로 예상되며, 제품 목록 옆에 차트, 속도, 예상 초과 요금이 보입니다](../screenshot.png)

Cloudflare 계정 안에 배포하는 Worker 하나입니다. Cloudflare Analytics에서 계정의 사용량을 읽어 요금제의 기본 제공량과 대조하고, 기간이 끝날 때 각 제품이 어디에 있을지 예측합니다. 페이지에서 보거나, JSON으로 받거나, 에이전트가 MCP로 물어보게 할 수 있습니다. 계정 밖으로 나가는 것은 없습니다: 원격 측정도, 제3자 서비스도 없습니다.

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

1. **Deploy to Cloudflare 버튼을 누르세요.** 필요한 KV 네임스페이스를 만들고 시크릿 두 개를 묻습니다.
   - `ANALYTICS_TOKEN`: **Account Analytics: Read** 권한 하나만 있는 API 토큰입니다. [이 링크](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage)를 열면 양식이 미리 채워집니다. 이 토큰은 사용량만 보여 주고, 저장된 내용은 보여 주지 않습니다. 데이터베이스, KV 값 또는 R2 객체를 읽을 수 없고, 아무것도 바꿀 수 없습니다.
   - `ACCESS_KEY`: 페이지의 비밀번호입니다. 24자 이상이어야 합니다. `openssl rand -base64 32` 명령으로 만들 수 있습니다.
2. **Worker 주소를 여세요** 그리고 액세스 키로 로그인하세요.
3. **청구가 갱신되는 날을 설정하세요.** Cloudflare 대시보드의 Manage Account → Billing → Subscriptions에 있습니다.

클론에서 배포하기, 여러 계정 함께 보기, 자신의 도메인 사용하기: [docs/deploy.md](../deploy.md) (영어).

## 에이전트 연결

이 Worker는 `https://<내 Worker>/mcp` 주소에서 MCP 서버이기도 합니다. Claude에서는 이 주소를 사용자 지정 커넥터로 추가하세요. Claude Code에서는 이렇게 하세요:

```sh
claude mcp add --transport http usage https://<내 Worker>/mcp
```

Worker가 로그인하고 허용하라고 요청합니다. 그러면 에이전트는 자체 읽기 전용 토큰을 받습니다. 다른 클라이언트, 도구, JSON API는 [docs/agents.md](../agents.md) (영어)에서 확인하세요.

## 문서

아래 문서는 영어입니다.

- [배포와 설정](../deploy.md)
- [에이전트, MCP, JSON API](../agents.md)
- [ntfy 또는 webhook으로 받는 알림](../alerts.md)
- [작동 방식과 숫자의 출처](../how-it-works.md)
- [개발과 언어 추가](../development.md)

## 라이선스

[Apache-2.0](../../LICENSE)
