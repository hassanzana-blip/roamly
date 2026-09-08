// Tilgjengelighetsgjennomgang med axe over de viktigste rutene.
//   node scripts/axe-sweep.mjs [--base URL] [--widths 390,1440] [--auth artifacts/auth.json]
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const args = process.argv.slice(2);
const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const base = get("--base", process.env.BASE_URL ?? "http://localhost:3411");
const widths = get("--widths", "390,1440").split(",").map(Number);
const authFile = get("--auth", null);
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const ROUTES = [
  "/", "/reisemal", "/journal", "/hjelp", "/quiz", "/utforsk", "/hotell-bil", "/om-oss",
  "/reise", "/samfunn", "/fotokreditering", "/logg-inn", "/vilkar", "/personvern", "/tavler",
  `/sok?from=OSL&to=IST&depart=${d(30)}&ret=${d(37)}&adults=2&children=1&infants=0&cabin=economy`,
];

const b = await chromium.launch();
const findings = [];
let checked = 0;
for (const width of widths) {
  const mobile = width < 700;
  const ctx = await b.newContext({
    viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile,
    locale: "nb-NO", reducedMotion: "reduce", ...(authFile ? { storageState: authFile } : {}),
  });
  const origin = new URL(base).origin;
  await ctx.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.getByRole("main").waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(route.startsWith("/sok?") ? 5000 : 1200);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    checked += 1;
    for (const v of bad) findings.push({ width, route: route.slice(0, 28), id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, nodes: v.nodes.slice(0, 2).map((n) => ({ html: n.html.slice(0, 160), why: n.failureSummary?.split("\n").slice(0, 3).join(" | ") })) });
    await page.close();
  }
  await ctx.close();
}
await b.close();

if (!findings.length) console.log(`REN: ingen alvorlige eller kritiske funn i ${checked} sidevisninger`);
else {
  console.log(`FUNN (${findings.length}):`);
  for (const f of findings) { console.log(`  ${f.width}px ${f.route} — ${f.id} (${f.impact}, ${f.n}): ${f.help}`); for (const n of f.nodes ?? []) console.log(`      ${n.html}\n      ${n.why}`); }
  process.exitCode = 1;
}
