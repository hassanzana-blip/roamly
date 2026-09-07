import type { Order } from "../../../contracts/types";
import { env } from "../env";

// ─── E-postmaler (OTA-131/079/133/134/135) ───────────────────────────────────
// Alle maler bygges som strukturerte «blokker» og rendres sentralt til text +
// html. ALL interpolert tekst går gjennom esc() i HTML-rendringen — malene
// selv setter aldri sammen rå HTML fra brukerdata. nb og en er komplette;
// sv/da/de faller tilbake til en.

export type EmailLocale = "nb" | "en" | "sv" | "da" | "de";
export type RenderLocale = "nb" | "en";

export type EmailKind =
  | "booking_confirmation"
  | "payment_receipt"
  | "payment_failed"
  | "booking_failed_refunded"
  | "schedule_change"
  | "cancellation_confirmed"
  | "refund_requested"
  | "refund_approved"
  | "refund_rejected"
  | "refund_paid"
  | "support_ack"
  | "case_reply"
  | "verify_email"
  | "password_reset"
  | "login_alert"
  | "price_alert"
  | "quote_checkout"
  | "ops_alert"
  | "trip_reminder";

/** Maler som regnes som markedsføring og derfor må ha avmeldingslenke. */
export const MARKETING_KINDS: ReadonlySet<EmailKind> = new Set<EmailKind>(["price_alert"]);

export type ReceiptLine = { label: string; amount: string; currency: string };

export type EmailPayloads = {
  booking_confirmation: { order: Order; accessUrl?: string };
  payment_receipt: {
    firstName?: string;
    bookingReference: string;
    amount: string;
    currency: string;
    paidAt?: string;
    paymentMethod?: string;
    lines?: ReceiptLine[];
    invoiceNumber?: number | string;
    accessUrl?: string;
  };
  payment_failed: { firstName?: string; bookingReference?: string; route?: string; retryUrl?: string };
  booking_failed_refunded: { firstName?: string; route?: string; amount: string; currency: string; reference?: string };
  schedule_change: {
    firstName?: string;
    bookingReference: string;
    /** Berørt fly, f.eks. "SK 4055" (for forsinkelse/kansellering). */
    flight?: string;
    /** Fritekst fra oss/flyselskapet (forsinkelse, kansellering). */
    note?: string;
    oldSegments?: string[];
    newSegments?: string[];
    accessUrl?: string;
  };
  cancellation_confirmed: { firstName?: string; bookingReference: string; refundNote?: string };
  refund_requested: { firstName?: string; bookingReference: string; refundReference: string };
  refund_approved: { firstName?: string; bookingReference: string; refundReference: string; amount: string; currency: string };
  refund_rejected: { firstName?: string; bookingReference: string; refundReference: string; reason?: string };
  refund_paid: { firstName?: string; bookingReference: string; refundReference: string; amount: string; currency: string };
  support_ack: { name: string; caseReference: string };
  case_reply: { name?: string; caseReference: string; message: string };
  verify_email: { firstName: string; url: string };
  password_reset: { firstName: string; url: string };
  login_alert: { firstName: string; ip?: string; userAgent?: string; at?: string };
  price_alert: { route: string; price: number; targetPrice: number; currency?: string; url: string };
  quote_checkout: {
    customerName: string;
    reference: string;
    route: string;
    totalAmount: string;
    serviceFeeAmount: string;
    currency: string;
    url: string;
    expiresAt: string;
  };
  ops_alert: { subject: string; body: string };
  trip_reminder: { firstName?: string; bookingReference: string; route: string; departingAt: string; accessUrl?: string };
};

export type RenderedEmail = { subject: string; text: string; html: string };

// ─── Escaping ────────────────────────────────────────────────────────────────

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);
}

/** Kun http(s)-lenker slippes gjennom til href — alt annet blir «#». */
function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return esc(u.toString());
  } catch {
    /* ignore */
  }
  return "#";
}

// ─── Blokker ─────────────────────────────────────────────────────────────────

