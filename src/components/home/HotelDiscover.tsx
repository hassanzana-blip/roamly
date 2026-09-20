import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, BedDouble, Map as MapIcon } from "lucide-react";
import Icon from "@/components/app/Icon";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { hotelSearchHref } from "@/components/stays/stayLinks";
import { ALL_DESTINATIONS, imageSrcSet, type DiscoverDestination } from "@/content/discover";
import { airportByIata } from "@contracts/airports";
import { datesFor } from "@/lib/tripDates";
import { useT } from "@/lib/i18n";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

const DiscoveryMap = lazy(() => import("@/components/home/DiscoveryMap"));

/**
 * «Finn hotell til en god pris».
 *
 * Feltet er et ekte søk mot leverandørens stedsregister, ikke en knapp som ser
 * ut som et felt. Kartet er det samme MapLibre-kartet forsiden allerede
 * bruker, og det lastes først når noen ber om det – ett megabyte kartkode skal
 * ikke følge med på en telefon som bare skulle se forsiden.
 *
 * Kortene er reisemål, ikke navngitte hoteller: vi har ikke rettigheter til å
 * vise et hotells bilder før leverandøren har gitt oss dem, og et bybilde ved
 * siden av et hotellnavn ville vært nettopp det.
 */

const HOTEL_PICKS = ["barcelona", "rome"];

function useStay() {
  // Hotellsøket trenger datoer. Vi bruker den kommende helgen og sier det.
  return useMemo(() => datesFor("weekend", 3), []);
}

/** Stedssøk med tastatur, knyttet til leverandørens eget register. */
function PlaceSearch({ onPicked }: { onPicked: (dest: string, place: string) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const status = trpc.hotels.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const enabled = status.data?.enabled === true;
  const query = text.trim();
  const places = trpc.hotels.places.useQuery({ query }, { enabled: enabled && query.length >= 2, staleTime: 60 * 60_000, retry: false });
  const options = (places.data ?? []).slice(0, 6);
  const listId = "hotel-place-list";

  const pick = (i: number) => {
    const o = options[i];
    if (!o) return;
    setOpen(false);
    setText(o.name);
    onPicked(o.key, o.name);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1.5">
        <Icon icon={BedDouble} size={20} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("hd.hotel.where")}
          placeholder={t("hd.hotel.where")}
          value={text}
          disabled={!enabled && status.isSuccess}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (!options.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % options.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + options.length) % options.length);
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              pick(active);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
      </div>
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" aria-label={t("hd.hotel.where")} className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lift">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                className={cn("flex min-h-12 w-full items-center px-3.5 text-left text-[15px]", i === active ? "bg-muted" : "hover:bg-muted/60")}
              >
                <span className="min-w-0 truncate">
                  {o.name}
                  {o.fullName && o.fullName !== o.name ? <span className="text-muted-foreground"> · {o.fullName}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Kartet: samme kart som resten av forsiden, åpnet på forespørsel. */
function MapPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (d: DiscoverDestination) => void }) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const pool = useMemo(() => ALL_DESTINATIONS.filter((d) => d.image && airportByIata(d.iata)), []);
  const pins = useMemo(
    () =>
      pool.map((d) => {
        const a = airportByIata(d.iata)!;
        return { id: d.id, label: d.city, price: null, lat: a.lat, lng: a.lng };
      }),
    [pool],
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("hd.hotel.map.title")}</SheetTitle>
        </SheetHeader>
        <SheetBody className="pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="h-[55dvh] overflow-hidden rounded-2xl">
            <Suspense fallback={<div className="shimmer h-full w-full" aria-hidden="true" />}>
              <DiscoveryMap pins={pins} selected={selected} onSelect={setSelected} className="h-full w-full" />
            </Suspense>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-w-0 text-[15px] text-muted-foreground">
              {selected ? pool.find((d) => d.id === selected)?.city : t("hd.hotel.map.hint")}
            </p>
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                const d = pool.find((x) => x.id === selected);
                if (d) onPick(d);
              }}
              className="press inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-[16px] font-bold text-primary-foreground disabled:opacity-40"
            >
              {t("hd.hotel.cta")} <Icon icon={ArrowRight} size={20} />
            </button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export default function HotelDiscover() {
  const t = useT();
  const navigate = useNavigate();
  const stay = useStay();
  const [mapOpen, setMapOpen] = useState(false);
  const picks = useMemo(
    () => HOTEL_PICKS.map((id) => ALL_DESTINATIONS.find((d) => d.id === id)).filter((d): d is DiscoverDestination => Boolean(d?.image)),
    [],
  );
  const hrefFor = (place: string, dest = "") => hotelSearchHref({ dest, place, checkin: stay.depart, checkout: stay.ret, adults: 2, rooms: 1 });

  return (
    <section aria-labelledby="hd-hotel">
      <h2 id="hd-hotel" className="t-h2">
        {t("hd.hotel.title")}
      </h2>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <PlaceSearch onPicked={(dest, place) => navigate(hrefFor(place, dest))} />
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="press inline-flex h-[54px] shrink-0 items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 text-[15px] font-semibold text-forest transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon icon={MapIcon} size={20} /> {t("hd.hotel.map")}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
        {picks.map((d, i) => (
          <article key={d.id} className={cn("flex flex-col overflow-hidden rounded-2xl", i % 2 === 0 ? "bg-apricot" : "bg-sunny-warm")}>
            <Link to={hrefFor(d.city)} className="block aspect-[4/3] overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <img
                src={d.image}
                srcSet={imageSrcSet(d.image!)}
                sizes="(max-width: 640px) 46vw, 300px"
                alt={d.imageAlt}
                width={400}
                height={300}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </Link>
            <div className="flex flex-1 flex-col px-4 pb-4 pt-3 text-petrol">
              <h3 className="text-[18px] font-bold leading-tight">{t("hd.hotel.in", { city: d.city })}</h3>
              <Link
                to={hrefFor(d.city)}
                className="mt-auto inline-flex min-h-10 w-fit items-center gap-1 pt-1 text-[16px] font-semibold text-azure-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("hd.hotel.cta")} <Icon icon={ArrowRight} size={20} />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <MapPicker open={mapOpen} onOpenChange={setMapOpen} onPick={(d) => navigate(hrefFor(d.city))} />
    </section>
  );
}
