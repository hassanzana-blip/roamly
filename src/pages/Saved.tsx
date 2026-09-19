import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bookmark, CalendarDays, ChevronRight, Clock3, FileText, Heart, Info, Pencil, Plane, Plus, Search, Share, Trash2, X } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { GreetingBar } from "@/components/app/TopBar";
import DestinationCard from "@/components/travel/DestinationCard";
import DestinationSheet from "@/components/app/DestinationSheet";
import Icon from "@/components/app/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DateRangeField } from "@/components/search/DateField";
import { rangeLabel } from "@/components/search/dateUtils";
import { useSavedDestinations } from "@/lib/useAccount";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { loadRecentSearches, onRecentSearchesChange, recentSearchHref, type RecentSearch } from "@/lib/recentSearches";
import { collectionImage, useCollections, type Collection, type SavedFlight, type SavedHotel } from "@/lib/collections";
import { destinationById, imageSrcSet, type DiscoverDestination } from "@/content/discover";
import { formatDateShort, formatMinor, formatMoney } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

/**
 * Lagret (HelloSky 4.0).
 *
 * Den nyeste samlingen først: fotografiet, tittelen, «Lagret samling · Ikke
 * bestilt», datoene i mint, flyet og hotellet du lagret med prisen slik den
 * var, «Sjekk oppdatert pris», notatet i lavendel og «Legg til et sted».
 * Alt ligger i denne nettleseren – vi lover ikke synk mellom enheter. Under
 * samlingen: reisemålene du har hjertet, og de siste søkene.
 */

function FlightRow({ item, editing, onRemove }: { item: SavedFlight; editing: boolean; onRemove: () => void }) {
  const t = useT();
  return (
    <li className="py-4">
      <div className="flex items-start gap-4">
        <Icon icon={Plane} size={28} className="mt-1 shrink-0 text-petrol" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-muted-foreground">{t("sv.flight")}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[22px] font-bold leading-tight text-petrol">
            <span className="truncate">{item.fromCity}</span>
            <Icon icon={ArrowRight} size={20} className="shrink-0" />
            <span className="truncate">{item.toCity}</span>
          </p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {formatDateShort(item.depart)}
            {item.ret ? ` – ${formatDateShort(item.ret)} · ${t("sr.roundtrip.cap")}` : ` · ${t("sr.oneway.cap")}`} · {item.airline}
          </p>
          <p className="t-num mt-1 text-[15px] text-muted-foreground">
            {formatMinor(item.priceMinor, item.currency)} · {t("oc.at", { name: item.provider })}
          </p>
        </div>
        {editing ? (
          <button type="button" onClick={onRemove} aria-label={t("sv.remove.item")} className="grid size-12 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring">
            <Icon icon={Trash2} size={24} />
          </button>
        ) : (
          <Icon icon={Bookmark} size={28} className="mt-1 shrink-0 fill-current text-petrol" />
        )}
      </div>
      <Link to={item.searchHref} className="mt-3 flex min-h-14 items-center gap-4 rounded-xl px-1 text-petrol transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
        <Icon icon={Search} size={28} className="shrink-0" />
        <span className="flex-1 text-[18px] font-medium">{t("sv.recheck")}</span>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white"><Icon icon={ChevronRight} size={24} /></span>
      </Link>
    </li>
  );
}

