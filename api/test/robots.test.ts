import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { sitemapEntries } from "../lib/sitemap";

/**
 * robots.txt mot sitemapet.
 *
 * `Disallow` er en prefiksregel, ikke en stimatch: «Disallow: /reise» (ment
 * for Min reise) sperret også /reisemal og alle reisemålssidene – 26 av 63
 * URL-er i sitemapet, og Search Console svarte «Blocked by robots.txt».
 *
 * Testen leser den faktiske public/robots.txt, bruker Googles og Bings
 * matchingregel (lengste treffende mønster vinner, Allow vinner ved lik
 * lengde, `*` er jokertegn, `$` er slutt på URL) og krever at hver URL i
 * sitemapet er tillatt – og at det som skal være sperret, fortsatt er det.
 */

type Rule = { allow: boolean; pattern: string };

/** Reglene i gruppen for `User-agent: *`. */
function parseRobots(text: string): Rule[] {
  const rules: Rule[] = [];
  // Flere user-agent-linjer rett etter hverandre danner én gruppe; reglene
  // under gjelder alle agentene i gruppen.
  let agents: string[] = [];
  let collecting = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (field === "user-agent") {
      if (!collecting) agents = [];
      collecting = true;
      agents.push(value.toLowerCase());
      continue;
    }
    if (field === "allow" || field === "disallow") {
      collecting = false;
      if (!agents.includes("*") || value === "") continue;
      rules.push({ allow: field === "allow", pattern: value });
    }
  }
  return rules;
}

/** Google: mønsteret matcher fra starten av stien; `*` = hva som helst, `$` = slutt. */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Lengste treffende mønster vinner; Allow vinner ved lik lengde. Ingen treff = tillatt. */
export function isAllowed(rules: Rule[], urlPath: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!patternToRegex(r.pattern).test(urlPath)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow && !best.allow)) best = r;
  }
  return best ? best.allow : true;
}

const robotsTxt = fs.readFileSync(path.resolve(process.cwd(), "public/robots.txt"), "utf-8");
const rules = parseRobots(robotsTxt);

describe("robots.txt", () => {
  it("har en regelgruppe for alle crawlere", () => {
    expect(rules.length).toBeGreaterThan(0);
  });

  it("tillater hver URL i sitemapet", () => {
    const blocked = sitemapEntries("2026-09-19")
      .map((e) => new URL(e.loc).pathname)
      .filter((p) => !isAllowed(rules, p));
    expect(blocked).toEqual([]);
  });

  it("sperrer fortsatt det som ikke skal i søk", () => {
    for (const p of ["/reise", "/reiser", "/bestill", "/bestill?offer=x", "/profil", "/profil/varsler", "/admin", "/admin/logg-inn", "/sok", "/sok?from=OSL&to=LIS", "/api/", "/api/trpc/flights.search"]) {
      expect({ path: p, allowed: isAllowed(rules, p) }).toEqual({ path: p, allowed: false });
    }
  });

  it("peker på sitemapet", () => {
    expect(robotsTxt).toContain("Sitemap: https://hellosky.no/sitemap.xml");
  });
});

describe("matchingregelen", () => {
  it("lar lengste treff vinne, og Allow ved lik lengde", () => {
    const r: Rule[] = [
      { allow: false, pattern: "/reise" },
      { allow: true, pattern: "/reisemal" },
    ];
    expect(isAllowed(r, "/reise")).toBe(false);
    expect(isAllowed(r, "/reisemal")).toBe(true);
    expect(isAllowed(r, "/reisemal/erbil")).toBe(true);
    expect(isAllowed([{ allow: false, pattern: "/a" }, { allow: true, pattern: "/a" }], "/a")).toBe(true);
  });

  it("forstår $ og *", () => {
    expect(isAllowed([{ allow: false, pattern: "/reise$" }], "/reise")).toBe(false);
    expect(isAllowed([{ allow: false, pattern: "/reise$" }], "/reisemal")).toBe(true);
    expect(isAllowed([{ allow: false, pattern: "/*.pdf$" }], "/a/b.pdf")).toBe(false);
    expect(isAllowed([{ allow: false, pattern: "/*.pdf$" }], "/a/b.pdfx")).toBe(true);
  });
});
