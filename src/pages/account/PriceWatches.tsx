import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Pause, Play, Plus, Trash2, TrendingDown } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import BottomSheet from "@/components/app/BottomSheet";
import Icon from "@/components/app/Icon";
import { EmptyState, PrimaryButton } from "@/components/app/primitives";
import { Chip, Toggle } from "@/components/account/AccountRow";
import AirportField from "@/components/search/AirportField";
import DateField from "@/components/search/DateField";
import { NoFlightsSpot } from "@/components/graphics";
import type { Airport } from "@contracts/airports";
import { airportByIata } from "@contracts/airports";
import { useCustomer } from "@/lib/useCustomer";
import { useTravelProfile } from "@/lib/useAccount";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { formatDateShort, formatMinor } from "@/lib/format";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";

type Watch = RouterOutputs["watch"]["list"][number];
const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-foreground/30 placeholder:text-muted-foreground/60";
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

function WatchRow({ w, onToggle, onDelete, busy }: { w: Watch; onToggle: () => void; onDelete: () => void; busy: boolean }) {
  const t = useT();
  const ended = w.dateTo < new Date().toISOString().slice(0, 10);
  const res = w.lastResult;
  const q = new URLSearchParams({ from: w.originIata, to: w.destinationIata, depart: res?.departDate ?? w.dateFrom, adults: String(w.adults), children: String(w.children), infants: String(w.infants), cabin: w.cabin });
  if (res?.returnDate) q.set("ret", res.returnDate);
  return (
    <li className={cn("rounded-xl border border-border bg-card p-4", (!w.active || ended) && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-accent-foreground"><Icon icon={TrendingDown} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-tight">{w.originCity} → {w.destinationCity}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {formatDateShort(w.dateFrom)} – {formatDateShort(w.dateTo)} · {t("pw.under", { price: formatMinor(w.maxPriceMinor, w.currency) })}
            {w.weekendsOnly ? ` · ${t("pw.weekends").split(" (")[0].toLowerCase()}` : ""}
            {w.maxStops !== null ? ` · ${w.maxStops === 0 ? t("pw.direct").toLowerCase() : t("pw.max1").toLowerCase() + " stopp"}` : ""}
            {w.minCheckedBags ? ` · ≥${w.minCheckedBags} kolli` : ""}
          </p>
          <p className="mt-2 text-[13px]">
            {ended ? (
              <span className="text-muted-foreground">{t("pw.ended")}</span>
            ) : res && res.live ? (
              <Link to={`/sok?${q.toString()}`} className="font-semibold text-success underline underline-offset-2">{t("pw.found", { price: formatMinor(res.priceMinor, res.currency), date: formatDateShort(res.departDate) })} · {t("pw.seeoffer")}</Link>
            ) : res ? (
              <span className="text-muted-foreground">{t("pw.foundtest")}</span>
            ) : w.lastCheckedAt ? (
              <span className="text-muted-foreground">{t("pw.notyet")} · {t("pw.checked", { date: formatDateShort(w.lastCheckedAt) })}</span>
            ) : (
              <span className="text-muted-foreground">{t("pw.unchecked")}</span>
            )}
          </p>
        </div>
      </div>
      {!ended && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider", w.active ? "bg-primary-soft text-accent-foreground" : "bg-muted text-muted-foreground")}>{w.active ? t("pw.active") : t("pw.paused")}</span>
          <span className="text-[12px] text-muted-foreground">· {t(`pw.${w.cadence}`)}</span>
          <span className="flex-1" />
          <button type="button" onClick={onToggle} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold hover:border-foreground/40 disabled:opacity-60"><Icon icon={w.active ? Pause : Play} size={14} /> {w.active ? t("pw.pause") : t("pw.resume")}</button>
          <button type="button" onClick={onDelete} disabled={busy} aria-label={t("pw.delete")} className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-60"><Icon icon={Trash2} size={16} /></button>
        </div>
      )}
    </li>
  );
}

export default function PriceWatches() {
  usePageMeta(PAGE_META.priceWatches);
  const t = useT();
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const { profile } = useTravelProfile();
  const utils = trpc.useUtils();
  const list = trpc.watch.list.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const invalidate = () => { utils.watch.list.invalidate(); utils.account.hub.invalidate(); };
  const create = trpc.watch.create.useMutation({ onSuccess: () => { invalidate(); setOpen(false); } });
  const update = trpc.watch.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.watch.remove.useMutation({ onSuccess: invalidate });

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/profil/prisovervaking");
  }, [customer, isLoading, navigate]);
  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-2xl">
        <AppHeader title={t("pw.title")} back as="h1" />
        <p className="mb-5 max-w-lg text-[14px] text-muted-foreground">{t("pw.intro")}</p>

        {list.data && list.data.length === 0 ? (
          <EmptyState illustration={<NoFlightsSpot />} title={t("pw.empty")} body={t("pw.emptysub")} action={<PrimaryButton icon={Plus} onClick={() => setOpen(true)} className="mt-2">{t("pw.new")}</PrimaryButton>} />
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {(list.data ?? []).map((w) => (
                <WatchRow key={w.id} w={w} busy={update.isPending || remove.isPending} onToggle={() => update.mutate({ id: w.id, active: !w.active })} onDelete={() => remove.mutate({ id: w.id })} />
              ))}
            </ul>
            <PrimaryButton icon={Plus} onClick={() => setOpen(true)} className="mt-5 w-full sm:w-auto">{t("pw.new")}</PrimaryButton>
          </>
        )}
        {(update.isError || remove.isError) && <p role="alert" className="mt-3 text-[13px] text-destructive">{humanMessage(update.error ?? remove.error)}</p>}
      </AppShell>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("pw.new")} snapPoints={[0.9]}>
        <CreateWatchForm key={profile ? "p" : "n"} profile={profile} pending={create.isPending} error={create.isError ? humanMessage(create.error) : null} onSubmit={(input) => create.mutate(input)} />
      </BottomSheet>
    </div>
  );
}

