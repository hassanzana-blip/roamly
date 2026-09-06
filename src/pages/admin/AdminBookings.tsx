import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  BOOKING_STATE_LABELS,
  BookingStatePill,
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Pill,
  formatDateTime,
  formatMoney,
} from "./ui";

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

      <Card className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(queryInput.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Søk på referanse, e-post, telefon eller rute …"
            aria-label="Søk i bestillinger"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-night outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </form>
        <select
          value={stateFilter}
          onChange={(e) => setState(e.target.value)}
          aria-label="Filtrer på status"
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-night outline-none focus:border-primary"
        >
          <option value="">Alle statuser</option>
          {Object.entries(BOOKING_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Card>

      {list.isLoading ? (
        <LoadingRows rows={6} />
      ) : list.error || !list.data ? (
        <ErrorState message={list.error?.message} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="Ingen bestillinger funnet"
          hint={query || stateFilter ? "Prøv å endre søk eller filter." : "Nye bestillinger dukker opp her automatisk."}
        />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-5 py-3.5">Opprettet</th>
                  <th className="px-5 py-3.5">Referanse</th>
                  <th className="px-5 py-3.5">Rute</th>
                  <th className="px-5 py-3.5">Passasjer</th>
                  <th className="px-5 py-3.5">Beløp</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.items.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-primary/[0.03]">
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">{formatDateTime(b.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/admin/bestillinger/${b.id}`} className="font-semibold text-primary hover:underline">
                        {b.bookingReference || b.orderId}
                      </Link>
                      {!b.liveMode && (
                        <Pill tone="neutral" className="ml-2">
                          <FlaskConical className="h-3 w-3" aria-hidden="true" /> Test
                        </Pill>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-night">{b.route || "–"}</td>
                    <td className="max-w-[220px] truncate px-5 py-3.5 text-muted-foreground" title={b.passenger}>
                      {b.passenger || "–"}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-night">
                      {formatMoney(b.totalAmount, b.totalCurrency ?? "NOK")}
                    </td>
                    <td className="px-5 py-3.5"><BookingStatePill state={b.state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Viser side {list.data.page} av {totalPages} · {list.data.total} totalt
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-3 py-2 font-semibold text-night disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Forrige
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-3 py-2 font-semibold text-night disabled:opacity-40"
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
