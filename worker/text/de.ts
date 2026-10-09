import type { PageText } from "./types";

export const de: PageText = {
  lang: "de",
  product: "Cloudflare-Nutzung",

  signIn: {
    title: "Anmelden",
    keyLabel: "Zugriffsschlüssel",
    keyHint: "Der ACCESS_KEY, den du beim Deployment gesetzt hast.",
    submit: "Anmelden",
    wrongKey: "Das ist nicht der Zugriffsschlüssel.",
    tooMany: "Zu viele Versuche. Versuch es in einer Minute erneut.",
  },

  consent: {
    title: (client) => `Darf ${client} deine Cloudflare-Nutzung lesen?`,
    scope: "Es kann deine Nutzungswerte und Prognosen lesen, aber nichts ändern.",
    publishedBy: (domain) => `Veröffentlicht von ${domain}.`,
    selfNamed: "Der Name stammt aus der App selbst und ist nicht geprüft.",
    sentTo: (host) => `Der Zugriff wird an ${host} gesendet.`,
    sentToApp: (scheme) =>
      `Der Zugriff wird an die App auf diesem Computer gesendet, die Links öffnet, die mit ${scheme} beginnen.`,
    loopback: "Mach nur weiter, wenn du die Verbindung gerade von einer App auf diesem Computer aus gestartet hast.",
    allow: "Erlauben",
    deny: "Ablehnen",
  },

  setup: {
    title: "Einrichtung abschließen",
    lead: "Setze diese Werte am Worker, um fortzufahren:",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN: ein Cloudflare-API-Token mit der Berechtigung Account Analytics: Read.",
      ACCESS_KEY: "ACCESS_KEY: das Passwort, mit dem du dich anmeldest.",
    },
    shortKey: (minimum) => `ACCESS_KEY: mindestens ${minimum} Zeichen.`,
    where: "Im Cloudflare-Dashboard: dieser Worker → Settings → Variables and Secrets.",
  },

  problem: {
    title: "Verbindung fehlgeschlagen",
    invalid: "Die Anfrage ist ungültig.",
    expired: "Die Anfrage ist abgelaufen oder wurde schon benutzt.",
    unverified: "Die App, die sich verbinden will, konnte nicht bestätigt werden.",
    startAgain: "Verbinde dich aus der App heraus noch einmal.",
  },
};
