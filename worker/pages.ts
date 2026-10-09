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
<link rel="stylesheet" href="/door.css">
</head>
<body>
<main class="door">
<p class="door-product">${escape(text.product)}</p>
${body}
</main>
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
