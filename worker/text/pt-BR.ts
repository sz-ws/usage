import type { PageText } from "./types";

export const ptBR: PageText = {
  lang: "pt-BR",
  product: "Uso da Cloudflare",

  signIn: {
    title: "Entrar",
    keyLabel: "Chave de acesso",
    keyHint: "A ACCESS_KEY definida no deploy.",
    submit: "Entrar",
    wrongKey: "Essa não é a chave de acesso.",
    tooMany: "Muitas tentativas. Tente novamente em um minuto.",
  },

  consent: {
    title: (client) => `Permitir que ${client} leia o seu uso da Cloudflare?`,
    scope: "Ele poderá ler os seus números de uso e as previsões. Não poderá alterar nada.",
    publishedBy: (domain) => `Publicado por ${domain}.`,
    selfNamed: "O nome vem do próprio app e não foi verificado.",
    sentTo: (host) => `O acesso será enviado para ${host}.`,
    sentToApp: (scheme) => `O acesso será enviado para o app neste computador que abre links ${scheme}.`,
    loopback: "Continue só se acabou de iniciar a conexão a partir de um app neste computador.",
    allow: "Permitir",
    deny: "Negar",
  },

  setup: {
    title: "Termine a configuração",
    lead: "Defina estas variáveis no Worker para continuar:",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN: um token de API da Cloudflare com a permissão Account Analytics: Read.",
      ACCESS_KEY: "ACCESS_KEY: a senha usada para entrar.",
    },
    shortKey: (minimum) => `ACCESS_KEY: precisa ter pelo menos ${minimum} caracteres.`,
    where: "No painel da Cloudflare: este Worker → Settings → Variables and Secrets.",
  },

  problem: {
    title: "Falha na conexão",
    invalid: "A solicitação não é válida.",
    expired: "A solicitação expirou ou já foi usada.",
    unverified: "Não foi possível verificar o app que pediu a conexão.",
    startAgain: "Tente conectar novamente a partir do app.",
  },
};