type Block =
  | { t: "p"; text: string }
  | { t: "muted"; text: string }
  | { t: "ref"; label: string; value: string }
  | { t: "button"; label: string; url: string }
  | { t: "kv"; rows: Array<[string, string]> }
  | { t: "list"; items: string[] }
  | { t: "quote"; text: string }
  | { t: "hr" };

type Template = { subject: string; heading: string; blocks: Block[] };

// ─── Hjelpere ───────────────────────────────────────────────────────────────

export function resolveLocale(locale: string | null | undefined): RenderLocale {
  return locale === "nb" ? "nb" : "en"; // sv/da/de → en (OTA-133)
}

const INTL: Record<RenderLocale, string> = { nb: "nb-NO", en: "en-GB" };

function fmtDate(iso: string, locale: RenderLocale, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(INTL[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat(INTL[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  }
}

function fmtTime(iso: string, locale: RenderLocale, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(INTL[locale], { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat(INTL[locale], { hour: "2-digit", minute: "2-digit" }).format(d);
  }
}

function fmtDateTime(iso: string, locale: RenderLocale, timeZone?: string): string {
  return `${fmtDate(iso, locale, timeZone)} ${fmtTime(iso, locale, timeZone)}`;
}

function money(amount: string | number, currency: string): string {
  return `${amount} ${currency}`;
}

const support = () => ({
  phone: process.env.SUPPORT_PHONE ?? "22 41 00 00",
  email: process.env.SUPPORT_EMAIL ?? "hei@hellosky.no",
  hours: process.env.SUPPORT_HOURS ?? "06–24",
});

const greeting = (locale: RenderLocale, name?: string) =>
  locale === "nb" ? (name ? `Hei ${name}!` : "Hei!") : name ? `Hi ${name}!` : "Hi!";

function sliceLines(order: Order, locale: RenderLocale): string[] {
  return order.slices.map((s, i) => {
    const label =
      locale === "nb"
        ? order.slices.length === 1 ? "Reise" : i === 0 ? "Utreise" : "Hjemreise"
        : order.slices.length === 1 ? "Flight" : i === 0 ? "Outbound" : "Return";
    const stops = s.stops === 0 ? (locale === "nb" ? "direkte" : "non-stop") : locale === "nb" ? `${s.stops} stopp` : `${s.stops} stop${s.stops > 1 ? "s" : ""}`;
    return `${label} ${fmtDate(s.departingAt, locale, s.origin.timeZone)}: ${s.origin.city} (${s.origin.iata}) ${fmtTime(s.departingAt, locale, s.origin.timeZone)} → ${s.destination.city} (${s.destination.iata}) ${fmtTime(s.arrivingAt, locale, s.destination.timeZone)}, ${stops}`;
  });
}

// ─── Maler ──────────────────────────────────────────────────────────────────

type Builder<K extends EmailKind> = (p: EmailPayloads[K], locale: RenderLocale) => Template;

const bookingConfirmation: Builder<"booking_confirmation"> = ({ order, accessUrl }, L) => {
  const pax = order.passengers.map((p) => `${p.givenName} ${p.familyName}`).join(", ");
  const blocks: Block[] = [
    { t: "p", text: greeting(L, order.passengers[0]?.givenName) },
    { t: "ref", label: L === "nb" ? "Bookingreferanse" : "Booking reference", value: order.bookingReference },
    { t: "list", items: sliceLines(order, L) },
    { t: "kv", rows: [[L === "nb" ? "Reisende" : "Passengers", pax]] },
  ];
  if (order.services?.extraBags) {
    blocks.push({ t: "kv", rows: [[L === "nb" ? "Tilvalg" : "Extras", L === "nb" ? `${order.services.extraBags} ekstra kolli` : `${order.services.extraBags} extra bag(s)`]] });
  }
  const tickets = order.tickets ?? [];
  if (tickets.length) {
    blocks.push({
      t: "list",
      items: tickets.map((t) => `${L === "nb" ? "Billettnummer" : "Ticket number"} ${t.uniqueIdentifier}${t.passengerName ? ` — ${t.passengerName}` : ""}`),
    });
  }
  blocks.push({ t: "kv", rows: [[L === "nb" ? "Betalt" : "Paid", money(order.totalAmount, order.totalCurrency)]] });
  if (accessUrl) blocks.push({ t: "button", label: L === "nb" ? "Se bestillingen" : "View booking", url: accessUrl });
  blocks.push({
    t: "muted",
    text:
      L === "nb"
        ? "Husk gyldig pass/ID. Sjekk inn hos flyselskapet med bookingreferansen over."
        : "Remember valid ID. Check in with the airline using the booking reference above.",
  });
  return {
    subject: L === "nb" ? `Reisen din er bekreftet — ${order.bookingReference}` : `Your trip is confirmed — ${order.bookingReference}`,
    heading: L === "nb" ? "Billetten din er bekreftet!" : "Your ticket is confirmed!",
    blocks,
  };
};

const paymentReceipt: Builder<"payment_receipt"> = (p, L) => {
  const rows: Array<[string, string]> = [];
  for (const line of p.lines ?? []) rows.push([line.label, money(line.amount, line.currency)]);
  rows.push([L === "nb" ? "Totalt betalt" : "Total paid", money(p.amount, p.currency)]);
  if (p.paymentMethod) rows.push([L === "nb" ? "Betalingsmåte" : "Payment method", p.paymentMethod]);
  if (p.paidAt) rows.push([L === "nb" ? "Betalt" : "Paid at", fmtDateTime(p.paidAt, L, "Europe/Oslo")]);
  if (p.invoiceNumber != null) rows.push([L === "nb" ? "Kvitteringsnummer" : "Receipt number", String(p.invoiceNumber)]);
  const blocks: Block[] = [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "ref", label: L === "nb" ? "Bookingreferanse" : "Booking reference", value: p.bookingReference },
    { t: "kv", rows },
  ];
  if (p.accessUrl) blocks.push({ t: "button", label: L === "nb" ? "Se kvittering" : "View receipt", url: p.accessUrl });
  blocks.push({ t: "muted", text: L === "nb" ? "Ta vare på denne kvitteringen. Prisen inkluderer HelloSkys servicegebyr." : "Keep this receipt for your records. The price includes HelloSky's service fee." });
  return {
    subject: L === "nb" ? `Kvittering — ${p.bookingReference}` : `Receipt — ${p.bookingReference}`,
    heading: L === "nb" ? "Kvittering for betalingen din" : "Your payment receipt",
    blocks,
  };
};

const paymentFailed: Builder<"payment_failed"> = (p, L) => {
  const blocks: Block[] = [
    { t: "p", text: greeting(L, p.firstName) },
    {
      t: "p",
      text:
        L === "nb"
          ? `Betalingen${p.route ? ` for ${p.route}` : ""} ble dessverre ikke gjennomført. Ingen billett er bestilt, og du er ikke belastet.`
          : `Unfortunately the payment${p.route ? ` for ${p.route}` : ""} did not go through. No ticket has been booked and you have not been charged.`,
    },
  ];
  if (p.retryUrl) blocks.push({ t: "button", label: L === "nb" ? "Prøv igjen" : "Try again", url: p.retryUrl });
  blocks.push({ t: "muted", text: L === "nb" ? "Prisen kan ha endret seg siden sist — du ser alltid oppdatert pris før du betaler." : "Prices may have changed — you will always see the current price before paying." });
  return {
    subject: L === "nb" ? "Betalingen gikk ikke gjennom" : "Your payment did not go through",
    heading: L === "nb" ? "Betalingen ble avvist" : "Payment declined",
    blocks,
  };
};

const bookingFailedRefunded: Builder<"booking_failed_refunded"> = (p, L) => ({
  subject: L === "nb" ? "Bestillingen kunne ikke fullføres — beløpet er refundert" : "We could not complete your booking — refund issued",
  heading: L === "nb" ? "Vi klarte dessverre ikke å fullføre bestillingen" : "We could not complete your booking",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    {
      t: "p",
      text:
        L === "nb"
          ? `Flyselskapet kunne ikke bekrefte reisen${p.route ? ` ${p.route}` : ""}. Beløpet på ${money(p.amount, p.currency)} er sendt tilbake til betalingsmåten din. Det tar normalt 3–10 virkedager før pengene vises.`
          : `The airline could not confirm the trip${p.route ? ` ${p.route}` : ""}. The amount of ${money(p.amount, p.currency)} has been returned to your payment method. It normally takes 3–10 business days to appear.`,
    },
    ...(p.reference ? [{ t: "ref", label: L === "nb" ? "Referanse" : "Reference", value: p.reference } as Block] : []),
    { t: "muted", text: L === "nb" ? "Ta gjerne kontakt, så hjelper vi deg med et alternativ." : "Get in touch and we will help you find an alternative." },
  ],
});

const scheduleChange: Builder<"schedule_change"> = (p, L) => {
  const blocks: Block[] = [
    { t: "p", text: greeting(L, p.firstName) },
    {
      t: "p",
      text: p.flight
        ? L === "nb" ? `Det er endringer på flyet ditt ${p.flight}.` : `There are changes to your flight ${p.flight}.`
        : L === "nb" ? "Flyselskapet har endret rutetidene på reisen din." : "The airline has changed the schedule for your trip.",
    },
    { t: "ref", label: L === "nb" ? "Bookingreferanse" : "Booking reference", value: p.bookingReference },
  ];
  if (p.note) blocks.push({ t: "quote", text: p.note });
  if (p.oldSegments?.length) {
    blocks.push({ t: "kv", rows: [[L === "nb" ? "Tidligere" : "Previously", ""]] }, { t: "list", items: p.oldSegments });
  }
  if (p.newSegments?.length) {
    blocks.push({ t: "kv", rows: [[L === "nb" ? "Nytt" : "New", ""]] }, { t: "list", items: p.newSegments });
  }
  if (p.accessUrl) blocks.push({ t: "button", label: L === "nb" ? "Se oppdatert reise" : "View updated trip", url: p.accessUrl });
  blocks.push({ t: "muted", text: L === "nb" ? "Passer ikke de nye tidene? Kontakt oss, så ser vi på ombestilling eller refusjon." : "If the new times do not work for you, contact us about rebooking or a refund." });
  return {
    subject: L === "nb" ? `Ruteendring på reisen din — ${p.bookingReference}` : `Schedule change on your trip — ${p.bookingReference}`,
    heading: L === "nb" ? "Viktig: rutetidene er endret" : "Important: your schedule has changed",
    blocks,
  };
};

const cancellationConfirmed: Builder<"cancellation_confirmed"> = (p, L) => ({
  subject: L === "nb" ? `Reisen er kansellert — ${p.bookingReference}` : `Your trip has been cancelled — ${p.bookingReference}`,
  heading: L === "nb" ? "Kanselleringen er bekreftet" : "Cancellation confirmed",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "ref", label: L === "nb" ? "Bookingreferanse" : "Booking reference", value: p.bookingReference },
    { t: "p", text: p.refundNote ?? (L === "nb" ? "Eventuell refusjon behandles separat, og du får egen e-post når den er klar." : "Any refund is handled separately; you will receive a separate e-mail when it is ready.") },
  ],
});

