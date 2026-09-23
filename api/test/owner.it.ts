import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { caller, closeDb, expectAppCode, fakeStaff, getDb, truncateAll } from "./setup";
import { affiliateConversions, auditLogs, customerAccounts, providerClicks, searchEvents, staffSessions, staffUsers } from "../../db/schema";
import type { StaffRole } from "../lib/rbac";

/**
 * Eierpanelets tall.
 *
 * To ting må holde, og de er like viktige:
 *
 *  1. **Ingen andre enn eieren ser dem.** Driftsoversikten trenger alle for å
 *     gjøre jobben sin. Selskapets provisjon trenger ingen andre.
 *  2. **Tallene må ikke blandes.** Bruttoverdi er leverandørens omsetning,
 *     provisjon er vår. Et estimat er ikke en utbetaling. Legges de sammen én
 *     gang, er dashbordet verdiløst – det er da eieren tror selskapet tjener
 *     tjue ganger mer enn det gjør.
 */

const owner = () => caller({ staff: fakeStaff({ role: "OWNER" }) });

async function click(over: Partial<typeof providerClicks.$inferInsert> = {}) {
  await getDb()
    .insert(providerClicks)
    .values({
      clickRef: `click-${Math.random().toString(36).slice(2)}`,
      provider: "kayak",
      originIata: "OSL",
      destinationIata: "LHR",
      departDate: "2026-11-02",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "economy",
      shownPriceMinor: 250_000,
      currency: "NOK",
      sandbox: false,
      ...over,
    });
}

async function search(over: Partial<typeof searchEvents.$inferInsert> = {}) {
  await getDb()
    .insert(searchEvents)
    .values({
      originIata: "OSL",
      destinationIata: "LHR",
      departDate: "2026-11-02",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "economy",
      provider: "kayak",
      resultCount: 12,
      sandbox: false,
      ...over,
    });
}

async function conversion(status: "estimated" | "confirmed" | "paid" | "reversed", commissionMinor: number) {
  await getDb()
    .insert(affiliateConversions)
    .values({
      externalRef: `ext-${Math.random().toString(36).slice(2)}`,
      provider: "kayak",
      status,
      bookingValueMinor: 250_000,
      commissionMinor,
      currency: "NOK",
      reportedAt: new Date(),
    });
}

beforeEach(truncateAll);
afterAll(closeDb);

describe("hvem som får se selskapets tall", () => {
  it("slipper eieren inn", async () => {
    await expect(owner().adminOwner.summary({ period: "30d" })).resolves.toBeTruthy();
  });

  /**
   * Alle roller har «overview:read» – driftskøen er felles. Eierpanelet er
   * det ikke, og det er nettopp derfor det ikke kan gjenbruke den
   * tillatelsen.
   */
  it.each<StaffRole>(["ADMIN", "SUPPORT", "FINANCE", "READ_ONLY"])("avviser %s", async (role) => {
    await expectAppCode(caller({ staff: fakeStaff({ role }) }).adminOwner.summary({ period: "30d" }), "FORBIDDEN");
  });

  it("slipper de samme rollene inn på driftsoversikten", async () => {
    // Beviset på at avvisningen over er eierpanelet, ikke adminen som helhet.
    await expect(caller({ staff: fakeStaff({ role: "SUPPORT" }) }).admin.dashboard()).resolves.toBeTruthy();
  });

  it("avviser en som ikke er logget inn", async () => {
    await expectAppCode(caller().adminOwner.summary({ period: "30d" }), "UNAUTHORIZED");
  });
});

