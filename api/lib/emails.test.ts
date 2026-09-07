import { describe, expect, it } from "vitest";
import { esc, renderEmail, resolveLocale, type EmailKind } from "./emails/templates";
import type { Order } from "../../contracts/types";

const order: Order = {
  id: "ord_1",
  bookingReference: "ABC123",
  liveMode: false,
  demoMode: true,
  createdAt: "2026-09-01T10:00:00Z",
  totalAmount: "1234.50",
  totalCurrency: "NOK",
  cabinClass: "economy",
  slices: [
    {
      id: "sli_1",
      origin: { iata: "OSL", name: "Gardermoen", city: "Oslo", country: "NO", lat: 0, lng: 0, timeZone: "Europe/Oslo" },
      destination: { iata: "CPH", name: "Kastrup", city: "København", country: "DK", lat: 0, lng: 0, timeZone: "Europe/Copenhagen" },
      departingAt: "2026-12-01T08:00:00+01:00",
      arrivingAt: "2026-12-01T09:10:00+01:00",
      durationMinutes: 70,
      stops: 0,
      segments: [],
    },
  ],
  passengers: [
    { id: "pas_1", type: "adult", givenName: "<b>Ola</b>", familyName: "Nordmann & Co", bornOn: "1990-01-01" },
  ],
  contactEmail: "ola@example.com",
  contactPhone: "+4791234567",
  paymentStatus: "succeeded",
  tickets: [{ passengerId: "pas_1", passengerName: "Ola Nordmann", type: "electronic_ticket", uniqueIdentifier: "117-1234567890" }],
};

describe("esc", () => {
  it("escaper alle HTML-spesialtegn", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(esc(null)).toBe("");
    expect(esc(42)).toBe("42");
  });
});

describe("resolveLocale", () => {
  it("nb er nb, alt annet faller tilbake til en", () => {
    expect(resolveLocale("nb")).toBe("nb");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("sv")).toBe("en");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});

describe("renderEmail", () => {
  it("escaper brukerdata i HTML men ikke i tekst", () => {
    const { html, text, subject } = renderEmail("booking_confirmation", "nb", { order, accessUrl: "https://hellosky.no/b/x?t=1&u=2" });
    expect(html).not.toContain("<b>Ola</b>");
    expect(html).toContain("&lt;b&gt;Ola&lt;/b&gt;");
    expect(html).toContain("Nordmann &amp; Co");
    expect(text).toContain("<b>Ola</b>");
    expect(subject).toContain("ABC123");
    expect(html).toContain("117-1234567890");
    expect(html).toContain('href="https://hellosky.no/b/x?t=1&amp;u=2"');
  });

  it("nekter javascript:-lenker i knapper", () => {
    const { html } = renderEmail("verify_email", "nb", { firstName: "Ola", url: "javascript:alert(1)" });
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="#"');
  });

  it("legger på avmeldingslenke kun for markedsførings-e-post", () => {
    const alert = renderEmail("price_alert", "nb", { route: "OSL → CPH", price: 500, targetPrice: 600, url: "https://hellosky.no/sok" });
    expect(alert.text).toContain("/profil/prisvarsler");
    const receipt = renderEmail("payment_receipt", "nb", { bookingReference: "ABC123", amount: "100.00", currency: "NOK" });
    expect(receipt.text).not.toContain("/profil/prisvarsler");
  });

  it("alle maltyper rendrer på nb og en uten å kaste", () => {
    const base = { firstName: "Ola", bookingReference: "ABC123", refundReference: "RF-1", amount: "100.00", currency: "NOK" };
    const payloads: Record<EmailKind, unknown> = {
      booking_confirmation: { order },
      payment_receipt: { ...base, lines: [{ label: "Billett", amount: "90.00", currency: "NOK" }], paidAt: "2026-09-01T10:00:00Z" },
      payment_failed: { ...base, route: "OSL → CPH", retryUrl: "https://hellosky.no/x" },
      booking_failed_refunded: { ...base, route: "OSL → CPH" },
      schedule_change: { ...base, flight: "SK 1460", note: "Forsinket 40 min", oldSegments: ["a"], newSegments: ["b"] },
      cancellation_confirmed: base,
      refund_requested: base,
      refund_approved: base,
      refund_rejected: { ...base, reason: "Ikke refunderbar" },
      refund_paid: base,
      support_ack: { name: "Ola", caseReference: "HS-1" },
      case_reply: { name: "Ola", caseReference: "HS-1", message: "Hei <b>der</b>\nlinje 2" },
      verify_email: { firstName: "Ola", url: "https://hellosky.no/v" },
      password_reset: { firstName: "Ola", url: "https://hellosky.no/r" },
      login_alert: { firstName: "Ola", ip: "1.2.3.4", userAgent: "UA", at: "2026-09-01T10:00:00Z" },
      price_alert: { route: "OSL → CPH", price: 500, targetPrice: 600, url: "https://hellosky.no/s" },
      quote_checkout: { customerName: "Ola", reference: "Q-1", route: "OSL → CPH", totalAmount: "100.00", serviceFeeAmount: "10.00", currency: "NOK", url: "https://hellosky.no/q", expiresAt: "2026-09-02T10:00:00Z" },
      ops_alert: { subject: "Test", body: "<script>" },
      trip_reminder: { ...base, route: "OSL → CPH", departingAt: "2026-12-01T08:00:00Z" },
    };
    for (const kind of Object.keys(payloads) as EmailKind[]) {
      for (const locale of ["nb", "en", "sv"] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out = renderEmail(kind, locale, payloads[kind] as any);
        expect(out.subject.length).toBeGreaterThan(3);
        expect(out.text.length).toBeGreaterThan(10);
        expect(out.html).toContain("HelloSky");
        expect(out.html).not.toContain("<script>");
      }
    }
  });
});
