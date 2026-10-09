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
