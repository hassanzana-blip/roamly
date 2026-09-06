import "dotenv/config";
import nodemailer from "nodemailer";
import type { Order } from "../../contracts/types";

// ─── Transactional email ────────────────────────────────────────────────────
// Configure with one of:
//   SMTP_URL=smtp://user:pass@host:587
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
//   MAIL_FROM (default: "Roamly <hei@roamly.no>")
// Without SMTP config the mailer logs instead of sending — bookings still work.

export type MailResult = { sent: boolean; reason?: string };

function buildTransport() {
  if (process.env.SMTP_URL) return nodemailer.createTransport(process.env.SMTP_URL);
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return null;
}

const from = () => process.env.MAIL_FROM ?? "Roamly <hei@roamly.no>";

function sliceLine(s: Order["slices"][number], label: string): string {
  const dep = new Date(s.departingAt);
  const date = dep.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  const stops = s.stops === 0 ? "direkte" : `${s.stops} stopp`;
  return `${label} ${date}: ${s.origin.city} (${s.origin.iata}) ${time(s.departingAt)} → ${s.destination.city} (${s.destination.iata}) ${time(s.arrivingAt)}, ${stops}`;
}

export async function sendBookingConfirmation(order: Order): Promise<MailResult> {
  const transport = buildTransport();
  const lines = order.slices.map((s, i) => sliceLine(s, i === 0 ? "Utreise" : "Hjemreise"));
  const pax = order.passengers.map((p) => `${p.givenName} ${p.familyName}`).join(", ");
  const services: string[] = [];
  if (order.services?.extraBags) services.push(`${order.services.extraBags} ekstra kolli`);
  const seatList = Object.entries(order.services?.seats ?? {});
  if (seatList.length) services.push(`seter: ${seatList.map(([, v]) => v).join(", ")}`);

  const text = [
    `Hei ${order.passengers[0]?.givenName ?? ""}!`,
    ``,
    `Billetten din er bekreftet. Bookingreferanse: ${order.bookingReference}`,
    ``,
    ...lines,
    ``,
    `Reisende: ${pax}`,
    services.length ? `Tilvalg: ${services.join(" · ")}` : "",
    `Betalt: ${order.totalAmount} ${order.totalCurrency}`,
    ``,
    `Trenger du hjelp? Svar på denne e-posten eller ring 22 41 00 00 (alle dager 06–24).`,
    ``,
    `God reise!`,
    `Roamly`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f1f3d">
    <div style="background:#102640;padding:24px 28px;border-radius:16px 16px 0 0">
      <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px">Roamly</span>
    </div>
    <div style="border:1px solid #dbe2f0;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:24px;font-weight:800;color:#102640;margin:0 0 6px">Billetten din er bekreftet!</h1>
      <p style="margin:0 0 18px;color:#4a5878">Bookingreferanse:
        <strong style="font-size:20px;letter-spacing:2px;color:#0f1f3d">${order.bookingReference}</strong></p>
      ${lines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join("")}
      <p style="margin:16px 0 4px"><strong>Reisende:</strong> ${pax}</p>
      ${services.length ? `<p style="margin:0 0 4px"><strong>Tilvalg:</strong> ${services.join(" · ")}</p>` : ""}
      <p style="margin:0 0 20px"><strong>Betalt:</strong> ${order.totalAmount} ${order.totalCurrency}</p>
      <p style="color:#4a5878;font-size:14px">Trenger du hjelp? Svar på denne e-posten eller ring
        <strong>22 41 00 00</strong> (alle dager 06–24).</p>
      <p style="margin-bottom:0">God reise!<br/>Roamly</p>
    </div>
  </div>`;

  if (!transport) {
    console.log(`[mailer] SMTP ikke konfigurert — bekreftelse til ${order.contactEmail} logges i stedet:\n${text}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    await transport.sendMail({
      from: from(),
      to: order.contactEmail,
      subject: `Reisen din er bekreftet — ${order.bookingReference} | Roamly`,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Sending feilet:", err);
    return { sent: false, reason: "failed" };
  }
}

export async function sendSupportAck(input: {
  email: string;
  name: string;
  caseReference: string;
}): Promise<MailResult> {
  const transport = buildTransport();
  if (!transport) return { sent: false, reason: "not_configured" };
  try {
    await transport.sendMail({
      from: from(),
      to: input.email,
      subject: `Vi har mottatt henvendelsen din — ${input.caseReference} | Roamly`,
      text: `Hei ${input.name}!\n\nTakk for at du kontaktet oss. Saken din er registrert med referanse ${input.caseReference}. Vi svarer så raskt vi kan — som regel innen 2 timer i åpningstiden (alle dager 06–24).\n\nVennlig hilsen\nRoamly kundeservice`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Sending feilet:", err);
    return { sent: false, reason: "failed" };
  }
}

const baseUrl = () => (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Tilbuds-lenke til kunde (assisted booking). */
export async function sendQuoteCheckout(quoteId: number, token: string): Promise<MailResult> {
  const { getDb } = await import("../queries/connection");
  const { quotes } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");
  const [quote] = await getDb().select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) throw new Error(`Tilbud ${quoteId} ikke funnet`);
  const offer = JSON.parse(quote.offerSnapshot);
  const slice = offer.slices?.[0];
  const route = slice ? `${slice.origin.city} → ${slice.destination.city}` : "";
  const url = `${baseUrl()}/tilbud/${token}`;
  const expires = quote.expiresAt.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });

  const text = [
    `Hei ${quote.customerName}!`,
    ``,
    `Vi har laget et tilbud til deg: ${route}`,
    `Totalt ${quote.totalAmount} ${quote.currency} (inkluderer vår serviceavgift på ${quote.serviceFeeAmount} ${quote.currency}).`,
    ``,
    `Se tilbudet og fullfør bestillingen her:`,
    url,
    ``,
    `Tilbudet er gyldig til ${expires}.`,
    ``,
    `Vennlig hilsen`,
    `Roamly`,
  ].join("\n");

  const transport = buildTransport();
  if (!transport) {
    console.log(`[mailer] SMTP ikke konfigurert — tilbuds-lenke til ${quote.customerEmail}: ${url}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    await transport.sendMail({
      from: from(),
      to: quote.customerEmail,
      subject: `Ditt reisetilbud ${quote.reference} — ${route} | Roamly`,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Sending feilet:", err);
    return { sent: false, reason: "failed" };
  }
}

/** Svar på kundesak. */
export async function sendCaseReply(caseId: number, message: string): Promise<MailResult> {
  const { getDb } = await import("../queries/connection");
  const { supportCases } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");
  const [supportCase] = await getDb().select().from(supportCases).where(eq(supportCases.id, caseId)).limit(1);
  if (!supportCase) throw new Error(`Sak ${caseId} ikke funnet`);

  const transport = buildTransport();
  if (!transport) {
    console.log(`[mailer] SMTP ikke konfigurert — sakssvar til ${supportCase.customerEmail} (${supportCase.reference})`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    await transport.sendMail({
      from: from(),
      to: supportCase.customerEmail,
      subject: `Svar på din henvendelse — ${supportCase.reference} | Roamly`,
      text: `Hei ${supportCase.customerName ?? ""}!\n\n${message}\n\nSaksreferanse: ${supportCase.reference}\n\nVennlig hilsen\nRoamly kundeservice`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Sending feilet:", err);
    return { sent: false, reason: "failed" };
  }
}

/** Driftsvarsel til teamet (OPS_ALERT_EMAIL eller fallback til MAIL_FROM). */
export async function sendOpsAlert(subject: string, body: string): Promise<MailResult> {
  const to = process.env.OPS_ALERT_EMAIL ?? process.env.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? null;
  const transport = buildTransport();
  if (!transport || !to) {
    console.warn(`[ops-alert] ${subject}\n${body}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    await transport.sendMail({ from: from(), to, subject: `[Roamly drift] ${subject}`, text: body });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Driftsvarsel feilet:", err);
    return { sent: false, reason: "failed" };
  }
}
