import { useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import type { Offer } from "@contracts/types";
import { fareConditionLabel, formatClock, formatDuration, formatMinor, previewTotalMinor, toMinor } from "@/lib/format";
import { sliceBaggage } from "@/components/offers/offerUtils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import Icon from "@/components/app/Icon";
import { useFeeConfig } from "@/lib/useFeeConfig";
import type { FeeConfig } from "@contracts/types";

/**
 * CompareTray — velg opptil 3 tilbud og sammenlign dem side ved side.
 * Festet bunnlinje + full visning i Radix Dialog (fokusfelle, Esc, aria).
 */

function offerDuration(o: Offer): number {
  return o.slices.reduce((s, x) => s + x.durationMinutes, 0);
}

const totalOf = (o: Offer, cfg: FeeConfig) => formatMinor(previewTotalMinor(o.totalAmount, o.totalCurrency, cfg), o.totalCurrency);

function CompareTable({ offers, onSelect, feeConfig }: { offers: Offer[]; onSelect: (offer: Offer) => void; feeConfig: FeeConfig }) {
  const rows: { label: string; value: (o: Offer) => string }[] = [
    { label: "Flyselskap", value: (o) => o.owner.name },
    { label: "Avgang", value: (o) => `${formatClock(o.slices[0].departingAt)} ${o.slices[0].origin.iata}` },
    { label: "Ankomst", value: (o) => `${formatClock(o.slices[o.slices.length - 1].arrivingAt)} ${o.slices[o.slices.length - 1].destination.iata}` },
    { label: "Reisetid", value: (o) => formatDuration(offerDuration(o)) },
    {
      label: "Stopp",
      value: (o) => {
        const max = Math.max(...o.slices.map((s) => s.stops));
        return max === 0 ? "Direkte" : `Maks ${max} stopp`;
      },
    },
    { label: "Håndbagasje", value: (o) => o.slices.map((s) => `${sliceBaggage(s, o.baggage).carryOnBags}`).join(" / ") },
    { label: "Innsjekket bagasje", value: (o) => o.slices.map((s) => `${sliceBaggage(s, o.baggage).checkedBags}`).join(" / ") },
    { label: "CO₂-utslipp", value: (o) => `${o.emissionsKg} kg` },
    { label: "Refusjon", value: (o) => fareConditionLabel("refund", o.conditions?.refundBeforeDeparture, o.refundable) },
    { label: "Endring", value: (o) => fareConditionLabel("change", o.conditions?.changeBeforeDeparture, o.changeable) },
    { label: "Flyselskapets pris", value: (o) => formatMinor(toMinor(o.totalAmount, o.totalCurrency), o.totalCurrency) },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-2">
        <thead>
          <tr>
            <th className="w-32" scope="col">
              <span className="sr-only">Egenskap</span>
            </th>
            {offers.map((o) => (
              <th key={o.id} scope="col" className="rounded-2xl bg-night p-4 text-left align-top text-white">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{o.owner.iata}</p>
                <p className="mt-1 text-xl font-extrabold sm:text-2xl">{totalOf(o, feeConfig)}</p>
                <p className="text-[11px] text-white/60">ca. inkl. servicegebyr</p>
                <button type="button" onClick={() => onSelect(o)} className="mt-3 min-h-11 w-full rounded-full bg-primary py-2 text-[13px] font-bold text-primary-foreground transition-colors hover:brightness-95">
                  Velg denne
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="p-2 text-left text-[12px] font-semibold text-muted-foreground">
                {r.label}
              </th>
              {offers.map((o) => (
                <td key={o.id} className="rounded-xl bg-muted/50 p-3 text-[13px] font-medium">
                  {r.value(o)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareTray({
  offers,
  onRemove,
  onClear,
  onSelect,
}: {
  offers: Offer[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onSelect: (offer: Offer) => void;
}) {
  const [open, setOpen] = useState(false);
  const feeConfig = useFeeConfig();
  if (!offers.length) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4" style={{ paddingBottom: "max(96px, calc(96px + env(safe-area-inset-bottom)))" }}>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-white p-1.5 shadow-lift" role="region" aria-label="Sammenlign valgte tilbud">
          {offers.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onRemove(o.id)}
              aria-label={`Fjern ${o.owner.name} ${totalOf(o, feeConfig)} fra sammenligning`}
              className="group flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-3 text-[12px] font-bold"
            >
              {o.owner.iata} · {totalOf(o, feeConfig)}
              <Icon icon={X} size={16} className="text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={offers.length < 2}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-night px-4 text-[13px] font-bold text-white transition-colors hover:brightness-125 disabled:opacity-40"
          >
            <Icon icon={ArrowLeftRight} size={16} />
            Sammenlign ({offers.length}/3)
          </button>
          <button type="button" onClick={onClear} className="min-h-11 px-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Nullstill
          </button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-3xl bg-background p-5 sm:p-7">
          <DialogTitle className="font-display text-2xl">Sammenlign {offers.length} tilbud</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Priser vises ca. inkl. servicegebyr. Bagasje per strekning.</DialogDescription>
          <CompareTable
            offers={offers}
            feeConfig={feeConfig}
            onSelect={(o) => {
              setOpen(false);
              onSelect(o);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
