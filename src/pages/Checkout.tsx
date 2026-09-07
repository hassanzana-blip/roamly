import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, CalendarClock, CheckCircle2, Info, Loader2, Lock, Luggage, TimerReset, TriangleAlert, User, Wallet } from "lucide-react";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { SliceViz } from "@/components/offers/OfferCard";
import ExtrasSection from "@/components/checkout/ExtrasSection";
import PassengerForm, { Field } from "@/components/checkout/PassengerForm";
import { buildPassengerDetails, emptyPax, inputCls, normalizePhone, selectCls, validatePassengers, type PaxForm } from "@/components/checkout/passengerUtils";
import PaymentSection from "@/components/checkout/PaymentSection";
import { klarnaAvailable, type CheckoutPaymentMethod } from "@/components/checkout/paymentMethods";
import StripePaymentFlow from "@/components/checkout/StripePaymentFlow";
import { readStripeReturn } from "@/components/checkout/stripeReturn";
import { useCustomer } from "@/lib/useCustomer";
import { appCodeOf, fieldOf, humanMessage, type AppCode } from "@/lib/apiError";
import { PHONE_CODES } from "@/content/countries";
import type { CabinClass, Offer, SearchPassengerInput, SearchSliceInput } from "@contracts/types";
import { cabinLabel, fareConditionLabel, formatCountdown, formatDateLong, formatMinor, paxLabel, previewServiceFeeMinor, toMinor } from "@/lib/format";
import { useFeeConfig } from "@/lib/useFeeConfig";
import { useLocale, useT, type I18nKey } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

// ─── Typer ──────────────────────────────────────────────────────────────────

type Step = "reisende" | "kontakt" | "tilvalg" | "betaling" | "bekreft";
const STEPS: { key: Step; label: I18nKey }[] = [
  { key: "reisende", label: "co.step.pax" },
  { key: "kontakt", label: "co.step.contact" },
  { key: "tilvalg", label: "co.step.bags" },
  { key: "betaling", label: "co.step.payment" },
  { key: "bekreft", label: "co.step.confirm" },
];

type CreateSessionResult = RouterOutputs["checkout"]["createSession"];

const TERMINAL = new Set(["confirmed", "failed", "expired", "price_changed", "cancelled"]);
const POLL_MAX_MS = 3 * 60_000;

// ─── Hjelpere ───────────────────────────────────────────────────────────────

/** Rekonstruer søket som ga tilbudet — for automatisk nytt søk ved utløpt tilbud. */
function parseSearchQuery(qs: string): { slices: SearchSliceInput[]; passengers: SearchPassengerInput[]; cabinClass: CabinClass } | null {
  if (!qs) return null;
  const p = new URLSearchParams(qs);
  const slices: SearchSliceInput[] = [];
  const legsParam = p.get("legs");
  if (legsParam) {
    for (const part of legsParam.split(",")) {
      const [o, d, date] = part.split(":");
      if (o && d && date) slices.push({ origin: o, destination: d, departureDate: date });
    }
  } else {
    const from = p.get("from");
    const to = p.get("to");
    const depart = p.get("depart");
    const ret = p.get("ret");
    if (!from || !to || !depart) return null;
    slices.push({ origin: from, destination: to, departureDate: depart });
    if (ret) slices.push({ origin: to, destination: from, departureDate: ret });
  }
  if (!slices.length) return null;
  const ages = (key: string) =>
    (p.get(key) ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17);
  const passengers: SearchPassengerInput[] = [];
  for (let i = 0; i < Number(p.get("adults") ?? 1); i++) passengers.push({ type: "adult" });
  ages("childAges").forEach((age) => passengers.push({ type: "child", age }));
  ages("infantAges").forEach((age) => passengers.push({ type: "infant_without_seat", age }));
  return { slices, passengers, cabinClass: (p.get("cabin") ?? "economy") as CabinClass };
}

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeSession(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ─── Små komponenter ────────────────────────────────────────────────────────

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "border-t hairline pt-3 text-base font-bold" : muted ? "text-muted-foreground" : "")}>
      <span>{label}</span>
      <span className={strong ? "font-display text-2xl text-night" : undefined}>{value}</span>
    </div>
  );
}

// ─── Hovedside ──────────────────────────────────────────────────────────────

