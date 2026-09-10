import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Printer, ReceiptText } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Btn, Card, PageHeader } from "./ui";
import { formatMoney, inputCls, labelCls } from "./helpers";

const TRIP_TYPES = [
  { value: "flight", label: "Fly" },
  { value: "hotel", label: "Hotell" },
  { value: "car", label: "Leiebil" },
  { value: "package", label: "Pakkereise" },
] as const;

const PAY_METHODS = [
  { value: "vipps", label: "Vipps" },
  { value: "card", label: "Kort (terminal)" },
  { value: "invoice", label: "Faktura" },
  { value: "cash", label: "Kontant" },
] as const;

export function AdminManualBooking() {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tripType, setTripType] = useState<(typeof TRIP_TYPES)[number]["value"]>("flight");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAY_METHODS)[number]["value"]>("vipps");
  const [done, setDone] = useState<{ bookingId: number; reference: string; total: string } | null>(null);

  const create = trpc.admin.createManualBooking.useMutation({
    onSuccess: (res) => setDone(res),
  });

  // Samme beregning som serveren: 8 % (rundet til hele kroner) + 250 kr.
  const calc = useMemo(() => {
    const base = Number(baseAmount);
    if (!Number.isFinite(base) || base <= 0) return null;
    const percent = Math.round(base * 0.08);
    const fee = percent + 250;
    return { percent, fee, total: base + fee };
  }, [baseAmount]);

  const valid =
    customerName.trim().length > 0 &&
    /.+@.+\..+/.test(customerEmail) &&
    title.trim().length > 0 &&
    calc !== null;

  const submit = () => {
    if (!valid || create.isPending) return;
    create.mutate({
      customerName, customerEmail, customerPhone: customerPhone || undefined,
      tripType, title, description: description || undefined,
      travelDate: travelDate || undefined,
      baseAmount: Number(baseAmount).toFixed(2),
      currency: "NOK", paymentMethod,
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg pt-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-foreground">Bestilling registrert</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Referanse <span className="font-mono font-semibold text-foreground">{done.reference}</span> · totalt{" "}
          <span className="font-semibold text-foreground">{formatMoney(done.total)}</span>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/admin/kvittering/${done.bookingId}`}>
            <Btn tone="night"><Printer className="h-4 w-4" /> Skriv ut kvittering</Btn>
          </Link>
          <Link to={`/admin/bestillinger/${done.bookingId}`}>
            <Btn tone="ghost">Åpne bestillingen</Btn>
          </Link>
          <Btn tone="ghost" onClick={() => { setDone(null); setCustomerName(""); setCustomerEmail(""); setCustomerPhone(""); setTitle(""); setDescription(""); setTravelDate(""); setBaseAmount(""); }}>
            Registrer en til
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Ny manuell bestilling"
        description="Legg inn bestilling for kunde som ringer, skriver på WhatsApp eller er i kontakt på annen måte. Servicegebyr (8 % + 250 kr) legges på automatisk."
      />

      <div className="grid gap-5">
        <Card>
          <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Kunde</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Navn *</label>
              <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Kundens fulle navn" />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+47 …" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>E-post *</label>
              <input className={inputCls} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="kunde@epost.no" />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Reisen</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {TRIP_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTripType(t.value)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                  tripType === t.value ? "bg-night text-white shadow-sm" : "bg-muted text-foreground/60 hover:bg-night/10",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>Tittel *</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={tripType === "flight" ? "F.eks. Oslo → Roma tur/retur, 2 voksne" : tripType === "hotel" ? "F.eks. Hotell Roma, 5 netter" : tripType === "car" ? "F.eks. Leiebil Roma flyplass, 7 dager" : "F.eks. Fly + hotell Roma"} />
            </div>
            <div>
              <label className={labelCls}>Detaljer (flynummer, hotellnavn, bilklasse …)</label>
              <textarea className={cn(inputCls, "min-h-[90px]")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Alt kunden skal vite om bestillingen …" />
            </div>
            <div className="sm:max-w-[220px]">
              <label className={labelCls}>Reisedato</label>
              <input className={inputCls} type="date" aria-label="Reisedato" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-xl font-semibold text-foreground">Pris og betaling</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Grunnpris (NOK) *</label>
              <input className={inputCls} inputMode="decimal" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value.replace(",", "."))} placeholder="4990.00" />
            </div>
            <div>
              <label className={labelCls}>Betalingsmåte</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {PAY_METHODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPaymentMethod(p.value)}
                    className={cn(
                      "rounded-lg px-3.5 py-2 text-xs font-semibold transition-all",
                      paymentMethod === p.value ? "bg-primary text-white" : "bg-muted text-foreground/60 hover:bg-night/10",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {calc && (
            <dl className="mt-5 space-y-2 rounded-lg bg-night/[0.03] p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Grunnpris</dt><dd className="font-semibold text-foreground">{formatMoney(Number(baseAmount))}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Servicegebyr (8 % = {formatMoney(calc.percent)} + 250 kr)</dt>
                <dd className="font-semibold text-foreground">{formatMoney(calc.fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Kunden betaler</dt>
                <dd className="font-display text-xl text-primary">{formatMoney(calc.total)}</dd>
              </div>
            </dl>
          )}
        </Card>

        {create.isError && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {create.error.message}
          </p>
        )}

        <Btn onClick={submit} disabled={!valid || create.isPending} className="h-12 text-base">
          <ReceiptText className="h-5 w-5" />
          {create.isPending ? "Registrerer …" : "Registrer bestilling og lag kvittering"}
        </Btn>
      </div>
    </div>
  );
}
