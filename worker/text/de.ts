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

  connect: {
    connectTitle: "Cloudflare verbinden",
    connectLead: "Zwei Schritte. Du bestätigst jeden auf einer eigenen Seite von Cloudflare.",
    reconnectTitle: "Cloudflare erneut verbinden",
    reconnectLead: "Dieselben zwei Schritte wie beim ersten Mal. Deine Einstellungen und dein Verlauf bleiben erhalten.",
    findTitle: "Konten finden",
    findText:
      "Cloudflare teilt dieser Seite mit, welche Konten du hast und wie sie heißen. Dieser Zugriff wird danach wieder zurückgegeben.",
    findAgain: "Neu auswählen",
    grantTitle: "Diese Seite darf deine Nutzung lesen",
    grantText:
      "Diese Seite sieht, wie viel jedes Konto genutzt hat, aber nicht, was darin gespeichert ist. Sie kann nichts ändern.",
    grantSame: "Wähle bei Cloudflare dieselben Konten aus.",
    button: "Mit Cloudflare fortfahren",
    signInLead: "Melde dich mit einem Cloudflare-Login an, der Zugriff auf das Konto hat, in dem dieser Worker läuft.",
    signInButton: "Mit Cloudflare anmelden",
    askedTitle: "Berechtigungen, die Cloudflare anfordert",
    askedSettings:
      "Account Settings: Read, nur in Schritt 1. Damit werden deine Konten und deren Mitglieder aufgelistet. Danach wird die Berechtigung wieder zurückgegeben.",
    askedAnalytics:
      "Account Analytics: Read, in beiden Schritten. Damit lässt sich sehen, wie viel jedes Produkt genutzt hat. Nur die Berechtigung aus Schritt 2 bleibt bestehen.",
    problemTitle: "Anmeldung nicht abgeschlossen",
    tryAgain: "Erneut versuchen",
    problems: {
      expired: "Die Anmeldung hat länger als zehn Minuten gedauert oder wurde in einem anderen Browser gestartet.",
      declined: "Bei Cloudflare wurde der Zugriff nicht erlaubt.",
      failed: "Cloudflare hat nicht geantwortet. Versuch es gleich noch einmal.",
      noAccounts:
        "Bei Cloudflare wurde kein Konto ausgewählt. Wähle das Konto aus, in dem dieser Worker läuft.",
      notFound:
        "In keinem der gewählten Konten läuft dieser Worker. Wenn du ihn in den letzten Minuten deployt hast, warte eine Minute und versuch es erneut.",
      notAllowed:
        "Dieser Cloudflare-Login hat keinen Zugriff auf das Konto dieses Workers. Wähle bei Cloudflare das Konto aus, in dem dieser Worker läuft.",
      otherAccount: "Diese Seite ist mit einem anderen Konto verbunden, als du jetzt gewählt hast.",
      notKept: "Cloudflare hat die Verbindung nicht aufrechterhalten. Versuch es noch einmal.",
      tooMany: "Zu viele Versuche. Versuch es in einer Minute erneut.",
    },
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