const refundRequested: Builder<"refund_requested"> = (p, L) => ({
  subject: L === "nb" ? `Refusjonsforespørsel mottatt — ${p.refundReference}` : `Refund request received — ${p.refundReference}`,
  heading: L === "nb" ? "Vi har mottatt refusjonsforespørselen" : "We have received your refund request",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "kv", rows: [[L === "nb" ? "Bookingreferanse" : "Booking reference", p.bookingReference], [L === "nb" ? "Refusjonsreferanse" : "Refund reference", p.refundReference]] },
    { t: "p", text: L === "nb" ? "Vi sjekker vilkårene hos flyselskapet og gir deg beskjed så snart vi vet beløpet. Dette tar vanligvis 1–5 virkedager." : "We are checking the fare rules with the airline and will let you know the amount as soon as we can, usually within 1–5 business days." },
  ],
});

const refundApproved: Builder<"refund_approved"> = (p, L) => ({
  subject: L === "nb" ? `Refusjon godkjent — ${p.refundReference}` : `Refund approved — ${p.refundReference}`,
  heading: L === "nb" ? "Refusjonen er godkjent" : "Your refund has been approved",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "kv", rows: [[L === "nb" ? "Bookingreferanse" : "Booking reference", p.bookingReference], [L === "nb" ? "Refusjonsreferanse" : "Refund reference", p.refundReference], [L === "nb" ? "Beløp" : "Amount", money(p.amount, p.currency)]] },
    { t: "p", text: L === "nb" ? "Beløpet sendes til betalingsmåten du brukte. Du får en ny e-post når pengene er på vei." : "The amount will be sent to the payment method you used. You will get another e-mail once the money is on its way." },
  ],
});

