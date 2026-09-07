import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Icon from "@/components/app/Icon";
import { PrimaryButton } from "@/components/app/primitives";
import { SkipLink } from "@/components/app/AppShell";
import SkyMark from "@/components/brand/SkyMark";
import { Chip } from "@/components/account/AccountRow";
import { BaggageVisual } from "@/components/graphics";
import { AirportPicker, DestinationPicker } from "./TravelProfile";
import { airportByIata } from "@contracts/airports";
import { BAGGAGE_OPTIONS, COMPANION_OPTIONS, HOME_AIRPORT_SHORTCUTS, TASTE } from "@/content/travelProfile";
import { useCustomer } from "@/lib/useCustomer";
import { useTravelProfile } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/**
 * Velkommen — 30–60 sekunder etter kontoopprettelse. Fem spørsmål, alle
 * valgfrie, hopp over når som helst. Svarene går rett i reiseprofilen.
 */

type Step = "welcome" | "airport" | "dest" | "taste" | "bags" | "company" | "finish";
const STEPS: Step[] = ["welcome", "airport", "dest", "taste", "bags", "company", "finish"];

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export default function Onboarding() {
  usePageMeta(PAGE_META.onboarding);
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const { profile } = useTravelProfile();

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/velkommen", { replace: true });
  }, [customer, isLoading, navigate]);

  if (!customer || !profile) return null;
  return <OnboardingFlow customer={customer} profile={profile} />;
}

type Profile = NonNullable<ReturnType<typeof useTravelProfile>["profile"]>;

