import { useState } from "react";
import { BedDouble, Car, Phone, Mail, ArrowRight, CheckCircle2, CircleSlash } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Btn, Card, EmptyState, ErrorState, LoadingRows, PageHeader, Pill } from "./ui";
import { formatDateTime } from "./helpers";

const STATUS = {
  new: { label: "Ny", tone: "danger" as const },
  in_progress: { label: "Under arbeid", tone: "warning" as const },
  done: { label: "Fullført", tone: "success" as const },
  cancelled: { label: "Avbrutt", tone: "neutral" as const },
};

const TYPE = {
  hotel: { label: "Hotell", icon: BedDouble },
  car: { label: "Leiebil", icon: Car },
};

const DETAIL_LABELS: Record<string, string> = {
  city: "By / område",
  checkin: "Innsjekk",
  checkout: "Utsjekk",
  guests: "Gjester",
  wishes: "Ønsker",
  pickup: "Hentested",
  pickupDate: "Hentedato",
  returnDate: "Returdato",
  carClass: "Bilklasse",
  driverAge: "Førerens alder",
};

export function AdminPartners() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "in_progress" | "done">("all");
  const requests = trpc.partners.listRequests.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter },
  );
  const update = trpc.partners.updateRequest.useMutation({
    onSuccess: () => utils.partners.listRequests.invalidate(),
  });

  return (
    <div>
      <PageHeader
        title="Hotell og leiebil"
        description="Forespørsler fra kundesiden — book hos partner og svar kunden."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", "new", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-bold transition-all",
              statusFilter === s ? "bg-night text-white" : "bg-night/5 text-night/60 hover:bg-night/10",
            )}
          >
            {s === "all" ? "Alle" : STATUS[s].label}
          </button>
        ))}
      </div>

      {requests.isLoading && <LoadingRows />}
      {requests.isError && <ErrorState />}
      {requests.data?.length === 0 && (
        <EmptyState title="Ingen forespørsler her ennå" hint="Nye forespørsler fra kundesiden dukker opp automatisk." />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {requests.data?.map((r) => {
          const t = TYPE[r.type as keyof typeof TYPE] ?? TYPE.hotel;
          const st = STATUS[r.status as keyof typeof STATUS] ?? STATUS.new;
          return (
            <Card key={r.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <t.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-night">{r.customerName}</h3>
                    <Pill tone="info">{t.label}</Pill>
                    {r.partner && <Pill tone="neutral">{r.partner}</Pill>}
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {r.customerEmail}</span>
                    {r.customerPhone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {r.customerPhone}</span>
                    )}
                    <span>{formatDateTime(r.createdAt)}</span>
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-night/[0.03] p-3.5 text-sm">
                {Object.entries(r.details)
                  .filter(([, v]) => v !== "" && v !== undefined)
                  .map(([k, v]) => (
                    <div key={k} className={k === "wishes" ? "col-span-2" : ""}>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {DETAIL_LABELS[k] ?? k}
                      </dt>
                      <dd className="font-medium text-night">{String(v)}</dd>
                    </div>
                  ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {r.status === "new" && (
                  <Btn tone="night" className="!px-3.5 !py-2 text-xs"
                    onClick={() => update.mutate({ id: r.id, status: "in_progress" })}>
                    <ArrowRight className="h-3.5 w-3.5" /> Start behandling
                  </Btn>
                )}
                {(r.status === "new" || r.status === "in_progress") && (
                  <>
                    <Btn tone="success" className="!px-3.5 !py-2 text-xs"
                      onClick={() => update.mutate({ id: r.id, status: "done" })}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Fullført
                    </Btn>
                    <Btn tone="ghost" className="!px-3.5 !py-2 text-xs"
                      onClick={() => update.mutate({ id: r.id, status: "cancelled" })}>
                      <CircleSlash className="h-3.5 w-3.5" /> Avbryt
                    </Btn>
                  </>
                )}
                <a
                  href={`mailto:${r.customerEmail}?subject=${encodeURIComponent(
                    r.type === "hotel" ? "Hotellforespørselen din — HelloSky" : "Leiebilforespørselen din — HelloSky",
                  )}`}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-night hover:border-night/30"
                >
                  <Mail className="h-3.5 w-3.5" /> Svar kunde
                </a>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
