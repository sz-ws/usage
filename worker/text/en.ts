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

  connect: {
    connectTitle: "Connect Cloudflare",
    connectLead: "Two steps. Cloudflare asks you to confirm each one on its own page.",
    reconnectTitle: "Reconnect Cloudflare",
    reconnectLead: "The same two steps as the first time. Your settings and history are kept.",
    findTitle: "Find your accounts",
    findText:
      "Cloudflare tells this page which accounts you have and what they are called. That access is returned as soon as the answer arrives.",
    findAgain: "Choose again",
    grantTitle: "Let this page read usage",
    grantText:
      "This page will see how much each account has used. It cannot see what is stored, and it cannot change anything.",
    grantSame: "Choose the same accounts on Cloudflare's page.",
    button: "Continue with Cloudflare",
    signInLead: "Use a Cloudflare login that has access to this Worker's account.",
    signInButton: "Sign in with Cloudflare",
    askedTitle: "Permissions Cloudflare will ask for",
    askedSettings:
      "Account Settings: Read, in step 1 only. It lists your accounts and their members, and is returned once the names are read.",
    askedAnalytics:
      "Account Analytics: Read, in both steps. It shows how much each product has used. Only the one from step 2 is kept.",
    problemTitle: "Sign-in did not finish",
    tryAgain: "Try again",
    problems: {
      expired: "That sign-in took more than ten minutes, or was started in another browser.",
      declined: "Access was not granted on Cloudflare's page.",
      failed: "Cloudflare did not answer. Try again in a moment.",
      noAccounts: "No account was chosen on Cloudflare's page. Choose the account this Worker runs in.",
      notFound:
        "None of the accounts you chose is running this Worker. If you deployed it in the last few minutes, wait a minute and try again.",
      notAllowed:
        "That Cloudflare login cannot read this Worker's account. On Cloudflare's page, choose the account this Worker runs in.",
      otherAccount: "This page is connected to a different account from the one you chose.",
      notKept: "Cloudflare did not let this page stay connected. Try again.",
      tooMany: "Too many attempts. Try again in a minute.",
    },
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