function OnboardingFlow({ customer, profile }: { customer: { firstName: string }; profile: Profile }) {
  const t = useT();
  const navigate = useNavigate();
  const { update } = useTravelProfile();
  const utils = trpc.useUtils();
  const finish = trpc.account.finishOnboarding.useMutation({ onSuccess: () => utils.account.invalidate() });

  // Startverdier fra det som eventuelt er lagret fra før — ingen effekter som skriver state.
  const [step, setStep] = useState<Step>("welcome");
  const [airports, setAirports] = useState<string[]>(() => profile.homeAirports);
  const [dests, setDests] = useState<string[]>(() => profile.favouriteDestinations);
  const [taste, setTaste] = useState<string[]>(() => Object.entries(profile.taste).filter(([, v]) => (v ?? 0) >= 60).map(([k]) => k));
  const [bags, setBags] = useState<(typeof BAGGAGE_OPTIONS)[number]["id"] | null>(profile.baggagePreference);
  const [company, setCompany] = useState<(typeof COMPANION_OPTIONS)[number]["id"] | null>(profile.companions);

  const idx = STEPS.indexOf(step);
  const total = STEPS.length - 2; // uten velkommen og ferdig
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]);
  const back = () => setStep(STEPS[Math.max(0, idx - 1)]);

  const save = async () => {
    await update.mutateAsync({
      homeAirports: airports,
      favouriteDestinations: dests,
      taste: Object.fromEntries(TASTE.map((d) => [d.id, taste.includes(d.id) ? 80 : 20])),
      baggagePreference: bags,
      companions: company,
    });
    await finish.mutateAsync({});
    setStep("finish");
  };
  const skip = () => {
    finish.mutate({ skipped: true });
    navigate("/profil", { replace: true });
  };

  const canContinue = step !== "taste" || taste.length >= 3;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <SkipLink />
      <header className="container-x flex items-center justify-between gap-3 py-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3">
          {idx > 0 && step !== "finish" ? (
            <button type="button" onClick={back} aria-label={t("common.back")} className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card"><Icon icon={ArrowLeft} size={20} /></button>
          ) : (
            <SkyMark className="h-8 w-8 text-foreground" />
          )}
          {idx > 0 && step !== "finish" && <span className="text-[12px] font-medium text-muted-foreground">{t("ob.step", { n: idx, total })}</span>}
        </div>
        {step !== "finish" && (
          <button type="button" onClick={skip} className="min-h-11 rounded-lg px-3 text-[14px] font-semibold text-muted-foreground hover:text-foreground">{t("ob.skip")}</button>
        )}
      </header>
      {idx > 0 && step !== "finish" && (
        <div className="container-x" aria-hidden="true">
          <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out" style={{ width: `${(idx / total) * 100}%` }} /></div>
        </div>
      )}

      <main id="main" tabIndex={-1} className="container-x flex flex-1 flex-col pb-28 pt-6 outline-none">
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait">
            <motion.section key={step} {...slide} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} className="mx-auto w-full max-w-2xl">
              {step === "welcome" && (
                <div className="py-8">
                  <h1 className="font-display text-[40px] leading-[1.02] sm:text-[52px]">{t("ob.welcome", { name: customer.firstName })}</h1>
                  <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">{t("ob.welcomesub")}</p>
                </div>
              )}
              {step === "airport" && (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl">{t("ob.airport")}</h1>
                  <p className="mt-2 text-[14px] text-muted-foreground">{t("ob.airportsub")}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {HOME_AIRPORT_SHORTCUTS.map((iata) => {
                      const a = airportByIata(iata);
                      if (!a) return null;
                      const on = airports.includes(iata);
                      return (
                        <Chip key={iata} active={on} onClick={() => setAirports((prev) => (on ? prev.filter((x) => x !== iata) : prev.length < 4 ? [...prev, iata] : prev))}>
                          {a.city} <span className={cn("font-mono-label text-[10px]", on ? "opacity-70" : "text-muted-foreground")}>{iata}</span>
                        </Chip>
                      );
                    })}
                  </div>
                  <div className="mt-5"><AirportPicker value={airports} onChange={setAirports} placeholder={t("ob.airportsearch")} /></div>
                </>
              )}
              {step === "dest" && (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl">{t("ob.dest")}</h1>
                  <p className="mt-2 text-[14px] text-muted-foreground">{t("ob.destsub")}</p>
                  <div className="mt-5"><DestinationPicker value={dests} onChange={setDests} /></div>
                </>
              )}
              {step === "taste" && (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl">{t("ob.taste")}</h1>
                  <p className="mt-2 text-[14px] text-muted-foreground">{t("ob.tastesub")}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {TASTE.map((d) => {
                      const on = taste.includes(d.id);
                      return (
                        <Chip key={d.id} active={on} onClick={() => setTaste((prev) => (on ? prev.filter((x) => x !== d.id) : [...prev, d.id]))}>
                          <span aria-hidden="true">{d.emoji}</span> {t(d.label)}
                        </Chip>
                      );
                    })}
                  </div>
                </>
              )}
              {step === "bags" && (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl">{t("ob.bags")}</h1>
                  <p className="mt-2 text-[14px] text-muted-foreground">{t("ob.bagssub")}</p>
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BAGGAGE_OPTIONS.map((o) => {
                      const on = bags === o.id;
                      return (
                        <button key={o.id} type="button" aria-pressed={on} onClick={() => setBags(o.id)} className={cn("flex min-h-[110px] flex-col items-start justify-between rounded-lg border p-3 text-left transition-colors", on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40")}>
                          <BaggageVisual kind={o.bags === 0 ? "cabin" : "checked"} count={o.bags === 0 ? 1 : o.bags} size={22} label={t(o.label)} className={on ? "text-background" : undefined} />
                          <span><span className="block text-[14px] font-semibold">{t(o.label)}</span><span className={cn("block text-[11px]", on ? "text-background/70" : "text-muted-foreground")}>{t(o.sub)}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {step === "company" && (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl">{t("ob.company")}</h1>
                  <p className="mt-2 text-[14px] text-muted-foreground">{t("ob.companysub")}</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {COMPANION_OPTIONS.map((o) => {
                      const on = company === o.id;
                      return (
                        <button key={o.id} type="button" aria-pressed={on} onClick={() => setCompany(o.id)} className={cn("flex min-h-[84px] items-center justify-between rounded-lg border px-4 text-left transition-colors", on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40")}>
                          <span><span className="block text-[16px] font-semibold">{t(o.label)}</span><span className={cn("block text-[12px]", on ? "text-background/70" : "text-muted-foreground")}>{t(o.sub)}</span></span>
                          {on && <Icon icon={Check} size={20} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {step === "finish" && (
                <div className="py-8">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><Icon icon={Check} size={28} /></span>
                  <h1 className="mt-6 font-display text-[40px] leading-[1.02] sm:text-[52px]">{t("ob.finish")}</h1>
                  <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">{t("ob.finishsub")}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link to="/" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground">{t("ob.tohome")} <Icon icon={ArrowRight} size={20} /></Link>
                    <Link to="/profil" className="inline-flex min-h-12 items-center rounded-lg border border-border bg-card px-5 text-[15px] font-semibold">{t("ob.toprofile")}</Link>
                  </div>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </MotionConfig>
      </main>

      {step !== "finish" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="container-x mx-auto flex max-w-2xl justify-end py-3">
            {step === "company" ? (
              <PrimaryButton onClick={save} disabled={update.isPending || finish.isPending} icon={Check} className="min-w-40">{t("ob.done")}</PrimaryButton>
            ) : (
              <PrimaryButton onClick={next} disabled={!canContinue} icon={ArrowRight} className="min-w-40">{t("ob.next")}</PrimaryButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