const refundRejected: Builder<"refund_rejected"> = (p, L) => ({
  subject: L === "nb" ? `Refusjon avslått — ${p.refundReference}` : `Refund declined — ${p.refundReference}`,
  heading: L === "nb" ? "Refusjonen kunne ikke innvilges" : "We could not approve the refund",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "kv", rows: [[L === "nb" ? "Bookingreferanse" : "Booking reference", p.bookingReference], [L === "nb" ? "Refusjonsreferanse" : "Refund reference", p.refundReference]] },
    { t: "p", text: p.reason ?? (L === "nb" ? "Billetten er ikke refunderbar i henhold til flyselskapets vilkår." : "The ticket is non-refundable under the airline's fare rules.") },
    { t: "muted", text: L === "nb" ? "Har du reiseforsikring, kan du ofte søke dekning der. Ta kontakt hvis du har spørsmål." : "If you have travel insurance, you may be able to claim there. Contact us if you have questions." },
  ],
});

const refundPaid: Builder<"refund_paid"> = (p, L) => ({
  subject: L === "nb" ? `Refusjon utbetalt — ${p.refundReference}` : `Refund paid — ${p.refundReference}`,
  heading: L === "nb" ? "Pengene er på vei" : "Your refund is on its way",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "kv", rows: [[L === "nb" ? "Bookingreferanse" : "Booking reference", p.bookingReference], [L === "nb" ? "Refusjonsreferanse" : "Refund reference", p.refundReference], [L === "nb" ? "Beløp" : "Amount", money(p.amount, p.currency)]] },
    { t: "p", text: L === "nb" ? "Det tar normalt 3–10 virkedager før beløpet vises hos banken din." : "It normally takes 3–10 business days for the amount to appear with your bank." },
  ],
});

