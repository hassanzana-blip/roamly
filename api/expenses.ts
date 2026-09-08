import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { createRouter, permittedProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import { expenseReceipts, expenses, staffUsers } from "../db/schema";
import { AppError, toTRPCError } from "./lib/errors";
import { logAudit } from "./lib/audit";
import { clientIp } from "./lib/ratelimit";

// ─── Utgifter ───────────────────────────────────────────────────────────────
//
// Et bilag er en kvittering, et beløp, en dato og en kategori. Alt annet er
// pynt. Mva regnes ut på serveren fra bruttobeløpet og satsen, aldri sendt inn
// av klienten – da kan to bilag med samme sum aldri ha ulik mva fordi noen
// skrev feil i et felt.

/** Norske mva-satser. Sats i basispunkter for å slippe flyttall. */
export const VAT_RATES = [
  { bp: 2500, label: "25 % – vanlig sats" },
  { bp: 1500, label: "15 % – mat" },
  { bp: 1200, label: "12 % – transport og overnatting" },
  { bp: 0, label: "0 % – fritatt" },
] as const;

export const EXPENSE_CATEGORIES = [
  { id: "reise", label: "Reise og transport" },
  { id: "kost", label: "Mat og bevertning" },
  { id: "kontor", label: "Kontor og rekvisita" },
  { id: "programvare", label: "Programvare og abonnement" },
  { id: "markedsforing", label: "Markedsføring" },
  { id: "gebyr", label: "Bank- og kortgebyr" },
  { id: "annet", label: "Annet" },
] as const;

const CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id) as unknown as [string, ...string[]];
const VAT_BPS: number[] = VAT_RATES.map((v) => v.bp);

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bruk formen ÅÅÅÅ-MM-DD.");
const PERIOD = z.string().regex(/^\d{4}-\d{2}$/);

/** Maks 2 MB per kvittering. Bildet skaleres ned i nettleseren først. */
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

/**
 * Mva regnet ut av bruttobeløpet: brutto − brutto / (1 + sats).
 * Avrundes til nærmeste øre, én gang, slik kvitteringen faktisk bokføres.
 */
export function vatFromGross(grossMinor: number, rateBp: number | null | undefined): number {
  if (!rateBp || rateBp <= 0) return 0;
  const net = Math.round((grossMinor * 10_000) / (10_000 + rateBp));
  return grossMinor - net;
}

const expenseInput = z.object({
  spentOn: DATE,
  vendor: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORY_IDS),
  /** Bruttobeløp i kroner og øre, som tall – regnes om til minste enhet. */
  grossMinor: z.number().int().min(1).max(100_000_000),
  currency: z.enum(["NOK", "SEK", "DKK", "EUR", "USD", "GBP"]).default("NOK"),
  vatRateBp: z
    .number()
    .int()
    .refine((v) => VAT_BPS.includes(v), "Ukjent mva-sats.")
    .nullable()
    .optional(),
  note: z.string().trim().max(500).optional(),
});

const receiptInput = z
  .object({
    mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    name: z.string().trim().min(1).max(160),
    /** base64 uten data:-prefiks. */
    data: z.string().min(16),
  })
  .optional();

function periodOf(spentOn: string): string {
  return spentOn.slice(0, 7);
}

function assertDraft(status: string) {
  if (status !== "draft") {
    throw new AppError("CONFLICT", { message: "Bilaget er bokført og kan ikke endres. Opprett et nytt om noe er feil." });
  }
}

