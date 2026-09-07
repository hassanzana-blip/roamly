import { useState } from "react";
import { Minus, Plus, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import FieldButton from "./FieldButton";
import PickerSurface from "./PickerSurface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { CABIN_LABELS, cabinLabel, paxLabel } from "@/lib/format";
import type { CabinClass, PassengerType } from "@contracts/types";
import { useT, type I18nKey } from "@/lib/i18n";
import { MAX_PASSENGERS, paxTotal, syncAges, type PaxAges, type PaxCount } from "./paxUtils";
import { AdultGlyph, CabinClassGlyph, ChildGlyph, InfantGlyph } from "@/components/graphics";
import { cn } from "@/lib/utils";

interface Props {
  pax: PaxCount;
  onPaxChange: (p: PaxCount) => void;
  ages: PaxAges;
  onAgesChange: (a: PaxAges) => void;
  cabin: CabinClass;
  onCabinChange: (c: CabinClass) => void;
  joined?: boolean;
}

const ROWS: { type: PassengerType; hint: I18nKey; Glyph: typeof AdultGlyph }[] = [
  { type: "adult", hint: "sw.adult.hint", Glyph: AdultGlyph },
  { type: "child", hint: "sw.child.hint", Glyph: ChildGlyph },
  { type: "infant_without_seat", hint: "sw.infant.hint", Glyph: InfantGlyph },
];

const GLYPH: Record<PassengerType, typeof AdultGlyph> = { adult: AdultGlyph, child: ChildGlyph, infant_without_seat: InfantGlyph };

/**
 * The party, drawn: one glyph per traveller. Adding someone pops a new
 * figure into the row; the count rolls. Pure feedback for a change the
 * user just made, so it earns its motion; reduced motion falls back to a
 * plain fade.
 */
function PartyRow({ pax, cabin }: { pax: PaxCount; cabin: CabinClass }) {
  const t = useT();
  const reduce = useReducedMotion();
  const total = paxTotal(pax);
  const people: { key: string; type: PassengerType }[] = [];
  (["adult", "child", "infant_without_seat"] as PassengerType[]).forEach((type) => {
    for (let i = 0; i < pax[type]; i++) people.push({ key: `${type}-${i}`, type });
  });
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3" aria-label={t("sw.party")}>
      <div className="flex items-center">
        <AnimatePresence initial={false}>
          {people.map((p, i) => {
            const G = GLYPH[p.type];
            return (
              <motion.span
                key={p.key}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
                transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.6 }}
                className={cn(
                  "grid size-10 place-items-center rounded-full border-2 border-card bg-card text-foreground shadow-xs",
                  i > 0 && "-ml-2.5",
                  p.type === "infant_without_seat" && "size-8 self-end",
                )}
                style={{ zIndex: people.length - i }}
                aria-hidden="true"
              >
                <G size={p.type === "infant_without_seat" ? 16 : 20} />
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="min-w-0 text-right">
        <div className="relative h-6 overflow-hidden text-base font-semibold leading-6">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={total}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="block tabular"
              aria-live="polite"
            >
              {t("common.pax", { count: total })}
            </motion.span>
          </AnimatePresence>
        </div>
        <p className="truncate text-sm text-muted-foreground">{cabinLabel(cabin)}</p>
      </div>
    </div>
  );
}

function Stepper({ value, min, max, onChange, label, fewer, more }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; fewer: string; more: string }) {
  const btn =
    "grid size-11 place-items-center rounded-full border border-input bg-card text-foreground transition-[border-color,transform] duration-fast ease-out hover:border-foreground/40 active:scale-95 disabled:opacity-30 disabled:hover:border-input disabled:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:active:scale-100";
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
      popoverClassName="w-[23rem]"
      align="end"
      doneLabel={t("sw.done")}
      trigger={<FieldButton icon={Users} label={t("search.travelers")} placeholder={t("search.travelers")} value={value} joined={joined} aria-label={`${t("sw.pax.title")}: ${value}`} />}
    >
      <div className="space-y-5 p-4">
        <PartyRow pax={pax} cabin={cabin} />

        {ROWS.map(({ type, hint, Glyph }) => {
          const isAdult = type === "adult";
          const max = type === "infant_without_seat" ? pax.adult : MAX_PASSENGERS;
          const name = paxLabel(type);
          return (
            <div key={type}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-foreground">
                    <Glyph size={22} />
                  </span>
                  <div>
                    <p className="text-base font-medium">{name}</p>
                    <p className="text-sm text-muted-foreground">{t(hint)}</p>
                  </div>
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
          <p className="mb-2 text-sm font-medium">{t("sw.cabin")}</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("sw.cabin")}>
            {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
              <Chip key={c} selected={cabin === c} onClick={() => onCabinChange(c)} className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left leading-tight" icon={<CabinClassGlyph cabin={c} size={20} />}>
                {cabinLabel(c)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </PickerSurface>
  );
}
