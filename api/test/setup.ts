import "./env";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, closeDb } from "../queries/connection";
import { appRouter } from "../router";
import { createCallerFactory } from "../middleware";
import type { TrpcContext } from "../context";
import type { StaffIdentity } from "../lib/sessions";
import type { CustomerIdentity } from "../lib/customerSessions";
import { claimNextJob } from "../lib/jobs";
import { runJob } from "../lib/workerHandlers";
import { AppError } from "../lib/errors";
import type { Offer, PassengerDetails } from "../../contracts/types";
import { resetAccessTokenCache } from "../checkout";

// ─── Integrasjonstest-harness (ekte MariaDB/MySQL) ───────────────────────────
// - truncateAll(): tøm alle tabeller mellom tester (FK-sjekk av)
// - makeCtx()/caller(): tRPC-caller med fabrikert kontekst (samme form som context.ts)
// - runJobsUntilIdle(): kjør outbox-jobber til køen er tom (claimNextJob + dispatch)

export { getDb, closeDb };

let tableCache: string[] | null = null;

async function listTables(): Promise<string[]> {
  if (tableCache) return tableCache;
  const db = getDb();
  const [rows] = (await db.execute(sql`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`)) as unknown as [
    Array<{ t: string }>,
  ];
  tableCache = rows.map((r) => r.t).filter((t) => t !== "__drizzle_migrations");
  return tableCache;
}

/**
 * TRUNCATE nullstiller auto_increment, så neste test får igjen id 1 – og
 * dermed de samme jobbnøklene («attempt:1», «recover:1:…»). Kjøres en
 * bakgrunnsjobb fra forrige test ferdig etter at vi har tømt (og det gjør de:
 * flere steder legges jobber i kø uten at noen venter på dem), står det en rad
 * igjen med en aktiv dedupe-nøkkel som stille sluker neste tests innlegging.
 * Da kjører ingenting, og testen feiler et helt annet sted.
 *
 * Løsningen er å la id-ene løpe videre: nøklene kan da ikke kollidere på tvers
 * av tester, uansett rekkefølge.
 */
const ID_STEP = 1000;
let idFloor = 0;

export async function truncateAll(): Promise<void> {
  resetAccessTokenCache();
  const db = getDb();
  const tables = await listTables();
  await db.execute(sql`SET FOREIGN_KEY_CHECKS=0`);
  try {
    for (const t of tables) await db.execute(sql.raw(`TRUNCATE TABLE \`${t}\``));
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS=1`);
  }
  idFloor += ID_STEP;
  for (const t of ["jobs", "booking_attempts", "checkout_sessions", "bookings"]) {
    if (tables.includes(t)) await db.execute(sql.raw(`ALTER TABLE \`${t}\` AUTO_INCREMENT = ${idFloor}`));
  }
}

let ipSeq = 0;
/** Unik «klient-IP» per kontekst slik at in-process rate limits ikke slår inn på tvers av tester. */
export function freshIp(): string {
  ipSeq += 1;
  return `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`;
}

export type CtxOptions = {
  staff?: StaffIdentity | null;
  customer?: CustomerIdentity | null;
  headers?: Record<string, string>;
  ip?: string;
  url?: string;
  method?: string;
};

export function makeCtx(opts: CtxOptions = {}): TrpcContext {
  const headers = new Headers({
    "x-forwarded-for": opts.ip ?? freshIp(),
    "user-agent": "vitest-integration",
    origin: "http://localhost:3000",
    ...(opts.headers ?? {}),
  });
  const req = new Request(opts.url ?? "http://localhost:3000/api/trpc/test", { method: opts.method ?? "POST", headers });
  return {
    req,
    resHeaders: new Headers(),
    requestId: `it-${randomUUID().slice(0, 8)}`,
    staff: opts.staff ?? null,
    customer: opts.customer ?? null,
  };
}

const factory = createCallerFactory(appRouter);
export type Caller = ReturnType<typeof factory>;

/** tRPC-caller med fabrikert kontekst. Hver caller har egen «IP». */
export function caller(opts: CtxOptions = {}): Caller {
  return factory(makeCtx(opts));
}

/** Fabrikert staff-identitet (ingen DB-rad nødvendig for RBAC/MFA-sjekker i middleware). */
export function fakeStaff(over: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    userId: over.userId ?? 1,
    email: over.email ?? "staff@hellosky.test",
    name: over.name ?? "Test Staff",
    role: over.role ?? "OWNER",
    status: "active",
    mfaEnabled: over.mfaEnabled ?? true,
    avatarUrl: null,
    sessionId: over.sessionId ?? 1,
    sessionCreatedAt: over.sessionCreatedAt ?? new Date(),
    mfaVerified: over.mfaVerified ?? true,
    ...over,
  };
}

/** Opprett en ekte staff_users-rad (FK-er som approved_by_id krever den) og returner identiteten. */
export async function seedStaff(over: Partial<StaffIdentity> & { passwordHash?: string | null } = {}): Promise<StaffIdentity> {
  const email = over.email ?? `staff-${randomUUID().slice(0, 8)}@hellosky.test`;
  const { staffUsers } = await import("../../db/schema");
  const res = await getDb().insert(staffUsers).values({
    email,
    name: over.name ?? "Test Staff",
    role: over.role ?? "OWNER",
    status: "active",
    mfaEnabled: over.mfaEnabled ?? true,
    passwordHash: over.passwordHash ?? null,
  });
  return fakeStaff({ ...over, userId: Number(res[0].insertId), email });
}

