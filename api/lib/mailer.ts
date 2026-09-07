import nodemailer, { type Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import type { Order } from "../../contracts/types";
import { env } from "./env";
import { log } from "./logger";
import { AppError } from "./errors";
import { getDb } from "../queries/connection";
import { emailEvents, quotes, supportCases } from "../../db/schema";
import { renderEmail, type EmailKind, type EmailLocale, type EmailPayloads } from "./emails/templates";

// ─── Transaksjonell e-post (OTA-131/079/133/134/135) ─────────────────────────
// Konfigureres med SMTP_URL eller SMTP_HOST/PORT/USER/PASS + MAIL_FROM.
// Produksjon uten transport → kaster (fail-closed; assertProductionSafety
// krever også SMTP). Dev uten transport → logger KUN "<kind> to <mottaker>",
// aldri innhold eller lenker med tokens.
// Hver sending registreres i email_events (queued → sent/failed).

export type MailResult = { sent: boolean; reason?: string; messageId?: string; eventId?: number };

let transport: Transporter | null | undefined;

function buildTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  if (env.SMTP_URL) transport = nodemailer.createTransport(env.SMTP_URL);
  else if (env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: env.SMTP_SECURE === "true",
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  } else transport = null;
  return transport;
}

const from = () => env.MAIL_FROM ?? "HelloSky <hei@hellosky.no>";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Render + send + logg. `to` valideres; ugyldig mottaker gir VALIDATION-feil
 * (aldri stille «ok») slik at kallere ikke tror en e-post gikk ut.
 */
export async function sendTemplatedEmail<K extends EmailKind>(
  kind: K,
  to: string,
  locale: EmailLocale | string | null | undefined,
  payload: EmailPayloads[K],
  opts: { bookingId?: number | null; replyTo?: string } = {},
): Promise<MailResult> {
  const recipient = String(to ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(recipient) || recipient.length > 255) {
    throw new AppError("VALIDATION", { message: "Ugyldig e-postadresse for utsending.", data: { kind } });
  }
  const resolvedLocale = locale === "nb" || locale === "en" || locale === "sv" || locale === "da" || locale === "de" ? locale : "nb";
  const rendered = renderEmail(kind, resolvedLocale, payload);
  const db = getDb();

  let eventId: number | undefined;
  try {
    const ins = await db.insert(emailEvents).values({
      recipient,
      kind,
      locale: resolvedLocale,
      bookingId: opts.bookingId ?? null,
      provider: buildTransport() ? "smtp" : "none",
      status: "queued",
    });
    eventId = Number(ins[0].insertId);
  } catch (err) {
    // Loggføring skal ikke stoppe utsending, men må synes.
    log.error({ err, kind }, "[mailer] kunne ikke registrere email_event");
  }

  const mark = async (status: "sent" | "failed" | "skipped", extra: { error?: string; providerMessageId?: string } = {}) => {
    if (!eventId) return;
    await db
      .update(emailEvents)
      .set({ status, error: extra.error?.slice(0, 2000) ?? null, providerMessageId: extra.providerMessageId?.slice(0, 128) ?? null })
      .where(eq(emailEvents.id, eventId))
      .catch(() => {});
  };

  const t = buildTransport();
  if (!t) {
    if (env.isProduction || env.isProdEnv) {
      await mark("failed", { error: "SMTP ikke konfigurert" });
      throw new AppError("INTERNAL", { message: "E-post er ikke konfigurert.", retryable: true, data: { kind } });
    }
    // Dev: ALDRI logg innhold/tokens — kun type og mottaker.
    log.info(`[mailer] (dev) ${kind} to ${recipient}`);
    await mark("skipped", { error: "dev: no transport" });
    return { sent: false, reason: "not_configured", eventId };
  }

  try {
    const info = await t.sendMail({
      from: from(),
      to: recipient,
      replyTo: opts.replyTo,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers: { "X-HelloSky-Kind": kind },
    });
    await mark("sent", { providerMessageId: info?.messageId });
    log.info({ kind, eventId, bookingId: opts.bookingId ?? undefined }, "[mailer] sendt");
    return { sent: true, messageId: info?.messageId, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await mark("failed", { error: message });
    log.error({ kind, eventId, err: message }, "[mailer] sending feilet");
    throw new AppError("INTERNAL", { message: "Kunne ikke sende e-post.", retryable: true, cause: err, data: { kind } });
  }
}

// ─── Bakoverkompatible navngitte eksporter (tynne wrappere) ─────────────────

export async function sendBookingConfirmation(
  order: Order,
  extras: { accessUrl?: string; locale?: string; bookingId?: number } = {},
): Promise<MailResult> {
  return sendTemplatedEmail("booking_confirmation", order.contactEmail, extras.locale ?? "nb", { order, accessUrl: extras.accessUrl }, { bookingId: extras.bookingId });
}

export function sendSupportAck(input: { email: string; name: string; caseReference: string; locale?: string }): Promise<MailResult> {
  return sendTemplatedEmail("support_ack", input.email, input.locale ?? "nb", { name: input.name, caseReference: input.caseReference });
}

/** Tilbuds-lenke til kunde (assisted booking). */
export async function sendQuoteCheckout(quoteId: number, token: string): Promise<MailResult> {
  const [quote] = await getDb().select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) throw new AppError("NOT_FOUND", { message: `Tilbud ${quoteId} ikke funnet` });
  const offer = JSON.parse(quote.offerSnapshot) as { slices?: Array<{ origin: { city: string }; destination: { city: string } }> };
  const slice = offer.slices?.[0];
  const route = slice ? `${slice.origin.city} → ${slice.destination.city}` : "";
  return sendTemplatedEmail("quote_checkout", quote.customerEmail, "nb", {
    customerName: quote.customerName,
    reference: quote.reference,
    route,
    totalAmount: quote.totalAmount,
    serviceFeeAmount: quote.serviceFeeAmount,
    currency: quote.currency,
    url: `${env.baseUrl}/tilbud/${encodeURIComponent(token)}`,
    expiresAt: quote.expiresAt.toISOString(),
  });
}

