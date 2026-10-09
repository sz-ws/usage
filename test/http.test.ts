import { describe, expect, it } from "vitest";

import {
  formTargetOf,
  html,
  isCrossSiteSubrequest,
  isForeignCall,
  isLoopback,
  isOpenAsset,
  isTopLevelVisit,
  keepFor,
  limitKeyOf,
  nextPath,
  overLimit,
  redirect,
  secured,
  signInAddress,
} from "../worker/http";
import { consentPage, escape, setupPage, signInPage } from "../worker/pages";
import { pageText } from "../worker/text";

const ORIGIN = "https://usage.example.workers.dev";
const request = (headers: Record<string, string>, method = "GET") =>
  new Request(`${ORIGIN}/api/state`, { method, headers });

describe("where a form may send the browser", () => {
  it("is the origin of a web address", () => {
    expect(formTargetOf("https://claude.ai/api/mcp/auth_callback?x=1")).toBe("https://claude.ai");
    expect(formTargetOf("http://127.0.0.1:53199/callback")).toBe("http://127.0.0.1:53199");
    expect(formTargetOf("http://localhost:6274/oauth/callback")).toBe("http://localhost:6274");
  });

  it("is the scheme of an app's own address", () => {
    expect(formTargetOf("cursor://anysphere.cursor-mcp/oauth/callback")).toBe("cursor:");
    expect(formTargetOf("com.example.app:/oauth")).toBe("com.example.app:");
  });

  it("is nothing for an address that is not one", () => {
    expect(formTargetOf("not a url")).toBeNull();
    expect(formTargetOf("")).toBeNull();
  });

  it("cannot carry anything else into the policy", () => {
    for (const address of [
      "https://evil.example/;script-src *",
      "https://evil.example/ 'unsafe-inline'",
      "https://a.example\r\nset-cookie: x=1",
      "x;y://host/",
    ]) {
      const target = formTargetOf(address);
      if (target !== null) expect(target, address).toMatch(/^[a-z][a-z0-9+.-]*:(\/\/[a-z0-9.:[\]-]+)?$/);
    }
    // The URL parser accepts these hosts; a policy would read them as a wildcard or a new directive.
    expect(formTargetOf("https://*/cb")).toBeNull();
    expect(formTargetOf("https://a;sandbox/cb")).toBeNull();
    expect(formTargetOf("https://a,b/cb")).toBeNull();
  });
});

