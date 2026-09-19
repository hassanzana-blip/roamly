import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./queries/connection";
import { customerDocumentBlobs, customerDocuments, tripPlans, DOCUMENT_KINDS } from "../db/schema";
import { resolveCustomerSession } from "./lib/customerSessions";
import { isAllowedOrigin } from "./lib/origin";
import { assertRateLimit, clientIp } from "./lib/ratelimit";
import { decryptBytes, encryptBytes } from "./lib/crypto";
import { contentDisposition, MAX_DOCUMENT_BASE64_CHARS, MAX_DOCUMENT_BYTES, MAX_DOCUMENTS_PER_CUSTOMER, safeFileName, sniffDocumentMime } from "./lib/documentFiles";
import { logAudit } from "./lib/audit";
import { log } from "./lib/logger";

/**
 * Bytes inn og ut for kundens reisedokumenter.
 *
 * Egen Hono-app fordi tRPC-kroppen er begrenset til 1 MB og fordi et PDF-svar
 * er en fil, ikke en JSON-konvolutt. Autentisering er den samme sesjons-
 * cookien som resten av kundesonen; eierskap sjekkes i hver spørring.
 * Svarene er `private, no-store` – en billett skal ikke ligge i en mellomlager.
 */

const uploadSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  title: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(200),
  /** Ren base64 uten data:-prefiks. */
  data: z.string().min(16).max(MAX_DOCUMENT_BASE64_CHARS),
  tripPlanId: z.number().int().positive().nullable().optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const documentsApp = new Hono();

// Grensen ligger over byte-grensen med base64-overhead og JSON-ramme.
documentsApp.use("/upload", bodyLimit({ maxSize: MAX_DOCUMENT_BASE64_CHARS + 2048, onError: (c) => c.json({ error: "Filen er for stor. Maks 6 MB.", code: "TOO_LARGE" }, 413) }));

documentsApp.post("/upload", async (c) => {
  if (!isAllowedOrigin(c.req.raw.headers)) return c.json({ error: "Ugyldig opprinnelse", code: "FORBIDDEN" }, 403);
  const customer = await resolveCustomerSession(c.req.raw);
  if (!customer) return c.json({ error: "Logg inn for å laste opp dokumenter.", code: "UNAUTHORIZED" }, 401);
  try {
    assertRateLimit("document-upload", String(customer.customerId), 30, 60 * 60_000);
  } catch (err) {
    return c.json({ error: "For mange opplastinger. Prøv igjen om en stund.", code: "RATE_LIMITED" }, 429);
  }
  const parsed = uploadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Ugyldig forespørsel.", code: "VALIDATION" }, 400);
  const input = parsed.data;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) return c.json({ error: "Ugyldig filinnhold.", code: "VALIDATION" }, 400);
  const bytes = Buffer.from(input.data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return c.json({ error: "Filen er for stor. Maks 6 MB.", code: "TOO_LARGE" }, 413);
  const mime = sniffDocumentMime(bytes);
  if (!mime) return c.json({ error: "Vi tar imot PDF, JPEG, PNG og WebP.", code: "UNSUPPORTED" }, 415);

  const db = getDb();
  const existing = await db.select({ id: customerDocuments.id }).from(customerDocuments).where(eq(customerDocuments.customerId, customer.customerId));
  if (existing.length >= MAX_DOCUMENTS_PER_CUSTOMER) return c.json({ error: `Du kan ha inntil ${MAX_DOCUMENTS_PER_CUSTOMER} dokumenter. Slett noen først.`, code: "LIMIT" }, 409);
  if (input.tripPlanId) {
    const [plan] = await db.select({ id: tripPlans.id }).from(tripPlans).where(and(eq(tripPlans.id, input.tripPlanId), eq(tripPlans.customerId, customer.customerId))).limit(1);
    if (!plan) return c.json({ error: "Reiseplanen finnes ikke.", code: "NOT_FOUND" }, 404);
  }

  const fileName = safeFileName(input.fileName, mime);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ciphertext = encryptBytes(bytes);
  const id = await db.transaction(async (tx) => {
    const result = await tx.insert(customerDocuments).values({
      customerId: customer.customerId,
      tripPlanId: input.tripPlanId ?? null,
      kind: input.kind,
      title: input.title,
      fileName,
      mime,
      bytes: bytes.length,
      source: "manual",
      travelDate: input.travelDate ?? null,
      sha256,
    });
    const newId = Number(result[0].insertId);
    await tx.insert(customerDocumentBlobs).values({ documentId: newId, ciphertext });
    return newId;
  });
  // Ingen filnavn eller innhold i loggen – bare at det skjedde.
  await logAudit({ actorType: "customer", actorId: customer.customerId, action: "document.uploaded", targetType: "customer_document", targetId: id, ip: clientIp(c.req.raw), metadata: { kind: input.kind, bytes: bytes.length, mime } });
  return c.json({ id, fileName, mime, bytes: bytes.length, href: `/api/documents/${id}` }, 201);
});

documentsApp.get("/:id", async (c) => {
  const customer = await resolveCustomerSession(c.req.raw);
  if (!customer) return c.text("Logg inn for å åpne dokumentet.", 401, { "cache-control": "private, no-store" });
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.text("Ikke funnet", 404, { "cache-control": "private, no-store" });
  try {
    assertRateLimit("document-read", String(customer.customerId), 240, 60 * 60_000);
  } catch {
    return c.text("For mange forespørsler", 429, { "cache-control": "private, no-store" });
  }
  const db = getDb();
  // Eierskap i selve spørringen: et fremmed dokument finnes ikke, sett fra denne kunden.
  const [doc] = await db.select().from(customerDocuments).where(and(eq(customerDocuments.id, id), eq(customerDocuments.customerId, customer.customerId))).limit(1);
  if (!doc) return c.text("Ikke funnet", 404, { "cache-control": "private, no-store" });
  const [blob] = await db.select({ ciphertext: customerDocumentBlobs.ciphertext }).from(customerDocumentBlobs).where(eq(customerDocumentBlobs.documentId, doc.id)).limit(1);
  if (!blob) return c.text("Ikke funnet", 404, { "cache-control": "private, no-store" });
  let plain: Buffer;
  try {
    plain = decryptBytes(Buffer.from(blob.ciphertext));
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err), documentId: doc.id }, "dokument: dekryptering feilet");
    return c.text("Dokumentet kunne ikke åpnes", 500, { "cache-control": "private, no-store" });
  }
  const download = c.req.query("download") === "1";
  return c.body(new Uint8Array(plain), 200, {
    "content-type": doc.mime,
    "content-length": String(plain.length),
    "content-disposition": contentDisposition(doc.fileName, !download),
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
});


