import { useMemo, useRef, useState, type UIEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, Car, Check, ChevronLeft, ChevronRight, Coffee, ConciergeBell, Dumbbell, ExternalLink, FileText, Heart, MapPin, Minus, PawPrint, Plane, Plus, Snowflake, Sparkles, Umbrella, UtensilsCrossed, Waves, Wifi, type LucideIcon } from "lucide-react";
import type { HotelRateOffer } from "@contracts/hotels";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import HeroBar from "@/components/app/HeroBar";
import { HotelPhoto, RatingChip, Stars } from "@/components/stays/HotelCard";
import { inclusionLabel } from "@/components/stays/hotelUtils";
import { DisabledState, DisclosureNote, RetryButton, SandboxBadge, StateBlock } from "@/components/stays/StayLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatMoney } from "@/lib/format";
import { humanMessage } from "@/lib/apiError";
import { searchSessionId } from "@/lib/kayakSession";
import { useCollections } from "@/lib/collections";
import { rangeLabel } from "@/components/search/dateUtils";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * Hotelldetaljer (HelloSky 4.0).
 *
 * Hvit topplinje med tilbake, merket og deling; hotellets egne bilder med
 * teller og hjerte; stedet som liten overlinje, navnet stort, adressen og
 * «Se kart»; oppholdet i mint; «Dette finner du her» i to kolonner; «Rom og
 * avbestillingsvilkår» i lavendel; «Avgifter og prisdetaljer» bak et pluss;
 * og prisen nederst med «Se rom». Alt er lest fra leverandøren – vi finner
 * ikke opp vurderinger, fasiliteter, vilkår eller priser.
 */

function ProviderLogo({ rate }: { rate: HotelRateOffer }) {
  const [failed, setFailed] = useState(false);
  if (!rate.provider.logoUrl || failed) {
    return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold text-muted-foreground">{rate.provider.name.slice(0, 1)}</span>;
  }
  return <img src={rate.provider.logoUrl} alt={rate.provider.name} loading="lazy" onError={() => setFailed(true)} className="h-7 w-auto max-w-[96px] shrink-0 object-contain" />;
}

/** Leverandørens fasilitetsnavn → et ikon. Ukjent → hake. Navnet står alltid ved siden av. */
const AMENITY_ICON: { re: RegExp; icon: LucideIcon }[] = [
  { re: /basseng|pool/i, icon: Waves },
  { re: /frokost|breakfast/i, icon: Coffee },
  { re: /wi-?fi|internett|internet/i, icon: Wifi },
  { re: /klima|air.?con|aircondition/i, icon: Snowflake },
  { re: /resepsjon|reception|front desk|concierge/i, icon: ConciergeBell },
  { re: /parkering|parking/i, icon: Car },
  { re: /trening|gym|fitness/i, icon: Dumbbell },
  { re: /spa|velvære|wellness|badstu|sauna/i, icon: Sparkles },
  { re: /restaurant|bar\b|mat|dining/i, icon: UtensilsCrossed },
  { re: /strand|beach/i, icon: Umbrella },
  { re: /flyplass|airport|shuttle|transport/i, icon: Plane },
  { re: /kjæledyr|pet/i, icon: PawPrint },
];
const amenityIcon = (name: string) => AMENITY_ICON.find((a) => a.re.test(name))?.icon ?? Check;