const supportAck: Builder<"support_ack"> = (p, L) => ({
  subject: L === "nb" ? `Vi har mottatt henvendelsen din — ${p.caseReference}` : `We have received your request — ${p.caseReference}`,
  heading: L === "nb" ? "Takk for henvendelsen" : "Thanks for contacting us",
  blocks: [
    { t: "p", text: greeting(L, p.name) },
    { t: "ref", label: L === "nb" ? "Saksreferanse" : "Case reference", value: p.caseReference },
    { t: "p", text: L === "nb" ? `Saken din er registrert. Vi svarer så raskt vi kan — som regel innen 2 timer i åpningstiden (alle dager ${support().hours}).` : `Your case has been registered. We reply as quickly as we can — usually within 2 hours during opening hours (every day ${support().hours}).` },
  ],
});

const caseReply: Builder<"case_reply"> = (p, L) => ({
  subject: L === "nb" ? `Svar på din henvendelse — ${p.caseReference}` : `Reply to your request — ${p.caseReference}`,
  heading: L === "nb" ? "Svar fra kundeservice" : "Reply from customer service",
  blocks: [
    { t: "p", text: greeting(L, p.name) },
    { t: "quote", text: p.message },
    { t: "ref", label: L === "nb" ? "Saksreferanse" : "Case reference", value: p.caseReference },
    { t: "muted", text: L === "nb" ? "Svar på denne e-posten hvis du har flere spørsmål." : "Reply to this e-mail if you have further questions." },
  ],
});

