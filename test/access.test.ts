import { describe, expect, it } from "vitest";

import {
  SESSION_TTL_MS,
  bearerOf,
  clearedCookie,
  isSignedIn,
  issueSession,
  sameSecret,
  sessionCookie,
  sessionOf,
  verifySession,
} from "../worker/access";
import { MIN_ACCESS_KEY_LENGTH, setupOf, tokensOf } from "../worker/env";

const KEY = "correct horse battery staple";
const NOW = Date.parse("2026-10-09T12:00:00Z");

describe("the access key", () => {
  it("matches itself and nothing else", async () => {
    expect(await sameSecret(KEY, KEY)).toBe(true);
    expect(await sameSecret(`${KEY} `, KEY)).toBe(false);
    expect(await sameSecret(KEY.slice(0, -1), KEY)).toBe(false);
    expect(await sameSecret(KEY.toUpperCase(), KEY)).toBe(false);
  });

  it("never matches when either side is empty", async () => {
    expect(await sameSecret("", KEY)).toBe(false);
    expect(await sameSecret(KEY, "")).toBe(false);
    expect(await sameSecret("", "")).toBe(false);
  });

  it("is read from a bearer header, whatever the case of the scheme", () => {
    expect(bearerOf("Bearer abc")).toBe("abc");
    expect(bearerOf("bearer   abc")).toBe("abc");
    expect(bearerOf("Basic abc")).toBeNull();
    expect(bearerOf("Bearer")).toBeNull();
    expect(bearerOf("Bearer a b")).toBeNull();
    expect(bearerOf(null)).toBeNull();
  });
});

describe("a browser session", () => {
  it("is accepted until it expires", async () => {
    const session = await issueSession(KEY, NOW);
    expect(await verifySession(session, KEY, NOW)).toBe(true);
    expect(await verifySession(session, KEY, NOW + SESSION_TTL_MS - 1)).toBe(true);
    expect(await verifySession(session, KEY, NOW + SESSION_TTL_MS)).toBe(false);
  });

  it("stops working when the access key changes", async () => {
    const session = await issueSession(KEY, NOW);
    expect(await verifySession(session, `${KEY}!`, NOW)).toBe(false);
  });

  it("cannot have its expiry pushed back", async () => {
    const session = await issueSession(KEY, NOW);
    const [version, expiry, signature] = session.split(".");
    const later = `${version}.${Number(expiry) + SESSION_TTL_MS}.${signature}`;
    expect(await verifySession(later, KEY, NOW)).toBe(false);
  });

  it("is refused when it is not one of ours", async () => {
    const session = await issueSession(KEY, NOW);
    const [, expiry, signature] = session.split(".");
    for (const forged of [
      "",
      "v1",
      `v1.${expiry}`,
      `v2.${expiry}.${signature}`,
      `v1.${expiry}.${signature}.extra`,
      `v1.${expiry}.not base64!`,
      `v1.1e99.${signature}`,
      `v1.${expiry}.AAAA`,
    ]) {
      expect(await verifySession(forged, KEY, NOW), forged).toBe(false);
    }
  });

  it("travels in a cookie only this host can set, over HTTPS", () => {
    const cookie = sessionCookie("v1.1.sig", true);
    expect(cookie).toContain("__Host-usage-session=v1.1.sig");
    for (const attribute of ["Path=/", "HttpOnly", "SameSite=Lax", "Secure", "Max-Age=2592000"]) {
      expect(cookie).toContain(attribute);
    }
    expect(cookie).not.toContain("Domain");
  });

  it("drops Secure and the host prefix on plain HTTP, which is only ever localhost", () => {
    const cookie = sessionCookie("v1.1.sig", false);
    expect(cookie.startsWith("usage-session=v1.1.sig")).toBe(true);
    expect(cookie).not.toContain("Secure");
  });

  it("is cleared by a cookie of the same name that has already expired", () => {
    expect(clearedCookie(true)).toContain("__Host-usage-session=;");
    expect(clearedCookie(true)).toContain("Max-Age=0");
  });

  it("is found by its exact name among other cookies", () => {
    expect(sessionOf("a=1; __Host-usage-session=v1.2.s; b=2", true)).toBe("v1.2.s");
    expect(sessionOf("x__Host-usage-session=bad; __Host-usage-session-2=bad", true)).toBeNull();
    // The plain name is only read on plain HTTP, the prefixed one only on HTTPS.
    expect(sessionOf("usage-session=v1.2.s", true)).toBeNull();
    expect(sessionOf("__Host-usage-session=v1.2.s", false)).toBeNull();
    expect(sessionOf(null, true)).toBeNull();
    expect(sessionOf("novalue", true)).toBeNull();
  });

  it("signs a request in when its cookie verifies", async () => {
    const session = await issueSession(KEY, Date.now());
    const withCookie = (cookie: string) =>
      new Request("https://usage.example/", { headers: { cookie } });

    expect(await isSignedIn(withCookie(`__Host-usage-session=${session}`), KEY, Date.now())).toBe(true);
    expect(await isSignedIn(withCookie(`__Host-usage-session=${session}x`), KEY, Date.now())).toBe(false);
    expect(await isSignedIn(new Request("https://usage.example/"), KEY, Date.now())).toBe(false);
  });
});

describe("what a deployment needs before it serves anything", () => {
  const TOKEN = "cfat_example";

  it("is ready with a token and a long enough key", () => {
    expect(setupOf({ ANALYTICS_TOKEN: TOKEN, ACCESS_KEY: ` ${KEY} ` })).toEqual({
      ready: true,
      accessKey: KEY,
      tokens: [TOKEN],
    });
  });

  it("names what is missing", () => {
    expect(setupOf({})).toEqual({ ready: false, missing: ["ANALYTICS_TOKEN", "ACCESS_KEY"], shortKey: false });
    expect(setupOf({ ANALYTICS_TOKEN: TOKEN, ACCESS_KEY: "   " })).toEqual({
      ready: false,
      missing: ["ACCESS_KEY"],
      shortKey: false,
    });
    expect(setupOf({ ACCESS_KEY: KEY })).toEqual({ ready: false, missing: ["ANALYTICS_TOKEN"], shortKey: false });
  });

  it("refuses a key short enough to guess", () => {
    const short = "x".repeat(MIN_ACCESS_KEY_LENGTH - 1);
    expect(setupOf({ ANALYTICS_TOKEN: TOKEN, ACCESS_KEY: short })).toEqual({
      ready: false,
      missing: [],
      shortKey: true,
    });
    expect(setupOf({ ANALYTICS_TOKEN: TOKEN, ACCESS_KEY: `${short}x` }).ready).toBe(true);
  });

  it("takes several tokens however they were separated, once each", () => {
    expect(tokensOf({ ANALYTICS_TOKEN: "a, b\nc;d  a" })).toEqual(["a", "b", "c", "d"]);
    expect(tokensOf({ ANALYTICS_TOKEN: "" })).toEqual([]);
    expect(tokensOf({})).toEqual([]);
  });
});
