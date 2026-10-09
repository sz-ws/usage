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
