import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { BookingStatePill, Card, EmptyState, ErrorState, LoadingRows, PageHeader, Pill } from "./ui";
import { BOOKING_STATE_LABELS, formatDateTime, formatMoney, inputCls, selectCls } from "./helpers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export function AdminBookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stateFilter = searchParams.get("state") ?? "";
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const list = trpc.admin.bookingsList.useQuery(
    {
      query: query || undefined,
      state: stateFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
      sort: "newest",
    },
    { retry: false, placeholderData: (prev) => prev },
  );

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  function setState(state: string) {
    setPage(1);
    setSearchParams(state ? { state } : {});
  }

  return (
    <div>
      <PageHeader title="Bestillinger" description="Søk, filtrer og følg opp alle bestillinger." />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(queryInput.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Søk på referanse, e-post, telefon eller rute …"
            aria-label="Søk i bestillinger"
            className={cn(inputCls, "pl-9")}
          />
        </form>
        <select value={stateFilter} onChange={(e) => setState(e.target.value)} aria-label="Filtrer på status" className={selectCls}>
          <option value="">Alle statuser</option>
          {Object.entries(BOOKING_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {list.isLoading ? (
        <LoadingRows rows={6} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Ingen bestillinger funnet"
            hint={query || stateFilter ? "Prøv å endre søk eller filter." : "Nye bestillinger dukker opp her automatisk."}
          />
        </Card>
      ) : (
        <>
          {/* Telefon: kort, ikke en 820 px tabell dratt sidelengs. Kolonnene i
              en operasjonstabell er laget for å sammenlignes på tvers, og det
              kan man ikke gjøre når bare tre av dem er synlige om gangen. */}
          <ul className="space-y-2 sm:hidden">
            {list.data.items.map((b) => (
              <li key={b.id}>
                <Link to={`/admin/bestillinger/${b.id}`} className="admin-card block p-3.5 transition-shadow hover:admin-raise">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-primary">{b.bookingReference || b.orderId}</span>
                    <BookingStatePill state={b.state} />
                  </div>
                  <p className="mt-1.5 text-[14px] font-medium text-foreground">{b.route || "Rute ikke registrert"}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{b.passenger || "Passasjer ikke registrert"}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="admin-num text-[14px] font-medium text-foreground">{formatMoney(b.totalAmount, b.totalCurrency ?? "NOK")}</span>
                    <span className="admin-num text-[12.5px] text-subtle">{formatDateTime(b.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-x-auto p-0 sm:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 sm:px-5">Referanse</th>
                  <th className="px-4 sm:px-5">Rute</th>
                  <th className="px-4 sm:px-5">Passasjer</th>
                  <th className="px-4 text-right sm:px-5">Beløp</th>
                  <th className="px-4 sm:px-5">Status</th>
                  <th className="px-4 text-right sm:px-5">Opprettet</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((b) => (
                  <tr key={b.id} className="border-t border-[hsl(var(--chart-grid))] transition-colors">
                    <td className="whitespace-nowrap px-4 sm:px-5">
                      <Link to={`/admin/bestillinger/${b.id}`} className="font-medium text-primary hover:underline">
                        {b.bookingReference || b.orderId}
                      </Link>
                      {!b.liveMode && (
                        <Pill tone="neutral" className="ml-2">
                          <FlaskConical className="h-3 w-3" aria-hidden="true" /> Test
                        </Pill>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 font-medium text-foreground sm:px-5">{b.route || "–"}</td>
                    <td className="max-w-[200px] truncate px-4 text-muted-foreground sm:px-5" title={b.passenger}>
                      {b.passenger || "–"}
                    </td>
                    <td className="admin-num whitespace-nowrap px-4 text-right font-medium text-foreground sm:px-5">
                      {formatMoney(b.totalAmount, b.totalCurrency ?? "NOK")}
                    </td>
                    <td className="px-4 sm:px-5"><BookingStatePill state={b.state} /></td>
                    <td className="admin-num whitespace-nowrap px-4 text-right text-muted-foreground sm:px-5">{formatDateTime(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-3 flex items-center justify-between text-[13px] text-muted-foreground">
            <p>
              Viser side {list.data.page} av {totalPages} · {list.data.total} totalt
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-border-strong bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Forrige
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-border-strong bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Neste <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
