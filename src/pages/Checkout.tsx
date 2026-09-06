import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  CalendarClock,
  Info,
  Lock,
  Luggage,
  ShieldCheck,
  User,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { SliceViz } from "@/components/offers/OfferCard";
import DateField from "@/components/search/DateField";
import ExtrasSection from "@/components/checkout/ExtrasSection";
import type {
  CabinClass,
  Gender,
  Offer,
  PassengerDetails,
  Title,
} from "@contracts/types";
import {
  CABIN_LABELS,
  PAX_LABELS,
  formatDateLong,
  formatPrice,
} from "@/lib/format";

// ─── small field helpers ────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-primary">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border hairline bg-card px-4 py-3 text-base outline-none transition-colors focus:border-accent placeholder:text-muted-foreground/60";
const selectCls = inputCls + " appearance-none";

// ─── main page ──────────────────────────────────────────────────────────────

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const offerId = params.get("offer") ?? "";

  const cached = useMemo<Offer | null>(() => {
    try {
      const raw = sessionStorage.getItem(`roamly:offer:${offerId}`);
      return raw ? (JSON.parse(raw) as Offer) : null;
    } catch {
      return null;
    }
  }, [offerId]);

  const fresh = trpc.flights.getOffer.useQuery(
    { offerId },
    { enabled: Boolean(offerId), retry: 1, staleTime: 60_000 },
  );
  const offer = fresh.data ?? cached;

  // The search that produced this offer — used for recovery when it expires
  const searchCtx = useMemo(() => {
    try {
      return sessionStorage.getItem(`roamly:offerctx:${offerId}`) ?? "";
    } catch {
      return "";
    }
  }, [offerId]);

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("+47 ");
  const [pax, setPax] = useState<Record<string, Partial<PassengerDetails>>>({});
  const [guardian, setGuardian] = useState<Record<string, string>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extraBags, setExtraBags] = useState(0);
  const [seats, setSeats] = useState<Record<string, string>>({});

  const order = trpc.flights.createOrder.useMutation({
    onSuccess: (o) => navigate(`/bekreftelse/${o.id}`),
  });

  // Idempotensnøkkel: én per checkout-økt — dobbeltklikk booker aldri to ganger
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  if (!offerId) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <p className="font-display text-3xl">Ingen reise valgt ennå</p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            Start et søk
          </button>
        </div>
      </div>
    );
  }

  const setP = (id: string, patch: Partial<PassengerDetails>) =>
    setPax((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const adults = offer?.passengers.filter((p) => p.type !== "infant_without_seat") ?? [];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) e.contactEmail = "Skriv inn en gyldig e-postadresse";
    if (contactPhone.replace(/\D/g, "").length < 8) e.contactPhone = "Skriv inn et gyldig telefonnummer";
    for (const p of offer?.passengers ?? []) {
      const d = pax[p.id] ?? {};
      if (!d.givenName?.trim()) e[`${p.id}.givenName`] = "Obligatorisk";
      if (!d.familyName?.trim()) e[`${p.id}.familyName`] = "Obligatorisk";
      if (!d.bornOn) e[`${p.id}.bornOn`] = "Obligatorisk";
      if (!d.gender) e[`${p.id}.gender`] = "Velg";
      if (!d.title) e[`${p.id}.title`] = "Velg";
      if (p.type === "infant_without_seat" && !guardian[p.id]) e[`${p.id}.guardian`] = "Velg ansvarlig voksen";
    }
    if (!acceptTerms) e.terms = "Du må godta vilkårene for å fullføre";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!offer || !validate()) return;
    const passengers: PassengerDetails[] = offer.passengers.map((p) => {
      const d = pax[p.id] ?? {};
      return {
        id: p.id,
        type: p.type,
        title: (d.title ?? "mr") as Title,
        gender: (d.gender ?? "m") as Gender,
        givenName: d.givenName!.trim(),
        familyName: d.familyName!.trim(),
        bornOn: d.bornOn!,
        email: contactEmail,
        phoneNumber: contactPhone,
        infantPassengerId: p.type === "infant_without_seat" ? guardian[p.id] : undefined,
      };
    });
    order.mutate({
      offerId: offer.id,
      contactEmail,
      contactPhone,
      passengers,
      services: extraBags > 0 || Object.keys(seats).length > 0 ? { extraBags, seats } : undefined,
      idempotencyKey: idempotencyKeyRef.current!,
    });
  };

  // price math — mirrors the server-side calculation
  const extrasCalc = (() => {
    if (!offer?.services) return { bags: 0, seats: 0, total: 0 };
    const bagUnit = Number(offer.services.extraBagPrice ?? 0);
    const seatUnit = offer.services.seatPrice !== undefined ? Number(offer.services.seatPrice) : 0;
    const bags = extraBags * bagUnit;
    const seatTotal = seatUnit > 0 ? Object.keys(seats).length * seatUnit : 0;
    return { bags, seats: seatTotal, total: bags + seatTotal };
  })();
  const grandTotal = offer ? Number(offer.totalAmount) + extrasCalc.total : 0;

  const stepCls = "rounded-3xl border hairline bg-card p-5 sm:p-6";

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-24 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Tilbake til resultater
        </button>

        <h1 className="font-display text-3xl sm:text-4xl">Fullfør bestillingen</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-gold" />
          Kryptert og sikkert — kortet ditt belastes først når billetten er utstedt
        </p>

        {!offer && fresh.isLoading && (
          <div className="mt-8 space-y-4">
            <div className="shimmer h-40 rounded-3xl" />
            <div className="shimmer h-64 rounded-3xl" />
          </div>
        )}

        {!offer && !fresh.isLoading && (
          <div className="mt-8 rounded-3xl border border-primary/40 bg-card p-8 text-center">
            <Info className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-4 font-display text-2xl">Tilbudet er dessverre utløpt</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Flypriser holdes bare i et begrenset tidsrom. Søk på nytt med samme reise —
              vi finner de nærmeste alternativene med oppdaterte priser.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {searchCtx && (
                <button
                  onClick={() => navigate(`/sok${searchCtx}`)}
                  className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
                >
                  Søk på nytt med samme reise
                </button>
              )}
              <button
                onClick={() => navigate("/")}
                className="rounded-2xl border hairline px-6 py-3 text-sm font-medium transition-colors hover:border-gold hover:text-gold"
              >
                Start helt på nytt
              </button>
            </div>
          </div>
        )}

        {offer && (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
            {/* ── form column ── */}
            <div className="space-y-6">
              {/* itinerary */}
              <section className={stepCls}>
                <h2 className="mb-5 flex items-center gap-2.5 font-display text-2xl">
                  <CalendarClock className="h-5 w-5 text-gold" /> Reisen din
                </h2>
                <div className="space-y-6">
                  {offer.slices.map((s, i) => (
                    <div key={s.id}>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-skyline">
                        {i === 0 ? "Utreise" : "Hjemreise"} · {formatDateLong(s.departingAt)}
                      </p>
                      <SliceViz slice={s} />
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {s.segments.map((seg) => (
                          <span key={seg.id}>
                            {seg.carrier.iata} {seg.flightNumber} · {seg.aircraft}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-4 border-t hairline pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Luggage className="h-3.5 w-3.5 text-gold" />
                    {offer.baggage.checkedBags > 0
                      ? `${offer.baggage.checkedBags} innsjekket bagasje inkludert`
                      : "Kun håndbagasje inkludert"}
                  </span>
                  <span>{CABIN_LABELS[offer.cabinClass as CabinClass]}</span>
                  <span>{offer.refundable ? "Refunderbar billett" : offer.changeable ? "Kan endres mot gebyr" : "Kan ikke endres/refunderes"}</span>
                </div>
              </section>

              {/* contact */}
              <section className={stepCls}>
                <h2 className="mb-1 flex items-center gap-2.5 font-display text-2xl">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-sm font-bold text-white">1</span>
                  Kontaktinformasjon
                </h2>
                <p className="mb-5 text-sm text-muted-foreground">
                  Billett og viktig informasjon om reisen sendes hit.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="E-post" error={errors.contactEmail}>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="deg@eksempel.no"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Mobilnummer" error={errors.contactPhone}>
                    <input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+47 900 00 000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </section>

              {/* passengers */}
              <section className={stepCls}>
                <h2 className="mb-1 flex items-center gap-2.5 font-display text-2xl">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-sm font-bold text-white">2</span>
                  Hvem reiser?
                </h2>
                <p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  Navnene må staves nøyaktig som i passet. Navneendring etter
                  utstedelse er ofte ikke mulig.
                </p>
                <div className="space-y-6">
                  {offer.passengers.map((p, i) => (
                    <div key={p.id} className="rounded-2xl border hairline bg-muted/50 p-4 sm:p-5">
                      <p className="mb-4 text-sm font-bold text-skyline">
                        {PAX_LABELS[p.type]} {offer.passengers.filter((x) => x.type === p.type).indexOf(p) + 1}
                        {p.type === "infant_without_seat" && " (reiser i fanget)"}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Tittel" error={errors[`${p.id}.title`]}>
                          <select
                            value={pax[p.id]?.title ?? ""}
                            onChange={(e) => setP(p.id, { title: e.target.value as Title })}
                            className={selectCls}
                          >
                            <option value="">Velg …</option>
                            <option value="mr">Herr</option>
                            <option value="ms">Fru</option>
                            <option value="mrs">Frøken</option>
                          </select>
                        </Field>
                        <Field label="Fornavn" error={errors[`${p.id}.givenName`]}>
                          <input
                            autoComplete={i === 0 ? "given-name" : "off"}
                            placeholder="Ola"
                            value={pax[p.id]?.givenName ?? ""}
                            onChange={(e) => setP(p.id, { givenName: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Etternavn" error={errors[`${p.id}.familyName`]}>
                          <input
                            autoComplete={i === 0 ? "family-name" : "off"}
                            placeholder="Nordmann"
                            value={pax[p.id]?.familyName ?? ""}
                            onChange={(e) => setP(p.id, { familyName: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        <div>
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Fødselsdato
                          </span>
                          <DateField
                            value={pax[p.id]?.bornOn ?? ""}
                            onChange={(iso) => setP(p.id, { bornOn: iso })}
                            placeholder="Fødselsdato"
                            captionLayout="dropdown"
                            fromYear={1930}
                            toYear={new Date().getFullYear()}
                            max={new Date().toISOString().slice(0, 10)}
                            error={Boolean(errors[`${p.id}.bornOn`])}
                          />
                          {errors[`${p.id}.bornOn`] && (
                            <span className="mt-1 block text-xs font-medium text-primary">
                              {errors[`${p.id}.bornOn`]}
                            </span>
                          )}
                        </div>
                        <Field label="Kjønn" error={errors[`${p.id}.gender`]} hint="Kreves av flyselskapet">
                          <select
                            value={pax[p.id]?.gender ?? ""}
                            onChange={(e) => setP(p.id, { gender: e.target.value as Gender })}
                            className={selectCls}
                          >
                            <option value="">Velg …</option>
                            <option value="m">Mann</option>
                            <option value="f">Kvinne</option>
                          </select>
                        </Field>
                        {p.type === "infant_without_seat" && (
                          <Field label="Ansvarlig voksen" error={errors[`${p.id}.guardian`]}>
                            <select
                              value={guardian[p.id] ?? ""}
                              onChange={(e) => setGuardian((g) => ({ ...g, [p.id]: e.target.value }))}
                              className={selectCls}
                            >
                              <option value="">Velg …</option>
                              {adults.map((a, ai) => (
                                <option key={a.id} value={a.id}>
                                  {pax[a.id]?.givenName || `Voksen ${ai + 1}`}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* extras: bags + seats */}
              <ExtrasSection
                offer={offer}
                extraBags={extraBags}
                onExtraBags={setExtraBags}
                seats={seats}
                onSeats={setSeats}
              />

              {/* payment — kortdata håndteres aldri av Roamly */}
              <section className={stepCls}>
                <h2 className="mb-1 flex items-center gap-2.5 font-display text-2xl">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-sm font-bold text-white">
                    {offer.services ? "4" : "3"}
                  </span>
                  Betaling
                </h2>
                <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="text-sm leading-relaxed">
                    <p className="font-semibold text-foreground">
                      Trygt fullført kjøp — hentet direkte fra flyselskapet
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Roamly ber aldri om kortinformasjon på denne siden. Når du
                      bekrefter, reserveres billetten hos flyselskapet umiddelbart,
                      og du mottar bekreftelse og betalingsinformasjon på e-post.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* ── price column ── */}
            <aside className="lg:sticky lg:top-24">
              <div className="rounded-3xl border hairline bg-card p-6">
                <h2 className="font-display text-2xl">Prissammendrag</h2>
                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {(["adult", "child", "infant_without_seat"] as const)
                        .map((t) => ({ t, n: offer.passengers.filter((p) => p.type === t).length }))
                        .filter(({ n }) => n > 0)
                        .map(({ t, n }) => `${n} × ${PAX_LABELS[t].toLowerCase()}`)
                        .join(" + ")}
                    </span>
                    <span>{formatPrice(offer.baseAmount, offer.totalCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Skatter og avgifter</span>
                    <span>{formatPrice(offer.taxAmount, offer.totalCurrency)}</span>
                  </div>
                  {extrasCalc.bags > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ekstra bagasje ({extraBags} kolli)</span>
                      <span>{formatPrice(extrasCalc.bags, offer.totalCurrency)}</span>
                    </div>
                  )}
                  {extrasCalc.seats > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Setevalg ({Object.keys(seats).length})</span>
                      <span>{formatPrice(extrasCalc.seats, offer.totalCurrency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t hairline pt-3 text-base font-bold">
                    <span>Totalt</span>
                    <span className="font-display text-2xl text-gold">
                      {formatPrice(grandTotal, offer.totalCurrency)}
                    </span>
                  </div>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#2E5BFF]"
                  />
                  <span>
                    Jeg godtar Roamlys reisevilkår og flyselskapets
                    transportbetingelser, og bekrefter at opplysningene ovenfor er riktige.
                  </span>
                </label>
                {errors.terms && <p className="mt-2 text-xs font-medium text-primary">{errors.terms}</p>}

                {order.isError && (
                  <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                    <p>{order.error.message}</p>
                    {order.error.message.includes("utløpt") && searchCtx && (
                      <button
                        onClick={() => navigate(`/sok${searchCtx}`)}
                        className="mt-2 font-bold underline underline-offset-2"
                      >
                        Søk på nytt med samme reise →
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={order.isPending}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {order.isPending ? (
                    <>
                      <span className="pulse-soft">Utsteder billett …</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Betal {formatPrice(grandTotal, offer.totalCurrency)}
                    </>
                  )}
                </button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Ved å betale utstedes billetten umiddelbart hos {offer.owner.name}.
                  Bekreftelse sendes til {contactEmail || "e-postadressen din"}.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
