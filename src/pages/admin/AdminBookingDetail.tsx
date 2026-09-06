import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Mail,
  RefreshCw,
  FlaskConical,
  MessageSquarePlus,
  PlaneTakeoff,
  PlaneLanding,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  BOOKING_STATE_LABELS,
  BookingStatePill,
  Card,
  EmptyState,
  ErrorState,
  LoadingRows,
  Pill,
  STAFF_TRANSITION_TARGETS,
  formatDateTime,
  formatMoney,
} from "./ui";

type PayloadSlice = {
  origin?: { iata?: string; cityName?: string; name?: string };
  destination?: { iata?: string; cityName?: string; name?: string };
  departingAt?: string;
  arrivingAt?: string;
  duration?: string;
};
type PayloadPassenger = { givenName?: string; familyName?: string; bornOn?: string; type?: string };
type Segment = {
  id: number;
  sliceIndex: number;
  carrierIata: string | null;
  flightNumber: string | null;
  originIata: string;
  destinationIata: string;
  departingAt: string;
  arrivingAt: string;
};

export function AdminBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const utils = trpc.useUtils();

  const detail = trpc.admin.bookingDetail.useQuery({ id: bookingId }, { retry: false });
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [transitionTo, setTransitionTo] = useState("");
  const [transitionReason, setTransitionReason] = useState("");

  const invalidate = () => utils.admin.bookingDetail.invalidate({ id: bookingId });
  const flash = (msg: string) => {
    setActionOk(msg);
    setActionError(null);
  };
  const fail = (msg: string) => {
    setActionError(msg);
    setActionOk(null);
  };

  const addNote = trpc.admin.addBookingNote.useMutation({
    onSuccess: () => { setNote(""); flash("Notat lagret."); invalidate(); },
    onError: (e) => fail(e.message),
  });
  const resend = trpc.admin.resendConfirmation.useMutation({
    onSuccess: () => flash("Bekreftelse er lagt i e-postkøen."),
    onError: (e) => fail(e.message),
  });
  const reconcile = trpc.admin.reconcileBooking.useMutation({
    onSuccess: () => flash("Avstemming mot Duffel er lagt i kø."),
    onError: (e) => fail(e.message),
  });
  const transition = trpc.admin.bookingTransition.useMutation({
    onSuccess: (r) => {
      setTransitionTo("");
      setTransitionReason("");
      flash(`Status endret til «${r.newStateLabel}».`);
      invalidate();
      utils.admin.bookingsList.invalidate();
    },
    onError: (e) => fail(e.message),
  });

  if (detail.isLoading) return <LoadingRows rows={6} />;
  if (detail.error || !detail.data) return <ErrorState message={detail.error?.message} />;

  const { booking, events, segments, payments, refunds, notes, cases, quote } = detail.data;
  const payload = booking.payload as {
    slices?: PayloadSlice[];
    passengers?: PayloadPassenger[];
  };
  const allowedTargets = STAFF_TRANSITION_TARGETS[booking.state] ?? [];
  const busy = resend.isPending || reconcile.isPending || transition.isPending || addNote.isPending;

  return (
    <div>
      <Link
        to="/admin/bestillinger"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Alle bestillinger
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-night sm:text-3xl">
          {booking.bookingReference || booking.orderId}
        </h1>
        <BookingStatePill state={booking.state} />
        {!booking.liveMode && (
          <Pill tone="neutral"><FlaskConical className="h-3 w-3" aria-hidden="true" /> Testmodus</Pill>
        )}
        <span className="text-sm text-muted-foreground">
          Opprettet {formatDateTime(booking.createdAt)} · {booking.source === "quote" ? "Fra tilbud" : "Direkte fra nettsiden"}
        </span>
      </div>

      {(actionError || actionOk) && (
        <div
          role="status"
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
            actionError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {actionError ?? actionOk}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Venstre: detaljer */}
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <h2 className="mb-4 font-display text-lg font-bold text-night">Reise og passasjerer</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kontakt</dt>
                <dd className="mt-1 text-night">{booking.contactEmail}</dd>
                {booking.contactPhone && <dd className="text-muted-foreground">{booking.contactPhone}</dd>}
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Beløp</dt>
                <dd className="mt-1 font-display text-xl font-bold text-night">
                  {formatMoney(booking.totalAmount, booking.totalCurrency ?? "NOK")}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Passasjerer</dt>
                <dd className="mt-1 text-night">
                  {(payload.passengers ?? [])
                    .map((p) => `${p.givenName ?? ""} ${p.familyName ?? ""}`.trim())
                    .filter(Boolean)
                    .join(", ") || "–"}
                </dd>
              </div>
            </dl>

            {quote && (
              <p className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-sm text-night">
                Bestilt fra tilbud <Link to={`/admin/tilbud/${quote.id}`} className="font-semibold text-primary hover:underline">{quote.reference}</Link>
              </p>
            )}
          </Card>

          <Card className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 font-display text-lg font-bold text-night">Flysegmenter</h2>
            {segments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Ingen segmenter registrert.</p>
            ) : (
              <table className="mt-3 w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="px-5 py-3">Flight</th>
                    <th className="px-5 py-3">Fra</th>
                    <th className="px-5 py-3">Til</th>
                    <th className="px-5 py-3">Avgang</th>
                    <th className="px-5 py-3">Ankomst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(segments as Segment[]).map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-semibold text-night">
                        {s.carrierIata ?? ""}{s.flightNumber ?? ""}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <PlaneTakeoff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          {s.originIata}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <PlaneLanding className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          {s.destinationIata}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(s.departingAt)}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(s.arrivingAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-5 py-4" />
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-lg font-bold text-night">Betalinger og refusjoner</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen betalinger registrert ennå.</p>
            ) : (
              <ul className="space-y-3">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-night">{formatMoney(p.amount, p.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.provider} · {formatDateTime(p.createdAt)}
                      </p>
                    </div>
                    <Pill tone={p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : "warning"}>
                      {p.status}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
            {refunds.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-border pt-3">
                {refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-night">{formatMoney(r.amount, booking.totalCurrency ?? "NOK")} refundert</span>
                    <Pill tone={r.status === "processed" ? "success" : "warning"}>{r.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-lg font-bold text-night">Hendelseslogg</h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen hendelser registrert.</p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-border pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary" aria-hidden="true" />
                    <p className="text-sm text-night">
                      {e.fromState ? <>{e.fromState} → </> : null}
                      <span className="font-semibold">{e.toState}</span>
                      <span className="text-muted-foreground"> · {e.actorType}</span>
                    </p>
                    {e.reason && <p className="mt-0.5 text-xs text-muted-foreground">{e.reason}</p>}
                    <time className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</time>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Høyre: handlinger og notater */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-lg font-bold text-night">Handlinger</h2>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => resend.mutate({ bookingId })}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-night transition-colors hover:border-primary/40 disabled:opacity-50"
              >
                <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                Send bekreftelse på nytt
              </button>
              <button
                type="button"
                onClick={() => reconcile.mutate({ bookingId })}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-night transition-colors hover:border-primary/40 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
                Avstem mot Duffel nå
              </button>
            </div>

            {allowedTargets.length > 0 && (
              <form
                className="mt-5 space-y-3 border-t border-border pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!transitionTo || transitionReason.trim().length < 3) return;
                  transition.mutate({ bookingId, toState: transitionTo as never, reason: transitionReason.trim() });
                }}
              >
                <label className="block text-sm font-semibold text-night" htmlFor="transition-to">
                  Endre status
                </label>
                <select
                  id="transition-to"
                  value={transitionTo}
                  onChange={(e) => setTransitionTo(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-night outline-none focus:border-primary"
                >
                  <option value="">Velg ny status …</option>
                  {allowedTargets.map((s) => (
                    <option key={s} value={s}>{BOOKING_STATE_LABELS[s] ?? s}</option>
                  ))}
                </select>
                <textarea
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Begrunnelse (påkrevd, minst 3 tegn) – logges i aktivitetsloggen"
                  aria-label="Begrunnelse for statusendring"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-night outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={busy || !transitionTo || transitionReason.trim().length < 3}
                  className="w-full rounded-xl bg-night px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {transition.isPending ? "Endrer …" : "Bekreft statusendring"}
                </button>
              </form>
            )}

            {cases.length > 0 && (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                {cases.length} tilknyttede kundesaker ·{" "}
                <Link to="/admin/kundeservice" className="font-semibold text-primary hover:underline">
                  Åpne kundeservice
                </Link>
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-night">
              <MessageSquarePlus className="h-5 w-5 text-primary" aria-hidden="true" />
              Interne notater
            </h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) addNote.mutate({ bookingId, body: note.trim() });
              }}
            >
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Skriv et internt notat (kun synlig for ansatte) …"
                aria-label="Nytt internt notat"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-night outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={busy || !note.trim()}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {addNote.isPending ? "Lagrer …" : "Legg til notat"}
              </button>
            </form>
            {notes.length > 0 && (
              <ul className="mt-4 space-y-3 border-t border-border pt-4">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-background px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-night">{n.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {n.author} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {notes.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Ingen notater ennå.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AdminBookingsEmpty() {
  return <EmptyState title="Velg en bestilling" hint="Åpne listen over bestillinger først." />;
}
