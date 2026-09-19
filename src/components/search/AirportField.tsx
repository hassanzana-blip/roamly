import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock3, Compass, MapPin, Route, Search, X } from "lucide-react";
import FieldButton from "./FieldButton";
import PickerSurface from "./PickerSurface";
import Wordmark from "@/components/brand/Wordmark";
import { AIRPORTS, airportByIata, searchAirports, type Airport } from "@contracts/airports";
import { DESTINATIONS, imageSrcSet } from "@/content/discover";
import { clearRecentSearches, loadRecentSearches, onRecentSearchesChange } from "@/lib/recentSearches";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, type I18nKey } from "@/lib/i18n";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: Airport | null;
  onChange: (a: Airport) => void;
  exclude?: string;
  direction: "from" | "to";
  invalid?: boolean;
  joined?: boolean;
  /** «Avreise fra Oslo, OSL» under the search field of the destination picker. */
  origin?: Airport | null;
  /** «Hvor som helst»: leave the picker and browse destinations instead. */
  onAnywhere?: () => void;
}

type Group = { key: I18nKey; items: Airport[]; kind: "recent" | "photo" | "plain" };

/** The destination photographs we own the rights to, by airport. */
const PHOTO_BY_IATA = new Map(DESTINATIONS.filter((d) => d.image).map((d) => [d.iata, d]));

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Recent searches, live: «Tøm» in one picker empties the other too. */
function useRecentIatas(direction: "from" | "to") {
  const read = () => Array.from(new Set(loadRecentSearches().map((s) => (direction === "from" ? s.from : s.to))));
  const [list, setList] = useState<string[]>(read);
  useEffect(() => onRecentSearchesChange(() => setList(read())), [direction]); // eslint-disable-line react-hooks/exhaustive-deps
  return list;
}

/**
 * Empty state of the picker: what the person most likely wants, in order.
 * Departure: their recent origins, Norwegian airports, then popular. Arrival:
 * recent destinations, then places we have real photographs of. No
 * geolocation, no guessing.
 */
function useGroups(direction: "from" | "to", recentIatas: string[], exclude?: string): Group[] {
  return useMemo(() => {
    const recent = recentIatas.map(airportByIata).filter((a): a is Airport => Boolean(a) && a!.iata !== exclude).slice(0, 4);
    const seen = new Set(recent.map((a) => a.iata));
    const take = (pred: (a: Airport) => boolean, n: number, source: Airport[] = AIRPORTS) => {
      const out: Airport[] = [];
      for (const a of source) {
        if (out.length >= n) break;
        if (a.iata === exclude || seen.has(a.iata) || !pred(a)) continue;
        seen.add(a.iata);
        out.push(a);
      }
      return out;
    };
    const groups: Group[] = [];
    if (recent.length) groups.push({ key: "sw.group.recent", items: recent, kind: "recent" });
    if (direction === "from") {
      groups.push({ key: "picker.norway", items: take((a) => a.countryCode === "NO" && Boolean(a.popular), 6), kind: "plain" });
      groups.push({ key: "sw.group.popular", items: take((a) => Boolean(a.popular) && a.countryCode !== "NO", 8), kind: "plain" });
    } else {
      const photoAirports = DESTINATIONS.filter((d) => d.image).map((d) => airportByIata(d.iata)).filter((a): a is Airport => Boolean(a));
      groups.push({ key: "picker.new", items: take(() => true, 6, photoAirports), kind: "photo" });
      groups.push({ key: "sw.group.popular", items: take((a) => Boolean(a.popular) && a.countryCode !== "NO", 8), kind: "plain" });
    }
    return groups.filter((g) => g.items.length > 0);
  }, [direction, exclude, recentIatas]);
}

