import { useParams } from "react-router";
import { Printer } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { Btn, ErrorState, LoadingRows } from "./ui";
import { formatDate, formatDateTime, formatMoney } from "./helpers";

const PAY_LABEL: Record<string, string> = {
  vipps: "Vipps",
  card: "Kort",
  invoice: "Faktura",
  cash: "Kontant",
};

const TRIP_LABEL: Record<string, string> = {
  flight: "Flyreise",
  hotel: "Hotellopphold",
  car: "Leiebil",
  package: "Pakkereise",
};

/** Utskriftsvennlig kvittering for manuelle bestillinger. */
export function AdminReceipt() {
  const { id } = useParams();
  const receipt = trpc.admin.manualReceipt.useQuery(
    { bookingId: Number(id) },
    { enabled: Boolean(id), retry: false },
  );

  if (receipt.isLoading) return <LoadingRows rows={3} />;
  if (receipt.isError || !receipt.data) return <ErrorState message={receipt.error?.message} />;

  const r = receipt.data;
  const p = r.payload as Record<string, string | null> & {
    title: string; customerName: string; tripType: string; paymentMethod: string;
    supplierAmount: string; serviceFeeAmount: string; totalAmount: string; currency: string;
    sellerName: string; description?: string | null; travelDate?: string | null;
  };
  const currency = p.currency ?? "NOK";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Forhåndsvisning — klar for utskrift eller lagring som PDF.</p>
        <Btn onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Skriv ut
        </Btn>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-[#f7f4ec] shadow-xl print:rounded-none print:border-0 print:shadow-none">
        {/* Topp */}
        <div className="flex items-center justify-between bg-night px-8 py-6 text-white">
          <div className="flex items-center gap-3">
            <SkyMark className="h-9 w-9 text-[#5b8cff]" />
            <div>
              <p className="font-display text-2xl font-bold leading-none">hellosky</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Kvittering</p>
            </div>
          </div>
          <div className="text-right text-xs text-white/70">
            <p className="font-mono text-sm font-bold text-white">{r.reference}</p>
            <p>{formatDateTime(r.createdAt)}</p>
          </div>
        </div>

        <div className="px-8 py-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-night/50">Kunde</p>
              <p className="mt-1 font-semibold text-night">{p.customerName}</p>
              <p className="text-sm text-night/70">{p.contactEmail}</p>
              {p.contactPhone && <p className="text-sm text-night/70">{p.contactPhone}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-night/50">Selger</p>
              <p className="mt-1 font-semibold text-night">{p.sellerName}</p>
              <p className="text-sm text-night/70">HelloSky AS · Oslo</p>
            </div>
          </div>

          <div className="mt-7 border-t border-dashed border-night/20 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-night/50">
              {TRIP_LABEL[p.tripType] ?? "Reise"}
            </p>
            <p className="mt-1 font-display text-xl font-bold text-night">{p.title}</p>
            {p.travelDate && (
              <p className="mt-0.5 text-sm text-night/70">Reisedato: {formatDate(p.travelDate)}</p>
            )}
            {p.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-night/70">{p.description}</p>
            )}
          </div>

          <dl className="mt-7 space-y-2.5 border-t border-dashed border-night/20 pt-5 text-sm">
            <div className="flex justify-between text-night/70">
              <dt>Grunnpris</dt>
              <dd className="font-semibold text-night">{formatMoney(p.supplierAmount, currency)}</dd>
            </div>
            <div className="flex justify-between text-night/70">
              <dt>Servicegebyr (8 % + 250 kr)</dt>
              <dd className="font-semibold text-night">{formatMoney(p.serviceFeeAmount, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-night/15 pt-3">
              <dt className="text-base font-bold text-night">Totalt betalt</dt>
              <dd className="font-display text-2xl font-bold text-night">{formatMoney(p.totalAmount, currency)}</dd>
            </div>
            <div className="flex justify-between text-night/70">
              <dt>Betalingsmåte</dt>
              <dd className="font-semibold text-night">{PAY_LABEL[p.paymentMethod] ?? p.paymentMethod}</dd>
            </div>
          </dl>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-night/50">
            Takk for handelen! Spørsmål? Svar på denne kvitteringen eller kontakt oss på
            hei@hellosky.no · WhatsApp 979 17 976 · alle dager 06–24.
          </p>
        </div>
      </div>
    </div>
  );
}
