import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ─── Kundereise i demo-modus: forside → søk → velg tilbud → bestill → demobetaling → PNR ──
// Kjører mot bygget app (playwright.config.ts starter web + worker).

const EMAIL = `e2e-${Date.now()}@hellosky.test`;

async function pickAirport(page: Page, label: "Fra" | "Til", query: string, iata: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}:`) }).first().click();
  const input = page.getByPlaceholder("Søk by eller flyplass …");
  await input.fill(query);
  await page.getByRole("option", { name: new RegExp(`\\b${iata}\\b`) }).first().click();
  await expect(page.getByRole("button", { name: new RegExp(`^${label}:`) }).first()).toContainText(iata);
}

/** react-day-picker (dropdown-caption): velg år/måned i select og klikk dagen. */
async function pickDate(page: Page, triggerName: string, iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  await page.getByRole("button", { name: triggerName }).first().click();
  // Popover på desktop, bunnark på telefon: begge er Radix-dialoger.
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.locator("select.rdp-years_dropdown").selectOption(String(y));
  await dialog.locator("select.rdp-months_dropdown").selectOption(String(m - 1));
  await dialog.locator(`td[data-day="${iso}"] button, [data-day="${iso}"]`).first().click();
  void d;
  await expect(dialog).toBeHidden();
}

test.describe("booking (demo)", () => {
  test("forside → søk → velg tilbud → fyll ut → demobetaling → bekreftelse med PNR", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HelloSky/i);

    // Søk: "Fra" er forhåndsvalgt (OSL), velg "Til"
    await pickAirport(page, "Til", "Bergen", "BGO");
    await page.getByRole("button", { name: /^Søk flyreiser$/ }).first().click();
    await expect(page).toHaveURL(/\/sok\?.*from=OSL.*to=BGO/);

    // Resultater (demo): velg første tilbud
    const first = page.getByRole("article").first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    await first.getByRole("button", { name: "Velg" }).click();
    await expect(page).toHaveURL(/\/bestill\?offer=/);

    // Steg 1: reisende
    // Tittel og kjønn er ett-trykks valg (radiogrupper), ikke nedtrekk.
    await page.getByRole("radiogroup", { name: "Tittel" }).first().getByRole("radio", { name: "Mr", exact: true }).click();
    await page.getByLabel("Fornavn (som i passet)").fill("Ola");
    await page.getByLabel("Etternavn (som i passet)").fill("Nordmann");
    await pickDate(page, "Fødselsdato", "1985-04-12");
    await page.getByRole("radiogroup", { name: "Kjønn" }).first().getByRole("radio", { name: "Mann" }).click();
    await page.getByRole("button", { name: "Neste: kontakt" }).click();

    // Steg 2: kontakt
    await page.getByLabel("E-post", { exact: true }).fill(EMAIL);
    await page.getByLabel("Gjenta e-post").fill(EMAIL);
    await page.getByLabel("Mobilnummer").fill("91234567");
    await page.getByRole("button", { name: "Neste: bagasje" }).click();

    // Steg 3: tilvalg + vilkår → prisbekreftelse
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Gå til betaling" }).first().click();

    // Steg 4: demobetaling
    const demoBtn = page.getByRole("button", { name: /^Demobestilling/ });
    await expect(demoBtn).toBeVisible({ timeout: 30_000 });
    await demoBtn.click();

    // Steg 5 → bekreftelsessiden (worker fullfører bookingen)
    await expect(page).toHaveURL(/\/bekreftelse\//, { timeout: 60_000 });
    const pnr = page.getByRole("button", { name: /Kopier bookingreferanse/ });
    await expect(pnr).toBeVisible();
    await expect(pnr).toContainText(/[A-Z0-9]{6}/);
    await expect(page.getByText("Ola Nordmann")).toBeVisible();
  });

  test("ingen kritiske tilgjengelighetsfeil på /, /sok og /bestill", async ({ page }) => {
    const depart = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
    for (const path of ["/", `/sok?from=OSL&to=BGO&depart=${depart}&adults=1&children=0&infants=0&cabin=economy`, "/bestill"]) {
      await page.goto(path);
      await page.getByRole("main").waitFor();
      if (path.startsWith("/sok")) await page.getByRole("article").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1_000); // la lazy-innhold/animasjoner lande før axe
      // @axe-core/playwright bundler nyere playwright-core-typer enn @playwright/test — kun typeforskjell.
      const results = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags(["wcag2a", "wcag2aa"]).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      expect(critical, `${path}: ${critical.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`).toEqual([]);
    }
  });
});
