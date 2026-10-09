import type { PageText } from "./types";

export const en: PageText = {
  lang: "en",
  product: "Cloudflare usage",

  signIn: {
    title: "Sign in",
    keyLabel: "Access key",
    keyHint: "The ACCESS_KEY you set when you deployed.",
    submit: "Sign in",
    wrongKey: "That is not the access key.",
    tooMany: "Too many attempts. Try again in a minute.",
  },

  consent: {
    title: (client) => `Let ${client} read your Cloudflare usage?`,
    scope: "It will be able to read your usage figures and forecasts. It cannot change anything.",
    publishedBy: (domain) => `Published by ${domain}.`,
    selfNamed: "The name comes from the app itself and is not verified.",
    sentTo: (host) => `Access will be sent to ${host}.`,
    sentToApp: (scheme) => `Access will be sent to the app on this computer that opens ${scheme} links.`,
    loopback: "Continue only if you just started connecting from an app on this computer.",
    allow: "Allow",
    deny: "Deny",
  },

  setup: {
    title: "Finish setting up",
    lead: "Set these on the Worker to continue:",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN: a Cloudflare API token with the Account Analytics: Read permission.",
      ACCESS_KEY: "ACCESS_KEY: the password you will sign in with.",
    },
    shortKey: (minimum) => `ACCESS_KEY: at least ${minimum} characters.`,
    where: "In the Cloudflare dashboard: this Worker → Settings → Variables and Secrets.",
  },

  problem: {
    title: "Connection failed",
    invalid: "The request is not valid.",
    expired: "The request expired or was already used.",
    unverified: "The app asking to connect could not be verified.",
    startAgain: "Try connecting again from the app.",
  },
};