export default function HotelDetail() {
  usePageMeta(PAGE_META.hotelDetail);
  const t = useT();
  const { currency, lang } = useLocale();
  const { key = "" } = useParams();
  const [params] = useSearchParams();
  const checkin = params.get("checkin") ?? "";
  const checkout = params.get("checkout") ?? "";
  const adults = Math.max(1, Math.min(8, Number(params.get("adults") ?? 2)));
  const rooms = Math.max(1, Math.min(4, Number(params.get("rooms") ?? 1)));
  const place = params.get("place") ?? "";
  const hotelKey = decodeURIComponent(key);
  const status = trpc.hotels.status.useQuery(undefined, { staleTime: 300_000, retry: false });
  const enabled = status.data?.enabled === true;
  const roomList = useMemo(() => Array.from({ length: rooms }, (_, i) => ({ adults: Math.max(1, Math.round(adults / rooms) + (i === 0 ? adults % rooms : 0)) })), [adults, rooms]);
  const detail = trpc.hotels.detail.useQuery(
    { hotelKey, checkin, checkout, rooms: roomList, currency, language: lang, sessionId: searchSessionId() },
    { enabled: enabled && /^khotel:\d+$/.test(hotelKey) && Boolean(checkin && checkout), staleTime: 5 * 60_000, retry: false },
  );
  const h = detail.data?.hotel;
  const sandbox = detail.data?.sandbox === true;
  const [photo, setPhoto] = useState(0);
  const [feesOpen, setFeesOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const strip = useRef<HTMLUListElement>(null);
  const backHref = `/hotell?place=${encodeURIComponent(place)}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}`;
  const selfHref = `/hotell/${encodeURIComponent(hotelKey)}?checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}&place=${encodeURIComponent(place)}`;
  const images = h?.images ?? [];
  const mapHref = h ? `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}` : undefined;
  // Laveste totalpris blant leverandørene – prisen i bunnen er alltid en ekte «fra»-pris.
  const lowest = useMemo(() => (h?.rates.length ? h.rates.reduce((m, r) => (r.totalAmount < m.totalAmount ? r : m), h.rates[0]) : undefined), [h]);
  const collections = useCollections((city) => t("sv.trip", { city }));
  const saved = collections.savedHotelKeys.has(hotelKey);

  const onStripScroll = (e: UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== photo) setPhoto(i);
  };
  const goPhoto = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const next = (i + images.length) % Math.max(1, images.length);
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setPhoto(next);
  };

  // Deling: systemets delingsark der det finnes, ellers kopieres lenken.
  const share = async () => {
    if (!h) return;
    const url = `${window.location.origin}${selfHref}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: h.name, text: `${h.name} · ${place || h.address}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice(t("ht.detail.copied"));
    } catch {
      /* avbrutt av brukeren, eller ingen utklippstavle */
    }
  };

  const toggleSave = () => {
    if (!h) return;
    if (saved) {
      collections.unsaveHotel(hotelKey);
      setNotice("");
      return;
    }
    const c = collections.saveHotel({
      hotelKey,
      name: h.name,
      place: place || h.address,
      countryCode: h.countryCode,
      checkin,
      checkout,
      nights: h.nights,
      adults,
      rooms,
      image: images[0]?.small ?? images[0]?.large,
      provider: lowest?.provider.name ?? "",
      priceAmount: lowest?.totalAmount ?? 0,
      currency: lowest?.currency ?? h.currency,
      href: selfHref,
      sandbox,
    });
    setNotice(t("sv.saved.toast", { title: c.title }));
  };

  const amenities = (h?.featureSummary ?? []).slice(0, 6);
  const nights = h?.nights ?? Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
  const stayLine = `${t("ht.nights", { count: nights })} · ${t("ht.adults", { count: adults })} · ${t("ht.detail.rooms", { count: rooms })}`;

  return (
    <div className="relative min-h-screen bg-background">
      <div className="hidden lg:block"><SiteHeader /></div>
      <main id="main" tabIndex={-1} className="pb-36 outline-none lg:pb-16 lg:pt-16">
        {(status.isSuccess && !enabled) || detail.isLoading || detail.isError ? (
          <div className="container-x pt-2 lg:pt-8">
            <HeroBar backTo={backHref} backIcon="chevron" className="lg:hidden" />
            <Link to={backHref} className="hidden min-h-10 items-center gap-1.5 text-[15px] font-semibold text-azure-ink lg:inline-flex">
              <ArrowLeft className="size-4" aria-hidden="true" /> {t("ht.detail.back")}
            </Link>
            {status.isSuccess && !enabled && <div className="mt-4"><DisabledState title={t("ht.disabled.title")} body={t("ht.disabled.body")} cta={t("ht.disabled.cta")} to="/hotell-bil?fane=hotell" /></div>}
            {detail.isLoading && (
              <div className="mt-4 space-y-4" aria-busy="true">
                <div className="shimmer aspect-[10/7] w-full rounded-2xl sm:aspect-[16/9]" />
                <div className="shimmer h-10 w-2/3 rounded-xl" />
                <div className="shimmer h-5 w-1/2 rounded-xl" />
                <div className="shimmer h-20 w-full rounded-2xl" />
              </div>
            )}
            {detail.isError && <div className="mt-4"><StateBlock kind="error" title={t("ht.error.title")} body={humanMessage(detail.error)} action={<RetryButton onClick={() => detail.refetch()} />} /></div>}
          </div>
        ) : null}

        {h && (
          <>
            {/* Topplinjen: tilbake, merket, del. Hvit, som resten av siden. */}
            <div className="container-x pb-2 pt-[max(6px,env(safe-area-inset-top))] lg:hidden">
              <HeroBar backTo={backHref} backIcon="chevron" onShare={share} shareLabel={t("ht.detail.share")} />
            </div>

            {/* Galleri: kun hotellets egne bilder fra leverandøren. Full bredde på telefon, avrundet på desktop. */}
            <section className="lg:container-x lg:pt-6" aria-label={h.name}>
              <div className="relative isolate aspect-[10/7] max-h-[520px] w-full overflow-hidden bg-secondary sm:aspect-[16/9] lg:rounded-2xl">
                {images.length > 0 ? (
                  <ul ref={strip} onScroll={onStripScroll} tabIndex={0} aria-label={t("ht.detail.photos", { count: images.length })} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-live="polite">
                    {images.map((img, i) => (
                      <li key={img.large} className="relative h-full w-full shrink-0 snap-start">
                        <img
                          src={img.large}
                          srcSet={img.small ? `${img.small} 460w, ${img.large} 920w` : undefined}
                          sizes="(min-width: 1024px) 1100px, 100vw"
                          alt={i === 0 ? h.name : `${h.name} – ${t("ht.detail.photo", { n: i + 1, total: images.length })}`}
                          loading={i < 2 ? "eager" : "lazy"}
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <HotelPhoto hotel={{ name: h.name, images: [] }} className="h-full w-full" />
                )}

                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <Link to={backHref} aria-label={t("ht.detail.back")} className="hidden size-14 place-items-center rounded-full bg-white text-petrol shadow-soft lg:grid">
                    <ArrowLeft className="size-6" aria-hidden="true" />
                  </Link>
                  <button type="button" onClick={share} aria-label={t("ht.detail.share")} className="hidden size-14 place-items-center rounded-full bg-white text-petrol shadow-soft lg:grid">
                    <ExternalLink className="size-6" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={toggleSave} aria-pressed={saved} aria-label={saved ? t("ht.detail.unsave") : t("ht.detail.save")} className="grid size-14 place-items-center rounded-full bg-white text-petrol shadow-soft transition-transform active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    <Heart className={cn("size-7", saved && "fill-current")} aria-hidden="true" />
                  </button>
                </div>

                {images.length > 1 && (
                  <>
                    <span className="t-num absolute bottom-4 left-4 rounded-xl bg-petrol/85 px-3.5 py-2 text-[15px] font-semibold text-white" aria-live="polite">
                      {photo + 1} / {images.length}
                    </span>
                    <button type="button" onClick={() => goPhoto(photo - 1)} aria-label={t("ht.detail.prev")} className="absolute left-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-petrol shadow-soft hover:bg-white sm:grid">
                      <ChevronLeft className="size-6" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => goPhoto(photo + 1)} aria-label={t("ht.detail.next")} className="absolute right-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-petrol shadow-soft hover:bg-white sm:grid">
                      <ChevronRight className="size-6" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </section>

            <div className="container-x mt-5 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
              <div className="min-w-0">
                {/* Overlinjen sier hva dette er: testdata når det er testdata, ellers stedet. */}
                <p className="eyebrow-coral">{sandbox ? t("ht.detail.testdata") : place || h.countryCode}</p>
                <h1 className="t-display mt-1.5">{h.name}</h1>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-[17px]">
                    <MapPin className="size-6 shrink-0" aria-hidden="true" />
                    <span className="truncate">{place ? `${place} · ` : ""}{h.address}</span>
                  </p>
                  {mapHref && (
                    <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[17px] font-semibold text-azure-ink underline-offset-4 hover:underline">
                      {t("ht.detail.map")} <ChevronRight className="size-5" aria-hidden="true" />
                    </a>
                  )}
                </div>
                {(h.starRating >= 1 || h.guestRating !== null || h.distanceKm !== null) && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted-foreground">
                    <Stars n={h.starRating} className="[&_svg]:size-4" />
                    <RatingChip rating={h.guestRating} reviews={h.numberOfReviews} sentiment={h.ratingSentiment} />
                    {h.distanceKm !== null && <span>{t("ht.distance", { km: String(h.distanceKm).replace(".", ",") })}</span>}
                    {sandbox && <SandboxBadge />}
                  </p>
                )}
                {notice && <p role="status" className="mt-3 rounded-xl bg-lavender px-4 py-3 text-[15px] font-medium text-petrol">{notice} {saved && <Link to="/lagret" className="font-semibold text-azure-ink underline-offset-4 hover:underline">{t("sv.open")}</Link>}</p>}

                {/* Oppholdet: datoer, netter, gjester og rom – med veien tilbake til søket for å endre. */}
                <Link to={backHref} className="mt-5 flex items-center gap-4 rounded-2xl bg-mint px-5 py-4 text-petrol transition-colors hover:bg-mint-deep/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`${t("common.editsearch")}: ${rangeLabel(checkin, checkout)} · ${stayLine}`}>
                  <CalendarDays className="size-8 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[20px] font-bold leading-tight">{rangeLabel(checkin, checkout)}</span>
                    <span className="mt-0.5 block text-[16px] text-muted-foreground">{stayLine}</span>
                  </span>
                  <ChevronRight className="size-6 shrink-0" aria-hidden="true" />
                </Link>

                {amenities.length > 0 && (
                  <section className="mt-8" aria-labelledby="here">
                    <h2 id="here" className="t-h2">{t("ht.detail.here")}</h2>
                    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                      {amenities.map((f) => {
                        const I = amenityIcon(f.name);
                        return (
                          <li key={`${f.name}-${f.description}`} className="flex min-h-8 items-center gap-3 text-[16px] font-medium text-petrol" title={f.description}>
                            <I className="size-7 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 truncate">{f.name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Rom og vilkår ligger lenger ned på siden; raden tar deg dit. */}
                <a href="#rom" className="mt-8 flex min-h-[72px] items-center gap-4 rounded-2xl bg-lavender px-5 py-4 text-petrol transition-colors hover:bg-lavender-deep/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <BedDouble className="size-8 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-[18px] font-semibold">{t("ht.detail.roomsterms")}</span>
                  <ChevronRight className="size-6 shrink-0" aria-hidden="true" />
                </a>

                {/* Avgifter og prisdetaljer: leverandørens tall, bak et pluss. */}
                <Collapsible.Root open={feesOpen} onOpenChange={setFeesOpen} className="mt-2 border-b border-border">
                  <Collapsible.Trigger asChild>
                    <button type="button" className="flex min-h-[72px] w-full items-center gap-4 px-5 py-4 text-left text-petrol focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <FileText className="size-8 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-[18px] font-semibold">{t("ht.detail.fees")}</span>
                      {feesOpen ? <Minus className="size-6 shrink-0" aria-hidden="true" /> : <Plus className="size-6 shrink-0" aria-hidden="true" />}
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    <dl className="grid gap-3 px-5 pb-5 text-[15px]">
                      {lowest ? (
                        <>
                          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("ht.detail.pertotal")}</dt><dd className="t-num font-semibold">{formatMoney(lowest.totalAmount, lowest.currency)}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("ht.pernight")}</dt><dd className="t-num font-semibold">{formatMoney(lowest.perNightAmount, lowest.currency)}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("ht.detail.fee.provider")}</dt><dd className="font-semibold">{lowest.provider.name}</dd></div>
                        </>
                      ) : (
                        <p className="text-muted-foreground">{t("ht.norates")}</p>
                      )}
                      <p className="text-muted-foreground">{t("ht.detail.pricenote")}</p>
                    </dl>
                  </Collapsible.Content>
                </Collapsible.Root>

                {h.description && (
                  <section className="mt-10">
                    <h2 className="t-h3">{t("ht.detail.about")}</h2>
                    <p className="t-body mt-2 max-w-2xl whitespace-pre-line text-muted-foreground">{h.description}</p>
                  </section>
                )}
                {h.reviewQuotes.length > 0 && (
                  <section className="mt-10">
                    <h2 className="t-h3">{t("ht.detail.quotes")}</h2>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {h.reviewQuotes.slice(0, 8).map((q) => <li key={q} className="rounded-xl bg-secondary px-3.5 py-1.5 text-[15px]">«{q}»</li>)}
                    </ul>
                  </section>
                )}
                {(h.featureSummary.length > amenities.length || h.policies.length > 0) && (
                  <section className="mt-10">
                    <h2 className="t-h3">{t("ht.detail.facilities")}</h2>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[...h.policies, ...h.featureSummary.slice(amenities.length)].map((f) => (
                        <div key={`${f.name}-${f.description}`} className="card-soft p-4">
                          <dt className="text-[13px] font-semibold text-muted-foreground">{f.name}</dt>
                          <dd className="mt-0.5 text-[15px]">{f.description}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                <section id="rom" className="mt-10 scroll-mt-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="t-h2">{t("ht.detail.roomsterms")}</h2>
                    <p className="text-[13px] text-muted-foreground">{t("ht.detail.rates", { count: new Set(h.rates.map((r) => r.provider.code)).size })} · {formatDateShort(checkin)} – {formatDateShort(checkout)}</p>
                  </div>
                  {h.rates.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{t("ht.norates")}</p>}
                  <ul className="mt-3 space-y-3">
                    {h.rates.map((r, i) => {
                      const perks = [r.freeCancellation ? t("ht.freecancel") : null, r.payLater ? t("ht.paylater") : null, ...r.inclusions.map((c) => inclusionLabel(c, t))].filter(Boolean) as string[];
                      const isLowest = r === lowest;
                      return (
                        <li key={`${r.provider.code}-${r.roomName}-${i}`} className={cn("card-soft p-4 sm:p-5", isLowest && "border-petrol")}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <ProviderLogo rate={r} />
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-1.5 text-[16px] font-bold">
                                  {r.roomName}
                                  {r.provider.isDirect && <span className="rounded-lg bg-mint px-2 py-0.5 text-[12px] font-semibold text-petrol">{t("ht.detail.direct")}</span>}
                                  {isLowest && <span className="rounded-lg bg-mint px-2 py-0.5 text-[12px] font-semibold text-petrol">{t("ht.detail.best")}</span>}
                                </p>
                                <p className="text-[14px] text-muted-foreground">{r.provider.name}{perks.length ? ` · ${perks.join(" · ")}` : ""}{r.availableRooms > 0 && r.availableRooms <= 3 ? ` · ${t("ht.detail.roomsleft", { count: r.availableRooms })}` : ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <div className="sm:text-right">
                                <p className="t-num text-[24px] font-bold leading-none">{formatMoney(r.totalAmount, r.currency)}</p>
                                <p className="mt-1 text-[13px] text-muted-foreground">{formatMoney(r.perNightAmount, r.currency)} {t("ht.pernight")}</p>
                              </div>
                              <Button asChild size="md" variant={isLowest ? "primary" : "outline"} className="h-12 rounded-xl px-4 font-bold">
                                <a href={r.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored" aria-label={t("oc.view.at", { name: r.provider.name })}>
                                  {t("oc.view")} <ExternalLink className="size-4" aria-hidden="true" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4"><DisclosureNote text={t("ht.disclosure")} /></div>
                </section>
              </div>

              {/* Desktop: klistret prisoppsummering */}
              <aside className="hidden lg:block">
                {lowest && (
                  <div className="card-soft sticky top-24 p-6">
                    <p className="text-[13px] font-semibold text-muted-foreground">{t("ht.detail.lowestat", { name: lowest.provider.name })}</p>
                    <p className="t-num mt-2 text-[40px] font-bold leading-none tracking-tight">{t("ht.detail.fromprice", { price: formatMoney(lowest.totalAmount, lowest.currency) })}</p>
                    <p className="mt-2 text-[15px] text-muted-foreground">{t("ht.nights", { count: nights })} · {formatMoney(lowest.perNightAmount, lowest.currency)} {t("ht.pernight")}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{t("ht.detail.pricenote")}</p>
                    <Button asChild size="lg" className="mt-5 h-[52px] w-full rounded-xl text-[17px] font-bold">
                      <a href="#rom">{t("ht.detail.seerooms")} <ArrowRight className="size-5" aria-hidden="true" /></a>
                    </Button>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Telefon: prisen og handlingen klistret nederst – den erstatter bunnavigasjonen på denne siden. */}
      {h && lowest && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-5 pt-3 lg:hidden" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="t-num text-[28px] font-bold leading-none tracking-tight">{t("ht.detail.fromprice", { price: formatMoney(lowest.totalAmount, lowest.currency) })}</p>
              <p className="mt-1 truncate text-[14px] text-muted-foreground">{t("ht.nights", { count: nights })} · {sandbox ? t("sr.examples") : t("ht.detail.lowestat", { name: lowest.provider.name })}</p>
            </div>
            <Button asChild size="lg" className="h-[52px] shrink-0 rounded-xl px-6 text-[18px] font-bold">
              <a href="#rom">{t("ht.detail.seerooms")} <ArrowRight className="size-6" aria-hidden="true" /></a>
            </Button>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
