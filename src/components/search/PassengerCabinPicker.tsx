import { useState } from "react";
import { Minus, Plus, Users } from "lucide-react";
import FieldButton from "./FieldButton";
import PickerSurface from "./PickerSurface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { CABIN_LABELS, cabinLabel, paxLabel } from "@/lib/format";
import type { CabinClass, PassengerType } from "@contracts/types";
import { useT, type I18nKey } from "@/lib/i18n";
import { MAX_PASSENGERS, paxTotal, syncAges, type PaxAges, type PaxCount } from "./paxUtils";

interface Props {
  pax: PaxCount;
  onPaxChange: (p: PaxCount) => void;
  ages: PaxAges;
  onAgesChange: (a: PaxAges) => void;
  cabin: CabinClass;
  onCabinChange: (c: CabinClass) => void;
  joined?: boolean;
}

const ROWS: { type: PassengerType; hint: I18nKey }[] = [
  { type: "adult", hint: "sw.adult.hint" },
  { type: "child", hint: "sw.child.hint" },
  { type: "infant_without_seat", hint: "sw.infant.hint" },
];

function Stepper({ value, min, max, onChange, label, fewer, more }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; fewer: string; more: string }) {
  const btn =
    "grid size-11 place-items-center rounded-full border border-input bg-card text-foreground transition-colors hover:border-foreground/40 disabled:opacity-30 disabled:hover:border-input focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} className={btn} aria-label={fewer}>
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center text-base font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className={btn} aria-label={more}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function AgeSelect({ value, onChange, options, label, unit }: { value: number; onChange: (v: number) => void; options: number[]; label: string; unit: (n: number) => string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger size="sm" className="w-28" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={String(o)}>
              {unit(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function PassengerCabinPicker({ pax, onPaxChange, ages, onAgesChange, cabin, onCabinChange, joined }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const total = paxTotal(pax);

  const set = (type: PassengerType, value: number) => {
    const next = { ...pax, [type]: value };
    if (next.adult < 1) next.adult = 1;
    if (next.infant_without_seat > next.adult) next.infant_without_seat = next.adult;
    if (paxTotal(next) > MAX_PASSENGERS) return;
    onPaxChange(next);
    onAgesChange(syncAges(next, ages));
  };

  const summary = t("common.pax", { count: total });
  const value = `${summary} · ${cabinLabel(cabin)}`;

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      title={t("sw.pax.title")}
      popoverClassName="w-[22rem]"
      align="end"
      doneLabel={t("sw.done")}
      trigger={<FieldButton icon={Users} label={t("search.travelers")} placeholder={t("search.travelers")} value={value} joined={joined} aria-label={`${t("sw.pax.title")}: ${value}`} />}
    >
      <div className="space-y-5 p-4">
        {ROWS.map(({ type, hint }) => {
          const isAdult = type === "adult";
          const max = type === "infant_without_seat" ? pax.adult : MAX_PASSENGERS;
          const name = paxLabel(type);
          return (
            <div key={type}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-medium">{name}</p>
                  <p className="text-sm text-muted-foreground">{t(hint)}</p>
                </div>
                <Stepper
                  value={pax[type]}
                  min={isAdult ? 1 : 0}
                  max={Math.min(max, pax[type] + (MAX_PASSENGERS - total))}
                  onChange={(v) => set(type, v)}
                  label={name}
                  fewer={t("sw.fewer", { type: name.toLowerCase() })}
                  more={t("sw.more", { type: name.toLowerCase() })}
                />
              </div>
              {type === "child" && ages.children.length > 0 && (
                <div className="mt-3 space-y-2 rounded-lg bg-muted p-3">
                  {ages.children.map((a, i) => (
                    <AgeSelect
                      key={i}
                      label={t("sw.age.child", { n: i + 1 })}
                      value={a}
                      options={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                      unit={(n) => t("sw.years", { count: n })}
                      onChange={(v) => onAgesChange({ ...ages, children: ages.children.map((x, xi) => (xi === i ? v : x)) })}
                    />
                  ))}
                </div>
              )}
              {type === "infant_without_seat" && ages.infants.length > 0 && (
                <div className="mt-3 space-y-2 rounded-lg bg-muted p-3">
                  {ages.infants.map((a, i) => (
                    <AgeSelect
                      key={i}
                      label={t("sw.age.infant", { n: i + 1 })}
                      value={a}
                      options={[0, 1]}
                      unit={(n) => t("sw.years", { count: n })}
                      onChange={(v) => onAgesChange({ ...ages, infants: ages.infants.map((x, xi) => (xi === i ? v : x)) })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {(pax.child > 0 || pax.infant_without_seat > 0) && <p className="text-sm text-muted-foreground">{t("sw.family.note")}</p>}

        <div className="border-t border-border pt-4">
          <p className="eyebrow mb-2">{t("sw.cabin")}</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("sw.cabin")}>
            {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
              <Chip key={c} selected={cabin === c} onClick={() => onCabinChange(c)} className="justify-center">
                {cabinLabel(c)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </PickerSurface>
  );
}
