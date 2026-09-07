import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { CABIN_LABELS } from "@/lib/format";
import type { InvoiceSummary, Order } from "@contracts/types";

export type OrderGetResult = RouterOutputs["orders"]["get"];

// ─── Kvittering (OTA-172) ───────────────────────────────────────────────────

/** `orders.get().invoice` + `payment.pspReference` (kun de siste 8 tegnene fra serveren). */
export function invoiceOf(data: OrderGetResult | undefined): { invoice: InvoiceSummary | null; pspReference: string | null } {
  const inv = data?.invoice ?? null;
  const psp = data?.payment?.pspReference ?? null;
  return { invoice: inv && Array.isArray(inv.lines) ? inv : null, pspReference: psp || null };
}

// ─── Tilgangstoken ──────────────────────────────────────────────────────────

/** Token fra `?t=` (bekreftelseslenke) eller sessionStorage (etter oppslag) — lagres per ordre. */
export function useAccessToken(orderId: string): string | undefined {
  const [params] = useSearchParams();
  const fromUrl = params.get("t");
  return useMemo(() => {
    if (fromUrl) {
      try {
        sessionStorage.setItem(`hellosky:access:${orderId}`, fromUrl);
      } catch {
        /* ignore */
      }
      return fromUrl;
    }
    try {
      return sessionStorage.getItem(`hellosky:access:${orderId}`) ?? undefined;
    } catch {
      return undefined;
    }
  }, [fromUrl, orderId]);
}

export function useOrder(orderId: string, opts?: { refetchWhileProcessing?: boolean }) {
  const accessToken = useAccessToken(orderId);
  const q = trpc.orders.get.useQuery(
    { orderId, accessToken },
    {
      enabled: Boolean(orderId),
      retry: 1,
      refetchInterval: (query) => {
        if (!opts?.refetchWhileProcessing) return false;
        const s = query.state.data?.state;
        return s && ["PAYMENT_AUTHORIZED", "BOOKING_PROCESSING", "AWAITING_RECONCILIATION", "CANCELLATION_REQUESTED"].includes(s) ? 5000 : false;
      },
    },
  );
  return { ...q, accessToken };
}

// ─── Kalender (.ics) ────────────────────────────────────────────────────────

function icsDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(order: Order): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HelloSky//Reise//NB", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const s of order.slices) {
    for (const seg of s.segments) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${order.bookingReference}-${seg.id}@hellosky.no`,
        `DTSTAMP:${icsDate(new Date().toISOString())}`,
        `DTSTART:${icsDate(seg.departingAt)}`,
        `DTEND:${icsDate(seg.arrivingAt)}`,
        `SUMMARY:${icsEscape(`Fly ${seg.carrier.iata} ${seg.flightNumber} ${seg.origin.iata} → ${seg.destination.iata}`)}`,
        `LOCATION:${icsEscape(`${seg.origin.name} (${seg.origin.iata})`)}`,
        `DESCRIPTION:${icsEscape(`Bookingreferanse ${order.bookingReference}. ${seg.carrier.name}. ${CABIN_LABELS[seg.cabinClass] ?? ""}`)}`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function icsDataUrl(order: Order): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(order))}`;
}