describe("the headers every response leaves with", () => {
  it("allow nothing the pages do not need, and keep nothing in shared caches", () => {
    const response = secured(html("<p>hi</p>"));
    const policy = response.headers.get("content-security-policy") ?? "";
    for (const part of ["default-src 'none'", "script-src 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
      expect(policy).toContain(part);
    }
    expect(policy).not.toContain("unsafe");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("widen form-action for one response only when asked", () => {
    const policy = secured(html("x"), "none", "https://claude.ai").headers.get("content-security-policy");
    expect(policy).toContain("form-action 'self' https://claude.ai");
    expect(secured(html("x")).headers.get("content-security-policy")).toMatch(/form-action 'self'$/);
  });

  it("keep hashed files for good, the sign-in page's files for a day, and pages not at all", () => {
    expect(keepFor("/assets/index-abc.js", 200)).toBe("forever");
    expect(keepFor("/assets/index-abc.js", 304)).toBe("forever");
    expect(keepFor("/door.css", 200)).toBe("day");
    expect(keepFor("/fonts/inter.woff2", 200)).toBe("day");
    expect(keepFor("/", 200)).toBe("none");
    expect(keepFor("/assets/missing.js", 404)).toBe("none");
  });

  it("redirect without being cached, with 303 after a form", () => {
    expect(redirect("/signin").status).toBe(302);
    expect(redirect("/", 303).status).toBe(303);
    expect(redirect("/").headers.get("cache-control")).toBe("no-store");
  });
});

describe("where signing in leads", () => {
  it("is a path on this site", () => {
    expect(nextPath("/")).toBe("/");
    expect(nextPath("/?account=work&open=d1.rowsRead")).toBe("/?account=work&open=d1.rowsRead");
    expect(nextPath("/authorize?client_id=a&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb")).toBe(
      "/authorize?client_id=a&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb",
    );
  });

  it("is never somewhere else, however the address is dressed up", () => {
    for (const value of [
      null,
      "",
      "evil.example",
      "https://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "/a\\b",
      // A browser drops tabs and newlines before reading an address: these become //evil.example.
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      "/\u0000/evil.example",
    ]) {
      expect(nextPath(value), JSON.stringify(value)).toBe("/");
    }
  });

  it("remembers the page that was asked for", () => {
    expect(signInAddress(new URL(`${ORIGIN}/`))).toBe("/signin");
    expect(signInAddress(new URL(`${ORIGIN}/?open=kv.reads`))).toBe("/signin?next=%2F%3Fopen%3Dkv.reads");
    expect(signInAddress(new URL(`${ORIGIN}/signin?next=%2F%3Fa%3D1`), "wrong")).toBe(
      "/signin?next=%2F%3Fa%3D1&error=wrong",
    );
    expect(signInAddress(new URL(`${ORIGIN}/signin?next=%2F%09%2Fevil.example`))).toBe("/signin");
  });
});

describe("counting callers", () => {
  it("counts an IPv4 address as itself and an IPv6 address as its /64", () => {
    expect(limitKeyOf("203.0.113.9")).toBe("203.0.113.9");
    expect(limitKeyOf("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3:8d3");
    expect(limitKeyOf("2001:db8:85a3:8d3::1")).toBe("2001:db8:85a3:8d3");
    expect(limitKeyOf("2001:0DB8:0000:0001:ffff:ffff:ffff:ffff")).toBe("2001:db8:0:1");
    expect(limitKeyOf("2001:db8::1")).toBe("2001:db8:0:0");
    expect(limitKeyOf("::1")).toBe("0:0:0:0");
    expect(limitKeyOf("2001:db8:1:2::")).toBe("2001:db8:1:2");
  });

  it("asks the limiter once per caller, and lets everyone through when there is nothing to count with", async () => {
    const asked: string[] = [];
    const limit = {
      limit: async ({ key }: { key: string }) => {
        asked.push(key);
        return { success: asked.length < 2 };
      },
    } as unknown as RateLimit;
    const from = (ip?: string) => new Request(ORIGIN, { headers: ip ? { "cf-connecting-ip": ip } : {} });

    expect(await overLimit(limit, from("2001:db8:1:2:3:4:5:6"))).toBe(false);
    expect(await overLimit(limit, from("2001:db8:1:2:ffff::1"))).toBe(true);
    expect(asked).toEqual(["2001:db8:1:2", "2001:db8:1:2"]);

    expect(await overLimit(undefined, from("203.0.113.9"))).toBe(false);
    expect(await overLimit(limit, from())).toBe(false);
  });

  it("knows a developer's own machine from the internet", () => {
    for (const host of ["localhost", "127.0.0.1", "127.8.9.10", "[::1]"]) expect(isLoopback(host), host).toBe(true);
    for (const host of ["usage.example.workers.dev", "127.0.0.1.evil.example", "localhost.evil.example", "10.0.0.1"]) {
      expect(isLoopback(host), host).toBe(false);
    }
  });
});

describe("what is served before anyone signs in", () => {
  it("is the sign-in page's own files and nothing else", () => {
    for (const path of ["/door.css", "/favicon.ico", "/fonts/inter-latin-wght-normal.woff2"]) {
      expect(isOpenAsset(path), path).toBe(true);
    }
    for (const path of ["/", "/index.html", "/assets/index.js", "/door.css.map", "/api/state", "/fontsx"]) {
      expect(isOpenAsset(path), path).toBe(false);
    }
  });
});

describe("telling this page's requests from another site's", () => {
  it("turns away another site's fetches, frames and scripts", () => {
    expect(isCrossSiteSubrequest(request({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" }))).toBe(true);
    expect(isCrossSiteSubrequest(request({ "sec-fetch-site": "same-site", "sec-fetch-mode": "no-cors" }))).toBe(true);
    expect(isCrossSiteSubrequest(request({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }))).toBe(false);
    expect(isCrossSiteSubrequest(request({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" }))).toBe(false);
    expect(isCrossSiteSubrequest(request({}))).toBe(false);
  });

  it("knows a person opening an address from a script fetching it", () => {
    const visit = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
    expect(isTopLevelVisit(request(visit))).toBe(true);
    expect(isTopLevelVisit(request({ ...visit, "sec-fetch-dest": "iframe" }))).toBe(false);
    expect(isTopLevelVisit(request(visit, "POST"))).toBe(false);
    expect(isTopLevelVisit(request({}))).toBe(false);
  });

  it("holds writes to this exact origin", () => {
    const url = new URL(`${ORIGIN}/api/settings`);
    expect(isForeignCall(request({ origin: ORIGIN }, "PUT"), url)).toBe(false);
    expect(isForeignCall(request({ origin: "https://evil.example" }, "PUT"), url)).toBe(true);
    expect(isForeignCall(request({}, "PUT"), url)).toBe(true);
    expect(isForeignCall(request({ origin: ORIGIN, "sec-fetch-site": "same-site" }, "PUT"), url)).toBe(true);
    expect(isForeignCall(request({}), url)).toBe(false);
    expect(isForeignCall(request({ "sec-fetch-site": "cross-site" }), url)).toBe(true);
  });
});

describe("the pages the Worker draws", () => {
  const text = pageText("en");

  it("escape everything that can open a tag or close an attribute", () => {
    expect(escape(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&#60;a href=&#34;x&#34; onclick=&#39;y&#39;&#62;&#38;&#60;/a&#62;",
    );
  });

  it("carry no script and no inline style", () => {
    const pages = [
      signInPage(text, "/", "wrong"),
      setupPage(text, { ready: false, missing: ["ANALYTICS_TOKEN", "ACCESS_KEY"], shortKey: false }),
      consentPage(text, {
        details: {
          clientId: "c",
          clientName: "Claude",
          clientDomain: "claude.ai",
          redirectUri: "https://claude.ai/cb",
          redirectHost: "claude.ai",
          redirectIsLoopback: false,
          scope: [],
        },
        handle: "h",
      }),
    ];
    for (const page of pages) {
      expect(page).not.toMatch(/<script|\sstyle=|\son[a-z]+=|javascript:/i);
      expect(page).toMatch(/<link rel="stylesheet" href="\/door\.css\?v=\d+">/);
    }
  });

  it("put where to go next into the form without letting it break out", () => {
    const page = signInPage(text, '/?a="><script>alert(1)</script>', null);
    expect(page).not.toContain("<script>");
    expect(page).toContain("&#34;&#62;&#60;script&#62;");
  });

  it("say when a client is an app on this computer, and who published one that says", () => {
    const view = (overrides: object) =>
      consentPage(text, {
        details: {
          clientId: "c",
          clientName: "Some app",
          redirectUri: "http://127.0.0.1:1/cb",
          redirectHost: "127.0.0.1",
          redirectIsLoopback: true,
          scope: [],
          ...overrides,
        },
        handle: "h",
      });

    expect(view({})).toContain("door-caution");
    expect(view({})).toContain(text.consent.selfNamed);
    expect(view({})).toContain("Access will be sent to 127.0.0.1.");

    const web = view({ redirectUri: "https://claude.ai/cb", redirectHost: "claude.ai", redirectIsLoopback: false });
    expect(web).not.toContain("door-caution");
    expect(web).toContain("Access will be sent to claude.ai.");
    expect(view({ clientDomain: "example.com" })).toContain("Published by example.com.");

    // The key is never asked for here: whoever sees this page has signed in.
    expect(view({})).not.toContain('name="key"');
  });

  it("names an app's own kind of link, not the host-looking part inside it", () => {
    const page = consentPage(text, {
      details: {
        clientId: "c",
        clientName: "Some app",
        redirectUri: "myapp://claude.ai/callback",
        redirectHost: "claude.ai",
        redirectIsLoopback: false,
        scope: [],
      },
      handle: "h",
    });
    expect(page).toContain("opens myapp: links");
    expect(page).not.toContain("sent to claude.ai");
    expect(page).toContain("door-caution");
  });

  it("exist in both languages with the same shape", () => {
    const shape = (value: unknown): unknown =>
      typeof value === "object" && value !== null
        ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]))
        : typeof value;
    expect(shape(pageText("zh-TW"))).toEqual(shape(pageText("en")));
    expect(pageText("zh-TW").lang).toBe("zh-Hant");
  });
});
