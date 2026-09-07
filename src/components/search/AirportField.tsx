import { useMemo, useState } from "react";
import { MapPin, PlaneLanding, PlaneTakeoff, Search, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchAirports, type Airport } from "@contracts/airports";

interface Props {
  label: string;
  value: Airport | null;
  onChange: (a: Airport) => void;
  exclude?: string;
  direction: "from" | "to";
}

export default function AirportField({ label, value, onChange, exclude, direction }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchAirports(query, 9).filter((a) => a.iata !== exclude),
    [query, exclude],
  );

  const Icon = direction === "from" ? PlaneTakeoff : PlaneLanding;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-3 rounded-2xl border hairline bg-card px-4 py-3 text-left transition-colors hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={`${label}: ${value ? value.city : "velg flyplass"}`}
        >
          <Icon className="h-5 w-5 shrink-0 text-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            {value ? (
              <span className="block truncate text-base font-semibold text-foreground">
                {value.city}
                <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 align-middle text-[11px] font-bold tracking-wider text-skyline">
                  {value.iata}
                </span>
              </span>
            ) : (
              <span className="block text-base text-muted-foreground">Velg flyplass</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[--radix-popover-trigger-width] min-w-72 border hairline bg-popover p-0 text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b hairline px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk by eller flyplass …"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Ingen treff på «{query}»
            </p>
          )}
          {results.map((a) => (
            <button
              key={a.iata}
              type="button"
              onClick={() => {
                onChange(a);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary"
            >
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {a.city} <span className="text-muted-foreground">· {a.name}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{a.country}</span>
              </span>
              {a.popular && <Star className="h-3.5 w-3.5 fill-skyline text-skyline" />}
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-skyline">
                {a.iata}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
