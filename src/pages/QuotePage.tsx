import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2, Clock, Loader2, MessageCircle, Phone, ShieldCheck, Ticket, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import StripePaymentFlow from "@/components/checkout/StripePaymentFlow";
import PassengerForm, { Field } from "@/components/checkout/PassengerForm";
import { buildPassengerDetails, emptyPax, inputCls, normalizePhone, validatePassengers, type PaxForm } from "@/components/checkout/passengerUtils";
import { readStripeReturn } from "@/components/checkout/stripeReturn";
import { klarnaAvailable, type CheckoutPaymentMethod } from "@/components/checkout/paymentMethods";
import { appCodeOf, fieldOf, humanMessage } from "@/lib/apiError";
import { cabinLabel, formatDateTime, formatMinor, formatPrice } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Slice = {
  origin?: { city?: string; cityName?: string; iata?: string };
  destination?: { city?: string; cityName?: string; iata?: string };
  departingAt?: string;
  arrivingAt?: string;
};

const SUPPORT_PHONE: string = import.meta.env.VITE_SUPPORT_PHONE ?? "+47 22 41 00 00";
const WA = "https://wa.me/4797917976";
const TERMINAL = new Set(["confirmed", "failed", "expired", "price_changed", "cancelled"]);
const POLL_MAX_MS = 3 * 60_000;

const dt = (value: string | Date | undefined) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : formatDateTime(d.toISOString());
};

function place(p?: { city?: string; cityName?: string; iata?: string }) {
  const name = p?.city ?? p?.cityName ?? "";
  return p?.iata ? `${name} (${p.iata})` : name || "–";
}

function readDraft(key: string): Record<string, PaxForm> {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, PaxForm>) : {};
  } catch {
    return {};
  }
}

