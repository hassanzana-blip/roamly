import { test, expect, type Page } from "@playwright/test";

/**
 * Kundereisene, ende til ende, mot bygget app i demomodus.
 *
 * Denne filen finnes for å svare på ett spørsmål per reise: virker den for en
 * kunde? Ikke «finnes knappen», men «kommer kunden fram, og står det samme
 * tallet hele veien».
 */

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const DEPART = iso(45);
const RETURN = iso(52);

/** Tallet i en prisstreng («13 152 kr» → 13152). */
function amount(text: string | null): number {
  const digits = (text ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : NaN;
}

function searchUrl(over: Record<string, string> = {}) {
  const p = new URLSearchParams({ from: "OSL", to: "BGO", depart: DEPART, adults: "1", children: "0", infants: "0", cabin: "economy", ...over });
  return `/sok?${p.toString()}`;
}

/** Ny kunde via skjemaet – kortere enn å plukke fra hverandre en økt. */
async function register(page: Page, email: string, password = "kundepassord-2026") {
  await page.goto("/logg-inn");
  await page.getByRole("button", { name: "Opprett konto", exact: true }).first().click();
  await page.getByLabel("Fornavn").fill("Kari");
  await page.getByLabel("Etternavn").fill("Nordmann");
  await page.getByLabel("E-post eller telefonnummer").fill(email);
  await page.getByLabel("Passord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Opprett konto", exact: true }).last().click();
  await expect(page).not.toHaveURL(/\/logg-inn/, { timeout: 30_000 });
}

async function firstOffer(page: Page) {
  const card = page.getByRole("article").first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  return card;
}

test.describe("søk", () => {
  test("tur-retur, én vei, reisefølge og kabin gir treff — og prisen er for hele følget", async ({ page }) => {
    // Én vei
    await page.goto(searchUrl());
    await expect(await firstOffer(page)).toBeVisible();

    // Tur-retur
    await page.goto(searchUrl({ ret: RETURN }));
    const roundTrip = await firstOffer(page);
    await expect(roundTrip).toBeVisible();

    // To voksne + ett barn + ett spedbarn: prisen skal si hvem den gjelder
    await page.goto(searchUrl({ adults: "2", children: "1", infants: "1" }));
    const family = await firstOffer(page);
    await expect(family).toContainText(/Totalt for/);
    await expect(family).toContainText(/2 voksne/);
    await expect(family).toContainText(/1 barn/);

    // Business
    await page.goto(searchUrl({ cabin: "business" }));
    await expect(await firstOffer(page)).toBeVisible();
  });

  test("hele verden er søkbar, ikke bare de kuraterte flyplassene", async ({ page }) => {
    await page.goto(searchUrl({ from: "TRF", to: "KRK" }));
    await expect(await firstOffer(page)).toBeVisible();
  });

  test("/sok uten parametre viser et søk, ikke en feilside", async ({ page }) => {
    await page.goto("/sok");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/Noe gikk galt|Beklager, her gikk noe galt/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Søk flyreiser$/ }).first()).toBeVisible();
  });

  test("søket overlever at kunden går tilbake fra resultatene", async ({ page }) => {
    await page.goto(searchUrl({ to: "LHR", adults: "2" }));
    await expect(await firstOffer(page)).toBeVisible();
    await page.goto("/");
    await page.goBack();
    await expect(page).toHaveURL(/to=LHR/);
    await expect(page).toHaveURL(/adults=2/);
    await expect(await firstOffer(page)).toBeVisible();
  });
});

test.describe("pris", () => {
  test("samme total i resultatet, i kassen og på bekreftelsen", async ({ page }) => {
    await page.goto(searchUrl({ adults: "2", children: "1" }));
    const card = await firstOffer(page);

    const priceText = await card.locator("p").filter({ hasText: /kr/ }).first().textContent();
    const resultTotal = amount(priceText);
    expect(Number.isFinite(resultTotal)).toBe(true);

    await card.getByRole("button", { name: "Velg" }).click();
    await expect(page).toHaveURL(/\/bestill\?offer=/);

    // Estimatet i kassen skal være det samme tallet som i resultatlisten.
    const estimate = page.getByText(/Estimert total|Totalt/).first();
    await expect(estimate).toBeVisible();
    const checkoutTotal = amount(await page.locator(".t-price").first().textContent());
    expect(checkoutTotal).toBe(resultTotal);
  });
});

test.describe("konto", () => {
  const email = `reise-${Date.now()}@hellosky.test`;
  const password = "kundepassord-2026";

  test("ny konto → reiseidentitet med flyplass utenfor det kuraterte settet → prisvarsel til verden", async ({ page }) => {
    await register(page, email, password);

    // Hjemmeflyplass: Torp finnes ikke i det kuraterte settet, men kunden bor der.
    await page.goto("/profil/reiseprofil");
    await expect(page.getByRole("main")).toBeVisible();

    // Prisvarsel på en verdensrute
    await page.goto("/profil/prisvarsler");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/Noe gikk galt/i)).toHaveCount(0);

    for (const path of ["/profil", "/mine-reiser", "/lagret", "/profil/bonus"]) {
      await page.goto(path);
      await expect(page.getByRole("main"), path).toBeVisible();
      await expect(page.getByText(/Noe gikk galt/i), path).toHaveCount(0);
    }
  });
});

