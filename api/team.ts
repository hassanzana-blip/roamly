import { z } from "zod";
import { desc, eq, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, permittedProcedure, staffProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  payrollEntries,
  problemReports,
  staffNotes,
  staffUsers,
  teamMessages,
} from "../db/schema";
import { logAudit } from "./lib/audit";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const PROBLEM_STATUSES = ["open", "in_progress", "resolved"] as const;
const NOTE_COLORS = ["sun", "sky", "leaf", "rose"] as const;

/** Lønn, meldinger, notater og problemmeldinger — interne teamverktøy. */
export const teamRouter = createRouter({
  // ─── Teamchat ────────────────────────────────────────────────────────────

  listMessages: permittedProcedure("team:use")
    .input(z.object({ afterId: z.number().int().min(0).default(0) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: teamMessages.id,
          body: teamMessages.body,
          createdAt: teamMessages.createdAt,
          senderId: teamMessages.senderId,
          senderName: staffUsers.name,
        })
        .from(teamMessages)
        .leftJoin(staffUsers, eq(teamMessages.senderId, staffUsers.id))
        .where(sql`${teamMessages.id} > ${input.afterId}`)
        .orderBy(teamMessages.id)
        .limit(200);
      return rows.map((r) => ({ ...r, senderName: r.senderName ?? "Ukjent" }));
    }),

  sendMessage: permittedProcedure("team:use")
    .input(z.object({ body: z.string().trim().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.insert(teamMessages).values({
        senderId: ctx.staff!.userId,
        body: input.body,
      });
      return { ok: true, id: Number(result[0].insertId) };
    }),

  // ─── Notattavle ──────────────────────────────────────────────────────────

  listNotes: permittedProcedure("team:use").query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        note: staffNotes,
        authorName: staffUsers.name,
      })
      .from(staffNotes)
      .leftJoin(staffUsers, eq(staffNotes.authorId, staffUsers.id))
      .orderBy(desc(staffNotes.pinned), desc(staffNotes.updatedAt))
      .limit(100);
    return rows.map((r) => ({ ...r.note, authorName: r.authorName ?? "Ukjent" }));
  }),

  createNote: permittedProcedure("team:use")
    .input(z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(4000),
      color: z.enum(NOTE_COLORS).default("sun"),
      pinned: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.insert(staffNotes).values({
        authorId: ctx.staff!.userId,
        title: input.title,
        body: input.body,
        color: input.color,
        pinned: input.pinned,
      });
      return { ok: true, id: Number(result[0].insertId) };
    }),

  updateNote: permittedProcedure("team:use")
    .input(z.object({
      id: z.number().int(),
      title: z.string().trim().min(1).max(120).optional(),
      body: z.string().trim().min(1).max(4000).optional(),
      pinned: z.boolean().optional(),
      color: z.enum(NOTE_COLORS).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [note] = await db.select().from(staffNotes).where(eq(staffNotes.id, input.id)).limit(1);
      if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke notatet." });
      const isOwner = ctx.staff!.role === "OWNER";
      if (note.authorId !== ctx.staff!.userId && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Du kan kun endre egne notater." });
      }
      const { id, ...patch } = input;
      await db.update(staffNotes).set(patch).where(eq(staffNotes.id, id));
      return { ok: true };
    }),

  deleteNote: permittedProcedure("team:use")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [note] = await db.select().from(staffNotes).where(eq(staffNotes.id, input.id)).limit(1);
      if (!note) return { ok: true };
      const isOwner = ctx.staff!.role === "OWNER";
      if (note.authorId !== ctx.staff!.userId && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Du kan kun slette egne notater." });
      }
      await db.delete(staffNotes).where(eq(staffNotes.id, input.id));
      return { ok: true };
    }),

  // ─── Problemmeldinger ────────────────────────────────────────────────────

  listProblems: permittedProcedure("problems:read").query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        problem: problemReports,
        reporterName: staffUsers.name,
      })
      .from(problemReports)
      .leftJoin(staffUsers, eq(problemReports.reportedById, staffUsers.id))
      .orderBy(desc(problemReports.createdAt))
      .limit(200);
    const assignees = await db
      .select({ id: staffUsers.id, name: staffUsers.name })
      .from(staffUsers)
      .where(ne(staffUsers.status, "invited"));
    return {
      items: rows.map((r) => ({ ...r.problem, reporterName: r.reporterName ?? "Ukjent" })),
      assignees,
    };
  }),

  createProblem: permittedProcedure("problems:write")
    .input(z.object({
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(4000),
      severity: z.enum(SEVERITIES).default("medium"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.insert(problemReports).values({
        title: input.title,
        description: input.description,
        severity: input.severity,
        reportedById: ctx.staff!.userId,
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "problem.created", targetType: "problem_report",
        targetId: String(Number(result[0].insertId)),
      });
      return { ok: true, id: Number(result[0].insertId) };
    }),

  updateProblem: permittedProcedure("problems:write")
    .input(z.object({
      id: z.number().int(),
      status: z.enum(PROBLEM_STATUSES).optional(),
      assignedToId: z.number().int().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [problem] = await db.select().from(problemReports)
        .where(eq(problemReports.id, input.id)).limit(1);
      if (!problem) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke meldingen." });
      const patch: Record<string, unknown> = {};
      if (input.status) {
        patch.status = input.status;
        patch.resolvedAt = input.status === "resolved" ? new Date() : null;
      }
      if (input.assignedToId !== undefined) patch.assignedToId = input.assignedToId;
      await db.update(problemReports).set(patch).where(eq(problemReports.id, input.id));
      if (input.status === "resolved") {
        await logAudit({
          actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
          action: "problem.resolved", targetType: "problem_report", targetId: String(input.id),
        });
      }
      return { ok: true };
    }),

  // ─── Lønn ────────────────────────────────────────────────────────────────

  payrollList: permittedProcedure("payroll:read").query(async () => {
    const db = getDb();
    const staff = await db
      .select({ id: staffUsers.id, name: staffUsers.name, role: staffUsers.role, status: staffUsers.status })
      .from(staffUsers)
      .where(ne(staffUsers.status, "invited"));
    const entries = await db
      .select({
        entry: payrollEntries,
        staffName: staffUsers.name,
        registeredByName: sql<string>`(SELECT name FROM staff_users WHERE id = ${payrollEntries.registeredById})`,
      })
      .from(payrollEntries)
      .leftJoin(staffUsers, eq(payrollEntries.staffUserId, staffUsers.id))
      .orderBy(desc(payrollEntries.createdAt))
      .limit(300);
    const totals = await db
      .select({
        staffUserId: payrollEntries.staffUserId,
        paid: sql<string>`COALESCE(SUM(CASE WHEN ${payrollEntries.status} = 'paid' THEN ${payrollEntries.amount} ELSE 0 END), 0)`,
        planned: sql<string>`COALESCE(SUM(CASE WHEN ${payrollEntries.status} = 'planned' THEN ${payrollEntries.amount} ELSE 0 END), 0)`,
      })
      .from(payrollEntries)
      .groupBy(payrollEntries.staffUserId);
    return {
      staff,
      totals: totals.map((t) => ({ staffUserId: t.staffUserId, paid: String(t.paid), planned: String(t.planned) })),
      entries: entries.map((r) => ({
        ...r.entry,
        staffName: r.staffName ?? "Ukjent",
        registeredByName: r.registeredByName ?? "Ukjent",
      })),
    };
  }),

  payrollAdd: permittedProcedure("payroll:manage")
    .input(z.object({
      staffUserId: z.number().int(),
      periodLabel: z.string().trim().min(1).max(40),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Beløpet må være et positivt tall"),
      note: z.string().trim().max(255).optional(),
      markPaid: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [member] = await db.select().from(staffUsers)
        .where(eq(staffUsers.id, input.staffUserId)).limit(1);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke ansatt." });
      const result = await db.insert(payrollEntries).values({
        staffUserId: input.staffUserId,
        periodLabel: input.periodLabel,
        amount: input.amount,
        status: input.markPaid ? "paid" : "planned",
        paidAt: input.markPaid ? new Date() : null,
        note: input.note ?? null,
        registeredById: ctx.staff!.userId,
      });
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "payroll.entry_added", targetType: "payroll_entry",
        targetId: String(Number(result[0].insertId)),
        metadata: { staffUserId: input.staffUserId, amount: input.amount, period: input.periodLabel },
      });
      return { ok: true, id: Number(result[0].insertId) };
    }),

  payrollMarkPaid: permittedProcedure("payroll:manage")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.update(payrollEntries)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(payrollEntries.id, input.id));
      await logAudit({
        actorType: "staff", actorId: ctx.staff!.userId, actorLabel: ctx.staff!.name,
        action: "payroll.marked_paid", targetType: "payroll_entry", targetId: String(input.id),
      });
      return { ok: true };
    }),

  payrollDelete: permittedProcedure("payroll:manage")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [entry] = await db.select().from(payrollEntries)
        .where(eq(payrollEntries.id, input.id)).limit(1);
      if (entry?.status === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Utbetalte poster kan ikke slettes." });
      }
      await db.delete(payrollEntries).where(eq(payrollEntries.id, input.id));
      return { ok: true };
    }),

  /** Hvem er innlogget + kollegaer (til chat/notater). */
  teamDirectory: staffProcedure.query(async () => {
    const rows = await getDb()
      .select({ id: staffUsers.id, name: staffUsers.name, role: staffUsers.role })
      .from(staffUsers)
      .where(eq(staffUsers.status, "active"));
    return rows;
  }),
});
