import { describe, expect, it } from "vitest";

import {
  MAX_CODE_LENGTH,
  MAX_STATE_LENGTH,
  RETURN_PATH,
  decide,
  decodeState,
  isReturnOrigin,
} from "../relay/public/decide.js";
import { DEFAULT_LANGUAGE, TEXT, pickLanguage } from "../relay/public/text.js";
import { decodeState as workerDecodeState } from "../worker/cloudflare-oauth";

/**
 * States written out by hand, with what they say. The relay page and the Worker
 * each read this format with code of their own; holding both to this table
 * keeps either from being checked only against itself.
 */
const KNOWN_STATES = [
  {
    // {"v":1,"o":"https://usage.example.workers.dev","n":"q7Rk2mXw9LpZ4sVt"}
    state: "eyJ2IjoxLCJvIjoiaHR0cHM6Ly91c2FnZS5leGFtcGxlLndvcmtlcnMuZGV2IiwibiI6InE3UmsybVh3OUxwWjRzVnQifQ",
    value: { o: "https://usage.example.workers.dev", n: "q7Rk2mXw9LpZ4sVt" },
  },
  {
    // {"v":1,"o":"http://localhost:8797","n":"Jx3-bN_8Qe5uYc1HdT0aWz6g"}
    state: "eyJ2IjoxLCJvIjoiaHR0cDovL2xvY2FsaG9zdDo4Nzk3IiwibiI6Ikp4My1iTl84UWU1dVljMUhkVDBhV3o2ZyJ9",
    value: { o: "http://localhost:8797", n: "Jx3-bN_8Qe5uYc1HdT0aWz6g" },
  },
  {
    // {"v":1,"o":"http://127.0.0.1:8797","n":"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"}
    state:
      "eyJ2IjoxLCJvIjoiaHR0cDovLzEyNy4wLjAuMTo4Nzk3IiwibiI6IjAxMjM0NTY3ODlhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaXy0ifQ",
    value: { o: "http://127.0.0.1:8797", n: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-" },
  },
  {
    // {"v":1,"o":"https://usage.example.com:8443","n":"__--__--__--__--"}
    state: "eyJ2IjoxLCJvIjoiaHR0cHM6Ly91c2FnZS5leGFtcGxlLmNvbTo4NDQzIiwibiI6Il9fLS1fXy0tX18tLV9fLS0ifQ",
    value: { o: "https://usage.example.com:8443", n: "__--__--__--__--" },
  },
] as const;

const ORIGIN = KNOWN_STATES[0].value.o;
const NONCE = KNOWN_STATES[0].value.n;
const STATE = KNOWN_STATES[0].state;

/** Unpadded base64url of some bytes: how a state is written, without the code that reads it. */
function packBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function pack(text: string): string {
  return packBytes(new TextEncoder().encode(text));
}

function stateOf(value: unknown): string {
  return pack(JSON.stringify(value));
}

describe("the state a usage page sends through Cloudflare", () => {
  it("reads the states written out by hand", () => {
    for (const { state, value } of KNOWN_STATES) {
      expect(decodeState(state), value.o).toEqual(value);
      // The helper the rest of this file writes states with agrees with them too.
      expect(stateOf({ v: 1, ...value }), value.o).toBe(state);
    }
  });

  it("names an https origin", () => {
    for (const o of ["https://usage.example.workers.dev", "https://usage.example.com:8443", "https://xn--bcher-kva.example"]) {
      expect(decodeState(stateOf({ v: 1, o, n: NONCE })), o).toEqual({ o, n: NONCE });
    }
  });

  it("names an http origin only on this computer", () => {
    for (const host of ["localhost", "127.0.0.1"]) {
      for (const o of [`http://${host}`, `http://${host}:8797`]) {
        expect(decodeState(stateOf({ v: 1, o, n: NONCE })), o).toEqual({ o, n: NONCE });
      }
    }
    for (const o of [
      "http://usage.example.com",
      "http://192.168.1.20:8797",
      "http://[::1]:8797",
      "http://127.0.0.2",
      "http://localhost.example.com",
      "http://127.0.0.1.example.com",
      "http://[::2]",
    ]) {
      expect(decodeState(stateOf({ v: 1, o, n: NONCE })), o).toBeNull();
    }
  });

  it("returns only the origin and the nonce", () => {
    expect(decodeState(stateOf({ v: 1, o: ORIGIN, n: NONCE, extra: true }))).toEqual({ o: ORIGIN, n: NONCE });
  });

  it("is turned away in any version but 1", () => {
    for (const v of [2, 0, "1", true, null]) {
      expect(decodeState(stateOf({ v, o: ORIGIN, n: NONCE })), JSON.stringify(v)).toBeNull();
    }
    expect(decodeState(stateOf({ o: ORIGIN, n: NONCE }))).toBeNull();
  });

  it("is turned away with a nonce that is short, long, or in other characters", () => {
    expect(decodeState(stateOf({ v: 1, o: ORIGIN, n: "a".repeat(16) }))).not.toBeNull();
    expect(decodeState(stateOf({ v: 1, o: ORIGIN, n: "a".repeat(64) }))).not.toBeNull();
    for (const n of ["a".repeat(15), "a".repeat(65), "sixteen chars + more", `${NONCE}\n`, "", 1234567890123456, null]) {
      expect(decodeState(stateOf({ v: 1, o: ORIGIN, n })), JSON.stringify(n)).toBeNull();
    }
    expect(decodeState(stateOf({ v: 1, o: ORIGIN }))).toBeNull();
  });

  it("is turned away when the origin is more than an origin, or written another way", () => {
    const turnedAway: Record<string, unknown> = {
      "a path": `${ORIGIN}/connect/return`,
      "a trailing slash": `${ORIGIN}/`,
      "a query": `${ORIGIN}?next=/`,
      "an empty query": `${ORIGIN}?`,
      "a fragment": `${ORIGIN}#top`,
      credentials: "https://owner:secret@usage.example.workers.dev",
      "a user name": "https://owner@usage.example.workers.dev",
      "the default port": "https://usage.example.workers.dev:443",
      capitals: "https://Usage.Example.Workers.dev",
      "a space before it": ` ${ORIGIN}`,
      "a line break after it": `${ORIGIN}\n`,
      "a backslash": "https://usage.example.workers.dev\\@evil.example",
      "no scheme": "usage.example.workers.dev",
      "no host": "https://",
      "256 characters": `https://${`${"a".repeat(63)}.`.repeat(3)}${"b".repeat(52)}.com`,
      "a number": 7,
      "a list": [ORIGIN],
      nothing: null,
    };
    for (const [what, o] of Object.entries(turnedAway)) {
      expect(decodeState(stateOf({ v: 1, o, n: NONCE })), what).toBeNull();
    }
    expect(decodeState(stateOf({ v: 1, n: NONCE }))).toBeNull();
  });

  it("is turned away for every scheme but https and local http", () => {
    for (const o of [
      "javascript:alert(1)",
      "javascript://usage.example.workers.dev/%0Aalert(1)",
      "data:text/html,<form>",
      "data:,",
      "file:///etc/passwd",
      "blob:https://usage.example.workers.dev/0b1f4a52-3a3b-4d39-9a0f-1a2b3c4d5e6f",
      "ftp://usage.example.workers.dev",
      "ws://localhost:8797",
      "wss://usage.example.workers.dev",
      "about:blank",
      "null",
    ]) {
      expect(decodeState(stateOf({ v: 1, o, n: NONCE })), o).toBeNull();
      expect(isReturnOrigin(o), o).toBe(false);
    }
  });

  it("carries the longest origin and nonce inside the length that is read", () => {
    const o = `https://${`${"a".repeat(63)}.`.repeat(3)}${"b".repeat(51)}.com`;
    expect(o).toHaveLength(255);
    const state = stateOf({ v: 1, o, n: "n".repeat(64) });
    expect(state.length).toBeLessThanOrEqual(MAX_STATE_LENGTH);
    expect(decodeState(state)).toEqual({ o, n: "n".repeat(64) });
  });

  it("is read up to 512 characters and no further", () => {
    // 384 bytes are 512 characters; JSON may end in spaces, so only the length differs.
    const json = JSON.stringify({ v: 1, o: ORIGIN, n: NONCE });
    const fits = pack(json.padEnd(384, " "));
    const tooLong = pack(json.padEnd(385, " "));
    expect(fits).toHaveLength(512);
    expect(decodeState(fits)).toEqual({ o: ORIGIN, n: NONCE });
    expect(tooLong.length).toBeGreaterThan(512);
    expect(decodeState(tooLong)).toBeNull();
  });

  it("is turned away when it is not base64url", () => {
    for (const value of [
      "",
      "not base64url!",
      `${STATE}=`,
      `${STATE.slice(0, 10)}+${STATE.slice(10)}`,
      `${STATE.slice(0, 10)}/${STATE.slice(10)}`,
      `${STATE.slice(0, 10)} ${STATE.slice(10)}`,
      `${STATE.slice(0, 10)}%3D${STATE.slice(10)}`,
      // One character more than a whole number of bytes.
      "A",
    ]) {
      expect(decodeState(value), value).toBeNull();
    }
    for (const value of [null, undefined, 7, [STATE]]) expect(decodeState(value)).toBeNull();
  });

  it("is turned away when its bytes are not UTF-8", () => {
    // Good JSON either side of one byte that no UTF-8 text contains.
    const [before, after] = JSON.stringify({ v: 1, o: ORIGIN, n: NONCE, x: "|" }).split("|") as [string, string];
    const encoder = new TextEncoder();
    const state = packBytes(new Uint8Array([...encoder.encode(before), 0xff, ...encoder.encode(after)]));
    expect(decodeState(state)).toBeNull();
    expect(decodeState(pack(`${before}?${after}`))).toEqual({ o: ORIGIN, n: NONCE });
  });

  it("reads the two characters base64url writes in place of + and /", () => {
    const state = pack(`{"v":1,"o":"${ORIGIN}","n":"${NONCE}","x":"???>>>"}`);
    expect(state).toContain("_");
    expect(state).toContain("-");
    expect(decodeState(state)).toEqual({ o: ORIGIN, n: NONCE });
  });

  it("is turned away when it is not JSON, or JSON that is not an object", () => {
    const made = JSON.stringify({ v: 1, o: ORIGIN, n: NONCE });
    for (const text of ["not json", made.slice(0, -1), `${made}${made}`, "null", "1", "true", `"${ORIGIN}"`, `[1,"${ORIGIN}","${NONCE}"]`]) {
      expect(decodeState(pack(text)), text).toBeNull();
    }
  });
});

describe("what the callback page does with Cloudflare's answer", () => {
  it("offers to return a code to the usage page that started the sign-in", () => {
    expect(decide(`?code=4f9a.c0de&state=${STATE}`)).toEqual({
      show: "confirm",
      outcome: "approved",
      origin: ORIGIN,
      action: "https://usage.example.workers.dev/connect/return",
      fields: { code: "4f9a.c0de", state: STATE },
    });
  });

  it("offers to return a refusal as the error alone, and never reads its description", () => {
    const decision = decide(`?error=access_denied&error_description=The+owner+said+no&state=${STATE}`);
    expect(decision).toEqual({
      show: "confirm",
      outcome: "refused",
      origin: ORIGIN,
      action: "https://usage.example.workers.dev/connect/return",
      fields: { error: "access_denied", state: STATE },
    });
    expect(JSON.stringify(decision)).not.toContain("said");
  });

  it("posts to /connect/return on exactly the origin the state names", () => {
    expect(RETURN_PATH).toBe("/connect/return");
    for (const { state, value } of KNOWN_STATES) {
      const decision = decide(`?code=abc&state=${state}`);
      expect(decision).toMatchObject({ origin: value.o, action: `${value.o}/connect/return`, fields: { state } });
    }
  });

  it("passes on a code it can use before an error", () => {
    expect(decide(`?code=abc&error=access_denied&state=${STATE}`)).toMatchObject({
      outcome: "approved",
      fields: { code: "abc", state: STATE },
    });
    expect(decide(`?error=access_denied&code=abc&state=${STATE}`)).toMatchObject({ outcome: "approved" });
    expect(decide(`?code=abc&error=access_denied&state=${STATE}`)).not.toHaveProperty("fields.error");

    // A code it cannot use leaves the error.
    for (const code of ["", "x".repeat(MAX_CODE_LENGTH + 1)]) {
      const decision = decide(`?code=${code}&error=access_denied&state=${STATE}`);
      expect(decision).toMatchObject({ outcome: "refused", fields: { error: "access_denied", state: STATE } });
      expect(decision).not.toHaveProperty("fields.code");
    }
  });

  it("passes on a code of 1 to 2048 characters", () => {
    expect(MAX_CODE_LENGTH).toBe(2048);
    for (const code of ["x", "x".repeat(2048)]) {
      expect(decide(`?code=${code}&state=${STATE}`), String(code.length)).toMatchObject({ fields: { code } });
    }
    for (const code of ["", "x".repeat(2049)]) {
      expect(decide(`?code=${code}&state=${STATE}`), String(code.length)).toEqual({ show: "problem" });
    }
  });

  it("passes on an error only in the characters OAuth allows, up to 100 of them", () => {
    for (const error of ["access_denied", "server error", "!#[]~", "e".repeat(100)]) {
      expect(decide(`?error=${encodeURIComponent(error)}&state=${STATE}`), error).toMatchObject({
        outcome: "refused",
        fields: { error },
      });
    }
    for (const error of ["", "e".repeat(101), 'access"denied', "access\\denied", "access\ndenied", "accès_refusé", "\u007f"]) {
      expect(decide(`?error=${encodeURIComponent(error)}&state=${STATE}`), error).toEqual({ show: "problem" });
    }
  });

  it("reads the query as the browser wrote it, and returns the state as it arrived", () => {
    expect(decide(`?state=${STATE}&code=a%2Fb+c%3Dd%26e`)).toMatchObject({ fields: { code: "a/b c=d&e", state: STATE } });
    // Without the question mark too.
    expect(decide(`code=abc&state=${STATE}`)).toMatchObject({ fields: { code: "abc", state: STATE } });
    // Given twice, the first one counts.
    expect(decide(`?code=abc&state=broken&state=${STATE}`)).toEqual({ show: "problem" });
  });

  it("shows a problem when there is no sign-in to finish", () => {
    for (const search of [
      "",
      "?",
      "?code=abc",
      `?state=${STATE}`,
      `?error_description=no&state=${STATE}`,
      "?code=abc&state=",
      "?code=abc&state=broken",
      `?code=abc&state=${STATE}=`,
      `?code=abc&state=${stateOf({ v: 2, o: ORIGIN, n: NONCE })}`,
      `?code=abc&state=${stateOf({ v: 1, o: "http://usage.example.com", n: NONCE })}`,
      `?code=abc&state=${stateOf({ v: 1, o: "javascript:alert(1)", n: NONCE })}`,
    ]) {
      expect(decide(search), search).toEqual({ show: "problem" });
    }
  });
});

describe("the relay's text", () => {
  /** The keys of a language, with the kind of thing under each. */
  function shape(value: unknown): unknown {
    if (typeof value !== "object" || value === null) return typeof value;
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }

  function strings(value: unknown): string[] {
    if (typeof value === "string") return [value];
    return typeof value === "object" && value !== null ? Object.values(value).flatMap(strings) : [];
  }

  it("has every English string in every language, none of them empty", () => {
    expect(Object.keys(TEXT)).toContain(DEFAULT_LANGUAGE);
    for (const [tag, text] of Object.entries(TEXT)) {
      expect(shape(text), tag).toEqual(shape(TEXT[DEFAULT_LANGUAGE]));
      expect(strings(text).every((sentence) => sentence.trim().length > 0), tag).toBe(true);
    }
  });

  it("says nothing with an exclamation mark", () => {
    for (const [tag, text] of Object.entries(TEXT)) {
      expect(strings(text).filter((sentence) => /[!！]/.test(sentence)), tag).toEqual([]);
    }
  });

  it("is in the first language the browser lists that there is text for", () => {
    const picked: [string[], string][] = [
      [["zh-TW"], "zh-TW"],
      [["zh-tw", "en"], "zh-TW"],
      [["zh-HK", "en"], "zh-TW"],
      [["zh-Hant"], "zh-TW"],
      [["zh-Hant-MO"], "zh-TW"],
      [["it-IT", "zh-Hant-TW", "en"], "zh-TW"],
      [["en-GB", "zh-TW"], "en"],
      [["en"], "en"],
      [["zh-CN", "en"], "zh-CN"],
      [["zh"], "zh-CN"],
      [["zh-Hans-SG"], "zh-CN"],
      [["ja", "de"], "ja"],
      [["ko-KR"], "ko"],
      [["es-MX", "en"], "es"],
      [["fr-CA"], "fr"],
      [["de-AT"], "de"],
      [["pt-PT", "en"], "pt-BR"],
      [["it", "nl"], "en"],
      [["", " "], "en"],
      [[], "en"],
    ];
    for (const [languages, expected] of picked) {
      expect(pickLanguage(languages), languages.join(", ")).toBe(expected);
    }
    expect(pickLanguage(undefined)).toBe("en");
  });
});

describe("the Worker's own reading of a state", () => {
  it("agrees with the relay page on every state written out by hand", () => {
    for (const { state, value } of KNOWN_STATES) {
      expect(workerDecodeState(state), state).toEqual(value);
      expect(decodeState(state), state).toEqual(value);
    }
  });

  it("agrees with the relay page on what it refuses", () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    for (const state of [
      encode({ v: 2, o: ORIGIN, n: NONCE }),
      encode({ v: 1, o: `${ORIGIN}/`, n: NONCE }),
      encode({ v: 1, o: "http://usage.example.com", n: NONCE }),
      encode({ v: 1, o: "http://[::1]:8797", n: NONCE }),
      encode({ v: 1, o: ORIGIN, n: "short" }),
      "not base64url!",
      "",
    ]) {
      expect(workerDecodeState(state), state).toBeNull();
      expect(decodeState(state), state).toBeNull();
    }
  });
});
