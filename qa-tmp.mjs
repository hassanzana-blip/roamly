import { chromium } from "@playwright/test";
const base = "http://localhost:3411";
const d = new Date(Date.now() + 35 * 864e5).toISOString().slice(0, 10);
const r = new Date(Date.now() + 42 * 864e5).toISOString().slice(0, 10);
const ROUTES = ["/", `/sok?from=OSL&to=BCN&depart=${d}&ret=${r}&adults=2&childAges=9&cabin=economy`, "/sok", "/journal", "/reisemal", "/utforsk", "/quiz", "/hjelp", "/samfunn", "/reiser", "/profil", "/lagret", "/tavler", "/logg-inn", "/om-oss", "/fotokreditering", "/bagasje", "/visum", "/vilkar", "/personvern", "/flystatus", "/hotell-bil", "/reise", "/journal/mellomlanding-med-barn"];
const b = await chromium.launch();
const problems = [];
for (const w of [375, 390, 430, 768, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 700, hasTouch: w < 700, locale: "nb-NO" });
  await ctx.route("**/*", (req) => (req.request().url().startsWith(base) ? req.continue() : req.abort()));
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  for (const route of ROUTES) {
    errs.length = 0;
    await p.goto(base + route, { waitUntil: "domcontentloaded" }).catch(() => problems.push(`${w} ${route} NAV FAIL`));
    await p.waitForTimeout(route.startsWith("/sok?") ? 6500 : 2200);
    const res = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      boundary: /Noe gikk galt|Something went wrong/.test(document.body.textContent || ""),
      empty: (document.body.innerText || "").trim().length < 40,
    }));
    if (res.sw > res.cw + 1) problems.push(`${w} ${route} OVERFLOW ${res.sw}>${res.cw}`);
    if (res.boundary) problems.push(`${w} ${route} ERROR BOUNDARY`);
    if (res.empty) problems.push(`${w} ${route} EMPTY`);
    if (errs.length) problems.push(`${w} ${route} JS: ${errs[0]}`);
  }
  await ctx.close();
  console.log(`width ${w} done`);
}
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "ALL CLEAN across 5 widths x " + ROUTES.length + " routes");
await b.close();
