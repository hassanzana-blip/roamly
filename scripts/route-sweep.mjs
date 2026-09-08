// Rutegjennomgang: besøk hver side og se etter det som faktisk ødelegger for en kunde.
//   node scripts/route-sweep.mjs [--base URL] [--widths 390,1440] [--auth artifacts/auth.json]
//
// Rapporterer per rute og bredde: feilgrense, tom side, JS-feil, mislykkede kall
// mot egen origin, og vannrett overflyt. Skriver ingenting til skjerm som ikke er
// et funn – en ren gjennomgang er én linje.
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const get = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const base = get("--base", process.env.BASE_URL ?? "http://localhost:3411");
const widths = get("--widths", "390,768,1440").split(",").map(Number);
const authFile = get("--auth", null);

const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const ROUTES = [
  "/", "/utforsk", "/lagret", "/profil", "/reise", "/flystatus", "/hjelp",
  "/reisemal", "/journal", "/quiz", "/tavler", "/hotell-bil", "/overnatting-bil",
  "/logg-inn", "/samfunn", "/reiser", "/vilkar", "/personvern", "/bagasje",
  "/visum", "/om-oss", "/fotokreditering", "/velkommen",
  "/profil/rediger", "/profil/innstillinger", "/profil/reisende", "/profil/prisvarsler",
  "/profil/prisovervaking", "/profil/reiseprofil", "/profil/varsler", "/profil/sikkerhet",
  "/profil/bonus", "/profil/inviter",
  `/sok?from=OSL&to=IST&depart=${d(30)}&ret=${d(37)}&adults=2&children=1&infants=0&cabin=economy`,
  "/sok",
  "/bestill",
  "/finnes-ikke-her",
];

const ERROR_TEXT = /Noe gikk galt|Beklager, her gikk noe galt|Application error|Unhandled/i;

const browser = await chromium.launch();
const findings = [];
let checked = 0;

for (const width of widths) {
  const mobile = width < 700;
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 },
    isMobile: mobile, hasTouch: mobile, locale: "nb-NO", reducedMotion: "reduce",
    ...(authFile ? { storageState: authFile } : {}),
  });
  const origin = new URL(base).origin;
  await ctx.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(`JS: ${String(e).slice(0, 160)}`));
    // Vi avviser selv alt utenfor egen origin (ingen utgående nett i sandkassen);
    // de avvisningene er våre, ikke sidens.
    page.on("console", (m) => {
      const text = m.text();
      if (m.type() !== "error") return;
      if (/net::ERR_FAILED|ERR_BLOCKED_BY_CLIENT|Failed to load resource/i.test(text)) return;
      problems.push(`console: ${text.slice(0, 160)}`);
    });
    page.on("requestfailed", (r) => {
      if (r.url().startsWith(origin)) problems.push(`forespørsel feilet: ${new URL(r.url()).pathname}`);
    });
    page.on("response", (r) => {
      if (r.url().startsWith(origin) && r.status() >= 500) problems.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    try {
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(route.startsWith("/sok?") ? 4000 : 1200);

      const main = page.locator("main");
      if ((await main.count()) === 0) problems.push("ingen <main>");
      else {
        const text = ((await main.textContent()) ?? "").trim();
        if (text.length < 40) problems.push(`tom side (${text.length} tegn)`);
        if (ERROR_TEXT.test(text)) problems.push("feilgrense");
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) problems.push(`vannrett overflyt ${overflow}px`);
    } catch (err) {
      problems.push(`navigasjon: ${String(err).slice(0, 160)}`);
    }
    checked += 1;
    if (problems.length) findings.push({ width, route, problems: [...new Set(problems)] });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

if (!findings.length) {
  console.log(`REN: ${checked} sidevisninger (${ROUTES.length} ruter × ${widths.length} bredder)`);
} else {
  console.log(`FUNN i ${findings.length} av ${checked} sidevisninger:\n`);
  for (const f of findings) console.log(`  ${f.width}px ${f.route}\n    - ${f.problems.join("\n    - ")}`);
  process.exitCode = 1;
}