export default function QuotePage() {
  usePageMeta(PAGE_META.quote);
  const t = useT();
  const { token = "" } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const stripeReturn = useMemo(() => readStripeReturn(window.location.search), []);
  const resumeSession = params.get("session");

  const quote = trpc.quotesPublic.getByToken.useQuery({ token }, { enabled: token.length >= 32, retry: false });
  const startPayment = trpc.quotesPublic.startPayment.useMutation();
  const paymentAuthorized = trpc.checkout.paymentAuthorized.useMutation();
  const [method, setMethod] = useState<CheckoutPaymentMethod>("card");
  const [phase, setPhase] = useState<"view" | "pay" | "confirm">(resumeSession && stripeReturn ? "confirm" : "view");
  const [flowError, setFlowError] = useState<string | null>(null);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(resumeSession && stripeReturn ? Date.now() : null);
  const [now, setNow] = useState(() => Date.now());

  const status = trpc.quotesPublic.status.useQuery(
    { token },
    {
      enabled: phase === "confirm" && token.length >= 32,
      retry: 2,
      refetchInterval: (q) => {
        const s = q.state.data?.sessionStatus;
        if (s && TERMINAL.has(s)) return false;
        if (q.state.data?.orderId) return false;
        if (pollStartedAt && Date.now() - pollStartedAt > POLL_MAX_MS) return false;
        return 1500;
      },
    },
  );

  useEffect(() => {
    if (phase !== "confirm") return;
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, [phase]);

  // Gjenoppta etter redirect (3DS/Klarna)
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !resumeSession || !stripeReturn) return;
    resumed.current = true;
    if (stripeReturn.redirectStatus === "failed") {
      setFlowError(t("co.paymentfailed"));
      setPhase("view");
      return;
    }
    paymentAuthorized.mutate({ publicId: resumeSession }, { onError: (e) => setFlowError(humanMessage(e)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSession, stripeReturn]);

  useEffect(() => {
    const s = status.data;
    if (s?.orderId && (s.sessionStatus === "confirmed" || s.quoteStatus === "booked")) {
      navigate(`/bekreftelse/${encodeURIComponent(s.orderId)}${s.accessToken ? `?t=${encodeURIComponent(s.accessToken)}` : ""}`, { replace: true });
    }
  }, [status.data, navigate]);

  const q = quote.data;
  const currency = q?.currency ?? "NOK";
  const pollTimedOut = phase === "confirm" && pollStartedAt !== null && now - pollStartedAt > POLL_MAX_MS && !(status.data?.sessionStatus && TERMINAL.has(status.data.sessionStatus));
  const sessionFailed = status.data?.sessionStatus && ["failed", "expired", "price_changed", "cancelled"].includes(status.data.sessionStatus);

  // ── Passasjerer (før betaling) ──
  const slots = useMemo(() => q?.passengerSlots ?? [], [q?.passengerSlots]);
  const slicesArr = (q?.slices ?? []) as Slice[];
  const lastSlice = slicesArr[slicesArr.length - 1];
  const lastDeparture = lastSlice?.departingAt ?? new Date().toISOString();
  const lastArrival = (lastSlice?.arrivingAt ?? lastSlice?.departingAt ?? "").slice(0, 10);
  const paxCtx = useMemo(
    () => ({ passengers: slots, lastDeparture, lastArrival, identityDocumentsRequired: Boolean(q?.identityDocumentsRequired) }),
    [slots, lastDeparture, lastArrival, q?.identityDocumentsRequired],
  );
  const draftKey = `hellosky:quote-pax:${token.slice(0, 16)}`;
  const [pax, setPax] = useState<Record<string, PaxForm>>(() => readDraft(draftKey));
  const [contactPhone, setContactPhone] = useState("");
  const [paxErrors, setPaxErrors] = useState<Record<string, string>>({});
  const [editingPax, setEditingPax] = useState(false);
  const passengersSubmitted = q?.passengersSubmitted === true && !editingPax;
  const canSubmitPassengers = q?.canSubmitPassengers === true;
  const setP = (id: string, patch: Partial<PaxForm>) => setPax((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyPax()), ...patch } }));

  // Allerede innsendte reisende (navn/fødselsdato) fyller skjemaet ved «Endre» — pass må skrives inn på nytt.
  const submitted = q?.submittedPassengers;
  useEffect(() => {
    if (!submitted?.length) return;
    setPax((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of submitted) {
        if (next[p.id]?.givenName) continue;
        next[p.id] = { ...emptyPax(), ...(next[p.id] ?? {}), givenName: p.givenName, familyName: p.familyName, bornOn: p.bornOn };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [submitted]);

  // Utkast i sessionStorage — ALDRI passnummer
  useEffect(() => {
    try {
      const safe = Object.fromEntries(Object.entries(pax).map(([id, p]) => [id, { ...p, passportNumber: "" }]));
      sessionStorage.setItem(draftKey, JSON.stringify(safe));
    } catch {
      /* ignore */
    }
  }, [pax, draftKey]);

  const submitPassengers = trpc.quotesPublic.submitPassengers.useMutation({
    onSuccess: async () => {
      setPaxErrors({});
      setFlowError(null);
      await utils.quotesPublic.getByToken.invalidate({ token });
      setEditingPax(false);
    },
    onError: (err) => {
      const field = fieldOf(err);
      if (field) setPaxErrors({ [field === "contactPhone" ? "contact.phone" : field]: humanMessage(err) });
      else setFlowError(humanMessage(err));
    },
  });

  const savePassengers = () => {
    const e = validatePassengers(paxCtx, pax, t);
    const phone = contactPhone.trim() ? normalizePhone(contactPhone) : null;
    if (contactPhone.trim() && !phone) e["contact.phone"] = t("co.v.phone");
    setPaxErrors(e);
    if (Object.keys(e).length) return;
    submitPassengers.mutate({ token, passengers: buildPassengerDetails(paxCtx, pax), contactPhone: phone ?? undefined });
  };

  const begin = () => {
    setFlowError(null);
    if (!passengersSubmitted) {
      setEditingPax(true);
      setFlowError(t("qp.pax.required"));
      return;
    }
    if (!q?.onlinePaymentAvailable) return;
    startPayment.mutate(
      { token, paymentMethod: method },
      {
        onSuccess: () => setPhase("pay"),
        onError: (e) => {
          if (appCodeOf(e) === "INVALID_PASSENGER") setEditingPax(true);
          setFlowError(humanMessage(e));
        },
      },
    );
  };

  const onSucceeded = async () => {
    const publicId = startPayment.data?.publicId;
    if (!publicId) return;
    setFlowError(null);
    setPollStartedAt(Date.now());
    setPhase("confirm");
    try {
      await paymentAuthorized.mutateAsync({ publicId });
    } catch (err) {
      setFlowError(humanMessage(err));
    }
  };

  const paxSummary = (q?.submittedPassengers ?? []).map((p) => `${p.givenName} ${p.familyName}`.trim());

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <SkyMark className="h-7 w-7" />
            <span className="font-display text-xl font-bold text-night">hellosky</span>
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Sikker tilbudslenke
          </span>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none">
        {quote.isLoading && (
          <div className="space-y-4" aria-label="Laster tilbud" aria-busy="true">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-night/5" />
            <div className="h-48 animate-pulse rounded-3xl bg-night/5" />
          </div>
        )}

        {quote.error && (
          <div role="alert" className="rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-bold text-night">Lenken er ikke gyldig</h1>
            <p className="mt-2 text-sm text-muted-foreground">{humanMessage(quote.error)} Kontakt oss, så sender vi en ny.</p>
            <a href={WA} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:brightness-110">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Kontakt oss på WhatsApp
            </a>
          </div>
        )}

        {q && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Tilbud {q.reference}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-night sm:text-4xl">Hei {q.customerName} – reisen din er klar til bestilling</h1>
            <p className="mt-2 text-muted-foreground">
              {q.route} · {q.passengers} {q.passengers === 1 ? "passasjer" : "passasjerer"}
              {q.cabinClass ? ` · ${cabinLabel(q.cabinClass)}` : ""}
            </p>

            {q.status === "expired" ? (
              <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
                <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
                <p className="mt-3 font-display text-xl font-bold text-night">Tilbudet er utløpt</p>
                <p className="mt-1 text-sm text-muted-foreground">Flypriser endrer seg raskt. Kontakt oss, så lager vi et ferskt tilbud til deg.</p>
                <a href={WA} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:brightness-110">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Få nytt tilbud
                </a>
              </div>
            ) : q.status === "booked" || q.status === "paid" ? (
              <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 font-display text-xl font-bold text-night">{q.status === "booked" ? "Denne reisen er allerede booket" : "Betalingen er registrert"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Du mottar bekreftelse og billetter på e-post. Kontakt oss hvis du har spørsmål.</p>
              </div>
            ) : (
              <>
                <div className="mt-8 space-y-3">
                  {slicesArr.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Ticket className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-night">
                          {place(s.origin)} → {place(s.destination)}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {dt(s.departingAt)}
                          {s.arrivingAt ? ` – ${dt(s.arrivingAt)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="font-display text-lg font-bold text-night">{t("common.price")}</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("common.flights")}</dt>
                      <dd className="font-semibold text-night">{formatPrice(q.offerAmount, currency)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Servicegebyr HelloSky</dt>
                      <dd className="font-semibold text-night">{formatPrice(q.serviceFeeAmount, currency)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <dt className="font-display text-base font-bold text-night">{t("common.total")}</dt>
                      <dd className="font-display text-xl font-bold text-primary">{formatPrice(q.totalAmount, currency)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Tilbudet gjelder til {dt(q.expiresAt)}
                  </p>
                </div>

                {/* Reisende — må registreres før betaling (startPayment avviser med INVALID_PASSENGER uten) */}
                {canSubmitPassengers && (
                  <section className="mt-6 rounded-3xl border border-border bg-white p-6 shadow-sm" aria-labelledby="pax-heading">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 id="pax-heading" className="flex items-center gap-2 font-display text-lg font-bold text-night">
                          <Users className="h-5 w-5 text-primary" aria-hidden="true" /> {t("qp.pax.title")}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">{passengersSubmitted ? t("qp.pax.saved") : t("qp.pax.sub")}</p>
                      </div>
                      {passengersSubmitted && phase === "view" && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPax(true);
                            setFlowError(null);
                          }}
                          className="min-h-11 rounded-full border border-border px-5 text-sm font-bold text-night hover:bg-muted"
                        >
                          {t("qp.pax.edit")}
                        </button>
                      )}
                    </div>

                    {flowError && !q.onlinePaymentAvailable && (
                      <p role="alert" className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                        {flowError}
                      </p>
                    )}
                    {passengersSubmitted ? (
                      <ul className="mt-4 flex flex-wrap gap-2" aria-live="polite">
                        {(paxSummary.length ? paxSummary : slots.map((_, i) => `${t("co.step.pax")} ${i + 1}`)).map((name) => (
                          <li key={name} className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-5 space-y-5">
                        <PassengerForm {...paxCtx} pax={pax} onChange={setP} errors={paxErrors} t={t} idPrefix="qpax" />
                        <div className="max-w-sm">
                          <Field id="qp-phone" label={t("qp.pax.phone")} error={paxErrors["contact.phone"]} hint={t("co.f.phone.hint")}>
                            {(a) => (
                              <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} type="tel" autoComplete="tel" inputMode="tel" placeholder="+47 900 00 000" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
                            )}
                          </Field>
                        </div>
                        <button
                          type="button"
                          onClick={savePassengers}
                          disabled={submitPassengers.isPending}
                          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-night px-6 text-base font-bold text-white hover:brightness-125 disabled:opacity-60 sm:w-auto"
                        >
                          {submitPassengers.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                          {t("qp.pax.save")}
                        </button>
                        <p className="text-xs text-muted-foreground">{t("qp.pax.thenpay")}</p>
                      </div>
                    )}
                  </section>
                )}

                {/* Online betaling — backend åpner først når passasjerene er registrert */}
                {q.onlinePaymentAvailable ? (
                  <section className="mt-6 rounded-3xl border border-border bg-white p-6 shadow-sm" aria-labelledby="pay-heading" aria-live="polite">
                    <h2 id="pay-heading" className="font-display text-lg font-bold text-night">
                      Betal og bestill
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Kortet ditt reserveres nå og belastes først når flyselskapet har bekreftet billetten. Får vi ikke bekreftelse, frigis reservasjonen automatisk.
                    </p>
                    {flowError && (
                      <p role="alert" className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                        {flowError}
                      </p>
                    )}

                    {phase === "view" && (
                      <div className="mt-4">
                        <div role="radiogroup" aria-label={t("pay.method")} className="flex flex-wrap gap-2">
                          {(["card", "klarna"] as const)
                            .filter((m) => m === "card" || klarnaAvailable(currency))
                            .map((m) => (
                              <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={method === m}
                                onClick={() => setMethod(m)}
                                className={cn("min-h-11 rounded-full border px-5 text-sm font-bold transition-colors", method === m ? "border-night bg-night text-white" : "border-border text-muted-foreground hover:text-foreground")}
                              >
                                {m === "card" ? t("pay.card") : "Klarna"}
                              </button>
                            ))}
                        </div>
                        <button
                          type="button"
                          onClick={begin}
                          disabled={startPayment.isPending}
                          aria-disabled={!passengersSubmitted}
                          className={cn(
                            "mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-white hover:brightness-110 disabled:opacity-60",
                            !passengersSubmitted && "opacity-60",
                          )}
                        >
                          {startPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                          {t("co.topay")} — {formatPrice(q.totalAmount, currency)}
                        </button>
                        {!passengersSubmitted && <p className="mt-2 text-xs text-muted-foreground">{t("qp.pax.required")}</p>}
                      </div>
                    )}

                    {phase === "pay" && startPayment.data && (
                      <div className="mt-4">
                        <StripePaymentFlow
                          publishableKey={startPayment.data.publishableKey}
                          clientSecret={startPayment.data.clientSecret}
                          returnUrl={`${window.location.origin}/tilbud/${encodeURIComponent(token)}?session=${encodeURIComponent(startPayment.data.publicId)}`}
                          payLabel={t("co.pay", { amount: formatMinor(startPayment.data.breakdown.totalAmountMinor, startPayment.data.breakdown.currency) })}
                          onSucceeded={onSucceeded}
                        />
                        <p className="mt-3 text-xs text-muted-foreground">Ved å betale godtar du HelloSkys reisevilkår og flyselskapets transportbetingelser.</p>
                      </div>
                    )}

                    {phase === "confirm" && (
                      <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-5 text-sm">
                        {sessionFailed ? (
                          <div role="alert">
                            <p className="font-semibold text-primary">
                              {status.data?.sessionStatus === "price_changed" ? "Prisen har endret seg hos flyselskapet." : "Bestillingen kunne ikke fullføres."}
                            </p>
                            <p className="mt-1 text-muted-foreground">Reservasjonen på kortet er frigitt. Kontakt oss, så hjelper vi deg videre.</p>
                          </div>
                        ) : pollTimedOut ? (
                          <div>
                            <p className="font-semibold">{t("co.slow.title")}</p>
                            <p className="mt-1 text-muted-foreground">Vi venter fortsatt på flyselskapet. Du får e-post når billetten er bekreftet — kortet belastes først da.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPollStartedAt(Date.now());
                                status.refetch();
                              }}
                              className="mt-3 min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-white"
                            >
                              {t("co.checkagain")}
                            </button>
                          </div>
                        ) : (
                          <p className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                            {status.data?.attemptState === "BOOKING_PROCESSING" ? t("co.booking") : t("co.confirmingpayment")}
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                ) : passengersSubmitted || !canSubmitPassengers ? (
                  <div className="mt-6 rounded-3xl bg-night p-6 text-white">
                    <h2 className="font-display text-lg font-bold">Slik fullfører du</h2>
                    <p className="mt-2 text-sm text-white/80">
                      Nettbetaling er ikke tilgjengelig for dette tilbudet. Ta kontakt, så bekrefter vi detaljene og sender deg en sikker betalingslenke – deretter bookes billettene.
                      HelloSky ber aldri om kortinformasjon på e-post.
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 rounded-3xl border border-border bg-white p-6 text-center shadow-sm">
                  <p className="text-sm font-semibold text-night">Spørsmål om tilbudet?</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <a href={WA} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-bold text-night hover:brightness-105">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                    </a>
                    <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border px-6 text-sm font-bold text-night hover:bg-muted">
                      <Phone className="h-4 w-4" aria-hidden="true" /> Ring {SUPPORT_PHONE}
                    </a>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">Personlig reisehjelp · alle dager 06–24</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
