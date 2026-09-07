import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, Copy, Heart, MapPin, Plane, Plus, Send, StickyNote, Trash2 } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import BottomSheet from "@/components/app/BottomSheet";
import { PrimaryButton } from "@/components/app/primitives";
import { WhatsAppIcon } from "@/components/WhatsAppFab";
import { useCustomer } from "@/lib/useCustomer";
import { ALL_DESTINATIONS, destinationById, searchHref } from "@/content/discover";
import { rememberName, rememberedName, voterKey } from "@/lib/matchKeys";
import { formatDateShort } from "@/lib/format";
import { usePageMeta } from "@/lib/seo";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";

type Board = RouterOutputs["boards"]["get"];
type Item = Board["items"][number];
const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-foreground/30 placeholder:text-muted-foreground/60";

/** Delekortet: turens idé i ett bilde – tydelig merket som idé, ikke bestilling. */
function TripIdeaCard({ board }: { board: Board }) {
  const cover = board.coverDestinationId ? destinationById(board.coverDestinationId) : (board.items.find((i) => i.kind === "destination" && i.refId) ? destinationById(board.items.find((i) => i.kind === "destination")!.refId!) : undefined);
  const places = board.items.filter((i) => i.kind === "destination").map((i) => destinationById(i.refId ?? "")?.city).filter(Boolean);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-night text-white">
      {cover?.image && <img src={cover.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" aria-hidden="true" />
      <div className="relative flex min-h-[220px] flex-col justify-end p-5 sm:min-h-[280px] sm:p-7">
        <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">Reiseidé – ikke en bestilling</p>
        <h1 className="font-display mt-2 text-[34px] leading-[1.02] sm:text-[46px]">{board.title}</h1>
        <p className="mt-2 text-[14px] text-white/80">{[board.when, places.slice(0, 3).join(" · ")].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

function ItemCard({ item, board, onVote, onRemove, busy }: { item: Item; board: Board; onVote: () => void; onRemove: () => void; busy: boolean }) {
  const d = item.kind === "destination" && item.refId ? destinationById(item.refId) : undefined;
  const p = (item.payload ?? {}) as { route?: string; date?: string; returnDate?: string; priceLabel?: string; title?: string; href?: string };
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      {d?.image && <img src={d.image} alt={d.imageAlt} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {item.kind === "destination" && d && <><p className="text-[16px] font-semibold">{d.city}</p><p className="text-[12px] text-muted-foreground">{d.country} · {d.tagline}</p></>}
            {item.kind === "flight" && <><p className="flex items-center gap-1.5 text-[16px] font-semibold"><Icon icon={Plane} size={16} /> {p.route ?? "Flyreise"}</p><p className="text-[12px] text-muted-foreground">{p.date ? formatDateShort(p.date) : ""}{p.returnDate ? ` – ${formatDateShort(p.returnDate)}` : ""}{p.priceLabel ? ` · ${p.priceLabel} (da det ble lagret)` : ""}</p></>}
            {item.kind === "article" && <p className="text-[16px] font-semibold">{p.title ?? item.refId}</p>}
            {item.kind === "note" && <p className="flex items-start gap-2 text-[15px] leading-relaxed"><Icon icon={StickyNote} size={16} className="mt-1 shrink-0 text-muted-foreground" /> {item.note}</p>}
            {item.kind !== "note" && item.note && <p className="mt-1.5 text-[13px] text-muted-foreground">«{item.note}»</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">Lagt til av {item.addedByName ?? "—"}</p>
          </div>
          {board.canEdit && <button type="button" onClick={onRemove} disabled={busy} aria-label="Fjern" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive"><Icon icon={Trash2} size={14} /></button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onVote} disabled={busy} aria-pressed={item.votedByMe} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold", item.votedByMe ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40")}><Icon icon={Heart} size={14} /> {item.votes}</button>
          {item.voters.length > 0 && <span className="text-[11px] text-muted-foreground">{item.voters.join(", ")}</span>}
          <span className="flex-1" />
          {d && <Link to={searchHref(d.iata)} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-primary"><Icon icon={Plane} size={14} /> Søk fly</Link>}
          {item.kind === "flight" && p.href && <Link to={p.href} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-primary"><Icon icon={Plane} size={14} /> Se i søket</Link>}
        </div>
      </div>
    </li>
  );
}

export default function BoardPage() {
  const { token = "" } = useParams<{ token: string }>();
  usePageMeta({ title: "Reisetavle", description: "En tur, samlet på ett sted.", canonicalPath: `/tavler/${token}`, noindex: true });
  const navigate = useNavigate();
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const [vk] = useState(voterKey);
  const q = trpc.boards.get.useQuery({ token, voterKey: vk }, { enabled: /^[a-f0-9]{24}$/.test(token), retry: false, refetchInterval: 30_000 });
  const invalidate = () => utils.boards.get.invalidate({ token, voterKey: vk });
  const [name, setName] = useState(rememberedName);
  const guestName = customer ? undefined : name.trim() || undefined;
  const vote = trpc.boards.vote.useMutation({ onSuccess: invalidate });
  const addItem = trpc.boards.addItem.useMutation({ onSuccess: () => { invalidate(); setNote(""); setPickOpen(false); } });
  const removeItem = trpc.boards.removeItem.useMutation({ onSuccess: invalidate });
  const comment = trpc.boards.comment.useMutation({ onSuccess: () => { setBody(""); invalidate(); } });
  const remove = trpc.boards.remove.useMutation({ onSuccess: () => navigate("/tavler") });
  const [note, setNote] = useState("");
  const [body, setBody] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const b = q.data;
  const needName = !customer && !name.trim();

  const copy = async () => { if (!b) return; try { await navigator.clipboard.writeText(b.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignorer */ } };
  const anyError = vote.error ?? addItem.error ?? removeItem.error ?? comment.error ?? remove.error;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-3xl">
        <AppHeader title={undefined} back={Boolean(customer)} />
        {q.isError && <div className="rounded-xl border border-border bg-card p-6"><p className="font-display text-2xl">Fant ikke tavla.</p><p className="mt-2 text-sm text-muted-foreground">{humanMessage(q.error)}</p></div>}
        {b && (
          <>
            <TripIdeaCard board={b} />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[14px] font-semibold"><Icon icon={copied ? Check : Copy} size={16} /> {copied ? "Kopiert" : "Kopier lenke"}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`«${b.title}» – legg til og stem: ${b.shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[14px] font-semibold"><WhatsAppIcon className="h-4 w-4" /> Del</a>
              <span className="flex-1" />
              {b.canEdit && <button type="button" onClick={() => { if (confirm("Slette tavla og alt på den?")) remove.mutate({ token }); }} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-destructive"><Icon icon={Trash2} size={14} /> Slett tavle</button>}
            </div>

            {!customer && (
              <label className="mt-5 block"><span className="mb-1.5 block eyebrow">Navnet ditt (for stemmer og notater)</span><input value={name} onChange={(e) => { setName(e.target.value); rememberName(e.target.value); }} maxLength={40} placeholder="Slik de andre ser deg" className={inputCls} /></label>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPickOpen(true)} disabled={needName} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background disabled:opacity-50"><Icon icon={MapPin} size={16} /> Legg til reisemål</button>
              <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[14px] font-semibold"><Icon icon={Plane} size={16} /> Finn en flyreise</Link>
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {b.items.map((item) => (
                <ItemCard key={item.id} item={item} board={b} busy={vote.isPending || removeItem.isPending} onVote={() => { if (needName) return; vote.mutate({ token, itemId: item.id, voterKey: vk, name: guestName }); }} onRemove={() => removeItem.mutate({ token, itemId: item.id })} />
              ))}
            </ul>
            {b.items.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-5 text-[13px] text-muted-foreground">Tomt ennå. Legg til reisemålene dere vurderer, så kan alle stemme.</p>}

            <form onSubmit={(e) => { e.preventDefault(); if (note.trim() && !needName) addItem.mutate({ token, kind: "note", note: note.trim(), name: guestName }); }} className="mt-6 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Legg til et notat: «Ahmed har ikke pass ennå» …" className={inputCls} />
              <PrimaryButton type="submit" disabled={!note.trim() || needName || addItem.isPending} className="shrink-0 px-4" aria-label="Legg til notat"><Icon icon={Plus} size={20} /></PrimaryButton>
            </form>

            <section className="mt-8">
              <h2 className="font-display text-xl">Kommentarer</h2>
              <ul className="mt-2 space-y-2">{b.comments.map((c) => <li key={c.id} className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-[14px]"><span className="font-semibold">{c.name}</span> <span className="text-muted-foreground">{c.body}</span></li>)}</ul>
              <form onSubmit={(e) => { e.preventDefault(); if (body.trim() && !needName) comment.mutate({ token, body: body.trim(), name: guestName }); }} className="mt-3 flex gap-2">
                <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Skriv til gjengen …" className={inputCls} />
                <PrimaryButton type="submit" disabled={!body.trim() || needName || comment.isPending} className="shrink-0 px-4" aria-label="Send"><Icon icon={Send} size={20} /></PrimaryButton>
              </form>
            </section>
            {anyError && <p role="alert" className="mt-4 text-[13px] text-destructive">{humanMessage(anyError)}</p>}
          </>
        )}
      </AppShell>

      <BottomSheet open={pickOpen} onClose={() => setPickOpen(false)} title="Legg til reisemål" snapPoints={[0.9]}>
        <ul className="grid grid-cols-3 gap-2 pb-2 sm:grid-cols-4">
          {ALL_DESTINATIONS.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => addItem.mutate({ token, kind: "destination", refId: d.id, name: guestName })} disabled={addItem.isPending} className="group relative block w-full overflow-hidden rounded-lg text-left">
                <span className="block aspect-[4/3] bg-night">{d.image && <img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/85 to-transparent px-2 pb-1.5 pt-6 text-[12px] font-semibold text-white">{d.city}</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
