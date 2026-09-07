import { Minus, Plus, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CABIN_LABELS, PAX_LABELS } from "@/lib/format";
import type { CabinClass, PassengerType } from "@contracts/types";
import { paxSummary, syncAges, type PaxAges, type PaxCount } from "./paxUtils";

interface Props {
  pax: PaxCount;
  onPaxChange: (p: PaxCount) => void;
  ages: PaxAges;
  onAgesChange: (a: PaxAges) => void;
  cabin: CabinClass;
  onCabinChange: (c: CabinClass) => void;
}

const ROWS: { type: PassengerType; hint: string }[] = [
  { type: "adult", hint: "12 år eller eldre" },
  { type: "child", hint: "2–11 år" },
  { type: "infant_without_seat", hint: "Under 2 år, uten eget sete" },
];

function AgeSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border hairline bg-card px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o} {o === 1 ? "år" : "år"}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PassengerCabinPicker({
  pax,
  onPaxChange,
  ages,
  onAgesChange,
  cabin,
  onCabinChange,
}: Props) {
  const set = (type: PassengerType, delta: number) => {
    const next = { ...pax, [type]: pax[type] + delta };
    if (next.adult < 1) next.adult = 1;
    if (next.infant_without_seat > next.adult) next.infant_without_seat = next.adult;
    if (next[type] < 0) return;
    const total = next.adult + next.child + next.infant_without_seat;
    if (total > 9) return;
    onPaxChange(next);
    onAgesChange(syncAges(next, ages));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border hairline bg-card px-4 py-3 text-left transition-colors hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Users className="h-5 w-5 shrink-0 text-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Reisende og klasse
            </span>
            <span className="block truncate text-base font-semibold">
              {paxSummary(pax)} · {CABIN_LABELS[cabin]}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border hairline bg-popover p-4 text-popover-foreground shadow-2xl" align="end">
        <div className="space-y-4">
          {ROWS.map(({ type, hint }) => (
            <div key={type}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{PAX_LABELS[type]}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => set(type, -1)}
                    disabled={pax[type] <= (type === "adult" ? 1 : 0)}
                    className="grid h-8 w-8 place-items-center rounded-full border hairline transition-colors hover:border-accent disabled:opacity-30"
                    aria-label={`Færre ${PAX_LABELS[type].toLowerCase()}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-bold">{pax[type]}</span>
                  <button
                    type="button"
                    onClick={() => set(type, 1)}
                    className="grid h-8 w-8 place-items-center rounded-full border hairline transition-colors hover:border-accent"
                    aria-label={`Flere ${PAX_LABELS[type].toLowerCase()}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* exact ages — Duffel prices children/infants by age */}
              {type === "child" && ages.children.length > 0 && (
                <div className="mt-2 space-y-1.5 rounded-xl bg-muted/60 p-3">
                  {ages.children.map((a, i) => (
                    <AgeSelect
                      key={i}
                      label={`Alder barn ${i + 1}`}
                      value={a}
                      options={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                      onChange={(v) =>
                        onAgesChange({
                          ...ages,
                          children: ages.children.map((x, xi) => (xi === i ? v : x)),
                        })
                      }
                    />
                  ))}
                </div>
              )}
              {type === "infant_without_seat" && ages.infants.length > 0 && (
                <div className="mt-2 space-y-1.5 rounded-xl bg-muted/60 p-3">
                  {ages.infants.map((a, i) => (
                    <AgeSelect
                      key={i}
                      label={`Alder baby ${i + 1}`}
                      value={a}
                      options={[0, 1]}
                      onChange={(v) =>
                        onAgesChange({
                          ...ages,
                          infants: ages.infants.map((x, xi) => (xi === i ? v : x)),
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="border-t hairline pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Kabinklasse
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CABIN_LABELS) as CabinClass[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCabinChange(c)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    cabin === c
                      ? "border-foreground/40 bg-muted text-foreground"
                      : "hairline text-muted-foreground hover:border-accent/60 hover:text-foreground"
                  }`}
                >
                  {CABIN_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
