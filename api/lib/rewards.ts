import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { customerAccounts, rewardEvents } from "../../db/schema";
import { getSetting } from "./pricing";
import { isDuplicateKeyError } from "./jobs";
import { notify } from "./notifications";
import { log } from "./logger";

/**
 * HelloSky-bonus: regler, nivåer og reskontro.
 *
 * Alle satser leses fra `settings.rewards.rules` (admin → Bonus og henvisning).
 * Standardverdiene under er de som gjaldt før regelmotoren fantes, slik at
 * ingenting endrer seg i produksjon før noen faktisk bestemmer noe annet.
 *
 * Nivåer gir ingen løfter vi ikke kan holde: fordelene er tekst som admin
 * skriver, og et nivå uten fordeler er bare et navn. Ingen «elite» uten innhold.
 */

export type RewardTier = { id: string; name: string; minCompletedTrips: number; benefits: string[] };

export type RewardRules = {
  /** Opptjening på gjennomført bestilling, brøk av totalpris (0.01 = 1 %). Kun NOK. */
  bookingEarnFraction: number;
  /** Henvisning: kroner til den som inviterte, når den inviterte har fullført første reise. */
  referralReferrerKr: number;
  /** Henvisning: kroner til den inviterte, samme tidspunkt. */
  referralReferredKr: number;
  /** Programnavn slik det vises til kunden. */
  programName: string;
  tiers: RewardTier[];
};

export const DEFAULT_REWARD_RULES: RewardRules = {
  bookingEarnFraction: 0.01,
  referralReferrerKr: 200,
  referralReferredKr: 200,
  programName: "HelloSky Bonus",
  tiers: [
    { id: "explorer", name: "Explorer", minCompletedTrips: 0, benefits: ["Bonus på hver gjennomførte reise", "Prisovervåking og lagrede reisende"] },
    { id: "traveller", name: "Traveller", minCompletedTrips: 3, benefits: ["Alt i Explorer", "Prioritert svar fra kundeservice"] },
    { id: "voyager", name: "Voyager", minCompletedTrips: 8, benefits: ["Alt i Traveller", "Tidlig tilgang til utvalgte tilbud"] },
  ],
};

function cleanRules(raw: unknown): RewardRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<RewardRules>;
  const frac = typeof r.bookingEarnFraction === "number" && r.bookingEarnFraction >= 0 && r.bookingEarnFraction <= 0.2 ? r.bookingEarnFraction : DEFAULT_REWARD_RULES.bookingEarnFraction;
  const kr = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5000 ? v : d);
  const tiers = Array.isArray(r.tiers) && r.tiers.length
    ? r.tiers
        .filter((t): t is RewardTier => Boolean(t && typeof t === "object" && typeof (t as RewardTier).id === "string" && typeof (t as RewardTier).name === "string"))
        .map((t) => ({
          id: t.id.slice(0, 24),
          name: t.name.slice(0, 40),
          minCompletedTrips: Number.isInteger(t.minCompletedTrips) && t.minCompletedTrips >= 0 ? t.minCompletedTrips : 0,
          benefits: Array.isArray(t.benefits) ? t.benefits.filter((b) => typeof b === "string").map((b) => b.slice(0, 120)).slice(0, 8) : [],
        }))
        .sort((a, b) => a.minCompletedTrips - b.minCompletedTrips)
    : DEFAULT_REWARD_RULES.tiers;
  return {
    bookingEarnFraction: frac,
    referralReferrerKr: kr(r.referralReferrerKr, DEFAULT_REWARD_RULES.referralReferrerKr),
    referralReferredKr: kr(r.referralReferredKr, DEFAULT_REWARD_RULES.referralReferredKr),
    programName: typeof r.programName === "string" && r.programName.trim() ? r.programName.trim().slice(0, 40) : DEFAULT_REWARD_RULES.programName,
    tiers,
  };
}

export async function rewardRules(): Promise<RewardRules> {
  return cleanRules(await getSetting<unknown>("rewards.rules", null));
}

/** Nivået kunden er på, gitt antall gjennomførte reiser — og hva som skal til for neste. */
export function tierFor(rules: RewardRules, completedTrips: number): { current: RewardTier; next: RewardTier | null; tripsToNext: number } {
  let current = rules.tiers[0];
  let next: RewardTier | null = null;
  for (const t of rules.tiers) {
    if (completedTrips >= t.minCompletedTrips) current = t;
    else {
      next = t;
      break;
    }
  }
  return { current, next, tripsToNext: next ? Math.max(0, next.minCompletedTrips - completedTrips) : 0 };
}

/** Opptjent bonus på en bestilling i hele kroner (kun NOK — vi finner ikke på valutakurser). */
export function bookingEarnKr(rules: RewardRules, totalAmountMinor: number, currency: string): number {
  if (currency !== "NOK") return 0;
  return Math.floor((totalAmountMinor / 100) * rules.bookingEarnFraction);
}

export type RewardEventInput = {
  customerId: number;
  kind: "booking" | "referral" | "referral_welcome" | "milestone" | "promotion" | "redemption" | "adjustment";
  amountKr: number;
  refType?: string;
  refId?: string | number;
  note?: string;
};

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Skriv én bonushendelse og oppdater saldoen — som én enhet. Den unike
 * indeksen (kind, refType, refId) gjør kallet idempotent: samme bestilling kan
 * aldri gi bonus to ganger, uansett hvor mange ganger workeren prøver.
 * Returnerer false når hendelsen fantes fra før.
 */
export async function recordReward(input: RewardEventInput, tx?: Tx): Promise<boolean> {
  const db = tx ?? getDb();
  if (input.amountKr === 0) return false;
  try {
    await db.insert(rewardEvents).values({
      customerId: input.customerId,
      kind: input.kind,
      amountKr: input.amountKr,
      refType: input.refType ?? null,
      refId: input.refId != null ? String(input.refId).slice(0, 64) : null,
      note: input.note?.slice(0, 255) ?? null,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
  await db
    .update(customerAccounts)
    .set({ bonusKr: sql`${customerAccounts.bonusKr} + ${input.amountKr}` })
    .where(eq(customerAccounts.id, input.customerId));
  log.info({ customerId: input.customerId, kind: input.kind, amountKr: input.amountKr }, "bonus registrert");
  if (input.amountKr > 0) {
    const what = input.kind === "booking" ? "for reisen din" : input.kind === "referral" ? "fordi en du inviterte har reist" : input.kind === "referral_welcome" ? "som velkomstbonus" : "";
    await notify({
      customerId: input.customerId,
      type: "rewards",
      title: `${input.amountKr} kr i bonus ${what}`.trim(),
      body: input.note ?? undefined,
      href: "/profil/bonus",
      dedupeKey: `reward:${input.kind}:${input.refType ?? "-"}:${input.refId ?? "-"}`,
    }).catch(() => {});
  }
  return true;
}

export async function rewardHistory(customerId: number, limit = 30) {
  const rows = await getDb()
    .select()
    .from(rewardEvents)
    .where(eq(rewardEvents.customerId, customerId))
    .orderBy(desc(rewardEvents.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountKr: r.amountKr,
    note: r.note,
    refType: r.refType,
    refId: r.refId,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Antall henvisninger som har gitt bonus (den inviterte fullførte første reise). */
export async function qualifiedReferralCount(customerId: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(rewardEvents)
    .where(and(eq(rewardEvents.customerId, customerId), eq(rewardEvents.kind, "referral")));
  return Number(row?.n ?? 0);
}
