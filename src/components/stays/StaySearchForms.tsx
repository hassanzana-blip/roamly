import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BedDouble, CalendarDays, CarFront, Search, Users } from "lucide-react";
import PlaceField, { type PlaceOption } from "./PlaceField";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { carSearchHref, DEFAULT_CAR_HOUR, hotelSearchHref, hourLabel, MAX_CHILDREN, type CarSearchValues, type HotelSearchValues } from "./stayLinks";

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

function useDebounced(value: string, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const fieldCls = "flex h-16 min-w-0 items-center gap-3 rounded-xl border border-input bg-card px-4 transition-[border-color,box-shadow] duration-fast focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30";
const labelCls = "block text-xs font-medium text-muted-foreground";
const inputCls = "block w-full bg-transparent text-base font-semibold leading-tight text-foreground outline-none";

function DateInput({ label, value, min, onChange, hour, hourLabelText, onHour }: { label: string; value: string; min?: string; onChange: (v: string) => void; hour?: number; hourLabelText?: string; onHour?: (h: number) => void }) {
  return (
    <div className={fieldCls}>
      <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 gap-2">
        <label className="min-w-0 flex-1">
          <span className={labelCls}>{label}</span>
          <input type="date" value={value} min={min} onChange={(e) => onChange(e.target.value)} className={inputCls} required />
        </label>
        {onHour && hour != null && (
          <label className="w-[5.5rem] shrink-0">
            <span className={labelCls}>{hourLabelText}</span>
            <select value={hour} onChange={(e) => onHour(Number(e.target.value))} className={cn(inputCls, "tabular")}>
              {Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
        )}
      </span>
    </div>
  );
}



/** Hotellsøk: sted (leverandørens forslag), datoer, gjester og rom. */
export function HotelSearchForm({ initial, compact, onSubmitted }: { initial?: Partial<HotelSearchValues>; compact?: boolean; onSubmitted?: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [text, setText] = useState(initial?.place ?? "");
  const [place, setPlace] = useState<PlaceOption | null>(initial?.dest ? { id: initial.dest, label: initial.place ?? "" } : null);
  const [checkin, setCheckin] = useState(initial?.checkin ?? inDays(30));
  const [checkout, setCheckout] = useState(initial?.checkout ?? inDays(33));
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [rooms, setRooms] = useState(initial?.rooms ?? 1);
  const [childAges, setChildAges] = useState<number[]>(initial?.childAges ?? []);
  const [touched, setTouched] = useState(false);
  const setChildCount = (n: number) => setChildAges((prev) => (n <= prev.length ? prev.slice(0, n) : [...prev, ...Array.from({ length: n - prev.length }, () => 8)]));
  const q = useDebounced(text);
  const status = trpc.hotels.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const enabled = status.data?.enabled === true;
  const places = trpc.hotels.places.useQuery({ query: q }, { enabled: enabled && q.trim().length >= 2 && !place, staleTime: 60 * 60_000, retry: false });
  const options = useMemo<PlaceOption[]>(() => (places.data ?? []).map((p) => ({ id: p.key, label: p.name, sublabel: p.fullName && p.fullName !== p.name ? p.fullName : undefined })), [places.data]);
  const valid = text.trim().length >= 2 && checkin && checkout > checkin && (!enabled || place);

  return (
    <form
      noValidate
      aria-label={t("ht.search")}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!valid) return;
        onSubmitted?.();
        navigate(hotelSearchHref({ dest: place?.id ?? "", place: place?.label ?? text.trim(), checkin, checkout, adults, rooms, childAges }));
      }}
      className="space-y-3"
    >
      <div className={cn("grid gap-2 md:grid-cols-2", compact ? "xl:grid-cols-[1.6fr_1fr_1fr_1.2fr]" : "lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]")}>
        <PlaceField
          label={t("ht.where")}
          placeholder={t("home.search.place.hotel.ph")}
          icon={<BedDouble className="size-5" aria-hidden="true" />}
          text={text}
          onText={setText}
          value={place}
          onChange={setPlace}
          options={options}
          loading={places.isLoading}
          invalid={touched && !valid}
        />
        <DateInput label={t("ht.checkin")} value={checkin} min={inDays(0)} onChange={(v) => { setCheckin(v); if (checkout <= v) setCheckout(new Date(Date.parse(v) + 86_400_000).toISOString().slice(0, 10)); }} />
        <DateInput label={t("ht.checkout")} value={checkout} min={checkin} onChange={setCheckout} />
        <label className={fieldCls}>
          <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className={labelCls}>{t("ht.guests")}</span>
            <span className="flex min-w-0 gap-2">
              <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={cn(inputCls, "min-w-0 flex-1 truncate")} aria-label={t("home.search.adults")}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{t("ht.adults", { count: n })}</option>)}
              </select>
              <select value={childAges.length} onChange={(e) => setChildCount(Number(e.target.value))} className={cn(inputCls, "min-w-0 flex-1 truncate")} aria-label={t("home.search.children")}>
                {Array.from({ length: MAX_CHILDREN + 1 }, (_, n) => n).map((n) => (
                  <option key={n} value={n}>{n === 0 ? t("ht.children.none") : n === 1 ? t("ht.children.one") : t("ht.children", { count: n })}</option>
                ))}
              </select>
              <select value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className={cn(inputCls, "min-w-0 flex-1 truncate")} aria-label={t("home.search.rooms")}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{t("ht.rooms", { count: n })}</option>)}
              </select>
            </span>
          </span>
        </label>
      </div>
      {childAges.length > 0 && (
        <fieldset className="rounded-xl border border-input bg-card px-4 py-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">{t("ht.child.age.hint")}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {childAges.map((age, i) => (
              <label key={i} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                <span className="text-muted-foreground">{t("ht.child.age", { n: i + 1 })}</span>
                <select value={age} onChange={(e) => setChildAges((prev) => prev.map((a, ai) => (ai === i ? Number(e.target.value) : a)))} className="bg-transparent font-semibold outline-none" aria-label={t("ht.child.age", { n: i + 1 })}>
                  {Array.from({ length: 18 }, (_, n) => n).map((n) => <option key={n} value={n}>{n === 0 ? t("ht.child.under1") : t("ht.child.years", { n })}</option>)}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="t-caption">{t("home.search.meta.note")}</p>
        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto sm:min-w-52">
          <Search /> {t("ht.search")}
        </Button>
      </div>
    </form>
  );
}



/** Leiebilsøk: hentested (flyplass eller by), hente- og leveringsdato. */
export function CarSearchForm({ initial, compact, onSubmitted }: { initial?: Partial<CarSearchValues>; compact?: boolean; onSubmitted?: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [text, setText] = useState(initial?.place ?? "");
  const [place, setPlace] = useState<PlaceOption | null>(initial?.value && initial.type ? { id: `${initial.type}:${initial.value}`, label: initial.place ?? "" } : null);
  const [pickup, setPickup] = useState(initial?.pickup ?? inDays(30));
  const [dropoff, setDropoff] = useState(initial?.dropoff ?? inDays(33));
  const [pickupHour, setPickupHour] = useState(initial?.pickupHour ?? DEFAULT_CAR_HOUR);
  const [dropoffHour, setDropoffHour] = useState(initial?.dropoffHour ?? DEFAULT_CAR_HOUR);
  // Enveisleie: eget leveringssted med egne forslag fra leverandøren.
  const [otherDropoff, setOtherDropoff] = useState(Boolean(initial?.dropoffValue));
  const [dropText, setDropText] = useState(initial?.dropoffPlace ?? "");
  const [dropPlace, setDropPlace] = useState<PlaceOption | null>(initial?.dropoffValue && initial.dropoffType ? { id: `${initial.dropoffType}:${initial.dropoffValue}`, label: initial.dropoffPlace ?? "" } : null);
  const [touched, setTouched] = useState(false);
  const q = useDebounced(text);
  const dq = useDebounced(dropText);
  const status = trpc.cars.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const enabled = status.data?.enabled === true;
  const toOptions = (list: { type: string; value: string; name: string; fullName?: string }[] | undefined): PlaceOption[] =>
    (list ?? []).map((p) => ({ id: `${p.type}:${p.value}`, label: p.type === "airport" ? `${p.name} (${p.value})` : p.name, sublabel: p.fullName && p.fullName !== p.name ? p.fullName : undefined }));
  const places = trpc.cars.places.useQuery({ query: q }, { enabled: enabled && q.trim().length >= 2 && !place, staleTime: 60 * 60_000, retry: false });
  const dropPlaces = trpc.cars.places.useQuery({ query: dq }, { enabled: enabled && otherDropoff && dq.trim().length >= 2 && !dropPlace, staleTime: 60 * 60_000, retry: false });
  const options = useMemo<PlaceOption[]>(() => toOptions(places.data), [places.data]);
  const dropOptions = useMemo<PlaceOption[]>(() => toOptions(dropPlaces.data), [dropPlaces.data]);
  // KAYAK godtar «city» som id ELLER fritekst – uten forslag søker vi på bynavnet.
  const valid = text.trim().length >= 2 && pickup && dropoff >= pickup && (!otherDropoff || dropText.trim().length >= 2);

  return (
    <form
      noValidate
      aria-label={t("cr.search")}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!valid) return;
        const [type, ...rest] = (place?.id ?? "").split(":");
        const [dtype, ...drest] = (dropPlace?.id ?? "").split(":");
        const dropoffValues = otherDropoff
          ? dropPlace
            ? { dropoffType: (dtype as "airport" | "city") || "", dropoffValue: drest.join(":"), dropoffPlace: dropPlace.label }
            : { dropoffType: "city" as const, dropoffValue: dropText.trim().slice(0, 80), dropoffPlace: dropText.trim() }
          : {};
        const times = { pickupHour, dropoffHour, ...dropoffValues };
        onSubmitted?.();
        navigate(
          place
            ? carSearchHref({ type: (type as "airport" | "city") || "", value: rest.join(":"), place: place.label, pickup, dropoff, ...times })
            : carSearchHref({ type: "city", value: text.trim().slice(0, 80), place: text.trim(), pickup, dropoff, ...times }),
        );
      }}
      className="space-y-3"
    >
      <div className={cn("grid gap-2 md:grid-cols-2", compact ? "xl:grid-cols-[1.8fr_1fr_1fr]" : "lg:grid-cols-[1.8fr_1fr_1fr]")}>
        <PlaceField
          label={t("cr.where")}
          placeholder={t("home.search.place.car.ph")}
          icon={<CarFront className="size-5" aria-hidden="true" />}
          text={text}
          onText={setText}
          value={place}
          onChange={setPlace}
          options={options}
          loading={places.isLoading}
          invalid={touched && !valid}
        />
        <DateInput label={t("cr.pickup")} value={pickup} min={inDays(0)} onChange={(v) => { setPickup(v); if (dropoff < v) setDropoff(v); }} hour={pickupHour} hourLabelText={t("cr.pickup.time")} onHour={setPickupHour} />
        <DateInput label={t("cr.dropoff")} value={dropoff} min={pickup} onChange={setDropoff} hour={dropoffHour} hourLabelText={t("cr.dropoff.time")} onHour={setDropoffHour} />
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={otherDropoff} onChange={(e) => setOtherDropoff(e.target.checked)} className="size-4 accent-primary" />
        {t("cr.dropoff.other")}
      </label>
      {otherDropoff && (
        <PlaceField
          label={t("cr.dropoff.where")}
          placeholder={t("home.search.place.car.ph")}
          icon={<CarFront className="size-5" aria-hidden="true" />}
          text={dropText}
          onText={setDropText}
          value={dropPlace}
          onChange={setDropPlace}
          options={dropOptions}
          loading={dropPlaces.isLoading}
          invalid={touched && otherDropoff && dropText.trim().length < 2}
        />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="t-caption">{t("home.search.meta.note")}</p>
        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto sm:min-w-52">
          <Search /> {t("cr.search")}
        </Button>
      </div>
    </form>
  );
}