function HotelRow({ item, editing, onRemove }: { item: SavedHotel; editing: boolean; onRemove: () => void }) {
  const t = useT();
  return (
    <li className="flex items-center gap-3 py-4 sm:gap-4">
      <span className="block size-[96px] shrink-0 overflow-hidden rounded-2xl bg-secondary sm:h-[112px] sm:w-[132px]">
        {item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Icon icon={Heart} size={24} /></span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-muted-foreground">{t("sv.hotel")}</p>
        <p className="mt-0.5 line-clamp-2 text-[20px] font-bold leading-tight text-petrol sm:text-[22px]">{item.name}</p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {rangeLabel(item.checkin, item.checkout)} · {t("ht.nights", { count: item.nights })}
        </p>
        <p className="t-num mt-0.5 text-[15px] text-muted-foreground">
          {item.priceAmount > 0 ? `${formatMoney(item.priceAmount, item.currency)} · ` : ""}{item.sandbox ? t("sr.examples") : item.provider}
        </p>
      </div>
      {editing ? (
        <button type="button" onClick={onRemove} aria-label={t("sv.remove.item")} className="grid size-12 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring">
          <Icon icon={Trash2} size={24} />
        </button>
      ) : (
        <Button asChild className="h-12 shrink-0 rounded-xl px-3.5 text-[16px] font-bold sm:px-4 sm:text-[17px]">
          <Link to={item.href}>{t("ht.detail.seerooms")} <Icon icon={ArrowRight} size={20} /></Link>
        </Button>
      )}
    </li>
  );
}

function CollectionView({ c, api }: { c: Collection; api: ReturnType<typeof useCollections> }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(c.note);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState({ depart: c.depart ?? "", ret: c.ret ?? "" });
  const [adultsDraft, setAdultsDraft] = useState(c.adults);
  const [titleDraft, setTitleDraft] = useState(c.title);
  const [notice, setNotice] = useState("");
  const image = collectionImage(c);
  // Drafts start from the stored collection; the parent remounts this view per collection (key), so they never go stale.
  const dest = c.destinationId ? destinationById(c.destinationId) : undefined;

  const share = async () => {
    const lines = [
      t("sv.share.text", { title: c.title }),
      c.depart ? (c.ret ? rangeLabel(c.depart, c.ret) : formatDateShort(c.depart)) : "",
      ...c.items.map((i) => (i.kind === "flight" ? `${t("sv.flight")}: ${i.fromCity} → ${i.toCity} · ${formatDateShort(i.depart)} · ${i.airline} · ${formatMinor(i.priceMinor, i.currency)} (${t("sv.savedat", { date: formatDateShort(new Date(i.savedAt).toISOString()) })})` : `${t("sv.hotel")}: ${i.name} · ${rangeLabel(i.checkin, i.checkout)} · ${formatMoney(i.priceAmount, i.currency)}`)),
      c.note ? `${t("sv.note")}: ${c.note}` : "",
      t("sv.pricenote"),
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: c.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setNotice(t("sv.copied"));
    } catch {
      /* cancelled, or no clipboard */
    }
  };

  const dates = c.depart ? (c.ret ? rangeLabel(c.depart, c.ret) : formatDateShort(c.depart)) : t("sv.dates.none");

  return (
    <section aria-labelledby={`col-${c.id}`}>
      {/* Fotografiet: reisemålets bilde når vi har det, ellers hotellets. */}
      <div className="relative isolate -mx-5 aspect-[16/9] overflow-hidden bg-petrol text-white sm:-mx-8 sm:aspect-[21/9] lg:mx-0 lg:rounded-2xl">
        {image && <img src={image} srcSet={dest?.image ? imageSrcSet(dest.image) : undefined} sizes="100vw" alt={dest?.imageAlt ?? ""} className="absolute inset-0 -z-10 h-full w-full object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-petrol/80 via-petrol/15 to-transparent" aria-hidden="true" />
        <button type="button" onClick={share} aria-label={t("sv.share")} className="absolute right-4 top-4 grid size-14 place-items-center rounded-full bg-white text-petrol shadow-soft transition-transform active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <Icon icon={Share} size={28} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          {editing ? (
            <label className="block max-w-md">
              <span className="sr-only">{t("sv.title.edit")}</span>
              <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => titleDraft.trim() && api.update(c.id, { title: titleDraft.trim() })} className="h-12 rounded-xl bg-white text-[18px] font-bold text-petrol" />
            </label>
          ) : (
            <h2 id={`col-${c.id}`} className="t-display text-white">{c.title}</h2>
          )}
          <p className="mt-1 text-[17px] font-medium text-white/90">{t("sv.collection")} · {t("sv.notbooked")}</p>
        </div>
      </div>

      {notice && <p role="status" className="mt-3 rounded-xl bg-lavender px-4 py-3 text-[15px] font-medium text-petrol">{notice}</p>}

      {/* Datoene og reisefølget: felles for hele samlingen, med «Endre». */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-mint px-5 py-4 text-petrol">
        <Icon icon={CalendarDays} size={28} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-bold leading-tight">{dates}</p>
          <p className="mt-0.5 text-[16px] text-muted-foreground">{t("pax.adults", { count: c.adults })}</p>
        </div>
        <button type="button" onClick={() => setDatesOpen(true)} className="inline-flex min-h-11 items-center gap-0.5 text-[17px] font-semibold text-azure-ink underline-offset-4 hover:underline">
          {t("common.change")} <Icon icon={ChevronRight} size={20} />
        </button>
      </div>

      <Sheet open={datesOpen} onOpenChange={setDatesOpen}>
        <SheetContent side="bottom" className="rounded-t-[20px]">
          <SheetHeader><SheetTitle>{t("sv.dates.edit")}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <DateRangeField depart={dateDraft.depart} ret={dateDraft.ret} roundtrip min={new Date().toISOString().slice(0, 10)} onChange={setDateDraft} variant="row" />
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <span className="text-[16px] font-medium">{t("pax.adults", { count: adultsDraft })}</span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => setAdultsDraft((a) => Math.max(1, a - 1))} disabled={adultsDraft <= 1} aria-label={t("sw.fewer", { type: t("pax.adults", { count: 2 }).replace(/^\d+\s/, "") })} className="grid size-11 place-items-center rounded-full border border-input text-petrol disabled:opacity-30">–</button>
                <button type="button" onClick={() => setAdultsDraft((a) => Math.min(9, a + 1))} aria-label={t("sw.more", { type: t("pax.adults", { count: 2 }).replace(/^\d+\s/, "") })} className="grid size-11 place-items-center rounded-full border border-input text-petrol">+</button>
              </span>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              size="lg"
              className="h-[52px] rounded-xl text-[17px] font-bold"
              onClick={() => {
                api.update(c.id, { depart: dateDraft.depart || undefined, ret: dateDraft.ret || undefined, adults: adultsDraft });
                setDatesOpen(false);
              }}
            >
              {t("sv.done")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Det du har lagret */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <h3 className="t-h2">{t("sv.yousaved")}</h3>
        <button type="button" onClick={() => setEditing((e) => !e)} aria-pressed={editing} className="inline-flex min-h-11 items-center text-[17px] font-semibold text-azure-ink underline-offset-4 hover:underline">
          {editing ? t("sv.done") : t("sv.edit")}
        </button>
      </div>
      <ul className="mt-1 divide-y divide-border border-y border-border">
        {c.items.map((item) =>
          item.kind === "flight" ? (
            <FlightRow key={item.id} item={item} editing={editing} onRemove={() => api.removeItem(c.id, item.id)} />
          ) : (
            <HotelRow key={item.id} item={item} editing={editing} onRemove={() => api.removeItem(c.id, item.id)} />
          ),
        )}
        {c.items.length === 0 && <li className="py-6 text-[15px] text-muted-foreground">{t("sv.empty.body")}</li>}
      </ul>

      {/* Notatet: lavendel, redigerbart på stedet. */}
      <div className="mt-4 rounded-2xl bg-lavender px-5 py-4 text-petrol">
        <div className="flex items-start gap-4">
          <Icon icon={FileText} size={28} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold">{t("sv.note")}</p>
            {noteOpen ? (
              <div className="mt-2">
                <label className="block">
                  <span className="sr-only">{t("sv.note")}</span>
                  <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={t("sv.note.placeholder")} rows={3} className="rounded-xl bg-white text-[16px]" />
                </label>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="md"
                    className="h-11 rounded-xl font-bold"
                    onClick={() => {
                      api.update(c.id, { note: noteDraft.trim() });
                      setNoteOpen(false);
                    }}
                  >
                    {t("sv.note.save")}
                  </Button>
                  <Button size="md" variant="ghost" className="h-11 rounded-xl" onClick={() => { setNoteDraft(c.note); setNoteOpen(false); }}>
                    {t("misc.close")}
                  </Button>
                </div>
              </div>
            ) : (
              <p className={cn("mt-1 whitespace-pre-line text-[16px]", c.note ? "text-petrol" : "text-muted-foreground")}>{c.note || t("sv.note.placeholder")}</p>
            )}
          </div>
          {!noteOpen && (
            <button type="button" onClick={() => setNoteOpen(true)} aria-label={t("sv.note.edit")} className="grid size-12 shrink-0 place-items-center rounded-full text-petrol hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-ring">
              <Icon icon={Pencil} size={24} />
            </button>
          )}
        </div>
      </div>

      <Button asChild variant="outline" className="mt-4 h-[52px] w-full rounded-xl border-petrol text-[18px] font-bold text-petrol hover:bg-secondary">
        <Link to="/utforsk"><Icon icon={Plus} size={24} /> {t("sv.addplace")}</Link>
      </Button>

      <p className="mt-4 flex items-center gap-2 text-[15px] text-muted-foreground">
        <Icon icon={Info} size={20} className="shrink-0" /> {t("sv.pricenote")} {t("sv.local.short")}.
      </p>
      {editing && (
        <button type="button" onClick={() => api.removeCollection(c.id)} className="mt-3 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-destructive underline-offset-4 hover:underline">
          <Icon icon={Trash2} size={20} /> {t("sv.delete")}
        </button>
      )}
    </section>
  );
}