/** Svar på kundesak. */
export async function sendCaseReply(caseId: number, message: string): Promise<MailResult> {
  const [supportCase] = await getDb().select().from(supportCases).where(eq(supportCases.id, caseId)).limit(1);
  if (!supportCase) throw new AppError("NOT_FOUND", { message: `Sak ${caseId} ikke funnet` });
  return sendTemplatedEmail("case_reply", supportCase.customerEmail, "nb", {
    name: supportCase.customerName ?? undefined,
    caseReference: supportCase.reference,
    message,
  }, { bookingId: supportCase.bookingId ?? null });
}

/**
 * Driftsvarsel til teamet: e-post til OPS_ALERT_EMAIL (fallback MAIL_FROM) og,
 * hvis satt, POST til OPS_ALERT_WEBHOOK_URL (Slack-kompatibel `{ text }`).
 * Kaster aldri — et feilet varsel skal ikke velte flyten som utløste det.
 */
export async function sendOpsAlert(subject: string, body: string): Promise<MailResult> {
  const webhook = env.OPS_ALERT_WEBHOOK_URL;
  if (webhook) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*[HelloSky drift] ${subject}*\n${body}`.slice(0, 3000) }),
      signal: controller.signal,
    })
      .catch((err) => log.warn({ err: String(err) }, "[ops-alert] webhook feilet"))
      .finally(() => clearTimeout(timer));
  }
  const to = env.OPS_ALERT_EMAIL ?? env.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? null;
  if (!to) {
    log.warn({ subject }, "[ops-alert] ingen mottaker konfigurert");
    return { sent: false, reason: "not_configured" };
  }
  try {
    return await sendTemplatedEmail("ops_alert", to, "nb", { subject, body });
  } catch (err) {
    log.error({ err: String(err), subject }, "[ops-alert] e-post feilet");
    return { sent: false, reason: "failed" };
  }
}

export function sendVerifyEmail(input: { email: string; firstName: string; url: string; locale?: string }): Promise<MailResult> {
  return sendTemplatedEmail("verify_email", input.email, input.locale ?? "nb", { firstName: input.firstName, url: input.url });
}

export function sendLoginAlertEmail(input: { email: string; firstName: string; ip?: string; userAgent?: string; at?: string; locale?: string }): Promise<MailResult> {
  return sendTemplatedEmail("login_alert", input.email, input.locale ?? "nb", {
    firstName: input.firstName,
    ip: input.ip,
    userAgent: input.userAgent,
    at: input.at ?? new Date().toISOString(),
  });
}

export function sendPasswordResetEmail(input: { email: string; firstName: string; url: string; locale?: string }): Promise<MailResult> {
  return sendTemplatedEmail("password_reset", input.email, input.locale ?? "nb", { firstName: input.firstName, url: input.url });
}

export function sendPriceAlertEmail(input: { email: string; route: string; price: number; targetPrice: number; url: string; currency?: string; locale?: string }): Promise<MailResult> {
  return sendTemplatedEmail("price_alert", input.email, input.locale ?? "nb", {
    route: input.route,
    price: input.price,
    targetPrice: input.targetPrice,
    currency: input.currency,
    url: input.url,
  });
}

/** Varsel om forsinkelse/kansellering/ruteendring på kommende reise. */
export function sendDisruptionAlert(input: {
  email: string;
  firstName: string;
  bookingReference: string;
  flight: string;
  message: string;
  accessUrl?: string;
  bookingId?: number;
  locale?: string;
}): Promise<MailResult> {
  return sendTemplatedEmail(
    "schedule_change",
    input.email,
    input.locale ?? "nb",
    {
      firstName: input.firstName,
      bookingReference: input.bookingReference,
      flight: input.flight,
      note: input.message,
      accessUrl: input.accessUrl,
    },
    { bookingId: input.bookingId },
  );
}
