import type { SecretName } from "../env";

/**
 * The words on the pages the Worker draws itself: signing in, letting an agent
 * connect, and a deployment that is not finished. The usage page has its own
 * dictionary in shared/i18n; these never reach the browser bundle.
 *
 * One file per language beside this one, each exporting a `PageText`.
 */

export interface PageText {
  lang: string;
  product: string;

  signIn: {
    title: string;
    keyLabel: string;
    keyHint: string;
    submit: string;
    wrongKey: string;
    tooMany: string;
  };

  /** Signing in with Cloudflare, for a deployment that reads through the owner's own sign-in. */
  connect: {
    connectTitle: string;
    connectLead: string;
    reconnectTitle: string;
    reconnectLead: string;
    /** The first step: Cloudflare says which accounts there are. */
    findTitle: string;
    findText: string;
    /** Beside a finished first step, to go through it again with other accounts. */
    findAgain: string;
    /** The second step: the access this page keeps. */
    grantTitle: string;
    grantText: string;
    /** Shown once the first step is done: Cloudflare's page asks for the accounts again. */
    grantSame: string;
    /** The button that leaves for Cloudflare, in either step. */
    button: string;
    signInLead: string;
    signInButton: string;
    /** Opens the list of permissions Cloudflare's own page will name. */
    askedTitle: string;
    askedSettings: string;
    askedAnalytics: string;
    problemTitle: string;
    tryAgain: string;
    problems: {
      /** Took too long, or the answer belongs to another browser's attempt. */
      expired: string;
      declined: string;
      failed: string;
      noAccounts: string;
      /** None of the chosen accounts is the one this Worker runs in. */
      notFound: string;
      notAllowed: string;
      otherAccount: string;
      /** Cloudflare gave no way to stay connected. */
      notKept: string;
      tooMany: string;
    };
  };

  consent: {
    title: (client: string) => string;
    scope: string;
    publishedBy: (domain: string) => string;
    selfNamed: string;
    sentTo: (host: string) => string;
    /** For an app that is reached through links of its own kind (`cursor:`), not a web address. */
    sentToApp: (scheme: string) => string;
    loopback: string;
    allow: string;
    deny: string;
  };

  setup: {
    title: string;
    lead: string;
    missing: Record<SecretName, string>;
    shortKey: (minimum: number) => string;
    where: string;
  };

  problem: {
    title: string;
    invalid: string;
    expired: string;
    unverified: string;
    startAgain: string;
  };
}