const verifyEmail: Builder<"verify_email"> = (p, L) => ({
  subject: L === "nb" ? "Bekreft e-postadressen din" : "Confirm your e-mail address",
  heading: L === "nb" ? "Velkommen til HelloSky!" : "Welcome to HelloSky!",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "p", text: L === "nb" ? "Bekreft e-postadressen din for å se reisene dine og få kvitteringer på e-post." : "Confirm your e-mail address to see your trips and receive receipts by e-mail." },
    { t: "button", label: L === "nb" ? "Bekreft e-post" : "Confirm e-mail", url: p.url },
    { t: "muted", text: L === "nb" ? "Lenken er gyldig i 72 timer. Har du ikke opprettet konto hos oss, kan du ignorere denne e-posten." : "The link is valid for 72 hours. If you did not create an account, you can ignore this e-mail." },
  ],
});

const passwordReset: Builder<"password_reset"> = (p, L) => ({
  subject: L === "nb" ? "Tilbakestill passordet ditt" : "Reset your password",
  heading: L === "nb" ? "Nytt passord" : "Reset your password",
  blocks: [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "p", text: L === "nb" ? "Vi har mottatt en forespørsel om å tilbakestille passordet ditt hos HelloSky." : "We received a request to reset your HelloSky password." },
    { t: "button", label: L === "nb" ? "Velg nytt passord" : "Choose a new password", url: p.url },
    { t: "muted", text: L === "nb" ? "Lenken er gyldig i 1 time. Hvis det ikke var deg, kan du ignorere denne e-posten — passordet er uendret." : "The link is valid for 1 hour. If this was not you, ignore this e-mail — your password is unchanged." },
  ],
});

const loginAlert: Builder<"login_alert"> = (p, L) => {
  const rows: Array<[string, string]> = [];
  if (p.at) rows.push([L === "nb" ? "Tidspunkt" : "Time", fmtDateTime(p.at, L, "Europe/Oslo")]);
  if (p.ip) rows.push(["IP", p.ip]);
  if (p.userAgent) rows.push([L === "nb" ? "Enhet" : "Device", p.userAgent.slice(0, 120)]);
  return {
    subject: L === "nb" ? "Ny innlogging på kontoen din" : "New sign-in to your account",
    heading: L === "nb" ? "Ny innlogging fra en ukjent enhet" : "New sign-in from an unrecognised device",
    blocks: [
      { t: "p", text: greeting(L, p.firstName) },
      { t: "p", text: L === "nb" ? "Noen logget nettopp inn på HelloSky-kontoen din fra en enhet eller et sted vi ikke har sett før." : "Someone just signed in to your HelloSky account from a device or location we have not seen before." },
      ...(rows.length ? [{ t: "kv", rows } as Block] : []),
      { t: "p", text: L === "nb" ? `Var det deg? Da trenger du ikke gjøre noe. Hvis ikke: bytt passord med en gang og kontakt oss på ${support().email}.` : `If this was you, no action is needed. If not: change your password right away and contact us at ${support().email}.` },
    ],
  };
};

const priceAlert: Builder<"price_alert"> = (p, L) => {
  const cur = p.currency ?? "NOK";
  return {
    subject: L === "nb" ? `Prisvarsel: ${p.route} nå ${p.price} ${cur}` : `Price alert: ${p.route} now ${p.price} ${cur}`,
    heading: L === "nb" ? "Prisen har gått ned!" : "The price has dropped!",
    blocks: [
      { t: "p", text: L === "nb" ? `${p.route} koster nå ${p.price} ${cur} — under målet ditt på ${p.targetPrice} ${cur}.` : `${p.route} is now ${p.price} ${cur} — below your target of ${p.targetPrice} ${cur}.` },
      { t: "button", label: L === "nb" ? "Se tilbudet" : "See the offer", url: p.url },
      { t: "muted", text: L === "nb" ? "Prisen er veiledende og kan endre seg før du bestiller." : "The price is indicative and may change before you book." },
    ],
  };
};

