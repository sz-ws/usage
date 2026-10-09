# Usage

Sua conta da Cloudflare vai continuar dentro do plano Workers Paid neste período de faturamento, e quanto vai custar se não continuar?

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português**

![Página de uso: as solicitações do Workers devem ultrapassar os 10 milhões incluídos no dia 19 de outubro, com o gráfico, o ritmo e o excedente estimado ao lado da lista de produtos](../screenshot.png)

Um Worker na sua própria conta da Cloudflare. Ele lê o uso da conta no Cloudflare Analytics, compara com o que o plano inclui e projeta em que ponto cada produto vai estar quando o período fechar. Veja em uma página, obtenha em JSON ou deixe um agente consultar pelo MCP. Nada sai da sua conta: não há telemetria nem serviço de terceiros.

## O que ele mostra

- **Se vai ultrapassar a franquia incluída.** Solicitações do Workers e tempo de CPU, D1, KV, R2, Durable Objects, Queues e Workers AI: o uso até agora, a franquia incluída e a previsão para o fim do período de faturamento.
- **Quanto vai custar.** O excedente em dólares, pelos preços de lista da Cloudflare.
- **Quem está usando.** Cada número por Worker, banco de dados, namespace, bucket, fila ou modelo.
- **O que mudou.** Um Worker cujas solicitações triplicaram esta semana. Um armazenamento que vai ultrapassar a franquia incluída em 40 dias.
- **Várias contas**, uma aba para cada uma.
- **Nove idiomas.**

## Experimente sem conta

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # dados fictícios em http://localhost:8798
```

## Deploy

Você precisa de uma conta da Cloudflare no **Workers Paid**. Rodar isso não custa nada além disso: o Worker consulta a Cloudflare quatro vezes por dia e guarda o resultado no KV, uma fração pequena do que o plano já inclui.

1. **Clique em Deploy to Cloudflare.** Ele cria o namespace do KV de que precisa e pede dois segredos.
   - `ANALYTICS_TOKEN`: um token de API com uma única permissão, **Account Analytics: Read**. [Este link](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage) preenche o formulário. O token mostra quanto foi usado e nada do que está armazenado: ele não consegue ler um banco de dados, um valor do KV nem um objeto do R2, e não pode alterar nada.
   - `ACCESS_KEY`: a senha da sua página, com 24 caracteres ou mais. `openssl rand -base64 32` gera uma.
2. **Abra o endereço do Worker** e entre com a chave de acesso.
3. **Defina o dia em que a sua fatura é renovada.** Você encontra isso em Manage Account → Billing → Subscriptions, no painel da Cloudflare.

A partir de um clone, com várias contas ou no seu próprio domínio: [docs/deploy.md](../deploy.md) (em inglês).

## Conectar um agente

O Worker também é um servidor MCP em `https://<your-worker>/mcp`. No Claude, adicione esse endereço como um conector personalizado. No Claude Code:

```sh
claude mcp add --transport http usage https://<your-worker>/mcp
```

Seu Worker pede para você entrar e autorizar o acesso, e o agente recebe um token somente leitura próprio. Outros clientes, as ferramentas e a API JSON: [docs/agents.md](../agents.md) (em inglês).

## Documentação

Os documentos a seguir estão em inglês.

- [Deploy e configuração](../deploy.md)
- [Agentes, MCP e API JSON](../agents.md)
- [Como funciona, e de onde vêm os números](../how-it-works.md)
- [Desenvolvimento, e como adicionar um idioma](../development.md)

## Licença

[Apache-2.0](../../LICENSE)
