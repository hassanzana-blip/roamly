import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Bell, BellOff, Plane } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { trpc } from "@/providers/trpc";
import { formatDateShort, formatPrice } from "@/lib/format";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/** Prisvarsler — vi sender e-post når prisen faller under målet. */
export default function PriceAlerts() {
  usePageMeta(PAGE_META.priceAlerts);
  const { customer, isLoading } = useCustomer();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const list = trpc.extras.myPriceAlerts.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const del = trpc.extras.deletePriceAlert.useMutation({
    onSuccess: () => utils.extras.myPriceAlerts.invalidate(),
  });

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn");
  }, [customer, isLoading, navigate]);

  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title="Prisvarsler" back />
        <p className="mb-5 text-[14px] text-muted-foreground">
          Vi overvåker rutene dine og sender e-post når prisen faller under målet ditt.
        </p>

        <div className="space-y-2.5">
          {list.data?.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-soft"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon icon={Plane} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">
                  {a.originIata} → {a.destinationIata}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {formatDateShort(a.departDate)} · varsel under {formatPrice(a.targetPrice, "NOK")}
                </p>
              </div>
              <button
                onClick={() => del.mutate({ id: a.id })}
                aria-label="Slå av varsel"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Icon icon={BellOff} size={16} />
              </button>
            </div>
          ))}
          {list.data?.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center shadow-soft">
              <Icon icon={Bell} size={24} className="mx-auto text-muted-foreground" />
              <p className="mt-3 font-display text-xl">Ingen aktive varsler</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                Søk etter en reise og trykk «Prisvarsel» på resultatsiden, så følger vi prisen for deg.
              </p>
            </div>
          )}
        </div>
      </AppShell>
    </div>
  );
}