const quoteCheckout: Builder<"quote_checkout"> = (p, L) => ({
  subject: L === "nb" ? `Ditt reisetilbud ${p.reference} — ${p.route}` : `Your travel quote ${p.reference} — ${p.route}`,
  heading: L === "nb" ? "Vi har laget et tilbud til deg" : "We have prepared a quote for you",
  blocks: [
    { t: "p", text: greeting(L, p.customerName) },
    { t: "kv", rows: [[L === "nb" ? "Reise" : "Trip", p.route], [L === "nb" ? "Totalt" : "Total", money(p.totalAmount, p.currency)], [L === "nb" ? "Herav servicegebyr" : "Of which service fee", money(p.serviceFeeAmount, p.currency)]] },
    { t: "button", label: L === "nb" ? "Se tilbudet og bestill" : "View quote and book", url: p.url },
    { t: "muted", text: L === "nb" ? `Tilbudet er gyldig til ${fmtDateTime(p.expiresAt, L, "Europe/Oslo")}. Prisen bekreftes på nytt hos flyselskapet før betaling.` : `The quote is valid until ${fmtDateTime(p.expiresAt, L, "Europe/Oslo")}. The price is re-confirmed with the airline before payment.` },
  ],
});

const opsAlert: Builder<"ops_alert"> = (p) => ({
  subject: `[HelloSky drift] ${p.subject}`,
  heading: p.subject,
  blocks: [{ t: "quote", text: p.body }],
});

const tripReminder: Builder<"trip_reminder"> = (p, L) => {
  const blocks: Block[] = [
    { t: "p", text: greeting(L, p.firstName) },
    { t: "p", text: L === "nb" ? `Snart reiser du: ${p.route}, avreise ${fmtDateTime(p.departingAt, L, "Europe/Oslo")}.` : `Your trip is coming up: ${p.route}, departing ${fmtDateTime(p.departingAt, L, "Europe/Oslo")}.` },
    { t: "ref", label: L === "nb" ? "Bookingreferanse" : "Booking reference", value: p.bookingReference },
    { t: "list", items: L === "nb" ? ["Sjekk inn hos flyselskapet (vanligvis 24 timer før)", "Ha pass/ID klart", "Sjekk bagasjeregler og møt opp i god tid"] : ["Check in with the airline (usually 24 hours before)", "Have your passport/ID ready", "Check baggage rules and arrive in good time"] },
  ];
  if (p.accessUrl) blocks.push({ t: "button", label: L === "nb" ? "Se reisen" : "View trip", url: p.accessUrl });
  return {
    subject: L === "nb" ? `Snart avreise — ${p.bookingReference}` : `Your trip is coming up — ${p.bookingReference}`,
    heading: L === "nb" ? "God tur!" : "Have a great trip!",
    blocks,
  };
};

const BUILDERS: { [K in EmailKind]: Builder<K> } = {
  booking_confirmation: bookingConfirmation,
  payment_receipt: paymentReceipt,
  payment_failed: paymentFailed,
  booking_failed_refunded: bookingFailedRefunded,
  schedule_change: scheduleChange,
  cancellation_confirmed: cancellationConfirmed,
  refund_requested: refundRequested,
  refund_approved: refundApproved,
  refund_rejected: refundRejected,
  refund_paid: refundPaid,
  support_ack: supportAck,
  case_reply: caseReply,
  verify_email: verifyEmail,
  password_reset: passwordReset,
  login_alert: loginAlert,
  price_alert: priceAlert,
  quote_checkout: quoteCheckout,
  ops_alert: opsAlert,
  trip_reminder: tripReminder,
};

// ─── Rendring ───────────────────────────────────────────────────────────────

