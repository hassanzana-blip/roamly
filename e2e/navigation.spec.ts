import { test, expect } from "@playwright/test";

test("a destination opened from the home page starts at the search heading", async ({ page }) => {
  await page.goto("/");
  const destination = page.getByRole("link", { name: "Gul trikk, linje 28, i Lisboas gater", exact: true });
  await destination.scrollIntoViewIfNeeded();
  await destination.click();
  await expect(page).toHaveURL(/\/sok\?.*to=LIS/);
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("footer section links open the requested section after a lazy page loads", async ({ page }) => {
  await page.goto("/om-oss");
  await page.getByRole("contentinfo").getByRole("link", { name: "Slik fungerer det", exact: true }).click();
  await expect(page).toHaveURL(/\/#how$/);
  await expect(page.getByRole("heading", { name: "Slik fungerer HelloSky", exact: true })).toBeInViewport();
});
