import { desc, eq } from "drizzle-orm";
import { invoices } from "../../db/schema";
import type { DbOrTx } from "./ledger";
import type { PriceBreakdownMinor } from "../../contracts/types";
import { getDb } from "../queries/connection";

// ─── Kvittering / faktura (bokføringsforskriften: løpende, ubrutt nummerserie) ──
// Nummeret hentes som MAX(invoice_number)+1 INNE i samme transaksjon som
// bookingen bekreftes, med radlås, slik at to samtidige bookinger aldri får
// samme nummer (unik indeks er siste skanse).

export type InvoiceLine = {
  description: string;
  amountMinor: number;
  /** MVA-sats som brøk (0, 0.12, 0.25). Beløpet er inkl. MVA. */
  vatRate: number;
  vatMinor: number;
};

export type SegmentForVat = { originCountryCode?: string | null; destinationCountryCode?: string | null };

/**
 * MVA på persontransport: 12 % når HELE reisen er innenlands i Norge,
 * ellers 0 % (internasjonal transport er fritatt). Ukjent land → 0 %.
 */
export function vatRateFor(segments: SegmentForVat[]): number {
  if (segments.length === 0) return 0;
  const allNo = segments.every((s) => s.originCountryCode === "NO" && s.destinationCountryCode === "NO");
  return allNo ? 0.12 : 0;
}

/** MVA-andel av et beløp som er inkl. MVA. */
export function vatPortion(amountInclMinor: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round((amountInclMinor * rate) / (1 + rate));
}

export const SERVICE_FEE_VAT_RATE = 0.25;

export function buildReceiptLines(breakdown: PriceBreakdownMinor, flightVatRate: number): InvoiceLine[] {
  const lines: InvoiceLine[] = [
    {
      description: "Flyreise (leverandørpris)",
      amountMinor: breakdown.supplierAmountMinor,
      vatRate: flightVatRate,
      vatMinor: vatPortion(breakdown.supplierAmountMinor, flightVatRate),
    },
  ];
  if (breakdown.servicesAmountMinor > 0) {
    lines.push({
      description: "Tilvalg (ekstra bagasje)",
      amountMinor: breakdown.servicesAmountMinor,
      vatRate: flightVatRate,
      vatMinor: vatPortion(breakdown.servicesAmountMinor, flightVatRate),
    });
  }
  lines.push({
    description: "Servicegebyr HelloSky",
    amountMinor: breakdown.serviceFeeAmountMinor,
    vatRate: SERVICE_FEE_VAT_RATE,
    vatMinor: vatPortion(breakdown.serviceFeeAmountMinor, SERVICE_FEE_VAT_RATE),
  });
  if (breakdown.bonusUsedMinor > 0) {
    lines.push({ description: "Bonus brukt", amountMinor: -breakdown.bonusUsedMinor, vatRate: 0, vatMinor: 0 });
  }
  return lines;
}

/**
 * Utsted kvittering for en booking. MÅ kalles inne i transaksjonen som
 * bekrefter bookingen (tx). Idempotent per (bookingId, kind).
 */
export async function issueReceipt(
  tx: DbOrTx,
  input: { bookingId: number; breakdown: PriceBreakdownMinor; segments: SegmentForVat[]; kind?: "receipt" | "credit_note"; refundCaseId?: number | null },
): Promise<{ invoiceId: number; invoiceNumber: number; lines: InvoiceLine[]; vatMinor: number; totalMinor: number }> {
  const kind = input.kind ?? "receipt";
  const existing = await tx.select().from(invoices).where(eq(invoices.bookingId, input.bookingId));
  const same = existing.find((i) => i.kind === kind && (input.refundCaseId == null || i.refundCaseId === input.refundCaseId));
  if (same) {
    const lines = JSON.parse(same.linesJson) as InvoiceLine[];
    return { invoiceId: same.id, invoiceNumber: same.invoiceNumber, lines, vatMinor: same.vatMinor, totalMinor: same.totalMinor };
  }

  const lines = buildReceiptLines(input.breakdown, vatRateFor(input.segments));
  const vatMinor = lines.reduce((s, l) => s + l.vatMinor, 0);
  const totalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);
  if (totalMinor !== input.breakdown.totalAmountMinor) {
    throw new Error(`Kvitteringslinjer (${totalMinor}) stemmer ikke med total (${input.breakdown.totalAmountMinor})`);
  }

  // Neste nummer med radlås på siste rad (serialiserer samtidige utstedelser).
  const [last] = await tx
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1)
    .for("update");
  const invoiceNumber = (last?.invoiceNumber ?? 0) + 1;
  const result = await tx.insert(invoices).values({
    invoiceNumber,
    kind,
    bookingId: input.bookingId,
    refundCaseId: input.refundCaseId ?? null,
    currency: input.breakdown.currency,
    totalMinor,
    vatMinor,
    linesJson: JSON.stringify(lines),
  });
  return { invoiceId: Number(result[0].insertId), invoiceNumber, lines, vatMinor, totalMinor };
}

/** Kreditnota for en refusjon (egen linje, negativt beløp). Idempotent per refundCaseId. */
export async function issueCreditNote(
  tx: DbOrTx,
  input: { bookingId: number; refundCaseId: number; currency: string; customerRefundMinor: number; serviceFeeRefundMinor: number; flightVatRate: number },
): Promise<{ invoiceNumber: number }> {
  const existing = await tx.select().from(invoices).where(eq(invoices.refundCaseId, input.refundCaseId)).limit(1);
  if (existing[0]) return { invoiceNumber: existing[0].invoiceNumber };
  const flightPart = input.customerRefundMinor - input.serviceFeeRefundMinor;
  const lines: InvoiceLine[] = [
    { description: "Refusjon flyreise", amountMinor: -flightPart, vatRate: input.flightVatRate, vatMinor: -vatPortion(flightPart, input.flightVatRate) },
  ];
  if (input.serviceFeeRefundMinor > 0) {
    lines.push({
      description: "Refundert servicegebyr",
      amountMinor: -input.serviceFeeRefundMinor,
      vatRate: SERVICE_FEE_VAT_RATE,
      vatMinor: -vatPortion(input.serviceFeeRefundMinor, SERVICE_FEE_VAT_RATE),
    });
  }
  const [last] = await tx.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices).orderBy(desc(invoices.invoiceNumber)).limit(1).for("update");
  const invoiceNumber = (last?.invoiceNumber ?? 0) + 1;
  await tx.insert(invoices).values({
    invoiceNumber,
    kind: "credit_note",
    bookingId: input.bookingId,
    refundCaseId: input.refundCaseId,
    currency: input.currency,
    totalMinor: -input.customerRefundMinor,
    vatMinor: lines.reduce((s, l) => s + l.vatMinor, 0),
    linesJson: JSON.stringify(lines),
  });
  return { invoiceNumber };
}

export async function invoiceForBooking(bookingId: number) {
  const rows = await getDb().select().from(invoices).where(eq(invoices.bookingId, bookingId)).orderBy(desc(invoices.issuedAt));
  return rows.map((r) => ({ ...r, lines: JSON.parse(r.linesJson) as InvoiceLine[] }));
}