function blockToText(b: Block): string {
  switch (b.t) {
    case "p":
    case "muted":
      return b.text;
    case "quote":
      return b.text.split("\n").map((l) => `> ${l}`).join("\n");
    case "ref":
      return `${b.label}: ${b.value}`;
    case "button":
      return `${b.label}:\n${b.url}`;
    case "kv":
      return b.rows.map(([k, v]) => (v ? `${k}: ${v}` : k)).join("\n");
    case "list":
      return b.items.map((i) => `• ${i}`).join("\n");
    case "hr":
      return "—";
  }
}

const P = 'style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f1f3d"';

function blockToHtml(b: Block): string {
  switch (b.t) {
    case "p":
      return `<p ${P}>${esc(b.text)}</p>`;
    case "muted":
      return `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#4a5878">${esc(b.text)}</p>`;
    case "quote":
      return `<blockquote style="margin:0 0 14px;padding:12px 16px;border-left:4px solid #dbe2f0;background:#f6f8fc;font-size:15px;line-height:1.5;color:#0f1f3d;white-space:pre-wrap">${esc(b.text)}</blockquote>`;
    case "ref":
      return `<p ${P}>${esc(b.label)}: <strong style="font-size:20px;letter-spacing:2px">${esc(b.value)}</strong></p>`;
    case "button":
      return `<p style="margin:6px 0 20px"><a href="${safeUrl(b.url)}" style="display:inline-block;background:#102640;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${esc(b.label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#4a5878;word-break:break-all">${esc(b.url)}</p>`;
    case "kv":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f1f3d">${b.rows
        .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#4a5878;vertical-align:top">${esc(k)}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`)
        .join("")}</table>`;
    case "list":
      return `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.6;color:#0f1f3d">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "hr":
      return `<hr style="border:0;border-top:1px solid #dbe2f0;margin:18px 0"/>`;
  }
}

function footerLines(kind: EmailKind, L: RenderLocale): string[] {
  const s = support();
  const lines =
    L === "nb"
      ? [`Trenger du hjelp? Ring ${s.phone} (alle dager ${s.hours}) eller skriv til ${s.email}.`, "HelloSky"]
      : [`Need help? Call ${s.phone} (every day ${s.hours}) or write to ${s.email}.`, "HelloSky"];
  if (MARKETING_KINDS.has(kind)) {
    lines.push(
      L === "nb"
        ? `Vil du ikke ha flere prisvarsler? Administrer varslene dine: ${env.baseUrl}/profil/prisvarsler`
        : `Don't want more price alerts? Manage your alerts: ${env.baseUrl}/profil/prisvarsler`,
    );
  }
  return lines;
}

export function renderEmail<K extends EmailKind>(kind: K, locale: EmailLocale | string | null | undefined, payload: EmailPayloads[K]): RenderedEmail {
  const L = resolveLocale(locale);
  const tpl = (BUILDERS[kind] as Builder<K>)(payload, L);
  const footer = footerLines(kind, L);

  const text = [
    tpl.heading,
    "",
    ...tpl.blocks.map(blockToText).flatMap((t) => [t, ""]),
    ...footer,
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const html = `<!doctype html><html lang="${L}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${esc(tpl.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f2f5fa;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto">
  <div style="background:#102640;padding:22px 28px;border-radius:16px 16px 0 0">
    <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px">HelloSky</span>
  </div>
  <div style="background:#ffffff;border:1px solid #dbe2f0;border-top:0;padding:28px;border-radius:0 0 16px 16px">
    <h1 style="font-size:22px;font-weight:800;color:#102640;margin:0 0 16px">${esc(tpl.heading)}</h1>
    ${tpl.blocks.map(blockToHtml).join("\n    ")}
  </div>
  <div style="padding:18px 8px;font-size:12px;line-height:1.6;color:#4a5878;text-align:center">
    ${footer.map((l) => `<p style="margin:0 0 4px">${esc(l)}</p>`).join("\n    ")}
  </div>
</div>
</body></html>`;

  return { subject: kind === "ops_alert" ? tpl.subject : `${tpl.subject} | HelloSky`, text, html };
}
