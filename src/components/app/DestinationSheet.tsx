import { useState } from "react";
import { Link } from "react-router";
import { useNavigate } from "react-router";
import { CalendarDays, Plane, ShieldCheck } from "lucide-react";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";
import { FavoriteButton, PrimaryButton, RatingChip } from "./primitives";
import { trpc } from "@/providers/trpc";
import { departDate, searchHref, VISA_NOTES, type DiscoverDestination } from "@/content/discover";
import { useFavourites } from "@/lib/favourites";

/**
 * DestinationSheet — native quick-view when a destination card is tapped.
 * Big photo, editorial info, and the next four departures with REAL
 * guide prices from the price API (never fabricated). CTA runs the
 * actual search.
 */

const DAY_OFFSETS = [21, 28, 35, 42];
const fmtDay = new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" });
const fmtNok = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export default function DestinationSheet({
  destination,
  onClose,
}: {
  destination: DiscoverDestination | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [favs, toggleFav] = useFavourites();
  const [imgFailed, setImgFailed] = useState(false);

  const hints = trpc.flights.priceHints.useQuery(
    {
      origin: "OSL",
      destination: destination?.iata ?? "XXX",
      cabinClass: "economy",
      dates: DAY_OFFSETS.map(departDate),
      passengers: ["adult"],
    },
    { enabled: Boolean(destination), staleTime: 600_000, retry: 1 },
  );

  const d = destination;
  const prices = (hints.data ?? []).map((h) => ({
    ...h,
    amount: h.amount == null ? null : Number(h.amount),
  }));
  const cheapest = prices.reduce<number | null>(
    (min, h) => (h.amount != null && Number.isFinite(h.amount) && (min == null || h.amount < min) ? h.amount : min),
    null,
  );

  return (
    <BottomSheet open={Boolean(d)} onClose={onClose} size="lg">
      {d && (
        <div className="flex flex-col gap-4">
          <div className="relative -mx-1 aspect-[16/10] overflow-hidden rounded-[24px] bg-muted">
            {d.image && !imgFailed ? (
              <img
                src={d.image}
                alt={d.imageAlt}
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-night text-white/70">
                <Icon icon={Plane} size={24} />
              </div>
            )}
            {typeof d.rating === "number" && (
              <RatingChip value={d.rating} className="absolute left-3 top-3" />
            )}
            <FavoriteButton
              active={favs.has(d.id)}
              onToggle={() => toggleFav(d.id)}
              label={favs.has(d.id) ? `Fjern ${d.city} fra lagrede` : `Lagre ${d.city}`}
              className="absolute right-3 top-3"
            />
          </div>

          <div>
            <h3 className="font-display text-2xl tracking-tight">{d.city}</h3>
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              {d.country} · {d.tagline}
            </p>
          </div>

          {VISA_NOTES[d.id] && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/50 px-4 py-3">
              <Icon icon={ShieldCheck} size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {VISA_NOTES[d.id]}{" "}
                <Link to="/visum" onClick={onClose} className="font-semibold text-foreground underline underline-offset-2">
                  Les visumguiden
                </Link>
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground">
              <Icon icon={CalendarDays} size={16} /> Neste avganger fra Oslo — veiledende pris
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
              {DAY_OFFSETS.map((offset, i) => {
                const date = departDate(offset);
                const amount = prices[i]?.amount;
                return (
                  <li key={offset} className="flex min-h-[52px] items-center justify-between px-4">
                    <span className="text-[14px] font-medium capitalize">{fmtDay.format(new Date(`${date}T12:00:00`))}</span>
                    {hints.isLoading ? (
                      <span className="h-4 w-16 animate-pulse rounded-full bg-muted" />
                    ) : amount != null ? (
                      <span className="text-[14px] font-bold">
                        {fmtNok.format(amount)} kr
                        {cheapest === amount && (
                          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                            Billigst
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">Se pris i søk</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <PrimaryButton
            icon={Plane}
            className="w-full"
            onClick={() => {
              onClose();
              navigate(searchHref(d.iata));
            }}
          >
            Søk flyreiser til {d.city}
          </PrimaryButton>
        </div>
      )}
    </BottomSheet>
  );
}
