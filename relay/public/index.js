/* The page at the bare address: says what the address is for, in the reader's language. */
import { TEXT, pickLanguage } from "./text.js";

const text = TEXT[pickLanguage(navigator.languages)];

document.documentElement.lang = text.lang;
document.title = text.home.title;
document.getElementById("title").textContent = text.home.title;
document.getElementById("body").textContent = text.home.body;
document.getElementById("link").textContent = text.home.link;
document.getElementById("view").hidden = false;
