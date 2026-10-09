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

  connect: {
    connectTitle: "Conectar à Cloudflare",
    connectLead: "São duas etapas. A Cloudflare pede que você confirme cada uma na própria página.",
    reconnectTitle: "Reconectar à Cloudflare",
    reconnectLead: "As mesmas duas etapas da primeira vez. Suas configurações e seu histórico continuam salvos.",
    findTitle: "Encontre as suas contas",
    findText: "A Cloudflare informa a esta página quais contas você tem e como elas se chamam. Esse acesso é descartado assim que a resposta chegar.",
    findAgain: "Escolher outras contas",
    grantTitle: "Permita que esta página leia o seu uso",
    grantText: "Esta página vai ver quanto cada conta já usou. Ela não consegue ver o que está armazenado e não pode alterar nada.",
    grantSame: "Escolha as mesmas contas na Cloudflare.",
    button: "Continuar com a Cloudflare",
    signInLead: "Use um login da Cloudflare que tenha acesso à conta deste Worker.",
    signInButton: "Entrar com a Cloudflare",
    askedTitle: "Permissões que a Cloudflare vai pedir",
    askedSettings: "Account Settings: Read, só na etapa 1. Lista as suas contas e os membros de cada uma, e é descartada assim que os nomes forem lidos.",
    askedAnalytics: "Account Analytics: Read, nas duas etapas. Mostra quanto cada produto já usou. Só a permissão da etapa 2 fica salva.",
    problemTitle: "O login não foi concluído",
    tryAgain: "Tentar novamente",
    problems: {
      expired: "Esse login levou mais de 10 minutos ou foi iniciado em outro navegador.",
      declined: "O acesso não foi concedido na página da Cloudflare.",
      failed: "A Cloudflare não respondeu. Tente novamente em instantes.",
      noAccounts: "Nenhuma conta foi escolhida na página da Cloudflare. Escolha a conta onde este Worker roda.",
      notFound: "Nenhuma das contas que você escolheu está rodando este Worker. Se você fez o deploy nos últimos minutos, espere um minuto e tente novamente.",
      notAllowed: "Esse login da Cloudflare não tem acesso à conta deste Worker. Na página da Cloudflare, escolha a conta onde este Worker roda.",
      otherAccount: "Esta página está conectada a uma conta diferente da que você escolheu.",
      notKept: "A Cloudflare não permitiu que esta página continuasse conectada. Tente novamente.",
      tooMany: "Muitas tentativas. Tente novamente em um minuto.",
    },
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