describe("tallene", () => {
  it("svarer null og ikke feil når ingenting er målt ennå", async () => {
    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.demand.searches.value).toBe(0);
    expect(s.money.clickedValue).toEqual([]);
    expect(s.money.commission).toEqual([]);
    expect(s.tracking.searchesSince).toBeNull();
  });

  it("holder bruttoverdi og provisjon i hvert sitt felt", async () => {
    await click({ shownPriceMinor: 250_000 });
    await click({ shownPriceMinor: 150_000 });
    await conversion("paid", 8_000);

    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.money.clickedValue).toEqual([{ currency: "NOK", amountMinor: 400_000, count: 2 }]);
    const paid = s.money.commission.find((c) => c.status === "paid");
    expect(paid?.amountMinor).toBe(8_000);
    // Det ene tallet er reisens pris hos leverandøren, det andre er vårt.
    expect(paid!.amountMinor).not.toBe(400_000);
  });

  it("summerer provisjon per status og aldri på tvers", async () => {
    await conversion("estimated", 5_000);
    await conversion("confirmed", 3_000);
    await conversion("paid", 1_000);
    await conversion("reversed", 900);

    const s = await owner().adminOwner.summary({ period: "30d" });
    const by = Object.fromEntries(s.money.commission.map((c) => [c.status, c.amountMinor]));
    expect(by).toEqual({ estimated: 5_000, confirmed: 3_000, paid: 1_000, reversed: 900 });
  });

  it("holder sandkasseklikk utenfor bruttoverdien", async () => {
    await click({ sandbox: true, shownPriceMinor: 999_000 });
    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.money.clickedValue).toEqual([]);
  });

  it("teller søk uten treff som en dekningsmangel, ikke som et tapt søk", async () => {
    await search({ resultCount: 12 });
    await search({ resultCount: 0, destinationIata: "EVE" });

    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.demand.searches.value).toBe(2);
    expect(s.demand.noResults).toBe(1);
    expect(s.noResultRoutes).toEqual([{ origin: "OSL", destination: "EVE", originCity: "Oslo", destinationCity: "Evenes", searches: 1 }]);
  });

  it("regner klikkandel av søk, og svarer null når det ikke er noe å dele på", async () => {
    expect((await owner().adminOwner.summary({ period: "30d" })).demand.clickThrough).toBeNull();
    await search();
    await search();
    await click();
    expect((await owner().adminOwner.summary({ period: "30d" })).demand.clickThrough).toBe(0.5);
  });

  /**
   * Forskjellen på «ingen gjorde det» og «vi vet ikke» er hele poenget med
   * trakten. Blir et umålt steg vist som 0, ser eieren en konverteringsrate
   * på null og tror produktet er ødelagt.
   */
  it("merker umålte steg som umålte, ikke som null", async () => {
    await search();
    const s = await owner().adminOwner.summary({ period: "30d" });
    const stage = (k: string) => s.funnel.find((f) => f.stage === k)!;
    expect(stage("searches").measured).toBe(true);
    expect(stage("conversions").measured).toBe(false);
    expect(stage("commission").measured).toBe(false);
  });

  it("sier at perioden bare er delvis dekket når målingen startet inni den", async () => {
    await search();
    const s = await owner().adminOwner.summary({ period: "year" });
    expect(s.tracking.partialPeriod).toBe(true);
    expect(s.tracking.searchesSince).not.toBeNull();
  });

  it("sammenligner mot en forrige periode av samme lengde", async () => {
    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.period.days).toBe(30);
    expect(new Date(s.period.to).getTime() - new Date(s.period.from).getTime()).toBe(30 * 24 * 60 * 60_000);
  });

  it("holder tall fra utenfor perioden ute", async () => {
    await search();
    await getDb()
      .update(searchEvents)
      .set({ createdAt: new Date(Date.now() - 60 * 24 * 60 * 60_000) });

    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.demand.searches.value).toBe(0);
    expect((await owner().adminOwner.summary({ period: "90d" })).demand.searches.value).toBe(1);
  });

  it("rangerer mest søkte ruter", async () => {
    await search({ destinationIata: "LHR" });
    await search({ destinationIata: "LHR" });
    await search({ destinationIata: "BCN" });

    const s = await owner().adminOwner.summary({ period: "30d" });
    // Bynavnene løses på serveren, så klienten slipper flyplasstabellen.
    expect(s.topRoutes[0]).toEqual({ origin: "OSL", destination: "LHR", originCity: "Oslo", destinationCity: "London", searches: 2 });
  });

  /**
   * Grafen.
   *
   * Databasen returnerer bare dager som har rader. Fylles ikke hullene, hopper
   * kurven over en stille tirsdag som om den ikke fantes – og en uke med to
   * søk ser ut som en uke med jevn trafikk.
   */
  it("gir ett punkt per dag, også for dagene uten aktivitet", async () => {
    await search();
    const s = await owner().adminOwner.series({ period: "7d" });
    // Sju døgn som starter midt på dagen berører åtte kalenderdager. Begge
    // endepunktene skal være med – ellers mangler kurven dagen i dag.
    expect(s.points.length).toBeGreaterThanOrEqual(7);
    expect(s.points.length).toBeLessThanOrEqual(8);
    expect(s.points.every((p) => typeof p.searches === "number" && typeof p.bookings === "number")).toBe(true);
    expect(s.points.filter((p) => p.searches === 0).length).toBeGreaterThan(0);
  });

  it("legger sammen til uker når perioden er et år, så kurven ikke blir 365 piksler støy", async () => {
    const s = await owner().adminOwner.series({ period: "year" });
    expect(s.period.step).toBe(7);
    expect(s.points.length).toBeLessThanOrEqual(53);
  });

  it("teller søk og bestillinger i hvert sitt felt", async () => {
    await search();
    await search();
    const s = await owner().adminOwner.series({ period: "7d" });
    expect(s.points.reduce((a, p) => a + p.searches, 0)).toBe(2);
    expect(s.points.reduce((a, p) => a + p.bookings, 0)).toBe(0);
  });

  it("er stengt for alle andre enn eieren", async () => {
    await expectAppCode(caller({ staff: fakeStaff({ role: "ADMIN" }) }).adminOwner.series({ period: "7d" }), "FORBIDDEN");
  });

  it("teller nye kunder i perioden", async () => {
    await getDb().insert(customerAccounts).values({ email: "ny@hellosky.test", passwordHash: "x", firstName: "Kari", lastName: "Nordmann", emailVerified: true, locale: "nb", currency: "NOK" });
    const s = await owner().adminOwner.summary({ period: "30d" });
    expect(s.audience.newCustomers).toBe(1);
  });
});