export const expensesRouter = createRouter({
  /** Kategoriene og satsene grensesnittet skal tilby – én kilde, ikke to lister. */
  options: permittedProcedure("expenses:read").query(() => ({
    categories: EXPENSE_CATEGORIES,
    vatRates: VAT_RATES,
    maxReceiptBytes: MAX_RECEIPT_BYTES,
  })),

  list: permittedProcedure("expenses:read")
    .input(z.object({ period: PERIOD.optional(), mine: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const where = [
        input?.period ? eq(expenses.period, input.period) : undefined,
        input?.mine ? eq(expenses.staffUserId, ctx.staff.userId) : undefined,
      ].filter(Boolean);
      const rows = await db
        .select({
          id: expenses.id,
          spentOn: expenses.spentOn,
          vendor: expenses.vendor,
          category: expenses.category,
          grossMinor: expenses.grossMinor,
          currency: expenses.currency,
          vatRateBp: expenses.vatRateBp,
          vatMinor: expenses.vatMinor,
          note: expenses.note,
          status: expenses.status,
          period: expenses.period,
          receiptMime: expenses.receiptMime,
          receiptName: expenses.receiptName,
          receiptBytes: expenses.receiptBytes,
          staffUserId: expenses.staffUserId,
          staffName: staffUsers.name,
        })
        .from(expenses)
        .innerJoin(staffUsers, eq(staffUsers.id, expenses.staffUserId))
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(expenses.spentOn), desc(expenses.id))
        .limit(500);
      return rows.map((r) => ({ ...r, hasReceipt: r.receiptBytes != null }));
    }),

  /** Månedssummer per kategori og per person – tallene månedsavslutningen trenger. */
  summary: permittedProcedure("expenses:read")
    .input(z.object({ period: PERIOD }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          category: expenses.category,
          staffUserId: expenses.staffUserId,
          staffName: staffUsers.name,
          currency: expenses.currency,
          gross: sql<number>`SUM(${expenses.grossMinor})`,
          vat: sql<number>`SUM(${expenses.vatMinor})`,
          n: sql<number>`COUNT(*)`,
        })
        .from(expenses)
        .innerJoin(staffUsers, eq(staffUsers.id, expenses.staffUserId))
        .where(eq(expenses.period, input.period))
        .groupBy(expenses.category, expenses.staffUserId, staffUsers.name, expenses.currency);

      const byCategory = new Map<string, { grossMinor: number; vatMinor: number; count: number }>();
      const byPerson = new Map<string, { name: string; grossMinor: number; count: number }>();
      let grossMinor = 0;
      let vatMinor = 0;
      for (const r of rows) {
        const g = Number(r.gross);
        const v = Number(r.vat);
        grossMinor += g;
        vatMinor += v;
        const c = byCategory.get(r.category) ?? { grossMinor: 0, vatMinor: 0, count: 0 };
        byCategory.set(r.category, { grossMinor: c.grossMinor + g, vatMinor: c.vatMinor + v, count: c.count + Number(r.n) });
        const key = String(r.staffUserId);
        const p = byPerson.get(key) ?? { name: r.staffName, grossMinor: 0, count: 0 };
        byPerson.set(key, { name: r.staffName, grossMinor: p.grossMinor + g, count: p.count + Number(r.n) });
      }
      return {
        period: input.period,
        grossMinor,
        vatMinor,
        netMinor: grossMinor - vatMinor,
        byCategory: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.grossMinor - a.grossMinor),
        byPerson: [...byPerson.values()].sort((a, b) => b.grossMinor - a.grossMinor),
      };
    }),

  create: permittedProcedure("expenses:write")
    .input(expenseInput.extend({ receipt: receiptInput }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const bytes = input.receipt ? Buffer.byteLength(input.receipt.data, "base64") : null;
        if (bytes && bytes > MAX_RECEIPT_BYTES) {
          throw new AppError("VALIDATION", { message: "Kvitteringen er for stor. Ta bildet på nytt, eller bruk en mindre fil.", data: { field: "receipt" } });
        }
        const vatMinor = vatFromGross(input.grossMinor, input.vatRateBp);
        const res = await db.insert(expenses).values({
          staffUserId: ctx.staff.userId,
          spentOn: input.spentOn,
          period: periodOf(input.spentOn),
          vendor: input.vendor,
          category: input.category,
          grossMinor: input.grossMinor,
          currency: input.currency,
          vatRateBp: input.vatRateBp ?? null,
          vatMinor,
          note: input.note ?? null,
          receiptMime: input.receipt?.mime ?? null,
          receiptName: input.receipt?.name ?? null,
          receiptBytes: bytes,
        });
        const id = Number(res[0].insertId);
        if (input.receipt) await db.insert(expenseReceipts).values({ expenseId: id, data: input.receipt.data });
        await logAudit({
          actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name,
          action: "expense.created", targetType: "expense", targetId: id,
          metadata: { grossMinor: input.grossMinor, currency: input.currency, category: input.category }, ip: clientIp(ctx.req),
        });
        return { id, vatMinor };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  update: permittedProcedure("expenses:write")
    .input(expenseInput.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const [row] = await db.select().from(expenses).where(eq(expenses.id, input.id)).limit(1);
        if (!row) throw new AppError("NOT_FOUND");
        assertDraft(row.status);
        const grossMinor = input.grossMinor ?? row.grossMinor;
        const vatRateBp = input.vatRateBp === undefined ? row.vatRateBp : input.vatRateBp;
        const spentOn = input.spentOn ?? row.spentOn;
        await db
          .update(expenses)
          .set({
            spentOn,
            period: periodOf(spentOn),
            vendor: input.vendor ?? row.vendor,
            category: input.category ?? row.category,
            grossMinor,
            currency: input.currency ?? (row.currency as "NOK"),
            vatRateBp,
            vatMinor: vatFromGross(grossMinor, vatRateBp),
            note: input.note ?? row.note,
          })
          .where(eq(expenses.id, input.id));
        await logAudit({ actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name, action: "expense.updated", targetType: "expense", targetId: input.id, ip: clientIp(ctx.req) });
        return { ok: true as const };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  remove: permittedProcedure("expenses:write")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const [row] = await db.select().from(expenses).where(eq(expenses.id, input.id)).limit(1);
        if (!row) throw new AppError("NOT_FOUND");
        assertDraft(row.status);
        await db.delete(expenseReceipts).where(eq(expenseReceipts.expenseId, input.id));
        await db.delete(expenses).where(eq(expenses.id, input.id));
        await logAudit({ actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name, action: "expense.deleted", targetType: "expense", targetId: input.id, ip: clientIp(ctx.req) });
        return { ok: true as const };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Kvitteringsbildet, hentet for seg. Listen henter det aldri. */
  receipt: permittedProcedure("expenses:read")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [meta] = await db.select({ mime: expenses.receiptMime, name: expenses.receiptName }).from(expenses).where(eq(expenses.id, input.id)).limit(1);
      if (!meta?.mime) throw new AppError("NOT_FOUND", { message: "Bilaget har ingen kvittering." });
      const [blob] = await db.select({ data: expenseReceipts.data }).from(expenseReceipts).where(eq(expenseReceipts.expenseId, input.id)).limit(1);
      if (!blob) throw new AppError("NOT_FOUND");
      return { mime: meta.mime, name: meta.name ?? "kvittering", dataUrl: `data:${meta.mime};base64,${blob.data}` };
    }),

  /** Lås måneden: bokførte bilag kan ikke endres eller slettes. */
  closePeriod: permittedProcedure("expenses:write")
    .input(z.object({ period: PERIOD }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const res = await db.update(expenses).set({ status: "bokfort" }).where(and(eq(expenses.period, input.period), eq(expenses.status, "draft")));
      const n = Number(res[0].affectedRows ?? 0);
      await logAudit({ actorType: "staff", actorId: ctx.staff.userId, actorLabel: ctx.staff.name, action: "expense.period_closed", targetType: "period", metadata: { period: input.period, count: n }, ip: clientIp(ctx.req) });
      return { closed: n };
    }),

  /**
   * Eksport til regnskapsføreren: semikolon-separert, norske desimaltegn og
   * BOM foran, slik at Excel i Norge åpner filen riktig uten spørsmål.
   */
  exportCsv: permittedProcedure("expenses:read")
    .input(z.object({ from: DATE, to: DATE }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          spentOn: expenses.spentOn,
          vendor: expenses.vendor,
          category: expenses.category,
          grossMinor: expenses.grossMinor,
          vatMinor: expenses.vatMinor,
          vatRateBp: expenses.vatRateBp,
          currency: expenses.currency,
          note: expenses.note,
          status: expenses.status,
          staffName: staffUsers.name,
        })
        .from(expenses)
        .innerJoin(staffUsers, eq(staffUsers.id, expenses.staffUserId))
        .where(and(gte(expenses.spentOn, input.from), lte(expenses.spentOn, input.to)))
        .orderBy(expenses.spentOn);

      const kr = (minorAmount: number) => (minorAmount / 100).toFixed(2).replace(".", ",");
      const cell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
      const header = ["Dato", "Leverandør", "Kategori", "Brutto", "Mva", "Sats", "Netto", "Valuta", "Ansatt", "Status", "Notat"];
      const lines = rows.map((r) =>
        [
          r.spentOn,
          cell(r.vendor),
          cell(EXPENSE_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category),
          kr(r.grossMinor),
          kr(r.vatMinor),
          r.vatRateBp != null ? `${r.vatRateBp / 100}%` : "",
          kr(r.grossMinor - r.vatMinor),
          r.currency,
          cell(r.staffName),
          r.status,
          cell(r.note),
        ].join(";"),
      );
      return {
        filename: `hellosky-utgifter-${input.from}_${input.to}.csv`,
        csv: `\uFEFF${[header.join(";"), ...lines].join("\r\n")}\r\n`,
        rows: rows.length,
      };
    }),
});