test.describe("deling", () => {
  /**
   * Lenken lages på serveren og åpnes av klienten. Da formatet kom i utakt ble
   * hver lenke laget riktig og avvist ved åpning, uten at noe feilet høyt.
   */
  async function api(page: Page, path: string, body: unknown) {
    const res = await page.request.post(`/api/trpc/${path}`, { data: { json: body }, headers: { origin: new URL(page.url() || "http://localhost").origin } });
    expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBe(true);
    const json = (await res.json()) as { result?: { data?: { json?: Record<string, string> } } };
    return json.result?.data?.json ?? {};
  }

  test("ReiseMatch: lenken serveren lager kan åpnes av den som får den", async ({ page }) => {
    await page.goto("/");
    const created = await api(page, "match.create", {
      mode: "friends",
      name: "Zana",
      answers: { company: "friends", mood: "city", weather: "mild", sights: "food", budget: "mid" },
    });
    expect(created.token, "serveren ga ingen token").toBeTruthy();

    await page.goto(`/m/${created.token}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/finnes ikke lenger|Noe gikk galt/i)).toHaveCount(0);
  });

  test("Reisetavle: lenken serveren lager kan åpnes av den som får den", async ({ page }) => {
    // Tavler hører til en konto, så vi lager en først.
    await register(page, `tavle-${Date.now()}@hellosky.test`);
    const created = await api(page, "boards.create", { title: "Sommer 2027" });
    expect(created.token, "serveren ga ingen token").toBeTruthy();

    await page.goto(`/tavler/${created.token}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/finnes ikke lenger|Noe gikk galt/i)).toHaveCount(0);
  });
});

/**
 * Fødselsdatoen skrives inn i tre tallfelt, ikke plukkes i en kalender.
 * Feltene ligger i raden til den reisende, så de scopes til panelet – ellers
 * treffer man den første reisende uansett hvem man fyller ut.
 */
async function fillDate(panel: import("@playwright/test").Locator, isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  await panel.getByLabel("Dag").first().fill(d);
  await panel.getByLabel("Måned").first().fill(m);
  await panel.getByLabel("År").first().fill(y);
}

/**
 * Fyll ut én reisende. Raden åpnes eksplisitt først: skjemaet viser én av
 * gangen, og en blind `.first()` treffer den raden som tilfeldigvis står åpen.
 */
async function fillTraveller(page: Page, row: string, p: { title: string; first: string; last: string; born: string; gender: string }) {
  const trigger = page.getByRole("button", { name: new RegExp(`\\b${row}\\b`) }).first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
  await panel.getByRole("radio", { name: p.title, exact: true }).click();
  await panel.getByLabel("Fornavn (som i passet)").fill(p.first);
  await panel.getByLabel("Etternavn (som i passet)").fill(p.last);
  await fillDate(panel, p.born);
  await panel.getByRole("radio", { name: p.gender, exact: true }).click();
}

test.describe("familie", () => {
  test("en lenke med barn, men uten alder, prises for hele familien hele veien", async ({ page }) => {
    // Slik lagrede og nylige søk ser ut: antall, ingen aldre.
    await page.goto(searchUrl({ adults: "2", children: "1" }));
    const card = await firstOffer(page);
    await expect(card).toContainText("Totalt for");
    await expect(card).toContainText("2 voksne");
    await expect(card).toContainText("1 barn");
    const resultTotal = amount(await card.locator("p").filter({ hasText: /kr/ }).first().textContent());

    await card.getByRole("button", { name: "Velg" }).click();
    await expect(page).toHaveURL(/\/bestill\?offer=/);

    // Kassen ber om tre reisende, ikke to.
    await expect(page.getByRole("heading", { name: /Reisende/ }).first()).toBeVisible();
    await expect(page.getByText("2 × voksen + 1 × barn")).toBeVisible();
    const checkoutTotal = amount(await page.locator(".t-price").first().textContent());
    expect(checkoutTotal).toBe(resultTotal);

    const email = `familie-${Date.now()}@hellosky.test`;
    await fillTraveller(page, "Voksen 1", { title: "Mr", first: "Ola", last: "Nordmann", born: "1985-04-12", gender: "Mann" });
    await fillTraveller(page, "Voksen 2", { title: "Ms", first: "Kari", last: "Nordmann", born: "1987-06-03", gender: "Kvinne" });
    await fillTraveller(page, "Barn 1", { title: "Ms", first: "Nora", last: "Nordmann", born: iso(-8 * 365), gender: "Kvinne" });

    await page.getByRole("button", { name: "Neste: kontakt" }).click();
    await page.getByLabel("E-post", { exact: true }).fill(email);
    await page.getByLabel("Gjenta e-post").fill(email);
    await page.getByLabel("Mobilnummer").fill("91234567");
    await page.getByRole("button", { name: "Neste: bagasje" }).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Gå til betaling" }).first().click();

    const demo = page.getByRole("button", { name: /^Demobestilling/ });
    await expect(demo).toBeVisible({ timeout: 30_000 });
    // Beløpet serveren har låst skal fortsatt være det samme som i resultatet.
    const lockedTotal = amount(await page.locator(".t-price").first().textContent());
    expect(lockedTotal).toBe(resultTotal);
    await demo.click();

    await expect(page).toHaveURL(/\/bekreftelse\//, { timeout: 60_000 });
    await expect(page.getByText("Nora Nordmann")).toBeVisible();
  });
});
