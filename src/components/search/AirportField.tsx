import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, PlaneLanding, PlaneTakeoff, Search, X } from "lucide-react";
import FieldButton from "./FieldButton";
import PickerSurface from "./PickerSurface";
import { searchAirports, type Airport } from "@contracts/airports";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: Airport | null;
  onChange: (a: Airport) => void;
  exclude?: string;
  direction: "from" | "to";
  invalid?: boolean;
}

export default function AirportField({ label, value, onChange, exclude, direction, invalid }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `airports-${direction}`;

  const results = useMemo(() => searchAirports(query, 12).filter((a) => a.iata !== exclude), [query, exclude]);

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
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  const Icon = direction === "from" ? PlaneTakeoff : PlaneLanding;

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
          aria-label={`${label}: ${value ? `${value.city} (${value.iata})` : t("sw.pickairport")}`}
          value={
            value ? (
              <>
                {value.city}
                <span className="ml-2 text-sm font-medium text-muted-foreground">{value.iata}</span>
              </>
            ) : undefined
          }
        />
      }
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
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
          aria-activedescendant={results[active] ? `${listId}-${results[active].iata}` : undefined}
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label={t("misc.close")} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        )}
      </div>
      {!query && <p className="eyebrow px-4 pt-3">{t("sw.popular")}</p>}
      <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5" aria-label={label}>
        {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t("sw.nohits", { q: query })}</li>}
        {results.map((a, i) => (
          <li
            key={a.iata}
            id={`${listId}-${a.iata}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(a)}
            className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors", i === active ? "bg-primary-soft" : "hover:bg-muted")}
          >
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium">{a.city}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {a.name} · {a.country}
              </span>
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tracking-wide text-foreground">{a.iata}</span>
          </li>
        ))}
      </ul>
    </PickerSurface>
  );
}
