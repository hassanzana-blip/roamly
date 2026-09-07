import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import FieldButton from "./FieldButton";
import PickerSurface from "./PickerSurface";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/lib/i18n";
import { dateLabel, toDate, toIso } from "./dateUtils";

interface SingleProps {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  label?: string;
  placeholder?: string;
  withYear?: boolean;
  /** "dropdown" gives year/month selectors: right for birth dates */
  captionLayout?: "label" | "dropdown";
  fromYear?: number;
  toYear?: number;
  error?: boolean;
  id?: string;
}

export default function DateField({ value, onChange, min, max, label, placeholder, withYear = true, captionLayout = "label", fromYear, toYear, error, id }: SingleProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min ?? "");
  const maxDate = toDate(max ?? "");
  const lbl = label ?? t("sw.date");
  const ph = placeholder ?? t("sw.pickdate");

  const disabled = useMemo(() => {
    const rules: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) rules.push({ before: minDate });
    if (maxDate) rules.push({ after: maxDate });
    return rules.length ? rules : undefined;
  }, [minDate, maxDate]);

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      title={lbl}
      popoverClassName="w-auto"
      trigger={
        <FieldButton
          id={id}
          icon={CalendarDays}
          label={lbl}
          placeholder={ph}
          invalid={error}
          value={selected ? dateLabel(value, withYear) : undefined}
          aria-label={`${lbl}: ${selected ? dateLabel(value, true) : ph}`}
        />
      }
    >
      <div className="p-2">
        <Calendar
          mode="single"
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
      </div>
    </PickerSurface>
  );
}

interface RangeProps {
  depart: string;
  ret: string;
  onChange: (next: { depart: string; ret: string }) => void;
  min?: string;
  roundtrip: boolean;
  invalid?: boolean;
}

/**
 * Departure/return picker. One field that opens a single month on phones
 * (bottom sheet) and two months on larger screens (popover).
 */
export function DateRangeField({ depart, ret, onChange, min, roundtrip, invalid }: RangeProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const from = toDate(depart);
  const to = roundtrip ? toDate(ret) : undefined;
  const minDate = toDate(min ?? "") ?? new Date();

  const onSelect = (range: DateRange | undefined, clicked: Date) => {
    if (!roundtrip) {
      onChange({ depart: toIso(clicked), ret });
      setOpen(false);
      return;
    }
    // Start a fresh range when both ends exist, otherwise extend.
    if (from && to) {
      onChange({ depart: toIso(clicked), ret: "" });
      return;
    }
    const f = range?.from ? toIso(range.from) : toIso(clicked);
    const r = range?.to ? toIso(range.to) : "";
    onChange({ depart: f, ret: r });
    if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) setOpen(false);
  };

  const summary = roundtrip
    ? depart && ret
      ? `${dateLabel(depart, false)} – ${dateLabel(ret, false)}`
      : depart
        ? `${dateLabel(depart, false)} – ${t("search.return").toLowerCase()}?`
        : undefined
    : depart
      ? dateLabel(depart)
      : undefined;

  const nights = roundtrip && from && to ? Math.round((to.getTime() - from.getTime()) / 86_400_000) : 0;
  const label = roundtrip ? t("sw.dates") : t("search.depart");

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      title={roundtrip ? t("sw.pickdates") : t("search.depart")}
      popoverClassName="w-auto"
      trigger={
        <FieldButton
          icon={CalendarDays}
          label={label}
          placeholder={roundtrip ? t("sw.pickdates") : t("sw.pickdate")}
          invalid={invalid}
          value={summary}
          aria-label={`${label}: ${summary ?? t("sw.pickdate")}`}
          trailing={
            nights > 0 ? (
              <span className="hidden shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
                {t("misc.night", { count: nights })}
              </span>
            ) : undefined
          }
        />
      }
    >
      <div className="p-2">
        {roundtrip ? (
          <Calendar
            mode="range"
            weekStartsOn={1}
            numberOfMonths={isMobile ? 1 : 2}
            selected={{ from, to }}
            onSelect={onSelect}
            defaultMonth={from ?? minDate}
            disabled={{ before: minDate }}
          />
        ) : (
          <Calendar
            mode="single"
            weekStartsOn={1}
            numberOfMonths={isMobile ? 1 : 2}
            selected={from}
            onSelect={(d) => d && onSelect(undefined, d)}
            defaultMonth={from ?? minDate}
            disabled={{ before: minDate }}
          />
        )}
        {roundtrip && (
          <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground" aria-live="polite">
            {from && !to ? t("sw.err.dates.round") : from && to ? t("misc.night", { count: nights }) : t("sw.err.dates.one")}
          </p>
        )}
      </div>
    </PickerSurface>
  );
}
