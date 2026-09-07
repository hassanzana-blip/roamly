import { useState } from "react";
import { Link } from "react-router";
import { Eye } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { BookingStatePill, Btn, Card, ClickableRow, EmptyState, ErrorState, KV, LoadingRows, PageHeader, Pager, Pill, TableCard } from "../ui";
import { formatDate, formatDateTime, formatMoney, inputCls, tdCls, thCls } from "../helpers";
import { useActionFeedback } from "../useActionFeedback";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function CustomerDetail({ id, onClose, canReveal }: { id: number | null; onClose: () => void; canReveal: boolean }) {
  const fb = useActionFeedback();
  const detail = trpc.admin.customerDetail.useQuery({ id: id ?? 0 }, { enabled: id != null, retry: false });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ email: string; phone: string | null } | null>(null);
  const reveal = trpc.admin.revealCustomerContact.useMutation({
    onSuccess: (r) => { setRevealed(r); fb.flash("Kontaktinfo vist – handlingen er logget."); },
    onError: fb.fail,
  });
  const c = detail.data?.customer;

  return (
    <Sheet open={id != null} onOpenChange={(o) => { if (!o) { onClose(); setRevealed(null); fb.clear(); } }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{c?.name ?? "Kunde"}</SheetTitle>
          <SheetDescription>{c ? `Kunde siden ${formatDate(c.createdAt)}` : "Laster …"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {fb.banner}
          {detail.isLoading ? (
            <LoadingRows rows={3} />
          ) : detail.error || !detail.data || !c ? (
            <ErrorState error={detail.error} />
          ) : (
            <>
              <KV
                items={[
                  { k: "E-post", v: revealed?.email ?? c.email },
                  { k: "Telefon", v: revealed ? (revealed.phone ?? "–") : (c.phone ?? "–") },
                ]}
              />
              {canReveal && !revealed && (
                <Btn tone="ghost" onClick={() => setConfirmOpen(true)} disabled={reveal.isPending}>
                  <Eye className="h-4 w-4" aria-hidden="true" /> Vis full kontaktinfo
                </Btn>
              )}
              <Tabs defaultValue="bookings">
                <TabsList>
                  <TabsTrigger value="bookings">Bestillinger ({detail.data.bookings.length})</TabsTrigger>
                  <TabsTrigger value="quotes">Tilbud ({detail.data.quotes.length})</TabsTrigger>
                  <TabsTrigger value="cases">Saker ({detail.data.cases.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="bookings">
                  {detail.data.bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen bestillinger.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {detail.data.bookings.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <Link to={`/admin/bestillinger/${b.id}`} className="font-semibold text-primary hover:underline">{b.bookingReference ?? `#${b.id}`}</Link>
                          <span className="text-muted-foreground">{formatMoney(b.totalAmount, b.totalCurrency ?? "NOK")}</span>
                          <BookingStatePill state={b.state} />
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
                <TabsContent value="quotes">
                  {detail.data.quotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen tilbud.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {detail.data.quotes.map((q) => (
                        <li key={q.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <span className="font-semibold text-foreground">{q.reference}</span>
                          <span className="text-muted-foreground">{formatMoney(q.totalAmount, q.currency)}</span>
                          <Pill>{q.status}</Pill>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
                <TabsContent value="cases">
                  {detail.data.cases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen saker.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {detail.data.cases.map((s) => (
                        <li key={s.id} className="py-2.5 text-sm">
                          <Link to={`/admin/kundeservice?case=${s.id}`} className="font-semibold text-primary hover:underline">{s.reference}</Link>
                          <span className="ml-2 text-foreground">{s.subject}</span>
                          <span className="block text-xs text-muted-foreground">{s.status} · {formatDateTime(s.updatedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vise full kontaktinformasjon?</AlertDialogTitle>
              <AlertDialogDescription>
                Handlingen logges i aktivitetsloggen med ditt navn og IP-adresse. Gjør dette kun når det er nødvendig for å hjelpe kunden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={() => id != null && reveal.mutate({ customerId: id })}>Vis</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {fb.reauthDialog}
      </SheetContent>
    </Sheet>
  );
}

export function AdminCustomers() {
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("customers");
  const [selected, setSelected] = useState<number | null>(null);
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canReveal = perms.data?.permissions.includes("customers:reveal") ?? false;
  const list = trpc.admin.customersList.useQuery({ query: query || undefined, page, pageSize: 25 }, { retry: false, placeholderData: (p) => p, enabled: tab === "customers" });
  const accounts = trpc.admin.accountList.useQuery({ query: query || undefined }, { retry: false, enabled: tab === "accounts" });

  return (
    <div>
      <PageHeader title="Kunder" description="Kontaktinformasjon er maskert som standard. Full visning krever egen tillatelse og logges." />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TabsList>
            <TabsTrigger value="customers">Bookingkunder</TabsTrigger>
            <TabsTrigger value="accounts">Registrerte kontoer</TabsTrigger>
          </TabsList>
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(input.trim()); }}>
            <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Søk på navn, e-post eller telefon …" aria-label="Søk i kunder" className={`${inputCls} sm:max-w-md`} />
          </form>
        </div>

        <TabsContent value="accounts">
          {accounts.isLoading ? (
            <LoadingRows rows={5} />
          ) : accounts.error || !accounts.data ? (
            <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />
          ) : accounts.data.length === 0 ? (
            <EmptyState title="Ingen kontoer funnet" hint="Kunder registrerer seg fra innloggingssiden." />
          ) : (
            <TableCard minWidth={760} caption="Registrerte kundekontoer">
              <thead>
                <tr className="border-b border-border">
                  <th className={thCls}>Navn</th>
                  <th className={thCls}>E-post</th>
                  <th className={thCls}>Telefon</th>
                  <th className={thCls}>Bekreftet</th>
                  <th className={thCls}>Bonus</th>
                  <th className={thCls}>Bookinger</th>
                  <th className={thCls}>Registrert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.data.map((a) => (
                  <tr key={a.id}>
                    <td className={`${tdCls} font-semibold text-foreground`}>{a.name}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{a.email}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{a.phone}</td>
                    <td className={tdCls}>{a.emailVerified ? <Pill tone="success">Ja</Pill> : <Pill tone="warning">Nei</Pill>}</td>
                    <td className={`${tdCls} text-foreground`}>{a.bonusKr ?? 0} kr</td>
                    <td className={`${tdCls} text-foreground`}>{a.bookings}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </TabsContent>

        <TabsContent value="customers">
          {list.isLoading ? (
            <LoadingRows rows={5} />
          ) : list.error || !list.data ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <EmptyState title="Ingen kunder funnet" hint="Kunder opprettes automatisk ved booking." />
          ) : (
            <TableCard minWidth={680} caption="Bookingkunder">
              <thead>
                <tr className="border-b border-border">
                  <th className={thCls}>Navn</th>
                  <th className={thCls}>E-post</th>
                  <th className={thCls}>Telefon</th>
                  <th className={thCls}>Bookinger</th>
                  <th className={thCls}>Kunde siden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.items.map((c) => (
                  <ClickableRow key={c.id} onClick={() => setSelected(c.id)} selected={selected === c.id}>
                    <td className={`${tdCls} font-semibold text-foreground`}>{c.name}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{c.email}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{c.phone}</td>
                    <td className={`${tdCls} text-foreground`}>{c.bookings}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{formatDate(c.createdAt)}</td>
                  </ClickableRow>
                ))}
              </tbody>
            </TableCard>
          )}
          {list.data && <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />}
        </TabsContent>
      </Tabs>
      <CustomerDetail id={selected} onClose={() => setSelected(null)} canReveal={canReveal} />
    </div>
  );
}

export function AdminPayments() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = trpc.admin.paymentsList.useQuery({ status: status || undefined, page, pageSize: 25 }, { retry: false, placeholderData: (p) => p });

  return (
    <div>
      <PageHeader title="Betalinger" description="Alle registrerte betalinger. Kortdata håndteres av Stripe – HelloSky ser aldri kortnummer." />
      <Card className="mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filtrer på status" className="min-h-11 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary">
          <option value="">Alle statuser</option>
          <option value="pending">Venter</option>
          <option value="authorized">Reservert</option>
          <option value="captured">Fanget</option>
          <option value="succeeded">Fullført</option>
          <option value="refunded">Refundert</option>
          <option value="failed">Feilet</option>
        </select>
      </Card>
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Ingen betalinger registrert" hint="Betalinger registreres når kunden betaler i kjøpsløpet eller et tilbud merkes som betalt." />
      ) : (
        <TableCard minWidth={760} caption="Betalinger">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Dato</th>
              <th className={thCls}>Beløp</th>
              <th className={thCls}>Refundert</th>
              <th className={thCls}>Leverandør</th>
              <th className={thCls}>Tilknytning</th>
              <th className={thCls}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.data.items.map((p) => (
              <tr key={p.id}>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{formatDateTime(p.createdAt)}</td>
                <td className={`${tdCls} whitespace-nowrap font-semibold text-foreground`}>{formatMoney(p.amount, p.currency)}</td>
                <td className={`${tdCls} whitespace-nowrap text-muted-foreground`}>{p.refundedMinor ? formatMoney(p.refundedMinor / 100, p.currency) : "–"}</td>
                <td className={tdCls}>
                  <span className="text-foreground">{p.provider}</span>
                  {p.providerRef && <span className="block max-w-[180px] truncate font-mono text-[11px] text-muted-foreground" title={p.providerRef}>{p.providerRef}</span>}
                </td>
                <td className={tdCls}>
                  {p.bookingId ? (
                    <Link to={`/admin/bestillinger/${p.bookingId}`} className="font-semibold text-primary hover:underline">{p.bookingReference ?? `Bestilling #${p.bookingId}`}</Link>
                  ) : p.quoteReference ? (
                    <span className="text-muted-foreground">Tilbud {p.quoteReference}</span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
                <td className={tdCls}>
                  <Pill tone={["succeeded", "captured"].includes(p.status) ? "success" : p.status === "failed" ? "danger" : p.status === "refunded" ? "info" : "warning"}>
                    {{ succeeded: "Fullført", captured: "Fanget", authorized: "Reservert", pending: "Venter", failed: "Feilet", refunded: "Refundert" }[p.status] ?? p.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
      {list.data && <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />}
    </div>
  );
}