export default function AirportField({ label, value, onChange, exclude, direction, invalid, joined, origin, onAnywhere }: Props) {
  const t = useT();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `airports-${direction}`;
  const recentIatas = useRecentIatas(direction);
  const groups = useGroups(direction, recentIatas, exclude);

  // The curated set answers at once, without the network.
  const local = useMemo(() => (query ? searchAirports(query, 12).filter((a) => a.iata !== exclude) : []), [query, exclude]);

  // The world register lives on the server (454 kB). We ask once the person
  // has paused typing, and the query key makes a stale answer irrelevant:
  // react-query only ever hands back the result for the current text.
  const debounced = useDebounced(query.trim(), 250);
  const wantWorld = debounced.length >= 2 && local.length < 8;
  const worldQuery = trpc.flights.airports.useQuery(
    { query: debounced, limit: 12 },
    { enabled: wantWorld, staleTime: 300_000, retry: false },
  );
  const pendingWorld = query.trim().length >= 2 && local.length < 8 && (debounced !== query.trim() || worldQuery.isFetching);

  const searched = useMemo(() => {
    const seen = new Set<string>();
    const out: Airport[] = [];
    for (const a of [...local, ...(wantWorld && worldQuery.data ? worldQuery.data : [])]) {
      if (a.iata === exclude || seen.has(a.iata)) continue;
      seen.add(a.iata);
      out.push(a);
    }
    return out.slice(0, 12);
  }, [local, wantWorld, worldQuery.data, exclude]);

  // One flat, ordered list drives keyboard navigation whether grouped or searched.
  const flat = query ? searched : groups.flatMap((g) => g.items);

  useEffect(() => {
    if (!open) return;
    // Sheet/popover mount is async; focus once the input exists.
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  };

  const choose = (a: Airport) => {
    onChange(a);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      choose(flat[active]);
    }
  };

  // «Fra» is a place you stand, «Til» is a place you look for.
  const TriggerIcon = direction === "from" ? MapPin : Search;
  const title = direction === "from" ? t("picker.title.from") : t("picker.title.to");

  const Row = ({ a, i, kind }: { a: Airport; i: number; kind: Group["kind"] | "search" }) => {
    const photo = kind === "photo" ? PHOTO_BY_IATA.get(a.iata) : undefined;
    return (
      <li
        id={`${listId}-${a.iata}`}
        role="option"
        aria-selected={i === active}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(a)}
        className={cn(
          "flex min-h-14 cursor-pointer items-center gap-4 rounded-xl px-2 py-2.5 transition-colors",
          i === active ? "bg-mint/70" : "hover:bg-secondary",
          kind === "photo" && "py-2",
        )}
      >
        {photo?.image ? (
          <img src={photo.image} srcSet={imageSrcSet(photo.image)} sizes="88px" alt="" loading="lazy" decoding="async" width={88} height={64} className="h-16 w-[88px] shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center text-petrol" aria-hidden="true">
            {kind === "recent" ? <Clock3 className="size-6" /> : <MapPin className="size-6" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[18px] font-semibold leading-tight text-petrol">{a.city}</span>
          <span className="mt-0.5 block truncate text-[15px] text-muted-foreground">
            {a.country} · {a.iata}
            {a.world || a.name === a.city ? "" : <span className="hidden sm:inline"> · {a.name}</span>}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-petrol" aria-hidden="true" />
      </li>
    );
  };

  const searchField = (
    <div className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-white px-4 transition-[border-color,box-shadow] duration-fast focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
      <Search className="size-6 shrink-0 text-petrol" aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={t("picker.placeholder")}
        aria-label={t("picker.placeholder")}
        aria-controls={listId}
        aria-activedescendant={flat[active] ? `${listId}-${flat[active].iata}` : undefined}
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-full w-full bg-transparent text-[17px] text-petrol outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:[box-shadow:none]"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label={t("misc.close")} className="grid size-10 shrink-0 place-items-center rounded-full text-petrol hover:bg-secondary">
          <X className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const list = (
    <ul id={listId} role="listbox" aria-label={label} className={cn(isMobile ? "" : "max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2")}>
      {query ? (
        <>
          {searched.map((a, i) => <Row key={a.iata} a={a} i={i} kind="search" />)}
          {pendingWorld && (
            <li role="presentation" className="flex items-center gap-3 px-2 py-4 text-[15px] text-muted-foreground" aria-live="polite">
              <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-petrol/20 border-t-petrol motion-reduce:animate-none" aria-hidden="true" />
              {t("picker.searching")}
            </li>
          )}
          {!pendingWorld && searched.length === 0 && !worldQuery.isError && (
            <li role="presentation" className="px-2 py-10 text-center text-[15px] text-muted-foreground">{t("sw.nohits", { q: query })}</li>
          )}
          {!pendingWorld && worldQuery.isError && (
            <li role="presentation" className="flex flex-col items-start gap-3 rounded-2xl bg-lavender px-4 py-4 text-[15px] text-petrol">
              {t("picker.error")}
              <Button type="button" variant="outline" size="sm" onClick={() => worldQuery.refetch()}>{t("common.retry")}</Button>
            </li>
          )}
        </>
      ) : (
        (() => {
          let i = 0;
          return groups.map((g) => (
            <li key={g.key} role="presentation" className="pt-5 first:pt-0">
              <div className="flex items-center justify-between gap-3 px-2 pb-1">
                <p className="t-h2 !text-[24px]" role="presentation">{t(g.key)}</p>
                {g.kind === "recent" && (
                  <button type="button" onClick={clearRecentSearches} className="inline-flex min-h-11 items-center px-2 text-[16px] font-semibold text-azure-ink underline-offset-4 hover:underline">
                    {t("picker.clear")}
                  </button>
                )}
              </div>
              <ul role="group" aria-label={t(g.key)} className={g.kind !== "photo" ? "divide-y divide-border" : "space-y-1"}>
                {g.items.map((a) => (
                  <Row key={a.iata} a={a} i={i++} kind={g.kind} />
                ))}
              </ul>
            </li>
          ));
        })()
      )}
    </ul>
  );

  const anywhere = onAnywhere && direction === "to" && !query && (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        onAnywhere();
      }}
      className="flex min-h-[88px] w-full items-center gap-4 rounded-2xl bg-petrol px-5 py-4 text-left text-white outline-none transition-colors hover:bg-petrol-deep focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint text-petrol" aria-hidden="true"><Compass className="size-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[22px] font-bold leading-tight">{t("sw.anywhere")}</span>
        <span className="mt-0.5 block text-[15px] text-white/85">{t("picker.anywhere.sub")}</span>
      </span>
      <ChevronRight className="size-6 shrink-0" aria-hidden="true" />
    </button>
  );

  const note = direction === "to" && !query && (
    <div className="flex items-start gap-4 rounded-2xl bg-lavender px-4 py-4">
      <Route className="mt-0.5 size-7 shrink-0 text-petrol" aria-hidden="true" />
      <p className="text-[15px] leading-snug text-petrol">
        <span className="block font-semibold">{t("picker.note.title")}</span>
        <span className="mt-0.5 block text-muted-foreground">{t("picker.note.body")}</span>
      </p>
    </div>
  );

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpenAndReset}
      title={title}
      mobile="fullscreen"
      popoverClassName="w-[var(--radix-popover-trigger-width)] min-w-[24rem]"
      trigger={
        <FieldButton
          icon={TriggerIcon}
          label={label}
          placeholder={direction === "to" ? t("sw.anywhere") : t("sw.pickairport")}
          invalid={invalid}
          joined={joined}
          value={value ? `${value.city}, ${value.iata}` : undefined}
        />
      }
    >
      {isMobile ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 rounded-t-[20px] bg-mint px-5 pb-5 pt-9">
            <div className="flex items-center justify-between gap-3">
              <Wordmark asLink={false} />
              <button type="button" onClick={() => setOpen(false)} aria-label={t("picker.close")} className="grid size-12 place-items-center rounded-full text-petrol hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-ring">
                <X className="size-7" aria-hidden="true" />
              </button>
            </div>
            <h2 className="t-display mt-2 !text-[32px]">{title}</h2>
            <div className="mt-5">{searchField}</div>
            {direction === "to" && origin && (
              <p className="mt-3 text-[16px] text-petrol">
                {t("picker.origin")} <span className="font-semibold">{origin.city}, {origin.iata}</span>
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
            {anywhere}
            {list}
            {note}
          </div>
          <div className="shrink-0 border-t border-border bg-white px-4 pt-3 pb-safe">
            <Button type="button" variant="outline" className="h-[52px] w-full rounded-xl border-petrol text-[17px] font-bold text-petrol hover:bg-secondary" onClick={() => setOpen(false)}>
              {t("picker.back")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="border-b border-border p-3">
            {searchField}
            {direction === "to" && origin && (
              <p className="mt-2 px-1 text-[14px] text-muted-foreground">
                {t("picker.origin")} <span className="font-semibold text-petrol">{origin.city}, {origin.iata}</span>
              </p>
            )}
          </div>
          {anywhere && <div className="p-2 pb-0">{anywhere}</div>}
          {list}
        </div>
      )}
    </PickerSurface>
  );
}
