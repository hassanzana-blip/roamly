import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { nb } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function toDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function label(iso: string, withYear = true): string {
  const d = toDate(iso);
  if (!d) return "Velg dato";
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(d);
}

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  withYear?: boolean;
  /** "dropdown" gives year/month selectors — right for birth dates */
  captionLayout?: "label" | "dropdown";
  fromYear?: number;
  toYear?: number;
  error?: boolean;
}

export default function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Velg dato",
  withYear = true,
  captionLayout = "label",
  fromYear,
  toYear,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min ?? "");
  const maxDate = toDate(max ?? "");

  const disabled = useMemo(() => {
    const ranges: { before?: Date; after?: Date } = {};
    if (minDate) ranges.before = minDate;
    if (maxDate) ranges.after = maxDate;
    return ranges.before || ranges.after ? [ranges as { before: Date }] : undefined;
  }, [minDate, maxDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={placeholder}
          className={`flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-ring ${
            error ? "border-primary" : "hairline"
          }`}
        >
          <CalendarDays className="h-5 w-5 shrink-0 text-gold" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {placeholder}
            </span>
            <span
              className={`block truncate text-base font-semibold ${
                selected ? "" : "font-normal text-muted-foreground"
              }`}
            >
              {selected ? label(value, withYear) : "Velg dato"}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-auto border hairline bg-popover p-2 text-popover-foreground shadow-2xl"
      >
        <Calendar
          mode="single"
          locale={nb}
          weekStartsOn={1}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toIso(d));
              setOpen(false);
            }
          }}
          defaultMonth={selected ?? minDate ?? new Date()}
          disabled={disabled}
          captionLayout={captionLayout}
          {...(captionLayout === "dropdown"
            ? {
                startMonth: new Date(fromYear ?? 1930, 0),
                endMonth: new Date(toYear ?? new Date().getFullYear(), 11),
              }
            : {})}
        />
      </PopoverContent>
    </Popover>
  );
}