type Profile = ReturnType<typeof useTravelProfile>["profile"];
type CreateInput = Parameters<ReturnType<typeof trpc.watch.create.useMutation>["mutate"]>[0];

/** Skjemaet lever i et eget tre, så startverdiene kan hentes fra reiseprofilen uten effekter. */
function CreateWatchForm({ profile, pending, error, onSubmit }: { profile: Profile; pending: boolean; error: string | null; onSubmit: (input: CreateInput) => void }) {
  const t = useT();
  // Forhåndsutfylt fra reiseprofilen – hjemmeflyplass og bagasjevane.
  const [from, setFrom] = useState<Airport | null>(() => (profile?.homeAirports[0] ? (airportByIata(profile.homeAirports[0]) ?? null) : null));
  const [to, setTo] = useState<Airport | null>(null);
  const [dateFrom, setDateFrom] = useState(iso(14));
  const [dateTo, setDateTo] = useState(iso(60));
  const [weekends, setWeekends] = useState(false);
  const [nights, setNights] = useState("");
  const [maxPrice, setMaxPrice] = useState("5000");
  const [stops, setStops] = useState<null | 0 | 1>(null);
  const [bags, setBags] = useState<null | 1>(() => (profile?.baggagePreference && profile.baggagePreference !== "cabin_only" ? 1 : null));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cadence, setCadence] = useState<"immediate" | "daily" | "weekly">("daily");

  const submit = () => {
    if (!from || !to) return;
    const n = Number(nights);
    onSubmit({
      origin: from.iata,
      destination: to.iata,
      dateFrom,
      dateTo,
      weekendsOnly: weekends,
      nightsMin: n > 0 ? n : null,
      nightsMax: n > 0 ? n : null,
      maxPriceMinor: Math.round(Number(maxPrice) * 100),
      currency: "NOK",
      maxStops: stops,
      minCheckedBags: bags,
      adults,
      children,
      cabin: profile?.preferredCabin ?? "economy",
      cadence,
    });
  };

  return (
        <div className="space-y-5 pb-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <AirportField label={t("pw.from")} direction="from" value={from} exclude={to?.iata} onChange={setFrom} />
            <AirportField label={t("pw.to")} direction="to" value={to} exclude={from?.iata} onChange={setTo} />
          </div>
          <div>
            <p className="mb-1.5 eyebrow">{t("pw.period")}</p>
            <div className="grid grid-cols-2 gap-2">
              <DateField label={t("pw.datefrom")} value={dateFrom} min={iso(0)} onChange={(v) => { setDateFrom(v); if (dateTo < v) setDateTo(v); }} />
              <DateField label={t("pw.dateto")} value={dateTo} min={dateFrom} onChange={setDateTo} />
            </div>
            <label className="mt-3 flex min-h-11 items-center justify-between gap-3 text-[14px] font-medium">
              {t("pw.weekends")}
              <Toggle checked={weekends} onChange={setWeekends} label={t("pw.weekends")} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block eyebrow">{t("pw.nights")}</span>
              <input type="number" inputMode="numeric" min={1} max={30} value={nights} onChange={(e) => setNights(e.target.value)} placeholder={t("pw.nightsoneway")} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1.5 block eyebrow">{t("pw.maxprice")}</span>
              <div className="relative">
                <input type="number" inputMode="numeric" min={100} step={100} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={cn(inputCls, "pr-10")} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">kr</span>
              </div>
            </label>
          </div>
          <p className="-mt-3 text-[12px] text-muted-foreground">{t("pw.pricehint")}</p>
          <div>
            <p className="mb-1.5 eyebrow">{t("pw.stops")}</p>
            <div className="flex gap-2">
              <Chip active={stops === null} onClick={() => setStops(null)}>{t("pw.anystops")}</Chip>
              <Chip active={stops === 0} onClick={() => setStops(0)}>{t("pw.direct")}</Chip>
              <Chip active={stops === 1} onClick={() => setStops(1)}>{t("pw.max1")}</Chip>
            </div>
          </div>
          <div>
            <p className="mb-1.5 eyebrow">{t("pw.bags")}</p>
            <div className="flex gap-2">
              <Chip active={bags === null} onClick={() => setBags(null)}>{t("pw.anybags")}</Chip>
              <Chip active={bags === 1} onClick={() => setBags(1)}>1 kolli</Chip>
            </div>
          </div>
          <div>
            <p className="mb-1.5 eyebrow">{t("pw.pax")}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[12px] text-muted-foreground">{t("pw.adults")}</span><input type="number" min={1} max={9} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} className={inputCls} /></label>
              <label className="block"><span className="mb-1 block text-[12px] text-muted-foreground">{t("pw.children")}</span><input type="number" min={0} max={8} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))} className={inputCls} /></label>
            </div>
          </div>
          <div>
            <p className="mb-1.5 eyebrow">{t("pw.cadence")}</p>
            <div className="flex gap-2">
              {(["immediate", "daily", "weekly"] as const).map((c) => <Chip key={c} active={cadence === c} onClick={() => setCadence(c)}>{t(`pw.${c}`)}</Chip>)}
            </div>
          </div>
          {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
          <PrimaryButton onClick={submit} disabled={!from || !to || pending || Number(maxPrice) < 100} className="w-full">{t("pw.create")}</PrimaryButton>
        </div>
  );
}
