import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";

import { MIN_ACCESS_KEY_LENGTH, type Setup } from "./env";
import type { PageText } from "./text";

/**
 * The pages the Worker draws itself. Plain HTML and one stylesheet
 * (public/door.css); no script, so the strict policy in http.ts covers them.
 *
 * Client names, hosts and anything else that arrives from outside is escaped
 * here and nowhere else: every dynamic value goes through `escape`.
 */

const REPOSITORY = "https://github.com/sz-ws/usage";
const PUBLISHER = "sz-ws";

const GITHUB_MARK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;

/**
 * Browsers keep the stylesheet for a day. Raised whenever these pages start to
 * need rules an older copy lacks, so no one sees new markup in old styles.
 */
const STYLES_VERSION = 8;

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function document(text: PageText, title: string, body: string): string {
  return `<!doctype html>
<html lang="${escape(text.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#fbfaf9">
<title>${escape(title)} · ${escape(text.product)}</title>
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/door.css?v=${STYLES_VERSION}">
</head>
<body>
<div class="door-shell">
<p class="door-product">${escape(text.product)}</p>
<main class="door">
${body}
</main>
<p class="door-foot"><a class="door-source" href="${REPOSITORY}" rel="noreferrer">${GITHUB_MARK}<span>${PUBLISHER}</span></a></p>
</div>
</body>
</html>`;
}

function keyField(text: PageText): string {
  // The hidden name lets a password manager file the key under something.
  return `<input class="visually-hidden" type="text" name="username" value="owner" autocomplete="username" tabindex="-1" aria-hidden="true">
<label class="door-field">
<span>${escape(text.signIn.keyLabel)}</span>
<input type="password" name="key" required autocomplete="current-password" autofocus>
<small>${escape(text.signIn.keyHint)}</small>
</label>`;
}

export type KeyError = "wrong" | "too-many";

function keyError(text: PageText, error: KeyError | null): string {
  if (!error) return "";
  const message = error === "wrong" ? text.signIn.wrongKey : text.signIn.tooMany;
  return `<p class="door-error" role="alert">${escape(message)}</p>`;
}

export function signInPage(text: PageText, next: string, error: KeyError | null): string {
  return document(
    text,
    text.signIn.title,
    `<h1>${escape(text.signIn.title)}</h1>
${keyError(text, error)}
<form method="post" action="/signin">
<input type="hidden" name="next" value="${escape(next)}">
${keyField(text)}
<button class="door-primary" type="submit">${escape(text.signIn.submit)}</button>
</form>`,
  );
}

/** Cloudflare's mark, in its own two oranges. Drawn here so the pages need no file but the stylesheet. */
const CLOUDFLARE_MARK = `<svg class="door-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
<path fill="#f6821f" d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268z"/>
<path fill="#fbad41" d="M19.2656 11.2813c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"/>
</svg>`;

