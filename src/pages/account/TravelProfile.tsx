import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, X } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { Chip } from "@/components/account/AccountRow";
import { BaggageVisual } from "@/components/graphics";
import { searchAirports, airportByIata, type Airport } from "@contracts/airports";
import { ALL_DESTINATIONS } from "@/content/discover";
import { BAGGAGE_OPTIONS, CABIN_OPTIONS, COMPANION_OPTIONS, FLIGHT_PREF_OPTIONS, SEAT_OPTIONS, TASTE, TIMING_PREF_OPTIONS } from "@/content/travelProfile";
import { useCustomer } from "@/lib/useCustomer";
import { useTravelProfile } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";

/** Reiseprofil — hver del lagres for seg, med en gang. Ingen «Lagre»-knapp å glemme. */

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-display text-xl">{title}</h2>
      {sub ? <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Flyplassvelger: valgte som brikker med x, pluss et lite søk. */
export function AirportPicker({ value, onChange, max = 4, placeholder }: { value: string[]; onChange: (v: string[]) => void; max?: number; placeholder: string }) {
  const [q, setQ] = useState("");
  const t = useT();
  const results = q.trim().length >= 2 ? searchAirports(q, 6).filter((a) => !value.includes(a.iata)) : [];
  const add = (a: Airport) => {
    if (value.length >= max) return;
    onChange([...value, a.iata]);
    setQ("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((iata) => {
          const a = airportByIata(iata);
          return (
            <span key={iata} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foreground bg-foreground pl-3.5 pr-1.5 text-[14px] font-semibold text-background">
              {a?.city ?? iata} <span className="font-mono-label text-[10px] opacity-70">{iata}</span>
              <button type="button" onClick={() => onChange(value.filter((v) => v !== iata))} aria-label={t("tpf.remove", { name: a?.city ?? iata })} className="grid h-8 w-8 place-items-center rounded-md hover:bg-background/20">
                <Icon icon={X} size={14} />
              </button>
            </span>
          );
        })}
        {value.length === 0 && <span className="self-center text-[13px] text-muted-foreground">{t("tpf.none")}</span>}
      </div>
      {value.length < max && (
        <div className="relative mt-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lift">
              {results.map((a) => (
                <li key={a.iata}>
                  <button type="button" onClick={() => add(a)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[14px] hover:bg-muted">
                    <span><span className="font-semibold">{a.city}</span> <span className="text-muted-foreground">· {a.name}</span></span>
                    <span className="font-mono-label text-[10px] text-muted-foreground">{a.iata}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Reisemålsvelger: rutenett av små bilder, maks n. */
export function DestinationPicker({ value, onChange, max = 4 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const t = useT();
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (value.length < max) onChange([...value, id]);
  };
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {ALL_DESTINATIONS.map((d) => {
        const active = value.includes(d.id);
        const disabled = !active && value.length >= max;
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => toggle(d.id)}
              aria-pressed={active}
              disabled={disabled}
              aria-label={`${d.city}, ${d.country}`}
              className={cn("group relative block w-full overflow-hidden rounded-lg text-left outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40", active && "ring-2 ring-foreground ring-offset-2")}
            >
              <span className="block aspect-[4/3] bg-night">
                {d.image ? <img src={d.image} alt="" loading="lazy" decoding="async" width={640} height={480} className="h-full w-full object-cover" /> : null}
              </span>
              <span className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/85 to-transparent px-2 pb-1.5 pt-6 text-[12px] font-semibold text-white")}>
                {d.city}
              </span>
              {active && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Icon icon={Plus} size={14} className="rotate-45" /></span>}
            </button>
          </li>
        );
      })}
      <li className="sr-only">{t("tpf.add")}</li>
    </ul>
  );
}

export default function TravelProfilePage() {
  usePageMeta(PAGE_META.travelProfile);
  const t = useT();
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const { profile, update } = useTravelProfile();
  // Utkast mens man drar i en glidebryter; ellers vises det som er lagret.
  const [tasteDraft, setTasteDraft] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/profil/reiseprofil");
  }, [customer, isLoading, navigate]);

  if (!customer || !profile) return null;
  const p = profile;
  const taste: Record<string, number> = tasteDraft ?? (p.taste as Record<string, number>);
  const commitTaste = () => {
    if (tasteDraft) update.mutate({ taste: tasteDraft });
    setTasteDraft(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-3xl">
        <AppHeader title={t("tpf.title")} back as="h1" />
        <p className="mb-2 text-[14px] text-muted-foreground">{t("tpf.intro")}</p>
        <p className="mb-6 flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-slow" style={{ width: `${p.completeness}%` }} /></span>
          <span className="shrink-0 tabular">{t("tpf.completeness", { pct: p.completeness })}</span>
        </p>
        {update.isError && <p role="alert" className="mb-4 text-[13px] text-destructive">{humanMessage(update.error)}</p>}

        <Section title={t("tpf.airports")}>
          <AirportPicker value={p.homeAirports} onChange={(homeAirports) => update.mutate({ homeAirports })} placeholder={t("ob.airportsearch")} />
        </Section>

        <Section title={t("tpf.dests")}>
          <DestinationPicker value={p.favouriteDestinations} onChange={(favouriteDestinations) => update.mutate({ favouriteDestinations })} />
        </Section>

        <Section title={t("tpf.bags")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BAGGAGE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={p.baggagePreference === o.id}
                onClick={() => update.mutate({ baggagePreference: o.id })}
                className={cn("flex min-h-[88px] flex-col items-start justify-between rounded-lg border p-3 text-left transition-colors", p.baggagePreference === o.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40")}
              >
                <BaggageVisual kind={o.bags === 0 ? "cabin" : "checked"} count={o.bags === 0 ? 1 : o.bags} size={20} label={t(o.label)} className={p.baggagePreference === o.id ? "text-background" : undefined} />
                <span><span className="block text-[14px] font-semibold">{t(o.label)}</span><span className={cn("block text-[11px]", p.baggagePreference === o.id ? "text-background/70" : "text-muted-foreground")}>{t(o.sub)}</span></span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("tpf.company")}>
          <div className="flex flex-wrap gap-2">
            {COMPANION_OPTIONS.map((o) => <Chip key={o.id} active={p.companions === o.id} onClick={() => update.mutate({ companions: o.id })}>{t(o.label)}</Chip>)}
          </div>
        </Section>

        <Section title={t("tpf.cabin")}>
          <div className="flex flex-wrap gap-2">
            {CABIN_OPTIONS.map((o) => <Chip key={o.id} active={p.preferredCabin === o.id} onClick={() => update.mutate({ preferredCabin: o.id })}>{t(o.label)}</Chip>)}
          </div>
        </Section>

        <Section title={t("tpf.flight")}>
          <div className="flex flex-wrap gap-2">
            {FLIGHT_PREF_OPTIONS.map((o) => (
              <Chip key={o.id} active={Boolean(p.flightPrefs[o.id])} onClick={() => update.mutate({ flightPrefs: { ...p.flightPrefs, [o.id]: !p.flightPrefs[o.id] } })}>{t(o.label)}</Chip>
            ))}
          </div>
        </Section>

        <Section title={t("tpf.timing")}>
          <div className="flex flex-wrap gap-2">
            {TIMING_PREF_OPTIONS.map((o) => (
              <Chip key={o.id} active={Boolean(p.timingPrefs[o.id])} onClick={() => update.mutate({ timingPrefs: { ...p.timingPrefs, [o.id]: !p.timingPrefs[o.id] } })}>{t(o.label)}</Chip>
            ))}
          </div>
        </Section>

        <Section title={t("tpf.seat")}>
          <div className="flex flex-wrap gap-2">
            {SEAT_OPTIONS.map((o) => <Chip key={o.id} active={p.seatPreference === o.id} onClick={() => update.mutate({ seatPreference: o.id })}>{t(o.label)}</Chip>)}
          </div>
        </Section>

        <Section title={t("tpf.taste")} sub={t("tpf.tastesub")}>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {TASTE.map((d) => {
              const v = taste[d.id] ?? 0;
              return (
                <li key={d.id} className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg" aria-hidden="true">{d.emoji}</span>
                  <label htmlFor={`taste-${d.id}`} className="w-28 shrink-0 text-[14px] font-medium">{t(d.label)}</label>
                  <input
                    id={`taste-${d.id}`}
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={v}
                    onChange={(e) => setTasteDraft({ ...taste, [d.id]: Number(e.target.value) })}
                    onMouseUp={commitTaste}
                    onTouchEnd={commitTaste}
                    onKeyUp={commitTaste}
                    className="h-11 flex-1 accent-[hsl(var(--primary))]"
                  />
                  <span className="w-8 text-right text-[12px] tabular text-muted-foreground">{v}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      </AppShell>
    </div>
  );
}
