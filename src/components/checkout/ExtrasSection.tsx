import { Minus, Plus, Armchair, Luggage } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Offer } from "@contracts/types";
import { formatPrice, PAX_LABELS } from "@/lib/format";

// Mirrors the deterministic occupancy in the demo engine
function seatTaken(offerId: string, seat: string): boolean {
  let h = 2166136261;
  const str = `${offerId}:${seat}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295 < 0.32;
}

const ROWS_COUNT = 9;
const COLS = ["A", "B", "C", "D", "E", "F"];

function SeatMap({
  offerId,
  value,
  onSelect,
}: {
  offerId: string;
  value?: string;
  onSelect: (seat: string) => void;
}) {
  return (
    <div className="p-1">
      <div className="mb-2 flex justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-secondary" /> Ledig</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-muted/60" /> Opptatt</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-gold" /> Valgt</span>
      </div>
      <div className="space-y-1">
        {Array.from({ length: ROWS_COUNT }, (_, r) => (
          <div key={r} className="flex items-center justify-center gap-1">
            <span className="w-4 text-right text-[10px] text-muted-foreground">{r + 1}</span>
            {COLS.map((c, ci) => {
              const seat = `${r + 1}${c}`;
              const taken = seatTaken(offerId, seat);
              const selected = value === seat;
              return (
                <span key={c} className="contents">
                  {ci === 3 && <span className="w-3" />}
                  <button
                    type="button"
                    disabled={taken}
                    onClick={() => onSelect(seat)}
                    aria-label={`Sete ${seat}${taken ? " (opptatt)" : ""}`}
                    aria-pressed={selected}
                    className={`h-7 w-7 rounded text-[10px] font-bold transition-colors ${
                      selected
                        ? "bg-gold text-white"
                        : taken
                          ? "cursor-not-allowed bg-muted/40 text-muted-foreground/50"
                          : "bg-secondary text-skyline hover:bg-accent/40"
                    }`}
                  >
                    {c}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  offer: Offer;
  extraBags: number;
  onExtraBags: (n: number) => void;
  seats: Record<string, string>;
  onSeats: (s: Record<string, string>) => void;
}

export default function ExtrasSection({ offer, extraBags, onExtraBags, seats, onSeats }: Props) {
  const svc = offer.services;
  if (!svc) return null;
  const seatPrice = svc.seatPrice !== undefined ? Number(svc.seatPrice) : null;

  return (
    <section className="rounded-3xl border hairline bg-card p-5 sm:p-6">
      <h2 className="mb-1 flex items-center gap-2.5 font-display text-2xl">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-sm font-bold text-white">3</span>
        Tilvalg
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Legg til det du trenger — prisen oppdateres med én gang.
      </p>

      <div className="space-y-5">
        {/* extra bags */}
        {svc.maxExtraBags > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border hairline bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <Luggage className="h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="text-sm font-semibold">Ekstra innsjekket bagasje</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(svc.extraBagPrice ?? "0", offer.totalCurrency)} per kolli
                  {offer.baggage.checkedBags > 0 && ` · ${offer.baggage.checkedBags} allerede inkludert`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onExtraBags(Math.max(0, extraBags - 1))}
                disabled={extraBags === 0}
                className="grid h-8 w-8 place-items-center rounded-full border hairline transition-colors hover:border-accent disabled:opacity-30"
                aria-label="Færre kolli"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-4 text-center text-sm font-bold">{extraBags}</span>
              <button
                type="button"
                onClick={() => onExtraBags(Math.min(svc.maxExtraBags, extraBags + 1))}
                disabled={extraBags >= svc.maxExtraBags}
                className="grid h-8 w-8 place-items-center rounded-full border hairline transition-colors hover:border-accent disabled:opacity-30"
                aria-label="Flere kolli"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* seat selection */}
        {seatPrice !== null && (
          <div className="rounded-2xl border hairline bg-muted/50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <Armchair className="h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="text-sm font-semibold">Velg sete</p>
                <p className="text-xs text-muted-foreground">
                  {seatPrice === 0
                    ? "Inkludert i billetten"
                    : `${formatPrice(String(seatPrice), offer.totalCurrency)} per sete`}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {offer.passengers.map((p) => (
                <Popover key={p.id}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                        seats[p.id]
                          ? "border-gold bg-gold/10 text-gold"
                          : "hairline text-muted-foreground hover:border-accent/60 hover:text-foreground"
                      }`}
                    >
                      <span>{PAX_LABELS[p.type]}</span>
                      <span className="font-bold">{seats[p.id] ?? "Velg sete"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto border hairline bg-popover text-popover-foreground shadow-2xl">
                    <SeatMap
                      offerId={offer.id}
                      value={seats[p.id]}
                      onSelect={(seat) => onSeats({ ...seats, [p.id]: seat })}
                    />
                    {seats[p.id] && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...seats };
                          delete next[p.id];
                          onSeats(next);
                        }}
                        className="mt-2 w-full rounded-lg border hairline py-1.5 text-xs text-muted-foreground hover:text-primary"
                      >
                        Fjern setevalg
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
