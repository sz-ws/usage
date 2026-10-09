/*
 * The callback page: reads what Cloudflare sent, shows where it would go, and
 * sends it there only when the button is pressed. What to show is decided in
 * decide.js; this file puts it on the page. Everything that came from the
 * address is written with textContent or as a field's value, never as HTML.
 */
import { decide } from "./decide.js";
import { TEXT, pickLanguage } from "./text.js";

// Read once, then taken out of the address bar and out of this history entry
// before anything else happens, so the code is not left where it can be found.
const search = location.search;
history.replaceState(null, "", location.pathname);

const decision = decide(search);
const text = TEXT[pickLanguage(navigator.languages)];

function say(id, words) {
  document.getElementById(id).textContent = words;
}

/** Posts the answer to the usage page, as a form so the browser goes there with it. */
function post({ action, fields }) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    form.append(field);
  }
  document.body.append(form);
  form.submit();
}

document.documentElement.lang = text.lang;

if (decision.show === "confirm") {
  const words = text[decision.outcome];
  document.title = `${words.title} · ${text.product}`;
  say("title", words.title);
  say("lead", words.lead);
  say("origin", decision.origin);
  say("warning", words.warning);
  say("continue", words.submit);
  say("stop", words.stop);

  const button = document.getElementById("continue");
  button.addEventListener("click", () => {
    // The code works once; a second press would only send it again.
    button.disabled = true;
    post(decision);
  });
  document.getElementById("confirm").hidden = false;
} else {
  document.title = `${text.problem.title} · ${text.product}`;
  say("title", text.problem.title);
  say("lead", text.problem.body);
}

document.getElementById("view").hidden = false;
