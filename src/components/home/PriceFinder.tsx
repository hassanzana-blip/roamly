import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, BedDouble, Luggage, PlaneTakeoff, Wallet } from "lucide-react";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { hotelSearchHref } from "@/components/stays/stayLinks";
import { ALL_DESTINATIONS } from "@/content/discover";
import { AIRPORTS } from "@contracts/airports";
import { useAccountHub } from "@/lib/useAccount";
import { datesFor, type WhenKey } from "@/lib/tripDates";
import { formatDayMonth } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Prisfinneren.
 *
 * Dette er ikke en tilbudsvegg. Vi har ingen leverandør som gir oss dagspriser
 * eller «fra»-priser uten et ekte søk, så vi later ikke som: her setter man
 * rammene, og HelloSky gjør søket med dem. Hver kontroll her endrer faktisk
 * resultatet – budsjettet blir et pristak i listen, bagasjekravet et filter,
 * «bare direktefly» går med til leverandøren. Ingen bryter som ikke virker.
 */

/** Norske avreiseflyplasser, hentet fra det ekte flyplassregisteret. */
const NORWEGIAN_ORIGINS = AIRPORTS.filter((a) => a.countryCode === "NO").sort((a, b) => a.city.localeCompare(b.city, "nb"));

export default function PriceFinder() {
  const t = useT();
  const navigate = useNavigate();
  const hub = useAccountHub();
  const homeIata = hub.data?.profile.homeAirports?.[0];

  const [origin, setOrigin] = useState(() => homeIata ?? "OSL");
  const [destination, setDestination] = useState("");
  const [when, setWhen] = useState<WhenKey>("weekend");
  const [nights, setNights] = useState(2);
  const [budget, setBudget] = useState("");
  const [directOnly, setDirectOnly] = useState(false);
  const [needBaggage, setNeedBaggage] = useState(false);

  const destinations = useMemo(() => [...ALL_DESTINATIONS].sort((a, b) => a.city.localeCompare(b.city, "nb")), []);
  const dest = destinations.find((d) => d.id === destination);
  const { depart, ret } = useMemo(() => datesFor(when, nights), [when, nights]);
  const budgetNumber = Number(budget.replace(/\s/g, ""));
  const budgetOk = budget.trim() === "" || (Number.isFinite(budgetNumber) && budgetNumber > 0);

  const flightHref = () => {
    const q = new URLSearchParams({
      from: origin,
      to: dest!.iata,
      depart,
      ret,
      adults: "1",
      children: "0",
      infants: "0",
      cabin: "economy",
    });
    if (budgetOk && budgetNumber > 0) q.set("maxpris", String(Math.round(budgetNumber)));
    if (directOnly) q.set("direct", "1");
    if (needBaggage) q.set("bagasje", "1");
    return `/sok?${q.toString()}`;
  };

  const NIGHTS = [2, 3, 5, 7, 10, 14];
  const WHENS: { key: WhenKey; label: string }[] = [
    { key: "weekend", label: t("pf.when.weekend") },
    { key: "month", label: t("pf.when.month") },
    { key: "quarter", label: t("pf.when.quarter") },
  ];
  const field = "h-12 w-full rounded-xl border border-input bg-card px-3 text-[15px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <section aria-labelledby="pf-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="eyebrow">{t("pf.eyebrow")}</p>
      <h2 id="pf-title" className="t-h2 mt-1.5">
        {t("pf.title")}
      </h2>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{t("pf.sub")}</p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dest && budgetOk) navigate(flightHref());
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block">
            <label htmlFor="pf-from" className="mb-1.5 block text-[13px] font-semibold text-foreground">{t("pf.from")}</label>
            <select id="pf-from" value={origin} onChange={(e) => setOrigin(e.target.value)} className={field}>
              {NORWEGIAN_ORIGINS.map((a) => (
                <option key={a.iata} value={a.iata}>
                  {a.city} ({a.iata})
                </option>
              ))}
            </select>
          </div>
          <div className="block">
            <label htmlFor="pf-to" className="mb-1.5 block text-[13px] font-semibold text-foreground">{t("pf.to")}</label>
            <select id="pf-to" required value={destination} onChange={(e) => setDestination(e.target.value)} className={field}>
              <option value="">{t("pf.to.choose")}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.city}, {d.country}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-foreground">{t("pf.when")}</legend>
          <div className="flex flex-wrap gap-2">
            {WHENS.map((w) => (
              <Chip key={w.key} selected={when === w.key} onClick={() => setWhen(w.key)}>
                {w.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-foreground">{t("pf.nights")}</legend>
          <div className="flex flex-wrap gap-2">
            {NIGHTS.map((n) => (
              <Chip key={n} selected={nights === n} onClick={() => setNights(n)}>
                {t("ht.stay.nights", { count: n })}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("pf.dates", { depart: formatDayMonth(depart), ret: formatDayMonth(ret) })}
          </p>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block">
            <label htmlFor="pf-budget" className="mb-1.5 block text-[13px] font-semibold text-foreground">{t("pf.budget")}</label>
            <span className="relative block">
              <Input
                id="pf-budget"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={t("pf.budget.ph")}
                aria-invalid={!budgetOk}
                aria-describedby="pf-budget-note"
                className="h-12 pr-10 text-[15px]"
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-muted-foreground">
                kr
              </span>
            </span>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <Chip selected={directOnly} onClick={() => setDirectOnly((v) => !v)} className="justify-start" icon={<PlaneTakeoff aria-hidden="true" />}>
              {t("pf.direct")}
            </Chip>
            <Chip selected={needBaggage} onClick={() => setNeedBaggage((v) => !v)} className="justify-start" icon={<Luggage aria-hidden="true" />}>
              {t("pf.baggage")}
            </Chip>
          </div>
        </div>

        <p id="pf-budget-note" className={cn("text-[13px]", budgetOk ? "text-muted-foreground" : "text-destructive")}>
          {budgetOk ? t("pf.budget.note") : t("pf.budget.invalid")}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={!dest || !budgetOk} className="h-[52px] rounded-xl text-[17px] font-bold sm:min-w-56">
            <Icon icon={Wallet} size={20} /> {t("pf.submit")}
          </Button>
          {dest && (
            <Button asChild variant="outline" size="lg" className="h-[52px] rounded-xl text-[16px] font-semibold">
              <a href={hotelSearchHref({ dest: "", place: dest.city, checkin: depart, checkout: ret, adults: 2, rooms: 1 })}>
                <Icon icon={BedDouble} size={20} /> {t("pf.hotels", { city: dest.city })} <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
