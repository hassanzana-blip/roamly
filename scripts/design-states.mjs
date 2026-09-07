// Interaction-state screenshots (open sheets, popovers, filled forms).
//   node scripts/design-states.mjs <prefix> <scenario>[,<scenario>...] [--base URL] [--widths 390,1440]
// Scenarios: airport-to | travelers | dates | prefs-more | results-filters
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const prefix = args[0];
const scenarios = (args[1] ?? "airport-to").split(",");
const get = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const base = get("--base", process.env.BASE_URL ?? "http://localhost:3411");
const widths = get("--widths", "390,1440").split(",").map(Number);
const outDir = path.resolve("artifacts/design-review");
fs.mkdirSync(outDir, { recursive: true });

const d1 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const d2 = new Date(Date.now() + 37 * 864e5).toISOString().slice(0, 10);
const SOK = `/sok?from=OSL&to=IST&depart=${d1}&ret=${d2}&adults=2&children=1&infants=0&cabin=economy`;

const STEPS = {
  "airport-to": async (page) => {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Til\b/ }).first().click();
    await page.waitForTimeout(700);
  },
  travelers: async (page) => {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Reisende\b/ }).first().click();
    await page.waitForTimeout(500);
    // add a child and an infant so the party row has something to show
    await page.getByRole("button", { name: /^Flere barn/ }).first().click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /^Flere (baby|spedbarn)/i }).first().click().catch(() => {});
    await page.waitForTimeout(700);
  },
  dates: async (page) => {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Datoer\b/ }).first().click();
    await page.waitForTimeout(700);
  },
  "prefs-more": async (page) => {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Flere hensyn/ }).first().click();
    await page.waitForTimeout(400);
  },
  "results-filters": async (page) => {
    await page.goto(base + SOK, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    const btn = page.getByRole("button", { name: /^Filt/ }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(700); }
  },
  "results-details": async (page) => {
    await page.goto(base + SOK, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /Se flydetaljer/ }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /Se flydetaljer|Skjul detaljer/ }).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -160));
    await page.waitForTimeout(300);
  },
  checkout: async (page) => {
    await page.goto(base + SOK, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /^Velg$/ }).first().click();
    await page.waitForURL(/\/bestill\?offer=/, { timeout: 20_000 });
    await page.waitForTimeout(2500);
  },
};
// Registers a throwaway customer in the local demo DB and stores the session
// cookie in artifacts/auth.json so design-shots can capture logged-in pages.
STEPS.register = async (page) => {
  const stamp = Date.now();
  await page.goto(base + "/logg-inn?modus=registrer", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/Fornavn/).fill("Aisha");
  await page.getByLabel(/Etternavn/).fill("Karim");
  await page.getByLabel(/E-post/).first().fill(`design-${stamp}@hellosky.test`);
  await page.getByLabel(/Passord/).first().fill("Sterkt-passord-2026");
  await page.getByLabel(/Passord/).first().press("Enter");
  await page.waitForURL(/\/(velkommen|profil)/, { timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.context().storageState({ path: path.resolve("artifacts/auth.json") });
  console.log("saved artifacts/auth.json");
};
const FULL = new Set(["checkout", "register"]);

const browser = await chromium.launch();
for (const width of widths) {
  const mobile = width < 700;
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 },
    deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, locale: "nb-NO", reducedMotion: "reduce",
  });
  const origin = new URL(base).origin;
  await ctx.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  for (const s of scenarios) {
    const page = await ctx.newPage();
    try {
      await page.waitForTimeout(300);
      await STEPS[s](page);
      const file = path.join(outDir, `${prefix}-${s}-${width}.png`);
      await page.screenshot({ path: file, fullPage: FULL.has(s), timeout: 30_000 });
      console.log("wrote", path.relative(process.cwd(), file));
    } catch (e) {
      console.log("FAILED", s, width, String(e).split("\n")[0]);
    } finally {
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();
