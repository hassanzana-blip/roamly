import type { MySqlDatabase } from "drizzle-orm/mysql-core";
import type { MySql2PreparedQueryHKT, MySql2QueryResultHKT } from "drizzle-orm/mysql2";
import * as schema from "../../db/schema";
import { ledgerEntries } from "../../db/schema";

// ─── Hovedbok: dobbelt bokføring i minste enhet ────────────────────────────
// Immutable: kun INSERT. Hver postering (batch) må balansere per valuta.
// Kontoer (interne navn, ikke kontoplan):
//   customer_receivable  – fordring på kunde (før PSP-oppgjør)
//   psp_clearing         – penger hos betalingsleverandør (Stripe)
//   supplier_payable     – gjeld til leverandør (Duffel-saldo: billett + tilvalg)
//   service_fee_revenue  – HelloSky-inntekt (servicegebyr)
//   bonus_liability      – kundebonus (gjeld) brukt/opptjent
//   refund_payable       – skyldig refusjon til kunde
//   goodwill_expense     – kulanse (refusjon utover leverandør/gebyr)

/** Database ELLER transaksjon (begge er MySqlDatabase i drizzle). */
export type DbOrTx = MySqlDatabase<MySql2QueryResultHKT, MySql2PreparedQueryHKT, typeof schema>;

export type LedgerAccount =
  | "customer_receivable"
  | "psp_clearing"
  | "supplier_payable"
  | "service_fee_revenue"
  | "bonus_liability"
  | "refund_payable"
  | "goodwill_expense";

export type LedgerEntryInput = {
  account: LedgerAccount;
  direction: "debit" | "credit";
  amountMinor: number;
  currency: string;
  bookingId?: number | null;
  paymentId?: number | null;
  refundCaseId?: number | null;
  description?: string;
  externalRef?: string | null;
};

/** Kaster hvis batchen ikke balanserer (Σ debet = Σ kredit per valuta) eller har ugyldige beløp. */
export function assertBalanced(entries: LedgerEntryInput[]): void {
  const perCurrency = new Map<string, number>();
  for (const e of entries) {
    if (!Number.isInteger(e.amountMinor) || e.amountMinor < 0) {
      throw new Error(`Ugyldig hovedbokbeløp: ${e.amountMinor} (${e.account})`);
    }
    const c = e.currency.toUpperCase();
    perCurrency.set(c, (perCurrency.get(c) ?? 0) + (e.direction === "debit" ? e.amountMinor : -e.amountMinor));
  }
  for (const [c, diff] of perCurrency) {
    if (diff !== 0) throw new Error(`Hovedbok balanserer ikke for ${c}: differanse ${diff}`);
  }
}

/** Posterer en balansert batch. Poster med beløp 0 hoppes over. */
export async function postLedger(db: DbOrTx, entries: LedgerEntryInput[]): Promise<void> {
  assertBalanced(entries);
  const rows = entries
    .filter((e) => e.amountMinor > 0)
    .map((e) => ({
      account: e.account,
      direction: e.direction,
      amountMinor: e.amountMinor,
      currency: e.currency.toUpperCase(),
      bookingId: e.bookingId ?? null,
      paymentId: e.paymentId ?? null,
      refundCaseId: e.refundCaseId ?? null,
      description: e.description?.slice(0, 255) ?? null,
      externalRef: e.externalRef?.slice(0, 128) ?? null,
    }));
  if (rows.length === 0) return;
  await db.insert(ledgerEntries).values(rows);
}

/** Posteringer ved fangst av betaling (booking bekreftet). */
export function captureEntries(input: {
  bookingId: number;
  paymentId: number;
  currency: string;
  supplierMinor: number;
  servicesMinor: number;
  serviceFeeMinor: number;
  bonusUsedMinor: number;
  totalMinor: number;
  externalRef?: string | null;
}): LedgerEntryInput[] {
  const base = { bookingId: input.bookingId, paymentId: input.paymentId, currency: input.currency, externalRef: input.externalRef ?? null };
  return [
    // Salg: fordring på kunde mot leverandørgjeld + gebyrinntekt (bonus dekker en del av fordringen)
    { ...base, account: "customer_receivable", direction: "debit", amountMinor: input.totalMinor, description: "Salg flyreise" },
    { ...base, account: "bonus_liability", direction: "debit", amountMinor: input.bonusUsedMinor, description: "Bonus brukt" },
    { ...base, account: "supplier_payable", direction: "credit", amountMinor: input.supplierMinor + input.servicesMinor, description: "Leverandør (billett + tilvalg)" },
    { ...base, account: "service_fee_revenue", direction: "credit", amountMinor: input.serviceFeeMinor, description: "Servicegebyr" },
    // Oppgjør: PSP har fanget beløpet
    { ...base, account: "psp_clearing", direction: "debit", amountMinor: input.totalMinor, description: "Fanget hos betalingsleverandør" },
    { ...base, account: "customer_receivable", direction: "credit", amountMinor: input.totalMinor, description: "Fordring gjort opp" },
  ];
}

/** Posteringer når en refusjon opprettes (forpliktelse mot kunde). */
export function refundCreatedEntries(input: {
  bookingId: number;
  paymentId: number | null;
  refundCaseId: number;
  currency: string;
  supplierRefundMinor: number;
  servicesRefundMinor: number;
  serviceFeeRefundMinor: number;
  customerRefundMinor: number;
  externalRef?: string | null;
}): LedgerEntryInput[] {
  const base = {
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    refundCaseId: input.refundCaseId,
    currency: input.currency,
    externalRef: input.externalRef ?? null,
  };
  const covered = input.supplierRefundMinor + input.servicesRefundMinor + input.serviceFeeRefundMinor;
  const goodwill = Math.max(0, input.customerRefundMinor - covered);
  // Dersom kunden får mindre enn leverandør+gebyr (kan ikke skje ved policy, men vern mot ubalanse)
  const supplierPart = Math.min(input.supplierRefundMinor + input.servicesRefundMinor, input.customerRefundMinor);
  const feePart = Math.min(input.serviceFeeRefundMinor, input.customerRefundMinor - supplierPart);
  return [
    { ...base, account: "supplier_payable", direction: "debit", amountMinor: supplierPart, description: "Leverandørrefusjon" },
    { ...base, account: "service_fee_revenue", direction: "debit", amountMinor: feePart, description: "Refundert servicegebyr" },
    { ...base, account: "goodwill_expense", direction: "debit", amountMinor: goodwill, description: "Kulanse" },
    { ...base, account: "refund_payable", direction: "credit", amountMinor: input.customerRefundMinor, description: "Skyldig refusjon til kunde" },
  ];
}

/** Posteringer når PSP bekrefter utbetalt refusjon. */
export function refundPaidEntries(input: {
  bookingId: number;
  paymentId: number | null;
  refundCaseId: number;
  currency: string;
  customerRefundMinor: number;
  externalRef?: string | null;
}): LedgerEntryInput[] {
  const base = {
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    refundCaseId: input.refundCaseId,
    currency: input.currency,
    externalRef: input.externalRef ?? null,
  };
  return [
    { ...base, account: "refund_payable", direction: "debit", amountMinor: input.customerRefundMinor, description: "Refusjon utbetalt" },
    { ...base, account: "psp_clearing", direction: "credit", amountMinor: input.customerRefundMinor, description: "Refusjon via betalingsleverandør" },
  ];
}