export function fakeCustomer(over: Partial<CustomerIdentity> = {}): CustomerIdentity {
  return {
    customerId: over.customerId ?? 1,
    email: over.email ?? "kunde@hellosky.test",
    phone: null,
    firstName: "Kari",
    lastName: "Nordmann",
    emailVerified: over.emailVerified ?? true,
    locale: "nb",
    currency: "NOK",
    sessionId: over.sessionId ?? 1,
    sessionCreatedAt: new Date(),
    ...over,
  };
}

/** Stabil app-kode fra en tRPC-feil (AppError i cause) — eller tRPC-koden. */
export function appCode(err: unknown): string | null {
  if (err instanceof AppError) return err.code;
  if (err instanceof TRPCError) {
    const c = err.cause;
    if (c instanceof AppError) return c.code;
    if (c && typeof c === "object" && "appCode" in c) return String((c as { appCode: unknown }).appCode);
    return err.code;
  }
  return null;
}

export async function expectAppCode(p: Promise<unknown>, code: string): Promise<void> {
  try {
    await p;
  } catch (err) {
    const got = appCode(err);
    if (got !== code) throw new Error(`Forventet app-kode ${code}, fikk ${got} (${err instanceof Error ? err.message : String(err)})`);
    return;
  }
  throw new Error(`Forventet feil ${code}, men kallet lyktes`);
}

export function trpcCode(err: unknown): string | null {
  return err instanceof TRPCError ? err.code : null;
}

/**
 * Kjør jobber til køen er tom. Jobber med runAt i fremtiden (backoff/gjenoppretting)
 * trekkes fram i tid slik at hele flyten kan testes uten å vente.
 */
export async function runJobsUntilIdle(opts: { max?: number; advanceScheduled?: boolean; workerId?: string } = {}): Promise<Array<{ id: number; type: string; outcome: string }>> {
  const db = getDb();
  const max = opts.max ?? 200;
  const advance = opts.advanceScheduled ?? true;
  const workerId = opts.workerId ?? "it-worker";
  const ran: Array<{ id: number; type: string; outcome: string }> = [];
  for (let i = 0; i < max; i++) {
    if (advance) {
      await db.execute(sql`UPDATE jobs SET run_at = NOW() WHERE status IN ('pending','failed') AND run_at > NOW()`);
    }
    const job = await claimNextJob(workerId);
    if (!job) return ran;
    const outcome = await runJob(job);
    ran.push({ id: job.id, type: job.type, outcome });
  }
  throw new Error(`runJobsUntilIdle: mer enn ${max} jobber — løkke?`);
}

// ─── Testdata ───────────────────────────────────────────────────────────────

export const TOMORROW_PLUS = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Standard voksen-passasjer for et tilbud. */
export function adultFor(offer: Offer, idx = 0, over: Partial<PassengerDetails> = {}): PassengerDetails {
  const p = offer.passengers[idx];
  return {
    id: p.id,
    type: "adult",
    title: "mr",
    gender: "m",
    givenName: idx === 0 ? "Ola" : ["Kari", "Per", "Anne", "Nils"][idx % 4],
    familyName: "Nordmann",
    bornOn: "1985-04-12",
    ...over,
  };
}

export const CONTACT = { contactEmail: "ola@hellosky.test", contactPhone: "+4791234567" };

export function sessionInput(offer: Offer, over: Record<string, unknown> = {}) {
  return {
    offerId: offer.id,
    passengers: offer.passengers.map((_, i) => adultFor(offer, i)),
    ...CONTACT,
    idempotencyKey: randomUUID(),
    termsAccepted: true as const,
    paymentMethod: "card" as const,
    ...over,
  };
}

/** Søk etter et tilbud (demo eller fake avhengig av injisert klient). */
export async function searchOffer(input: { origin?: string; destination?: string; pax?: Array<{ type: "adult" | "child" | "infant_without_seat"; age?: number }>; cabinClass?: "economy" | "business" } = {}): Promise<Offer> {
  const res = await caller().flights.search({
    slices: [{ origin: input.origin ?? "OSL", destination: input.destination ?? "BGO", departureDate: TOMORROW_PLUS(30) }],
    passengers: input.pax ?? [{ type: "adult" }],
    cabinClass: input.cabinClass ?? "economy",
  });
  if (!res.offers.length) throw new Error("ingen tilbud i søket");
  return res.offers[0];
}

export async function countRows(table: string, where = "1=1"): Promise<number> {
  const [rows] = (await getDb().execute(sql.raw(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${where}`))) as unknown as [Array<{ n: number | string }>];
  return Number(rows[0]?.n ?? 0);
}

export async function rows<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const [r] = (await getDb().execute(sql.raw(query))) as unknown as [T[]];
  return r;
}

/** Σ debet = Σ kredit per valuta i ledger_entries (evt. begrenset til én booking). */
export async function assertLedgerBalanced(bookingId?: number): Promise<void> {
  const r = await rows<{ currency: string; d: string; c: string }>(
    `SELECT currency, SUM(CASE WHEN direction='debit' THEN amount_minor ELSE 0 END) AS d, SUM(CASE WHEN direction='credit' THEN amount_minor ELSE 0 END) AS c
     FROM ledger_entries ${bookingId ? `WHERE booking_id = ${bookingId}` : ""} GROUP BY currency`,
  );
  if (r.length === 0) throw new Error("ingen hovedbokposteringer");
  for (const x of r) if (Number(x.d) !== Number(x.c)) throw new Error(`Hovedbok ubalansert for ${x.currency}: debet ${x.d} ≠ kredit ${x.c}`);
}
