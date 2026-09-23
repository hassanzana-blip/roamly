import { test, expect, type Page } from "@playwright/test";
import superjson from "superjson";

/** Isolated UI fixtures: no real customer, SMS, credentials or deletion. Server enforcement has MySQL integration tests. */
async function accountFixture(page: Page, passwordless = false) {
  let loggedIn = true;
  const customer = { id: 900001, firstName: "Kari", lastName: "Eksempel", email: "kari@example.invalid", phone: "+4791234567", emailVerified: true, hasPassword: !passwordless, locale: "nb", currency: "NOK", avatarUrl: null, marketingConsent: false, rewardBalance: 0, referralCode: null };
  const calls: Array<{ procedure: string; input: Record<string, unknown> }> = [];
  const ok = (value: unknown) => ({ result: { data: superjson.serialize(value) } });
  const fail = (message: string, appCode: string, details: Record<string, unknown>) => ({ error: superjson.serialize({ message, code: -32003, data: { code: "FORBIDDEN", httpStatus: 403, appCode, details } }) });
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const paths = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(",");
    const handled = new Set(["customerAuth.me", "customerAuth.updateProfile", "customerAuth.requestPhoneChange", "customerAuth.confirmPhoneChange", "customerAuth.deleteAccount", "customerAuth.logout"]);
    if (!paths.some((path) => handled.has(path))) return route.continue();
    const batch = url.searchParams.get("batch") === "1";
    const raw = request.method() === "POST" ? request.postDataJSON() : JSON.parse(url.searchParams.get("input") ?? "{}");
    // Preserve unrelated calls if tRPC batches them with me; never forward a mocked account mutation.
    const fallback = request.method() === "GET" && paths.some((path) => !handled.has(path)) ? await (await route.fetch()).json() : [];
    const results = paths.map((procedure, index) => {
      if (!handled.has(procedure)) return batch ? fallback[index] : fallback;
      const serialized = batch ? raw?.[String(index)] : raw;
      const input = serialized?.json ?? {};
      if (request.method() === "POST") calls.push({ procedure, input });
      switch (procedure) {
        case "customerAuth.me": return ok(loggedIn ? customer : null);
        case "customerAuth.updateProfile": Object.assign(customer, input); return ok({ ok: true });
        case "customerAuth.requestPhoneChange": return passwordless ? fail("Reauthentication required", "FORBIDDEN", { reason: "reauth_required" }) : ok({ ok: true });
        case "customerAuth.confirmPhoneChange":
          if (input.code !== "123456") return fail("Feil eller utløpt kode. Be om en ny kode.", "VALIDATION", { field: "code" });
          customer.phone = input.phone;
          return ok({ ok: true });
        case "customerAuth.deleteAccount": return fail("Reauthentication required", "FORBIDDEN", { reason: "reauth_required" });
        case "customerAuth.logout": loggedIn = false; return ok({ ok: true });
      }
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(batch ? results : results[0]) });
  });
  await page.goto("/profil/rediger");
  await expect(page.getByRole("heading", { name: "Rediger profil", exact: true })).toBeVisible();
  return { calls, customer };
}

test("saving a name never changes the sign-in phone", async ({ page }) => {
  const { calls } = await accountFixture(page);
  await page.getByLabel("Fornavn", { exact: true }).fill("Anne");
  await page.getByRole("button", { name: "Lagre endringer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Navnet er lagret." })).toBeVisible();
  expect(calls.find((call) => call.procedure === "customerAuth.updateProfile")?.input).toEqual({ firstName: "Anne", lastName: "Eksempel" });
  expect(calls.some((call) => /PhoneChange/.test(call.procedure))).toBe(false);
});

test("phone changes require a code, recover from a wrong code and only then save", async ({ page }) => {
  const { calls } = await accountFixture(page);
  const section = page.getByRole("region", { name: "Telefonnummer", exact: true });
  await page.getByRole("button", { name: "Endre telefonnummer", exact: true }).click();
  await page.getByLabel("Nytt telefonnummer", { exact: true }).fill("+4798765432");
  await page.getByLabel("Bekreft med passord", { exact: true }).fill("isolated-test-password");
  await page.screenshot({ path: test.info().outputPath("profile-phone-request.png"), fullPage: true, mask: [page.getByLabel("Bekreft med passord", { exact: true })] });
  await page.getByRole("button", { name: "Send SMS-kode", exact: true }).click();
  await expect(page.getByLabel("SMS-kode", { exact: true })).toBeFocused();
  await expect(section).toContainText("Nummeret er ikke endret ennå.");
  await page.screenshot({ path: test.info().outputPath("profile-phone-code.png"), fullPage: true });
  expect(calls.filter((call) => call.procedure === "customerAuth.confirmPhoneChange")).toHaveLength(0);
  await page.getByLabel("SMS-kode", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Bekreft og lagre nummer", exact: true }).click();
  await expect(section.getByRole("alert")).toContainText("Feil eller utløpt kode");
  await expect(section).toContainText("+4791234567");
  await page.getByLabel("SMS-kode", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Bekreft og lagre nummer", exact: true }).click();
  await expect(section.getByRole("status")).toContainText("Telefonnummeret er bekreftet og lagret");
  await expect(section).toContainText("+4798765432");
  expect(calls.filter((call) => call.procedure === "customerAuth.confirmPhoneChange")).toHaveLength(2);
});

test("requesting another phone code requires confirming the password again; cancel never saves", async ({ page }) => {
  const { calls } = await accountFixture(page);
  await page.getByRole("button", { name: "Endre telefonnummer", exact: true }).click();
  await page.getByLabel("Nytt telefonnummer", { exact: true }).fill("+4798765432");
  await page.getByLabel("Bekreft med passord", { exact: true }).fill("isolated-test-password");
  await page.getByRole("button", { name: "Send SMS-kode", exact: true }).click();
  await page.getByRole("button", { name: "Endre nummer eller be om ny kode", exact: true }).click();
  await expect(page.getByLabel("Bekreft med passord", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Avbryt telefonendring", exact: true }).click();
  await expect(page.getByRole("region", { name: "Telefonnummer", exact: true })).toContainText("+4791234567");
  expect(calls.filter((call) => call.procedure === "customerAuth.requestPhoneChange")).toHaveLength(1);
  expect(calls.some((call) => /confirmPhoneChange|updateProfile/.test(call.procedure))).toBe(false);
});

for (const action of ["phone", "delete"] as const) {
  test(`an old passwordless session can reauthenticate after ${action} is denied`, async ({ page }) => {
    const { calls } = await accountFixture(page, true);
    if (action === "phone") {
      await page.getByRole("button", { name: "Endre telefonnummer", exact: true }).click();
      await page.getByLabel("Nytt telefonnummer", { exact: true }).fill("+4798765432");
      await expect(page.getByLabel("Bekreft med passord", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Send SMS-kode", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Jeg vil slette kontoen min", exact: true }).click();
      await page.getByPlaceholder("Skriv SLETT for å bekrefte", { exact: true }).fill("SLETT");
      await page.getByRole("button", { name: "Slett kontoen permanent", exact: true }).click();
    }
    await expect(page.getByRole("alert").filter({ hasText: "Logg inn på nytt" })).toBeVisible();
    await page.getByRole("button", { name: "Logg inn på nytt", exact: true }).click();
    await expect(page).toHaveURL(/\/logg-inn\?next=%2Fprofil%2Frediger/);
    await expect(page.getByLabel("E-post eller telefonnummer", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.procedure === "customerAuth.logout")).toHaveLength(1);
  });
}
