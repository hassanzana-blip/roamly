// Fullfører ekte demobestillinger som den innloggede demokunden, slik at
// profilmodulene kan vurderes mot faktiske data i stedet for tomme tilstander.
// Speiler e2e/booking.spec.ts, men med passfelt for internasjonale ruter.
import { chromium } from "@playwright/test";

const BASE = process.env.SEED_BASE ?? "http://localhost:5174";
const EMAIL = process.env.SEED_EMAIL ?? "design-1788816720087@hellosky.test";
const to = process.argv[2] ?? "IST";
const daysOut = Number(process.argv[3] ?? 30);
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, locale: "nb-NO", storageState: "artifacts/auth.json" });
await ctx.route("**/*", (r) => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()));
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));

const dumpErrors = async (where) => {
  const alerts = await p.locator('[role="alert"]').allTextContents();
  console.log(`  errors@${where}:`, alerts.filter(Boolean).join(" ⋅ ") || "(none)");
};

/** react-day-picker med år/måned-nedtrekk: velg dato og vent til arket lukkes. */
async function pickDate(trigger, isoDate) {
  const [y, m] = isoDate.split("-").map(Number);
  await trigger.click();
  const dlg = p.locator('[role="dialog"]').last();
  await dlg.locator("select.rdp-years_dropdown").selectOption(String(y));
  await dlg.locator("select.rdp-months_dropdown").selectOption(String(m - 1));
  await dlg.locator(`td[data-day="${isoDate}"] button, [data-day="${isoDate}"]`).first().click();
  await dlg.waitFor({ state: "hidden", timeout: 10_000 });
}

try {
  const url = `${BASE}/sok?from=OSL&to=${to}&depart=${iso(daysOut)}&ret=${iso(daysOut + 7)}&adults=1&children=0&infants=0&cabin=economy`;
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.getByRole("article").first().waitFor({ timeout: 60_000 });
  await p.getByRole("button", { name: /^Velg$/ }).first().click();
  await p.waitForURL(/\/bestill\?offer=/, { timeout: 30_000 });
  await p.getByRole("radiogroup", { name: "Tittel" }).first().waitFor({ timeout: 30_000 });

  await p.getByRole("radiogroup", { name: "Tittel" }).first().getByRole("radio", { name: "Mr", exact: true }).click();
  await p.getByLabel("Fornavn (som i passet)").first().fill("Aisha");
  await p.getByLabel("Etternavn (som i passet)").first().fill("Karim");
  await pickDate(p.getByRole("button", { name: "Fødselsdato" }).first(), "1990-03-14");
  await p.getByRole("radiogroup", { name: "Kjønn" }).first().getByRole("radio", { name: "Kvinne" }).click();

  // Internasjonale ruter krever reisedokument.
  const passNo = p.getByLabel("Passnummer");
  if (await passNo.count()) {
    await passNo.first().fill("X1234567");
    await pickDate(p.getByRole("button", { name: "Passet utløper" }).first(), `${new Date().getFullYear() + 4}-06-15`);
  }

  await dumpErrors("pre-next");
  await p.getByRole("button", { name: "Neste: kontakt" }).first().click();
  await p.waitForTimeout(600);
  await dumpErrors("post-next");

  const email = p.getByLabel("E-post", { exact: true });
  await email.waitFor({ timeout: 15_000 });
  await email.fill(EMAIL);
  await p.getByLabel("Gjenta e-post").fill(EMAIL);
  await p.getByLabel("Mobilnummer").fill("91234567");
  await p.getByRole("button", { name: "Neste: bagasje" }).first().click();

  await p.getByRole("checkbox").first().check();
  await p.getByRole("button", { name: "Gå til betaling" }).first().click();
  const demo = p.getByRole("button", { name: /^Demobestilling/ });
  await demo.waitFor({ timeout: 60_000 });
  await demo.click();
  await p.waitForURL(/\/bekreftelse\//, { timeout: 120_000 });
  console.log("BOOKED", to, p.url());
} catch (e) {
  console.log("SEED FAILED", to, String(e).split("\n")[0]);
  console.log("  url:", p.url());
  console.log("  step:", (await p.locator("h2").allTextContents()).slice(0, 3).join(" | "));
  await dumpErrors("fail");
  await p.screenshot({ path: `artifacts/design-review/seed-fail-${to}.png`, fullPage: true });
} finally {
  await b.close();
}
