import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlaceOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  label: string;
  placeholder: string;
  value: PlaceOption | null;
  /** Fri tekst mens kunden skriver (brukes når leverandøren ikke kan slå opp stedet). */
  text: string;
  onText: (v: string) => void;
  onChange: (p: PlaceOption | null) => void;
  options: PlaceOption[];
  loading?: boolean;
  invalid?: boolean;
  icon?: ReactNode;
  className?: string;
}

/**
 * Stedsfelt med forslag fra leverandøren (KAYAK autocomplete). Tilgjengelig
 * som combobox: piltaster, Enter og Escape, forslag i en listbox.
 */
export default function PlaceField({ label, placeholder, value, text, onText, onChange, options, loading, invalid, icon, className }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (o: PlaceOption) => {
    onChange(o);
    onText(o.label);
    setOpen(false);
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <label
        htmlFor={id}
        className={cn(
          "flex h-16 min-w-0 items-center gap-3 rounded-xl border bg-card px-4 transition-[border-color,box-shadow] duration-fast focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30",
          invalid ? "border-destructive" : "border-input",
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icon ?? <MapPin className="size-5" aria-hidden="true" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted-foreground">{label}</span>
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            value={text}
            placeholder={placeholder}
            onChange={(e) => {
              onText(e.target.value);
              onChange(null);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => text.length >= 2 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open || !options.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(options[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="block w-full min-w-0 truncate bg-transparent text-base font-semibold leading-tight text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        </span>
        {value && <Check className="size-4 shrink-0 text-success" aria-hidden="true" />}
      </label>
      {open && text.length >= 2 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-auto rounded-xl border border-border bg-card p-1 shadow-lift"
        >
          {loading && options.length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">…</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">Ingen forslag – prøv et annet stedsnavn.</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm", i === active ? "bg-primary-soft text-accent-foreground" : "text-foreground")}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{o.label}</span>
                {o.sublabel && <span className="block truncate text-xs text-muted-foreground">{o.sublabel}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
