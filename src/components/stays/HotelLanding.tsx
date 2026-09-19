import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CalendarDays, CircleHelp, Coffee, FileText, MapPin, Users, type LucideIcon } from "lucide-react";
import Icon from "@/components/app/Icon";
import { HotelSearchForm } from "@/components/stays/StaySearchForms";
import { HOTEL_PREFS, prefLabelKey, type HotelPref, type HotelSearchValues } from "@/components/stays/stayLinks";
import { photoSrc } from "@/content/photos";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Hotell før søk (godkjent design, ref 5): «Bo godt. Gjør mindre.»
 *
 * Valgene under «Hva er viktig for deg?» er ikke pynt: de følger med i
 * søket og blir startfiltre i resultatlisten (frokost, fleksible vilkår),
 * sortering (sentralt) og reisende (familierom gir et barn i skjemaet).
 */
const PREF_ICON: Record<HotelPref, LucideIcon> = { frokost: Coffee, sentralt: MapPin, familie: Users, fleks: CalendarDays };

export function HotelLanding({ initial }: { initial?: Partial<HotelSearchValues> }) {
  const t = useT();
  const [prefs, setPrefs] = useState<HotelPref[]>(initial?.prefs ?? []);
  const togglePref = (p: HotelPref) => setPrefs((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const family = prefs.includes("familie");

  return (
    <section aria-labelledby="hl-title" className="lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-12">
      <div className="min-w-0">
        <p className="inline-flex min-h-8 items-center rounded-full bg-sunny px-3 text-[13px] font-bold uppercase tracking-[0.14em] text-sunny-ink">{t("hl.eyebrow")}</p>
        <h1 id="hl-title" className="t-h1 mt-3 max-w-[12ch] text-[40px] leading-[1.05] sm:text-[48px]">{t("hl.title")}</h1>
        <p className="t-lead mt-2 text-muted-foreground">{t("hl.sub")}</p>
        <img src={photoSrc("hotel-terrace")} srcSet={`/photos/hotel-terrace-640.jpg 640w, /photos/hotel-terrace.jpg 1280w`} sizes="(max-width: 640px) 100vw, 720px" alt={t("hl.photo.alt")} className="mt-5 aspect-[5/3] w-full rounded-2xl object-cover" loading="eager" decoding="async" />
        <h2 className="t-h1 mt-6 text-[34px] sm:text-[38px]">{t("hl.h2")}</h2>
        <p className="mt-1 text-[20px] text-muted-foreground sm:text-[18px]">{t("hl.h2sub")}</p>
      </div>

      <div className="mt-8 min-w-0 lg:mt-0">
        <h2 className="text-[22px] font-bold">{t("hl.prefs")}</h2>
        <div role="group" aria-label={t("hl.prefs")} className="mt-3 grid grid-cols-2 gap-3">
          {HOTEL_PREFS.map((p) => {
            const on = prefs.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => togglePref(p)}
                className={cn(
                  "press inline-flex min-h-[64px] items-center gap-3 rounded-2xl border px-4 text-left text-[17px] font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-14 sm:px-5",
                  on ? "border-petrol bg-petrol text-white" : "border-border bg-card text-foreground hover:border-foreground/40",
                )}
              >
                <Icon icon={PREF_ICON[p]} size={24} strokeWidth={1.75} className="shrink-0" />
                {t(prefLabelKey(p))}
              </button>
            );
          })}
        </div>

        <p className="mt-6 flex items-center gap-3 text-[19px] font-semibold text-accent-foreground sm:text-[17px]"><Icon icon={MapPin} size={24} /> {t("hl.pickdest")}</p>
        <div className="card-soft mt-3 p-3 sm:p-4">
          <HotelSearchForm key={family ? "fam" : "std"} compact submitLabel={t("hl.find")} initial={{ ...initial, prefs, childAges: initial?.childAges ?? (family ? [8] : undefined), adults: initial?.adults ?? 2 }} />
        </div>

        <div className="mt-8 rounded-2xl bg-sky-soft p-6">
          <h2 className="text-[24px] font-bold leading-tight sm:text-[22px]">{t("hl.more.title")}</h2>
          <ul className="mt-4 space-y-3 text-[19px] sm:text-[17px]">
            <li className="flex items-center gap-4"><Icon icon={Coffee} size={24} strokeWidth={1.75} className="shrink-0" /> {t("hl.more.q1")}</li>
            <li className="flex items-center gap-4"><Icon icon={FileText} size={24} strokeWidth={1.75} className="shrink-0" /> {t("hl.more.q2")}</li>
            <li className="flex items-center gap-4"><Icon icon={CircleHelp} size={24} strokeWidth={1.75} className="shrink-0" /> {t("hl.more.q3")}</li>
          </ul>
          <Link to="/journal/hotell-slik-leser-du-prisen" className="mt-5 inline-flex min-h-11 items-center gap-2 text-[19px] font-semibold text-accent-foreground hover:underline sm:text-[17px]">
            {t("hl.more.cta")} <Icon icon={ArrowRight} size={24} />
          </Link>
        </div>
      </div>
    </section>
  );
}
