import type { PageText } from "./types";

export const fr: PageText = {
  lang: "fr",
  product: "Consommation Cloudflare",

  signIn: {
    title: "Connexion",
    keyLabel: "Clé d'accès",
    keyHint: "La valeur d'ACCESS_KEY définie au déploiement.",
    submit: "Se connecter",
    wrongKey: "Ce n'est pas la clé d'accès.",
    tooMany: "Trop de tentatives. Réessayez dans une minute.",
  },

  connect: {
    connectTitle: "Connecter Cloudflare",
    connectLead: "Deux étapes. Cloudflare vous demande de confirmer chacune sur sa propre page.",
    reconnectTitle: "Reconnecter Cloudflare",
    reconnectLead: "Les mêmes deux étapes que la première fois. Vos réglages et votre historique sont conservés.",
    findTitle: "Trouver vos comptes",
    findText:
      "Cloudflare transmet à cette page la liste de vos comptes et leurs noms. Cette page ne conserve pas cet accès.",
    findAgain: "Choisir à nouveau",
    grantTitle: "Autoriser cette page à lire la consommation",
    grantText:
      "Cette page verra la consommation de chaque compte. Elle ne verra pas ce qui est stocké et ne pourra rien modifier.",
    grantSame: "Choisissez les mêmes comptes sur Cloudflare.",
    button: "Continuer avec Cloudflare",
    signInLead: "Utilisez un identifiant Cloudflare ayant accès au compte où ce Worker est déployé.",
    signInButton: "Se connecter avec Cloudflare",
    askedTitle: "Permissions que Cloudflare va vous demander",
    askedSettings:
      "Account Settings: Read, à l'étape 1 uniquement. Cette permission permet de lister vos comptes et leurs membres, et n'est pas conservée une fois la liste lue.",
    askedAnalytics:
      "Account Analytics: Read, aux deux étapes. Cette permission permet de suivre la consommation de chaque produit. Seul l'accès accordé à l'étape 2 est conservé.",
    problemTitle: "La connexion n'a pas abouti",
    tryAgain: "Réessayer",
    problems: {
      expired: "Cette connexion a pris plus de dix minutes, ou a été lancée dans un autre navigateur.",
      declined: "L'accès n'a pas été accordé auprès de Cloudflare.",
      failed: "Cloudflare n'a pas répondu. Réessayez dans un instant.",
      noAccounts: "Aucun compte n'a été choisi sur la page de Cloudflare. Choisissez le compte où ce Worker est déployé.",
      notFound:
        "Ce Worker ne se trouve dans aucun des comptes choisis. Si vous venez de le déployer, attendez une minute et réessayez.",
      notAllowed:
        "Cet identifiant Cloudflare n'a pas accès au compte où ce Worker est déployé. Sur la page de Cloudflare, choisissez ce compte.",
      otherAccount: "Cette page est connectée à un autre compte que celui que vous avez choisi.",
      notKept: "La connexion n'a pas pu être maintenue auprès de Cloudflare. Réessayez.",
      tooMany: "Trop de tentatives. Réessayez dans une minute.",
    },
  },

  consent: {
    title: (client) => `Autoriser ${client} à lire votre consommation Cloudflare ?`,
    scope: "L'application pourra lire vos chiffres de consommation et leurs prévisions. Elle ne pourra rien modifier.",
    publishedBy: (domain) => `Publié par ${domain}.`,
    selfNamed: "Le nom vient de l'application elle-même et n'est pas vérifié.",
    sentTo: (host) => `L'accès sera envoyé à ${host}.`,
    sentToApp: (scheme) =>
      `L'accès sera envoyé à l'application de cet ordinateur qui ouvre les liens ${scheme}.`,
    loopback: "Continuez seulement si vous venez de lancer la connexion depuis une application de cet ordinateur.",
    allow: "Autoriser",
    deny: "Refuser",
  },

  setup: {
    title: "Terminez la configuration",
    lead: "Définissez ces valeurs sur le Worker pour continuer :",
    missing: {
      ANALYTICS_TOKEN:
        "ANALYTICS_TOKEN : un jeton API Cloudflare avec la permission Account Analytics: Read.",
      ACCESS_KEY: "ACCESS_KEY : le mot de passe avec lequel vous vous connecterez.",
    },
    shortKey: (minimum) => `ACCESS_KEY : au moins ${minimum} caractères.`,
    where: "Dans le tableau de bord Cloudflare : ce Worker → Settings → Variables and Secrets.",
  },

  problem: {
    title: "Échec de la connexion",
    invalid: "La requête n'est pas valide.",
    expired: "La requête a expiré ou a déjà été utilisée.",
    unverified: "L'application qui demande la connexion n'a pas pu être vérifiée.",
    startAgain: "Recommencez la connexion depuis l'application.",
  },
};