/**
 * Profilbyttet.
 *
 * Profilen er ikke en tilgang, men den er signaturen under alt eieren gjør.
 * Da må den komme fra serveren – ikke fra det klienten påstår at den er.
 */
describe("profilbytte", () => {
  async function sessionFor(role: "OWNER" | "ADMIN") {
    const res = await getDb()
      .insert(staffUsers)
      .values({ email: `${role.toLowerCase()}-${Math.random().toString(36).slice(2)}@hellosky.test`, name: "Test Staff", role, status: "active" });
    const userId = Number(res[0].insertId);
    const s = await getDb()
      .insert(staffSessions)
      .values({ userId, tokenHash: `hash-${Math.random().toString(36).slice(2)}`, expiresAt: new Date(Date.now() + 60 * 60_000) });
    return { userId, sessionId: Number(s[0].insertId) };
  }

  it("lar eieren velge seg selv", async () => {
    const { userId, sessionId } = await sessionFor("OWNER");
    const c = caller({ staff: fakeStaff({ role: "OWNER", userId, sessionId }) });
    await expect(c.staffAuth.setProfile({ profile: "zyar" })).resolves.toEqual({ activeProfile: "zyar" });

    const [row] = await getDb().select().from(staffSessions).where(eq(staffSessions.id, sessionId));
    expect(row!.activeProfile).toBe("zyar");
  });

  it("avviser en profil klienten fant på", async () => {
    const { userId, sessionId } = await sessionFor("OWNER");
    const c = caller({ staff: fakeStaff({ role: "OWNER", userId, sessionId }) });
    await expectAppCode(c.staffAuth.setProfile({ profile: "direktør" }), "VALIDATION");
    await expectAppCode(c.staffAuth.setProfile({ profile: "ZANA" }), "VALIDATION");
  });

  it("nekter alle andre roller å ha en profil i det hele tatt", async () => {
    const { userId, sessionId } = await sessionFor("ADMIN");
    const c = caller({ staff: fakeStaff({ role: "ADMIN", userId, sessionId }) });
    await expectAppCode(c.staffAuth.setProfile({ profile: "zana" }), "FORBIDDEN");
  });

  it("skriver navnet, ikke kontoen, i revisjonsloggen", async () => {
    const { userId, sessionId } = await sessionFor("OWNER");
    await caller({ staff: fakeStaff({ role: "OWNER", userId, sessionId, name: "HelloSky Eier" }) }).staffAuth.setProfile({ profile: "zana" });

    const [entry] = await getDb().select().from(auditLogs).where(eq(auditLogs.action, "staff.profile_switched"));
    expect(entry!.actorLabel).toBe("Zana");
  });
});