const CHECK = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The form whose button leaves for Cloudflare. `fields` say which step it starts. */
function cloudflareForm(next: string, fields: Record<string, string>, label: string): string {
  const hidden = Object.entries({ next, ...fields })
    .map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`)
    .join("\n");
  return `<form method="post" action="/connect/start">
${hidden}
<button class="door-cloudflare" type="submit" autofocus>${CLOUDFLARE_MARK}<span>${escape(label)}</span></button>
</form>`;
}

/** The permission names as Cloudflare's own page writes them. The same in every language. */
const PERMISSIONS = { settings: "Account Settings: Read", analytics: "Account Analytics: Read" } as const;

/**
 * One permission: its name set apart, then the sentence about it. The
 * sentences open with the name; where a translation does not, it is shown whole.
 */
function permission(text: PageText, name: string, sentence: string): string {
  if (!sentence.startsWith(name)) return `<li><span>${escape(sentence)}</span></li>`;
  const rest = sentence.slice(name.length).replace(/^[\s,，、:：;；.。-]+/u, "");
  // What followed a comma now opens a line of its own.
  const line = rest.charAt(0).toLocaleUpperCase(text.lang) + rest.slice(1);
  return `<li><strong>${escape(name)}</strong><span>${escape(line)}</span></li>`;
}

function asked(text: PageText): string {
  const words = text.connect;
  return `<details class="door-more">
<summary>${escape(words.askedTitle)}</summary>
<ul>
${permission(text, PERMISSIONS.settings, words.askedSettings)}
${permission(text, PERMISSIONS.analytics, words.askedAnalytics)}
</ul>
</details>`;
}

/** The first letter of an account's name, in the round mark beside it. */
function initial(name: string): string {
  const [first = "?"] = name.trim();
  return `<span class="door-avatar" aria-hidden="true">${escape(first.toLocaleUpperCase())}</span>`;
}

export interface ConnectView {
  /** Connecting again, as opposed to for the first time. */
  again: boolean;
  /** The accounts the first step found, home first. Null until it has been through. */
  found: readonly { name: string }[] | null;
  next: string;
  tooMany: boolean;
}

/**
 * Connecting, as two steps on one page: the visitor goes to Cloudflare for the
 * first, comes back to see it done, and goes again for the second. One button
 * at the foot of the card starts whichever step is in turn.
 */
export function connectPage(text: PageText, view: ConnectView): string {
  const words = text.connect;
  const title = view.again ? words.reconnectTitle : words.connectTitle;
  const again: Record<string, string> = view.again ? { again: "1" } : {};

  const first = view.found
    ? `<li class="door-step is-done">
<span class="door-step-mark">${CHECK}</span>
<div>
<div class="door-step-head">
<h2>${escape(words.findTitle)}</h2>
<form method="post" action="/connect/start">
<input type="hidden" name="next" value="${escape(view.next)}">
<input type="hidden" name="again" value="1">
<button class="door-link" type="submit">${escape(words.findAgain)}</button>
</form>
</div>
<ul class="door-accounts">
${view.found.map((account) => `<li>${initial(account.name)}<span>${escape(account.name)}</span></li>`).join("\n")}
</ul>
</div>
</li>`
    : `<li class="door-step is-current">
<span class="door-step-mark" aria-hidden="true">1</span>
<div>
<h2>${escape(words.findTitle)}</h2>
<p>${escape(words.findText)}</p>
</div>
</li>`;

  const second = `<li class="door-step ${view.found ? "is-current" : "is-waiting"}">
<span class="door-step-mark" aria-hidden="true">2</span>
<div>
<h2>${escape(words.grantTitle)}</h2>
<p>${escape(words.grantText)}</p>
${view.found ? `<p class="door-step-note">${escape(words.grantSame)}</p>` : ""}
</div>
</li>`;

  return document(
    text,
    title,
    `<h1>${escape(title)}</h1>
${view.tooMany ? `<p class="door-error" role="alert">${escape(words.problems.tooMany)}</p>` : ""}
<p class="door-lead">${escape(view.again ? words.reconnectLead : words.connectLead)}</p>
<ol class="door-steps">
${first}
${second}
</ol>
${asked(text)}
${cloudflareForm(view.next, view.found ? { step: "grant" } : again, words.button)}`,
  );
}

/** Coming back to a page that is already connected. */
export function cloudflareSignInPage(text: PageText, next: string, tooMany: boolean): string {
  const words = text.connect;
  return document(
    text,
    text.signIn.title,
    `<h1>${escape(text.signIn.title)}</h1>
${tooMany ? `<p class="door-error" role="alert">${escape(words.problems.tooMany)}</p>` : ""}
<p class="door-lead">${escape(words.signInLead)}</p>
${cloudflareForm(next, {}, words.signInButton)}`,
  );
}

export function connectProblemPage(text: PageText, reason: string): string {
  return document(
    text,
    text.connect.problemTitle,
    `<h1>${escape(text.connect.problemTitle)}</h1>
<p class="door-lead">${escape(reason)}</p>
${cloudflareForm("/", {}, text.connect.tryAgain)}`,
  );
}

export interface ConsentView {
  details: ConsentDescription;
  handle: string;
}

/**
 * Where the client's address leads, in words. A web address is named by its
 * host. Anything else (`cursor://…`) is handed to whichever app on this
 * computer has claimed that kind of link, and the part that looks like a host
 * says nothing about who that is, so the kind of link is what gets named.
 */
function destination(text: PageText, details: ConsentDescription): { sentence: string; local: boolean } {
  let scheme = "";
  try {
    scheme = new URL(details.redirectUri).protocol;
  } catch {
    // The library has validated the address; an unreadable one is treated as an app's.
  }
  if (scheme === "https:" || scheme === "http:") {
    return { sentence: text.consent.sentTo(details.redirectHost), local: details.redirectIsLoopback };
  }
  return { sentence: text.consent.sentToApp(scheme || details.redirectUri), local: true };
}

export function consentPage(text: PageText, view: ConsentView): string {
  const { details } = view;
  const publisher = details.clientDomain ? text.consent.publishedBy(details.clientDomain) : text.consent.selfNamed;
  const { sentence, local } = destination(text, details);

  return document(
    text,
    text.consent.title(details.clientName),
    `<h1>${escape(text.consent.title(details.clientName))}</h1>
<p>${escape(text.consent.scope)}</p>
<p class="door-facts">${escape(publisher)} ${escape(sentence)}</p>
${local ? `<p class="door-caution">${escape(text.consent.loopback)}</p>` : ""}
<form method="post">
<input type="hidden" name="handle" value="${escape(view.handle)}">
<div class="door-actions">
<button class="door-primary" type="submit" name="decision" value="approve">${escape(text.consent.allow)}</button>
<button type="submit" name="decision" value="deny">${escape(text.consent.deny)}</button>
</div>
</form>`,
  );
}

export function setupPage(text: PageText, setup: Extract<Setup, { ready: false }>): string {
  const items = setup.missing.map((name) => text.setup.missing[name]);
  if (setup.shortKey) items.push(text.setup.shortKey(MIN_ACCESS_KEY_LENGTH));

  return document(
    text,
    text.setup.title,
    `<h1>${escape(text.setup.title)}</h1>
<p>${escape(text.setup.lead)}</p>
<ul class="door-list">
${items.map((item) => `<li>${escape(item)}</li>`).join("\n")}
</ul>
<p>${escape(text.setup.where)}</p>`,
  );
}

export function problemPage(text: PageText, reason: string): string {
  return document(
    text,
    text.problem.title,
    `<h1>${escape(text.problem.title)}</h1>
<p>${escape(reason)}</p>
<p>${escape(text.problem.startAgain)}</p>`,
  );
}
