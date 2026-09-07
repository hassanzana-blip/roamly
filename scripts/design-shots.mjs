// Design-review screenshots. Usage:
//   node scripts/design-shots.mjs <prefix> <route>[,<route>...] [--base http://localhost:3411] [--widths 390,1440] [--full]
// Writes artifacts/design-review/<prefix>-<route-slug>-<width>.png
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const prefix = args[0];
const routes = (args[1] ?? "/").split(",");
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
const base = get("--base", process.env.BASE_URL ?? "http://localhost:3411");
const widths = get("--widths", "390,1440").split(",").map(Number);
const full = args.includes("--full") || !args.includes("--fold");
const dark = args.includes("--dark");
const auth = get("--auth", null); // storageState file from design-states.mjs register
const outDir = path.resolve("artifacts/design-review");
fs.mkdirSync(outDir, { recursive: true });

const slug = (r) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")) || "home";

const browser = await chromium.launch();
for (const width of widths) {
  const mobile = width < 700;
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "nb-NO",
    colorScheme: dark ? "dark" : "light",
    reducedMotion: "reduce",
    ...(auth ? { storageState: path.resolve(auth) } : {}),
  });
  // No egress from the sandbox: third-party requests (analytics, CDNs) would hang and block load.
  const origin = new URL(base).origin;
  await ctx.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  for (const route of routes) {
    const page = await ctx.newPage();
    try {
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(Number(get("--settle", "1500")));
      if (full) {
        // Walk the page so lazy images and IntersectionObservers fire, then return to top.
        await page.evaluate(async () => {
          const step = Math.max(400, window.innerHeight * 0.8);
          const max = Math.min(document.body.scrollHeight, 20000);
          for (let y = 0; y < max; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 90));
          }
          window.scrollTo(0, 0);
        });
        // Bounded wait for images the walk just triggered (never longer than 4s).
        await page.evaluate(() => {
          const pending = Array.from(document.images).filter((i) => !i.complete);
          return Promise.race([
            Promise.all(pending.map((i) => new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))),
            new Promise((r) => setTimeout(r, 4000)),
          ]);
        });
        await page.waitForTimeout(300);
      }
      const file = path.join(outDir, `${prefix}-${slug(route)}-${width}${dark ? "-dark" : ""}.png`);
      await page.screenshot({ path: file, fullPage: full, timeout: 30_000 });
      console.log("wrote", path.relative(process.cwd(), file));
    } catch (e) {
      console.log("FAILED", route, width, String(e).split("\n")[0]);
    } finally {
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();