export default function Checkout() {
  usePageMeta(PAGE_META.checkout);
  const t = useT();
  const { lang } = useLocale();
  const feeConfig = useFeeConfig();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const offerId = params.get("offer") ?? "";
  const resumeSessionId = params.get("session");
  const stripeReturn = useMemo(() => readStripeReturn(window.location.search), []);

  // ── Tilbud: fersk fra server, ellers øktens snapshot ──
  const cached = useMemo<Offer | null>(() => readSession<Offer>(`hellosky:offer:${offerId}`), [offerId]);
  const fresh = trpc.flights.getOffer.useQuery({ offerId }, { enabled: Boolean(offerId), retry: 1, staleTime: 60_000 });
  const offer = fresh.data ?? cached;
  const searchCtx = useMemo(() => {
    try {
      return sessionStorage.getItem(`hellosky:offerctx:${offerId}`) ?? "";
    } catch {
      return "";
    }
  }, [offerId]);
  const serviceStatus = trpc.flights.status.useQuery(undefined, { staleTime: 300_000, retry: false });

  // ── Steg + fokus ──
  const [step, setStep] = useState<Step>(resumeSessionId && stripeReturn ? "bekreft" : "reisende");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // ── Skjema ──
  const draftKey = `hellosky:checkout-draft:${offerId}`;
  const [pax, setPax] = useState<Record<string, PaxForm>>(() => readSession<{ pax: Record<string, PaxForm> }>(draftKey)?.pax ?? {});
  const [contact, setContact] = useState(() => {
    const d = readSession<{ contact?: { email: string; emailRepeat: string; phoneCode: string; phoneLocal: string } }>(draftKey)?.contact;
    return d ?? { email: "", emailRepeat: "", phoneCode: "+47", phoneLocal: "" };
  });
  const [bagsByPax, setBagsByPax] = useState<Record<string, number>>(() => readSession<{ bags?: Record<string, number> }>(draftKey)?.bags ?? {});
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("card");
  const [bonusUse, setBonusUse] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Utkast i sessionStorage — ALDRI passnummer
  useEffect(() => {
    if (!offerId) return;
    const safePax = Object.fromEntries(Object.entries(pax).map(([id, p]) => [id, { ...p, passportNumber: "" }]));
    writeSession(draftKey, { pax: safePax, contact, bags: bagsByPax });
  }, [pax, contact, bagsByPax, draftKey, offerId]);

  // ── Innlogget kunde: forhåndsutfyll ──
  const { customer } = useCustomer();
  const savedTravelersQ = trpc.extras.myTravelers.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const savedTravelers = savedTravelersQ.data ?? [];
  const prefilled = useRef(false);
  useEffect(() => {
    if (!customer || prefilled.current) return;
    prefilled.current = true;
    setContact((c) => {
      const next = { ...c };
      if (!c.email && customer.email) {
        next.email = customer.email;
        next.emailRepeat = customer.email;
      }
      if (!c.phoneLocal && customer.phone) {
        const m = PHONE_CODES.find((pc) => customer.phone!.startsWith(pc.code));
        if (m) {
          next.phoneCode = m.code;
          next.phoneLocal = customer.phone.slice(m.code.length);
        } else next.phoneLocal = customer.phone;
      }
      return next;
    });
    const firstId = offer?.passengers[0]?.id;
    if (firstId) {
      setPax((prev) => {
        const cur = prev[firstId] ?? emptyPax();
        if (cur.givenName || cur.familyName) return prev;
        return { ...prev, [firstId]: { ...cur, givenName: customer.firstName, familyName: customer.lastName } };
      });
    }
  }, [customer, offer]);

  // ── Nedtelling på tilbudet ──
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const expiresAtMs = offer ? Date.parse(offer.expiresAt) : NaN;
  const remainingMs = Number.isFinite(expiresAtMs) ? expiresAtMs - now : Infinity;
  const offerExpired = remainingMs <= 0;

  // ── Utløpt tilbud: søk automatisk på nytt ──
  const reSearch = trpc.flights.search.useMutation();
  const [recovery, setRecovery] = useState<null | { status: "searching" | "found" | "none"; offer?: Offer }>(null);
  const startRecovery = useCallback(() => {
    if (recovery) return;
    const input = parseSearchQuery(searchCtx);
    if (!input) {
      setRecovery({ status: "none" });
      return;
    }
    setRecovery({ status: "searching" });
    const oldFlights = offer?.slices.map((s) => s.segments.map((g) => g.flightNumber).join("-")).join("|");
    reSearch.mutate(input, {
      onSuccess: (res) => {
        const same = res.offers.find((o) => o.slices.map((s) => s.segments.map((g) => g.flightNumber).join("-")).join("|") === oldFlights);
        const cheapest = [...res.offers].sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount))[0];
        const match = same ?? cheapest;
        setRecovery(match ? { status: "found", offer: match } : { status: "none" });
      },
      onError: () => setRecovery({ status: "none" }),
    });
  }, [recovery, searchCtx, offer, reSearch]);

  const continueWithOffer = (o: Offer) => {
    writeSession(`hellosky:offer:${o.id}`, o);
    try {
      sessionStorage.setItem(`hellosky:offerctx:${o.id}`, searchCtx);
      // Behold utkastet (uten passnummer) for det nye tilbudet når passasjer-ID-ene matcher i antall
      const draft = readSession<unknown>(draftKey);
      if (draft) sessionStorage.setItem(`hellosky:checkout-draft:${o.id}`, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    window.location.href = `/bestill?offer=${encodeURIComponent(o.id)}`;
  };

  // ── Checkout-økt ──
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const [session, setSession] = useState<CreateSessionResult | null>(null);
  const createSession = trpc.checkout.createSession.useMutation();
  const paymentAuthorized = trpc.checkout.paymentAuthorized.useMutation();
  const confirmDemo = trpc.checkout.confirmDemo.useMutation();
  const cancelSession = trpc.checkout.cancelSession.useMutation();
  const [flowError, setFlowError] = useState<string | null>(null);

  const activePublicId = session?.publicId ?? resumeSessionId ?? null;
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const polling = step === "bekreft" && Boolean(activePublicId);
  const status = trpc.checkout.status.useQuery(
    { publicId: activePublicId ?? "00000000-0000-0000-0000-000000000000" },
    {
      enabled: polling,
      retry: 2,
      refetchInterval: (q) => {
        const s = q.state.data?.status;
        if (s && TERMINAL.has(s)) return false;
        if (pollStartedAt && Date.now() - pollStartedAt > POLL_MAX_MS) return false;
        return 1500;
      },
    },
  );
  const pollTimedOut = polling && pollStartedAt !== null && now - pollStartedAt > POLL_MAX_MS && !(status.data && TERMINAL.has(status.data.status));

  // Gjenoppta etter redirect fra 3DS/Klarna
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !resumeSessionId || !stripeReturn) return;
    resumed.current = true;
    setPollStartedAt(Date.now());
    if (stripeReturn.redirectStatus === "failed") {
      setFlowError(t("co.paymentfailed"));
      setStep("betaling");
      return;
    }
    paymentAuthorized.mutate(
      { publicId: resumeSessionId },
      { onError: (e) => setFlowError(humanMessage(e)) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSessionId, stripeReturn]);

  // Bekreftet → bekreftelsessiden
  useEffect(() => {
    const s = status.data;
    if (s?.status === "confirmed" && s.orderId) {
      try {
        sessionStorage.removeItem(draftKey);
        if (s.accessToken) sessionStorage.setItem(`hellosky:access:${s.orderId}`, s.accessToken);
      } catch {
        /* ignore */
      }
      navigate(`/bekreftelse/${encodeURIComponent(s.orderId)}${s.accessToken ? `?t=${encodeURIComponent(s.accessToken)}` : ""}`, { replace: true });
    }
  }, [status.data, navigate, draftKey]);

  // ── Avledet ──
  const lastSlice = offer?.slices[offer.slices.length - 1];
  const lastDeparture = lastSlice?.departingAt ?? "";
  const lastArrival = (lastSlice?.arrivingAt ?? lastSlice?.departingAt ?? "").slice(0, 10);
  const currency = offer?.totalCurrency ?? "NOK";
  const totalBags = Object.values(bagsByPax).reduce((a, b) => a + b, 0);
  const bagPriceMinor = offer?.services?.extraBagPrice ? toMinor(offer.services.extraBagPrice, currency) : 0;
  const supplierMinor = offer ? toMinor(offer.totalAmount, currency) : 0;
  const previewFee = previewServiceFeeMinor(supplierMinor, currency, feeConfig);
  const previewTotal = supplierMinor + totalBags * bagPriceMinor + previewFee;
  const breakdown = status.data?.breakdown ?? session?.breakdown ?? null;
  const displayTotalMinor = breakdown?.totalAmountMinor ?? previewTotal;
  const setP = (id: string, patch: Partial<PaxForm>) => setPax((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyPax()), ...patch } }));

  useEffect(() => {
    if (!klarnaAvailable(currency) && paymentMethod === "klarna") setPaymentMethod("card");
  }, [currency, paymentMethod]);

  // ── Validering (speiler serveren) ──
  const paxCtx = useMemo(
    () => ({
      passengers: offer?.passengers ?? [],
      lastDeparture,
      lastArrival,
      identityDocumentsRequired: Boolean(offer?.identityDocumentsRequired),
    }),
    [offer, lastDeparture, lastArrival],
  );
  const validatePax = (): Record<string, string> => (offer ? validatePassengers(paxCtx, pax, t) : {});

  const validateContact = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const email = contact.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) e["contact.email"] = t("co.v.email");
    if (email !== contact.emailRepeat.trim().toLowerCase()) e["contact.emailRepeat"] = t("co.v.emailrepeat");
    if (!normalizePhone(`${contact.phoneCode}${contact.phoneLocal}`)) e["contact.phone"] = t("co.v.phone");
    return e;
  };

  const goNext = (from: Step) => {
    let e: Record<string, string> = {};
    if (from === "reisende") e = validatePax();
    if (from === "kontakt") e = validateContact();
    setErrors(e);
    if (Object.keys(e).length) return;
    const order: Step[] = ["reisende", "kontakt", "tilvalg", "betaling", "bekreft"];
    setStep(order[order.indexOf(from) + 1]);
  };

  /** «Gå til betaling»: server priser og låser summen. */
  const startSession = (opts?: { newKey?: boolean }) => {
    if (!offer) return;
    const e = { ...validatePax(), ...validateContact() };
    if (!terms) e.terms = t("co.v.terms");
    setErrors(e);
    if (Object.keys(e).length) return;
    if (opts?.newKey) idempotencyKeyRef.current = crypto.randomUUID();
    setFlowError(null);
    createSession.mutate(
      {
        offerId: offer.id,
        passengers: buildPassengerDetails(paxCtx, pax),
        contactEmail: contact.email.trim().toLowerCase(),
        contactPhone: normalizePhone(`${contact.phoneCode}${contact.phoneLocal}`)!,
        services: totalBags > 0 ? { extraBags: totalBags, bagsByPassenger: bagsByPax } : { extraBags: 0 },
        bonusUse: Boolean(customer && bonusUse && currency === "NOK"),
        paymentMethod,
        idempotencyKey: idempotencyKeyRef.current,
        searchCtx: searchCtx || undefined,
        locale: lang === "nb" || lang === "en" ? lang : "en",
        termsAccepted: true,
        marketingConsent: marketing,
      },
      {
        onSuccess: (s) => {
          setSession(s);
          writeSession(`hellosky:checkout-session:${offer.id}`, s.publicId);
          setStep("betaling");
        },
        onError: (err) => {
          const field = fieldOf(err);
          if (field) {
            setErrors({ [field]: humanMessage(err) });
            setStep(field.startsWith("contact") ? "kontakt" : "reisende");
          }
          const code = appCodeOf(err);
          if (code === "OFFER_EXPIRED" || code === "OFFER_NOT_FOUND") startRecovery();
          if (code === "PRICE_CHANGED") fresh.refetch(); // vis ny leverandørpris i sammendraget
        },
      },
    );
  };

  const onStripeSucceeded = async () => {
    if (!session) return;
    setFlowError(null);
    setPollStartedAt(Date.now());
    setStep("bekreft");
    try {
      await paymentAuthorized.mutateAsync({ publicId: session.publicId });
    } catch (err) {
      setFlowError(humanMessage(err));
    }
  };

  const onDemoConfirm = () => {
    if (!session) return;
    setFlowError(null);
    setPollStartedAt(Date.now());
    confirmDemo.mutate(
      { publicId: session.publicId },
      { onSuccess: () => setStep("bekreft"), onError: (err) => setFlowError(humanMessage(err)) },
    );
  };

  const editDetails = () => {
    if (session) cancelSession.mutate({ publicId: session.publicId });
    setSession(null);
    idempotencyKeyRef.current = crypto.randomUUID();
    setFlowError(null);
    setStep("reisende");
  };

  const retryWithNewPrice = () => {
    setSession(null);
    setStep("tilvalg");
    fresh.refetch().finally(() => startSession({ newKey: true }));
  };

  // ── Feil fra sesjonsopprettelse / status ──
  const createErrCode: AppCode | null = createSession.error ? appCodeOf(createSession.error) : null;
  const statusErrCode = status.data?.errorCode ?? null;

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const stepCls = "rounded-3xl border border-border bg-card p-5 sm:p-6";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-44 pt-24 outline-none sm:px-6 lg:pb-20">
        {!offerId ? (
          <div className="grid min-h-[50vh] place-items-center text-center">
            <div>
              <p className="font-display text-3xl">{t("co.nooffer")}</p>
              <button onClick={() => navigate("/")} className="mt-6 min-h-11 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">
                {t("co.startsearch")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => navigate(-1)}
              className="mb-5 flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("co.backresults")}
            </button>

            <h1 className="font-display text-3xl sm:text-4xl">{t("co.title")}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {t("co.secure")}
            </p>

            {/* Stegindikator */}
            <ol className="mt-6 flex items-center gap-1.5 sm:gap-2" aria-label={t("co.progress")}>
              {STEPS.map((s, i) => {
                const done = i < stepIndex;
                const current = i === stepIndex;
                const clickable = done && !session && step !== "bekreft";
                return (
                  <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2" aria-current={current ? "step" : undefined}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => setStep(s.key)}
                      className="flex min-h-11 min-w-0 items-center gap-1.5 disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                          current || done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={cn("truncate text-[11px] font-semibold sm:text-xs", current ? "text-foreground" : "text-muted-foreground")}>{t(s.label)}</span>
                    </button>
                    {i < STEPS.length - 1 && <span className="h-px min-w-2 flex-1 bg-border" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>

            {!offer && fresh.isLoading && (
              <div className="mt-8 space-y-4">
                <div className="shimmer h-40 rounded-3xl" />
                <div className="shimmer h-64 rounded-3xl" />
              </div>
            )}

            {/* Utløpt / manglende tilbud */}
            {((!offer && !fresh.isLoading) || (offer && offerExpired && step !== "bekreft")) && (
              <ExpiredPanel
                searchCtx={searchCtx}
                recovery={recovery}
                onStart={startRecovery}
                oldOffer={offer}
                onContinue={continueWithOffer}
                onHome={() => navigate("/")}
                onSearch={() => navigate(`/sok${searchCtx}`)}
              />
            )}

            {offer && !(offerExpired && step !== "bekreft") && (
              <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
                {/* ── Skjemakolonne ── */}
                <div className="space-y-6">
                  <h2 ref={headingRef} tabIndex={-1} className="sr-only">
                    {t("co.stepof", { n: stepIndex + 1, total: STEPS.length, label: t(STEPS[stepIndex].label) })}
                  </h2>

                  {/* Reisen */}
                  <section className={stepCls} aria-label={t("co.trip")}>
                    <h2 className="mb-5 flex items-center gap-2.5 font-display text-2xl">
                      <CalendarClock className="h-5 w-5 text-foreground" aria-hidden="true" /> {t("co.trip")}
                    </h2>
                    <div className="space-y-6">
                      {offer.slices.map((s, i) => (
                        <div key={s.id}>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                            {offer.slices.length === 1 ? t("co.leg.single") : i === 0 ? t("co.leg.out") : offer.slices.length === 2 ? t("co.leg.return") : t("co.leg.n", { n: i + 1 })} · {formatDateLong(s.departingAt)}
                          </p>
                          <SliceViz slice={s} />
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {s.segments.map((seg) => (
                              <span key={seg.id}>
                                {seg.carrier.iata} {seg.flightNumber}
                                {seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? ` ${t("co.operatedby", { name: seg.operatingCarrier.name })}` : ""} · {seg.aircraft}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-4 border-t hairline pt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Luggage className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                        {offer.baggage.checkedBags > 0 ? t("co.bags.included", { count: offer.baggage.checkedBags }) : t("co.bags.handonly")}
                      </span>
                      <span>{cabinLabel(offer.cabinClass)}</span>
                      <span>{fareConditionLabel("refund", offer.conditions?.refundBeforeDeparture, offer.refundable)}</span>
                      <span>{fareConditionLabel("change", offer.conditions?.changeBeforeDeparture, offer.changeable)}</span>
                    </div>
                  </section>

                  {/* Steg 1: Reisende */}
                  {step === "reisende" && (
                    <section className={stepCls} aria-labelledby="reisende-heading">
                      <h2 id="reisende-heading" className="mb-1 flex items-center gap-2.5 font-display text-2xl">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">1</span>
                        {t("co.pax.title")}
                      </h2>
                      <p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground">
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                        {t("co.pax.note")}
                      </p>
                      <PassengerForm {...paxCtx} pax={pax} onChange={setP} errors={errors} savedTravelers={savedTravelers} t={t} />
                      <div className="mt-6 flex justify-end">
                        <button type="button" onClick={() => goNext("reisende")} className="min-h-12 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 hover:brightness-[0.94]">
                          {t("co.next.contact")}
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Steg 2: Kontakt */}
                  {step === "kontakt" && (
                    <section className={stepCls} aria-labelledby="kontakt-heading">
                      <h2 id="kontakt-heading" className="mb-1 flex items-center gap-2.5 font-display text-2xl">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">2</span>
                        {t("co.contact.title")}
                      </h2>
                      <p className="mb-5 text-sm text-muted-foreground">{t("co.contact.sub")}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="contact-email" label={t("common.email")} error={errors["contact.email"]}>
                          {(a) => (
                            <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} type="email" autoComplete="email" placeholder={t("common.emailph")} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} className={inputCls} />
                          )}
                        </Field>
                        <Field id="contact-email2" label={t("co.f.email2")} error={errors["contact.emailRepeat"]}>
                          {(a) => (
                            <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} type="email" autoComplete="off" placeholder={t("common.emailph")} value={contact.emailRepeat} onChange={(e) => setContact((c) => ({ ...c, emailRepeat: e.target.value }))} onPaste={(e) => e.preventDefault()} className={inputCls} />
                          )}
                        </Field>
                        <Field id="contact-phone" label={t("co.f.phone")} error={errors["contact.phone"]} hint={t("co.f.phone.hint")}>
                          {(a) => (
                            <div className="flex gap-2">
                              <select aria-label={t("co.f.countrycode")} value={contact.phoneCode} onChange={(e) => setContact((c) => ({ ...c, phoneCode: e.target.value }))} className={selectCls + " w-32 shrink-0"}>
                                {PHONE_CODES.map((pc) => (
                                  <option key={pc.code} value={pc.code}>
                                    {pc.label}
                                  </option>
                                ))}
                              </select>
                              <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} type="tel" autoComplete="tel-national" inputMode="tel" placeholder="900 00 000" value={contact.phoneLocal} onChange={(e) => setContact((c) => ({ ...c, phoneLocal: e.target.value }))} className={inputCls} />
                            </div>
                          )}
                        </Field>
                      </div>
                      <div className="mt-6 flex justify-between gap-3">
                        <button type="button" onClick={() => setStep("reisende")} className="min-h-12 rounded-full border hairline px-6 text-sm font-medium hover:border-foreground/25">
                          {t("common.back")}
                        </button>
                        <button type="button" onClick={() => goNext("kontakt")} className="min-h-12 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 hover:brightness-[0.94]">
                          {t("co.next.bags")}
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Steg 3: Tilvalg (bagasje) */}
                  {step === "tilvalg" && (
                    <>
                      <ExtrasSection
                        offer={offer}
                        step={3}
                        bagsByPax={bagsByPax}
                        onBagsByPax={setBagsByPax}
                        names={Object.fromEntries(offer.passengers.map((p) => [p.id, pax[p.id]?.givenName?.trim() ?? ""]))}
                        disabled={createSession.isPending}
                      />
                      <PaymentSection step={4} value={paymentMethod} onChange={setPaymentMethod} currency={currency} />
                      <section className={stepCls} aria-label={t("co.terms.aria")}>
                        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
                          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-describedby={errors.terms ? "terms-err" : undefined} aria-invalid={Boolean(errors.terms)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                          <span>
                            {t("co.terms.label")}
                            <span className="text-primary"> *</span>
                          </span>
                        </label>
                        {errors.terms && (
                          <p id="terms-err" role="alert" className="mt-2 text-xs font-medium text-primary">
                            {errors.terms}
                          </p>
                        )}
                        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
                          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                          <span>{t("co.marketing")}</span>
                        </label>
                        {customer && (customer.bonusKr ?? 0) > 0 && currency === "NOK" && (
                          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3">
                            <input type="checkbox" checked={bonusUse} onChange={(e) => setBonusUse(e.target.checked)} className="h-5 w-5 shrink-0 accent-primary" />
                            <Wallet className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                            <span className="text-sm">{t("co.bonus.use", { amount: customer.bonusKr ?? 0 })}</span>
                          </label>
                        )}
                      </section>

                      {createSession.isError && (
                        <ErrorPanel
                          code={createErrCode}
                          message={humanMessage(createSession.error)}
                          onRetry={() => startSession({ newKey: true })}
                          onSearch={() => navigate(`/sok${searchCtx}`)}
                        />
                      )}

                      <div className="flex justify-between gap-3">
                        <button type="button" onClick={() => setStep("kontakt")} className="min-h-12 rounded-full border hairline px-6 text-sm font-medium hover:border-foreground/25">
                          {t("common.back")}
                        </button>
                        <button
                          type="button"
                          onClick={() => startSession()}
                          disabled={createSession.isPending || offerExpired}
                          aria-busy={createSession.isPending}
                          className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 hover:brightness-[0.94] disabled:opacity-60"
                        >
                          {createSession.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("co.confirmingprice")}
                            </>
                          ) : (
                            t("co.topay")
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Steg 4: Betaling */}
                  {step === "betaling" && session && (
                    <>
                      <PaymentSection step={4} value={paymentMethod} onChange={setPaymentMethod} currency={currency} locked>
                        {flowError && (
                          <p role="alert" className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                            {flowError}
                          </p>
                        )}
                        {session.payment.provider === "stripe" ? (
                          <StripePaymentFlow
                            publishableKey={session.payment.publishableKey}
                            clientSecret={session.payment.clientSecret}
                            returnUrl={`${window.location.origin}/bestill?offer=${encodeURIComponent(offer.id)}&session=${encodeURIComponent(session.publicId)}`}
                            payLabel={t("co.pay", { amount: formatMinor(session.breakdown.totalAmountMinor, session.breakdown.currency) })}
                            disabled={offerExpired}
                            onSucceeded={onStripeSucceeded}
                          />
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-4">
                            <p className="text-sm font-semibold">{t("co.demo.title")}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{t("co.demo.body")}</p>
                            <button
                              type="button"
                              onClick={onDemoConfirm}
                              disabled={confirmDemo.isPending}
                              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-night bg-white px-6 text-sm font-bold text-night hover:bg-muted disabled:opacity-60"
                            >
                              {confirmDemo.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                              {t("co.demo.title")}
                            </button>
                          </div>
                        )}
                      </PaymentSection>
                      <button type="button" onClick={editDetails} className="min-h-11 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
                        {t("co.editdetails")}
                      </button>
                    </>
                  )}

                  {/* Steg 5: Bekreftelse / venting */}
                  {step === "bekreft" && (
                    <section className={stepCls} aria-live="polite" aria-busy={!status.data || !TERMINAL.has(status.data.status)}>
                      <h2 className="mb-1 flex items-center gap-2.5 font-display text-2xl">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">5</span>
                        {t("co.step.confirm")}
                      </h2>
                      {flowError && (
                        <p role="alert" className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                          {flowError}
                        </p>
                      )}
                      {status.data?.status === "price_changed" ? (
                        <PriceChangedPanel
                          oldMinor={session?.breakdown.totalAmountMinor ?? null}
                          newMinor={status.data.breakdown?.totalAmountMinor ?? null}
                          currency={status.data.breakdown?.currency ?? currency}
                          onContinue={retryWithNewPrice}
                          onSearch={() => navigate(`/sok${searchCtx}`)}
                        />
                      ) : status.data && (status.data.status === "failed" || status.data.status === "expired" || status.data.status === "cancelled") ? (
                        <ErrorPanel
                          code={(statusErrCode as AppCode | null) ?? (status.data.status === "expired" ? "OFFER_EXPIRED" : "SUPPLIER_REJECTED")}
                          message={status.data.errorMessage || humanMessage({ data: { appCode: statusErrCode } }, t("co.bookingfailed"))}
                          onRetry={() => startSession({ newKey: true })}
                          onSearch={() => navigate(`/sok${searchCtx}`)}
                        />
                      ) : pollTimedOut ? (
                        <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-5 text-sm">
                          <p className="flex items-center gap-2 font-semibold">
                            <TimerReset className="h-4 w-4" aria-hidden="true" /> {t("co.slow.title")}
                          </p>
                          <p className="mt-2 text-muted-foreground">{t("co.slow.body", { email: contact.email || t("co.youraddress") })}</p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button type="button" onClick={() => { setPollStartedAt(Date.now()); status.refetch(); }} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
                              {t("co.checkagain")}
                            </button>
                            <button type="button" onClick={() => navigate("/reise")} className="min-h-11 rounded-full border hairline px-5 text-sm font-medium">
                              {t("co.gomytrip")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-5">
                          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                          <div className="text-sm">
                            <p className="font-semibold">
                              {status.data?.attemptState === "BOOKING_PROCESSING" || status.data?.status === "authorized"
                                ? t("co.booking")
                                : t("co.confirmingpayment")}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {t("co.wait")}
                            </p>
                            {status.data?.bookingReference && (
                              <p className="mt-2 flex items-center gap-1.5 text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("co.ref", { ref: status.data.bookingReference })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </div>

                {/* ── Prissammendrag ── */}
                <aside className="lg:sticky lg:top-24">
                  <div className="rounded-3xl border hairline bg-card p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-2xl">{t("common.price")}</h2>
                      {Number.isFinite(remainingMs) && (
                        <p
                          className={cn("rounded-full px-3 py-1 text-xs font-semibold tabular-nums", remainingMs < 120_000 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}
                          aria-live={remainingMs < 120_000 ? "polite" : "off"}
                        >
                          {t("co.validfor", { time: formatCountdown(remainingMs) })}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 space-y-2.5 text-sm">
                      <Row
                        muted
                        label={(["adult", "child", "infant_without_seat"] as const)
                          .map((t) => ({ t, n: offer.passengers.filter((p) => p.type === t).length }))
                          .filter(({ n }) => n > 0)
                          .map(({ t: type, n }) => `${n} × ${paxLabel(type).toLowerCase()}`)
                          .join(" + ")}
                        value={formatMinor(breakdown?.supplierAmountMinor ?? supplierMinor, currency)}
                      />
                      {(breakdown ? breakdown.servicesAmountMinor > 0 : totalBags > 0) && (
                        <Row muted label={t("co.extrabags", { count: totalBags })} value={formatMinor(breakdown?.servicesAmountMinor ?? totalBags * bagPriceMinor, currency)} />
                      )}
                      <Row muted label={breakdown ? t("common.fee") : t("co.fee.approx")} value={formatMinor(breakdown?.serviceFeeAmountMinor ?? previewFee, currency)} />
                      {breakdown && breakdown.bonusUsedMinor > 0 && (
                        <div className="flex justify-between font-semibold text-emerald-700">
                          <span>{t("common.bonusused")}</span>
                          <span>−{formatMinor(breakdown.bonusUsedMinor, currency)}</span>
                        </div>
                      )}
                      <Row strong label={breakdown ? t("common.total") : t("co.total.est")} value={formatMinor(displayTotalMinor, currency)} />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {breakdown
                        ? t("co.price.final")
                        : t("co.price.est")}
                    </p>
                    {serviceStatus.data && !serviceStatus.data.instantBookingEnabled && (
                      <p role="alert" className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
                        {t("co.closed")}
                      </p>
                    )}
                    <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t("co.issuedby", { name: offer.owner.name, email: contact.email || t("co.youremail") })}
                    </p>
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobil bunnlinje — BottomNav er skjult på /bestill */}
      {offer && !offerExpired && step !== "bekreft" && step !== "betaling" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/97 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{breakdown ? t("common.total") : t("co.total.est")}</p>
              <p className="text-lg font-extrabold leading-none tracking-tight text-night">{formatMinor(displayTotalMinor, currency)}</p>
            </div>
            {step === "tilvalg" ? (
              <button
                onClick={() => startSession()}
                disabled={createSession.isPending}
                className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 disabled:opacity-60"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                {createSession.isPending ? t("co.confirming") : t("co.topay")}
              </button>
            ) : (
              <button onClick={() => goNext(step)} className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25">
                {t("common.next")}
              </button>
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

// ─── Paneler ────────────────────────────────────────────────────────────────

function ExpiredPanel({
  searchCtx,
  recovery,
  onStart,
  oldOffer,
  onContinue,
  onHome,
  onSearch,
}: {
  searchCtx: string;
  recovery: null | { status: "searching" | "found" | "none"; offer?: Offer };
  onStart: () => void;
  oldOffer: Offer | null;
  onContinue: (o: Offer) => void;
  onHome: () => void;
  onSearch: () => void;
}) {
  const t = useT();
  useEffect(() => {
    if (!recovery && searchCtx) onStart();
  }, [recovery, searchCtx, onStart]);
  const diff = recovery?.offer && oldOffer ? toMinor(recovery.offer.totalAmount, recovery.offer.totalCurrency) - toMinor(oldOffer.totalAmount, oldOffer.totalCurrency) : 0;
  return (
    <div role="alert" className="mt-8 rounded-3xl border border-primary/40 bg-card p-8 text-center">
      <Info className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
      <p className="mt-4 font-display text-2xl">{t("co.exp.title")}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("co.exp.body")}</p>
      <div className="mt-6">
        {recovery?.status === "searching" && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("co.exp.searching")}
          </p>
        )}
        {recovery?.status === "found" && recovery.offer && (
          <div className="mx-auto max-w-sm rounded-2xl bg-muted/60 p-4 text-sm">
            <p>
              {t("co.exp.found")} <b>{formatMinor(toMinor(recovery.offer.totalAmount, recovery.offer.totalCurrency), recovery.offer.totalCurrency)}</b>
              {diff !== 0 && (
                <span className={diff > 0 ? "text-primary" : "text-emerald-700"}>
                  {" "}
                  ({diff > 0 ? "+" : "−"}
                  {formatMinor(Math.abs(diff), recovery.offer.totalCurrency)} {diff > 0 ? t("co.exp.dearer") : t("co.exp.cheaper")})
                </span>
              )}{" "}
              <span className="text-muted-foreground">{t("co.exp.exclfee")}</span>
            </p>
            <button onClick={() => onContinue(recovery.offer!)} className="mt-3 min-h-11 w-full rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
              {t("co.exp.continue")}
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {searchCtx && (
            <button onClick={onSearch} className="min-h-11 rounded-full border hairline px-6 text-sm font-medium hover:border-foreground/25">
              {t("co.exp.samesearch")}
            </button>
          )}
          <button onClick={onHome} className="min-h-11 rounded-full border hairline px-6 text-sm font-medium hover:border-foreground/25">
            {t("co.exp.restart")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ code, message, onRetry, onSearch }: { code: AppCode | null; message: string; onRetry: () => void; onSearch: () => void }) {
  const t = useT();
  const reSearchCodes: (AppCode | null)[] = ["OFFER_EXPIRED", "OFFER_NOT_FOUND", "PRICE_CHANGED"];
  const retryCodes: (AppCode | null)[] = ["SUPPLIER_UNAVAILABLE", "SUPPLIER_TIMEOUT", "PAYMENT_FAILED", "PAYMENT_REQUIRED", "CONFLICT", "INTERNAL", null];
  return (
    <div role="alert" className="rounded-3xl border border-primary/40 bg-primary/5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" /> {message}
      </p>
      {code === "PAYMENT_FAILED" && <p className="mt-1 text-xs text-muted-foreground">{t("co.err.nocharge")}</p>}
      {code === "BOOKING_CLOSED" && <p className="mt-1 text-xs text-muted-foreground">{t("co.err.callus")}</p>}
      {code === "PRICE_CHANGED" && <p className="mt-1 text-xs text-muted-foreground">{t("co.err.newprice")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {code === "PRICE_CHANGED" && (
          <button onClick={onRetry} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
            {t("co.err.continuenew")}
          </button>
        )}
        {reSearchCodes.includes(code) && (
          <button onClick={onSearch} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
            {t("common.searchagain")}
          </button>
        )}
        {retryCodes.includes(code) && (
          <button onClick={onRetry} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
            {t("common.retry")}
          </button>
        )}
        {(code === "BOOKING_CLOSED" || code === "SUPPLIER_REJECTED" || code === "PAYMENT_NOT_CONFIGURED") && (
          <a href="/hjelp" className="min-h-11 rounded-full border hairline px-5 py-3 text-sm font-medium">
            {t("common.contactus")}
          </a>
        )}
      </div>
    </div>
  );
}

function PriceChangedPanel({ oldMinor, newMinor, currency, onContinue, onSearch }: { oldMinor: number | null; newMinor: number | null; currency: string; onContinue: () => void; onSearch: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="mt-4 rounded-3xl border border-primary/40 bg-primary/5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" /> {t("co.pc.title")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("co.pc.body")}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("co.pc.old")}</p>
          <p className="font-bold line-through">{oldMinor != null ? formatMinor(oldMinor, currency) : "—"}</p>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-primary/40">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("co.pc.new")}</p>
          <p className="font-bold text-night">{newMinor != null ? formatMinor(newMinor, currency) : t("co.pc.fetching")}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onContinue} className="min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
          {t("co.err.continuenew")}
        </button>
        <button onClick={onSearch} className="min-h-11 rounded-full border hairline px-5 text-sm font-medium">
          {t("common.searchagain")}
        </button>
      </div>
    </div>
  );
}
