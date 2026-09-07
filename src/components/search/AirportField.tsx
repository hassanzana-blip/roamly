import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, MapPin, PlaneLanding, PlaneTakeoff, Search, X } from "lucide-react";
import FieldButton from "./FieldButton";
import PickerSurface from "./PickerSurface";
import { AIRPORTS, airportByIata, searchAirports, type Airport } from "@contracts/airports";
import { loadRecentSearches } from "@/lib/recentSearches";
import { useT, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: Airport | null;
  onChange: (a: Airport) => void;
  exclude?: string;
  direction: "from" | "to";
  invalid?: boolean;
  joined?: boolean;
}

type Group = { key: I18nKey; items: Airport[]; recent?: boolean };

/** Destinations HelloSky is built around (see content/discover RECOMMENDED_DESTINATIONS). */
const HOME_ROUTES = ["IST", "EBL", "ISU", "BEY", "DXB", "JED", "CMN", "ISB"];

/**
 * Empty state of the picker: what the person most likely wants, in order.
 * Departure: their recent origins, Norwegian airports, then popular. Arrival:
 * recent destinations, then popular. No geolocation, no guessing.
 */
function useGroups(direction: "from" | "to", exclude?: string): Group[] {
  return useMemo(() => {
    const recentIatas = Array.from(new Set(loadRecentSearches().map((s) => (direction === "from" ? s.from : s.to))));
    const recent = recentIatas.map(airportByIata).filter((a): a is Airport => Boolean(a) && a!.iata !== exclude).slice(0, 4);
    const seen = new Set(recent.map((a) => a.iata));
    const take = (pred: (a: Airport) => boolean, n: number) => {
      const out: Airport[] = [];
      for (const a of AIRPORTS) {
        if (out.length >= n) break;
        if (a.iata === exclude || seen.has(a.iata) || !pred(a)) continue;
        seen.add(a.iata);
        out.push(a);
      }
      return out;
    };
    const groups: Group[] = [];
    if (recent.length) groups.push({ key: "sw.group.recent", items: recent, recent: true });
    if (direction === "from") {
      groups.push({ key: "sw.group.norway", items: take((a) => a.countryCode === "NO" && Boolean(a.popular), 6) });
      groups.push({ key: "sw.group.popular", items: take((a) => Boolean(a.popular) && a.countryCode !== "NO", 8) });
    } else {
      // The routes HelloSky is known for come first; Norwegian airports last.
      const home = HOME_ROUTES.map(airportByIata).filter((a): a is Airport => Boolean(a) && a!.iata !== exclude && !seen.has(a!.iata));
      home.forEach((a) => seen.add(a.iata));
      if (home.length) groups.push({ key: "sw.group.home", items: home });
      groups.push({ key: "sw.group.popular", items: take((a) => Boolean(a.popular) && a.countryCode !== "NO", 10) });
      groups.push({ key: "sw.group.norway", items: take((a) => a.countryCode === "NO" && Boolean(a.popular), 5) });
    }
    return groups.filter((g) => g.items.length > 0);
  }, [direction, exclude]);
}

export default function AirportField({ label, value, onChange, exclude, direction, invalid, joined }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `airports-${direction}`;

  const groups = useGroups(direction, exclude);
  const searched = useMemo(() => (query ? searchAirports(query, 12).filter((a) => a.iata !== exclude) : []), [query, exclude]);
  // One flat, ordered list drives keyboard navigation whether grouped or searched.
  const flat = query ? searched : groups.flatMap((g) => g.items);

  useEffect(() => {
    if (!open) return;
    // Sheet/popover mount is async; focus once the input exists.
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
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

  const Icon = direction === "from" ? PlaneTakeoff : PlaneLanding;

  const Row = ({ a, i, recent }: { a: Airport; i: number; recent?: boolean }) => (
    <li
      id={`${listId}-${a.iata}`}
      role="option"
      aria-selected={i === active}
      onMouseEnter={() => setActive(i)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => choose(a)}
      className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors", i === active ? "bg-primary-soft" : "hover:bg-muted")}
    >
      {recent ? <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">{a.city}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {a.name} · {a.country}
        </span>
      </span>
      <span className="t-code rounded-md bg-muted px-2 py-0.5 text-foreground">{a.iata}</span>
    </li>
  );

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpenAndReset}
      title={direction === "from" ? t("search.from") : t("search.where")}
      popoverClassName="w-[var(--radix-popover-trigger-width)] min-w-80"
      trigger={
        <FieldButton
          icon={Icon}
          label={label}
          placeholder={t("sw.pickairport")}
          invalid={invalid}
          joined={joined}
          value={
            value ? (
              <>
                {value.city}
                <span className="t-code ml-2 text-muted-foreground">{value.iata}</span>
              </>
            ) : undefined
          }
        />
      }
    >
      <div className="border-b border-border px-3 py-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 transition-[border-color,box-shadow] duration-fast focus-within:border-foreground/50 focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("sw.searchairport")}
          aria-label={t("sw.searchairport")}
          aria-controls={listId}
          aria-activedescendant={flat[active] ? `${listId}-${flat[active].iata}` : undefined}
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:[box-shadow:none]"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label={t("misc.close")} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        )}
      </div>
      </div>
      <ul id={listId} role="listbox" className="max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain p-1.5" aria-label={label}>
        {query ? (
          searched.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t("sw.nohits", { q: query })}</li>
          ) : (
            searched.map((a, i) => <Row key={a.iata} a={a} i={i} />)
          )
        ) : (
          (() => {
            let i = 0;
            return groups.map((g) => (
              <li key={g.key} role="presentation" className="pt-2 first:pt-0">
                <p className="t-label px-3 pb-1.5" role="presentation">
                  {t(g.key)}
                </p>
                <ul role="group" aria-label={t(g.key)}>
                  {g.items.map((a) => (
                    <Row key={a.iata} a={a} i={i++} recent={g.recent} />
                  ))}
                </ul>
              </li>
            ));
          })()
        )}
      </ul>
    </PickerSurface>
  );
}