export default function Saved() {
  usePageMeta(PAGE_META.saved);
  const t = useT();
  const { customer } = useCustomer();
  const { ids, toggle, isServer } = useSavedDestinations();
  const api = useCollections((city) => t("sv.trip", { city }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<DiscoverDestination | null>(null);
  const [local, setLocal] = useState<RecentSearch[]>(() => loadRecentSearches());
  useEffect(() => onRecentSearchesChange(() => setLocal(loadRecentSearches())), []);
  const utils = trpc.useUtils();
  const history = trpc.account.searchHistory.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const removeSearch = trpc.account.removeSearch.useMutation({ onSuccess: () => utils.account.searchHistory.invalidate() });
  const clear = trpc.account.clearSearchHistory.useMutation({ onSuccess: () => utils.account.searchHistory.invalidate() });

  const active = useMemo(() => api.collections.find((c) => c.id === activeId) ?? api.collections[0], [api.collections, activeId]);
  const saved = [...ids].map((id) => destinationById(id)).filter((d): d is NonNullable<typeof d> => Boolean(d));

  const searches = customer
    ? (history.data ?? []).map((s) => ({
        key: String(s.id),
        id: s.id as number | null,
        label: `${s.originCity} → ${s.destinationCity}`,
        sub: `${formatDateShort(s.departDate)}${s.returnDate ? ` – ${formatDateShort(s.returnDate)}` : ""} · ${t("common.pax", { count: s.adults + s.children + s.infants })}`,
        href: `/sok?${new URLSearchParams({ from: s.originIata, to: s.destinationIata, depart: s.departDate, ...(s.returnDate ? { ret: s.returnDate } : {}), adults: String(s.adults), children: String(s.children), infants: String(s.infants), cabin: s.cabin }).toString()}`,
      }))
    : local.map((s) => ({
        key: `${s.from}-${s.to}-${s.depart}-${s.ret ?? "ow"}`,
        id: null as number | null,
        label: `${s.fromLabel} → ${s.toLabel}`,
        sub: `${formatDateShort(s.depart)}${s.ret ? ` – ${formatDateShort(s.ret)}` : ""} · ${t("common.pax", { count: s.adults + s.children + s.infants })}`,
        href: recentSearchHref(s),
      }));

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <GreetingBar className="lg:hidden" />
        <h1 className="sr-only">{t("nav.saved")}</h1>

        {active ? (
          <>
            {api.collections.length > 1 && (
              <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="tablist" aria-label={t("sv.collections")}>
                {api.collections.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={c.id === active.id} onClick={() => setActiveId(c.id)} className={cn("h-11 shrink-0 rounded-xl border px-4 text-[15px] font-semibold", c.id === active.id ? "border-petrol bg-petrol text-white" : "border-border bg-white text-petrol")}>
                    {c.title}
                  </button>
                ))}
              </div>
            )}
            <div className="lg:mx-auto lg:max-w-3xl"><CollectionView key={active.id} c={active} api={api} /></div>
          </>
        ) : (
          <div className="rounded-2xl bg-mint px-6 py-10 text-center text-petrol">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-white"><Icon icon={Bookmark} size={28} /></span>
            <h2 className="t-h2 mt-4">{t("sv.empty.title")}</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">{t("sv.empty.body")}</p>
            <Button asChild className="mt-6 h-12 rounded-xl px-6 font-bold">
              <Link to="/">{t("tr.search")} <Icon icon={ArrowRight} size={20} /></Link>
            </Button>
          </div>
        )}

        {/* Reisemål du har hjertet */}
        {saved.length > 0 && (
          <section className="mt-12" aria-labelledby="saved-dest">
            <div className="flex items-center justify-between gap-4">
              <h2 id="saved-dest" className="t-h2">{t("sv.destinations")}</h2>
              <span className="text-[13px] text-muted-foreground">{isServer ? t("sv.synced") : t("sv.local.short")}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {saved.map((d) => (
                <DestinationCard key={d.id} destination={d} isFavourite onToggleFavourite={toggle} onOpen={setQuickView} fluid />
              ))}
            </div>
          </section>
        )}

        {/* Siste søk */}
        {searches.length > 0 && (
          <section className="mt-12" aria-labelledby="saved-searches">
            <h2 id="saved-searches" className="t-h2">{t("saved.recent")}</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {searches.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <Link to={s.href} className="flex min-h-16 min-w-0 flex-1 items-center gap-4 py-2 text-petrol transition-colors hover:bg-secondary">
                    <Icon icon={Clock3} size={28} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[18px] font-semibold">{s.label}</span>
                      <span className="block text-[14px] text-muted-foreground">{s.sub}</span>
                    </span>
                    <Icon icon={ChevronRight} size={24} className="shrink-0" />
                  </Link>
                  {s.id !== null && (
                    <button type="button" onClick={() => removeSearch.mutate({ id: s.id as number })} aria-label={t("sv.remove")} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"><Icon icon={X} size={20} /></button>
                  )}
                </li>
              ))}
            </ul>
            {customer && (
              <button type="button" onClick={() => clear.mutate()} disabled={clear.isPending} className="mt-3 min-h-11 text-[14px] font-semibold text-muted-foreground hover:text-foreground">{t("sv.clear")}</button>
            )}
          </section>
        )}
      </AppShell>
      <DestinationSheet destination={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
