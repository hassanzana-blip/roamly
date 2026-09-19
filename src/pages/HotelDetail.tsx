import { useMemo, useRef, useState, type UIEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Car, Check, ChevronLeft, ChevronRight, Coffee, Dumbbell, ExternalLink, MapPin, PawPrint, Plane, Sparkles, Umbrella, Users, UtensilsCrossed, Waves, Wifi, type LucideIcon } from "lucide-react";
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
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * Hotelldetaljer (HelloSky 3.0).
 *
 * Fotografiet først – hotellets egne bilder fra leverandøren, aldri et lånt
 * motiv – med den elfenbenshvite buen som lar siden ta over. Så stedet,
 * navnet, vurderingen, fasilitetene som myke brikker, oppholdet, det beste
 * rommet akkurat nå, og til slutt alle leverandørene ved siden av hverandre.
 * Prisen nederst er leverandørens; bestillingen skjer hos dem.
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
  const [photo, setPhoto] = useState(0);
  const strip = useRef<HTMLUListElement>(null);
  const backHref = `/hotell?place=${encodeURIComponent(place)}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}`;
  const best = h?.rates[0];
  const images = h?.images ?? [];
  const mapHref = h ? `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}` : undefined;

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

  const amenities = (h?.featureSummary ?? []).slice(0, 6);
  const nights = h?.nights ?? Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));

  return (
    <div className="relative min-h-screen bg-background">
      <div className="hidden lg:block"><SiteHeader /></div>
      <main id="main" tabIndex={-1} className="pb-32 outline-none lg:pb-16 lg:pt-16">
        {(status.isSuccess && !enabled) || detail.isLoading || detail.isError ? (
          <div className="container-x pt-4 lg:pt-8">
            <HeroBar backTo={backHref} tone="dark" className="mb-6 lg:hidden" />
            <Link to={backHref} className="hidden min-h-10 items-center gap-1.5 text-[15px] font-medium text-accent-foreground lg:inline-flex">
              <ArrowLeft className="size-4" aria-hidden="true" /> {t("ht.detail.back")}
            </Link>
            {status.isSuccess && !enabled && <div className="mt-4"><DisabledState title={t("ht.disabled.title")} body={t("ht.disabled.body")} cta={t("ht.disabled.cta")} to="/hotell-bil?fane=hotell" /></div>}
            {detail.isLoading && (
              <div className="mt-4 space-y-4" aria-busy="true">
                <div className="shimmer aspect-[4/5] w-full rounded-[28px] sm:aspect-[16/9]" />
                <div className="shimmer h-10 w-2/3 rounded-xl" />
                <div className="shimmer h-5 w-1/2 rounded-xl" />
              </div>
            )}
            {detail.isError && <div className="mt-4"><StateBlock kind="error" title={t("ht.error.title")} body={humanMessage(detail.error)} action={<RetryButton onClick={() => detail.refetch()} />} /></div>}
          </div>
        ) : null}

        {h && (
          <>
            {/* Galleri: kun hotellets egne bilder fra leverandøren. Full bredde på telefon, avrundet på desktop. */}
            <section className="lg:container-x lg:pt-6" aria-label={h.name}>
              <div className="relative isolate h-[50vh] max-h-[520px] min-h-[360px] overflow-hidden bg-burgundy lg:h-[500px] lg:rounded-[28px]">
                {images.length > 0 ? (
                  <ul ref={strip} onScroll={onStripScroll} tabIndex={0} aria-label={t("ht.detail.photos", { count: images.length })} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" aria-live="polite">
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
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" aria-hidden="true" />

                <div className="container-x absolute inset-x-0 top-0 pt-[max(16px,env(safe-area-inset-top))] lg:px-6">
                  <HeroBar backTo={backHref} tone="light" className="lg:hidden" />
                  <Link to={backHref} aria-label={t("ht.detail.back")} className="hidden size-14 place-items-center rounded-full bg-white text-foreground shadow-soft lg:grid">
                    <ArrowLeft className="size-6" aria-hidden="true" />
                  </Link>
                </div>

                {images.length > 1 && (
                  <>
                    <span className="t-num absolute bottom-16 right-5 rounded-full bg-black/55 px-3.5 py-1.5 text-[14px] font-medium text-white backdrop-blur-sm lg:bottom-5" aria-live="polite">
                      {photo + 1} / {images.length}
                    </span>
                    <button type="button" onClick={() => goPhoto(photo - 1)} aria-label={t("ht.detail.prev")} className="absolute left-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-soft hover:bg-white sm:grid">
                      <ChevronLeft className="size-6" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => goPhoto(photo + 1)} aria-label={t("ht.detail.next")} className="absolute right-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-soft hover:bg-white sm:grid">
                      <ChevronRight className="size-6" aria-hidden="true" />
                    </button>
                  </>
                )}
                {/* Buen: siden tar over fotografiet. */}
                <svg className="hero-curve lg:hidden" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 26 C 110 -6, 250 -2, 400 44 L400 64 L0 64 Z" fill="hsl(var(--background))" />
                </svg>
              </div>
            </section>

            <div className="container-x mt-2 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
              <div className="min-w-0">
                <p className="eyebrow-burgundy">{place || h.countryCode}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="t-h1 lg:t-display">{h.name}</h1>
                  {detail.data?.sandbox && <SandboxBadge />}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[17px]">
                  <Stars n={h.starRating} className="[&_svg]:size-4" />
                  <RatingChip rating={h.guestRating} reviews={h.numberOfReviews} sentiment={h.ratingSentiment} />
                </div>
                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[17px]">
                  <span className="inline-flex items-center gap-2"><MapPin className="size-5 shrink-0" aria-hidden="true" /> {h.address}{h.distanceKm !== null ? ` · ${t("ht.distance", { km: String(h.distanceKm).replace(".", ",") })}` : ""}</span>
                  {mapHref && (
                    <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center border-l border-border pl-3 font-medium text-burgundy underline underline-offset-4">
                      {t("ht.detail.onmap")}
                    </a>
                  )}
                </p>

                {amenities.length > 0 && (
                  <ul className="mt-5 grid grid-cols-3 gap-2" aria-label={t("ht.detail.facilities")}>
                    {amenities.map((f) => {
                      const I = amenityIcon(f.name);
                      return (
                        <li key={`${f.name}-${f.description}`} className="flex min-h-12 items-center gap-2 rounded-2xl bg-blush px-3 py-2.5 text-[13px] font-medium text-foreground sm:text-[15px]" title={f.description}>
                          <I className="size-5 shrink-0 text-burgundy" aria-hidden="true" />
                          <span className="min-w-0 truncate">{f.name}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Oppholdet: datoer og gjester, med veien tilbake til søket for å endre. */}
                <Link to={backHref} className="card-soft mt-6 flex items-center gap-3 px-5 py-4 text-[17px] font-medium transition-colors hover:bg-white sm:gap-4 sm:text-[18px]" aria-label={t("common.editsearch")}>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="inline-flex items-center gap-2.5"><CalendarDays className="size-6 shrink-0 text-burgundy" aria-hidden="true" /> {formatDateShort(checkin)} – {formatDateShort(checkout)}</span>
                    <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
                    <span className="inline-flex items-center gap-2.5"><Users className="size-6 shrink-0 text-burgundy" aria-hidden="true" /> {t("ht.adults", { count: adults })} · {t("ht.detail.rooms", { count: rooms })}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>

                {/* Det beste rommet akkurat nå: leverandørens romnavn og pris, bilde fra hotellet. */}
                {best && (
                  <a href={best.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored" className="card-soft mt-4 flex gap-4 p-4 transition-colors hover:bg-white">
                    <span className="block aspect-[4/3] w-[42%] max-w-[220px] shrink-0 overflow-hidden rounded-2xl bg-secondary">
                      <HotelPhoto hotel={{ name: h.name, images: images.slice(1, 2).length ? images.slice(1, 2) : images.slice(0, 1) }} sizes="220px" className="h-full w-full" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center">
                      <span className="text-[13px] font-medium text-muted-foreground">{t("ht.detail.bestroom")}</span>
                      <span className="mt-1 text-[22px] font-medium leading-tight">{best.roomName}</span>
                      <span className="mt-1.5 text-[14px] text-muted-foreground">{best.provider.name} · {formatMoney(best.perNightAmount, best.currency)} {t("ht.pernight")}</span>
                    </span>
                    <ChevronRight className="my-auto size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </a>
                )}

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
                      {h.reviewQuotes.slice(0, 8).map((q) => <li key={q} className="rounded-full bg-secondary px-3.5 py-1.5 text-[15px]">«{q}»</li>)}
                    </ul>
                  </section>
                )}
                {(h.featureSummary.length > amenities.length || h.policies.length > 0) && (
                  <section className="mt-10">
                    <h2 className="t-h3">{t("ht.detail.facilities")}</h2>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[...h.policies, ...h.featureSummary.slice(amenities.length)].map((f) => (
                        <div key={`${f.name}-${f.description}`} className="card-soft !rounded-2xl p-4">
                          <dt className="text-[13px] font-medium text-muted-foreground">{f.name}</dt>
                          <dd className="mt-0.5 text-[15px]">{f.description}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                <section className="mt-10">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="t-h3">{t("ht.detail.rates", { count: new Set(h.rates.map((r) => r.provider.code)).size })}</h2>
                    <p className="text-[13px] text-muted-foreground">{formatDateShort(checkin)} – {formatDateShort(checkout)} · {t("ht.nights", { count: h.nights })} · {t("ht.adults", { count: adults })}</p>
                  </div>
                  {h.rates.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{t("ht.norates")}</p>}
                  <ul className="mt-3 space-y-3">
                    {h.rates.map((r, i) => {
                      const perks = [r.freeCancellation ? t("ht.freecancel") : null, r.payLater ? t("ht.paylater") : null, ...r.inclusions.map((c) => inclusionLabel(c, t))].filter(Boolean) as string[];
                      return (
                        <li key={`${r.provider.code}-${r.roomName}-${i}`} className={cn("card-soft p-4 sm:p-5", i === 0 && "ring-2 ring-primary")}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <ProviderLogo rate={r} />
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-1.5 text-[16px] font-medium">
                                  {r.provider.name}
                                  {r.provider.isDirect && <span className="rounded-full bg-blush px-2 py-0.5 text-[12px] font-medium text-accent-foreground">{t("ht.detail.direct")}</span>}
                                  {i === 0 && <span className="rounded-full bg-blush px-2 py-0.5 text-[12px] font-medium text-accent-foreground">{t("ht.detail.best")}</span>}
                                </p>
                                <p className="truncate text-[13px] text-muted-foreground">{r.roomName}{perks.length ? ` · ${perks.join(" · ")}` : ""}{r.availableRooms > 0 && r.availableRooms <= 3 ? ` · ${t("ht.detail.roomsleft", { count: r.availableRooms })}` : ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <div className="sm:text-right">
                                <p className="t-num text-[24px] font-medium leading-none">{formatMoney(r.perNightAmount, r.currency)}</p>
                                <p className="mt-1 text-[13px] text-muted-foreground">{t("ht.pernight")} · {formatMoney(r.totalAmount, r.currency)}</p>
                              </div>
                              <Button asChild size="md" variant={i === 0 ? "primary" : "subtle"} className="rounded-full">
                                <a href={r.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
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
                {best && (
                  <div className="card-soft sticky top-24 p-6 shadow-lift">
                    <p className="text-[13px] font-medium text-muted-foreground">{t("ht.detail.best")} · {best.provider.name}</p>
                    <p className="t-num mt-2 text-[40px] font-medium leading-none tracking-tight">{formatMoney(best.totalAmount, best.currency)}</p>
                    <p className="mt-2 text-[15px] text-muted-foreground">{t("ht.detail.totalfor", { count: nights })} · {formatMoney(best.perNightAmount, best.currency)} {t("ht.pernight")}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{t("ht.detail.pricenote")}</p>
                    <Button asChild size="lg" className="mt-5 h-14 w-full rounded-full text-[17px]">
                      <a href={best.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                        {t("oc.view.at", { name: best.provider.name })} <ArrowRight className="size-5" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Telefon: prisen og handlingen flyter over bunnavigasjonen */}
      {best && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-white px-5 pt-4 shadow-lift lg:hidden" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="t-num text-[26px] font-medium leading-none tracking-tight">{formatMoney(best.totalAmount, best.currency)}</p>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">{t("ht.detail.totalfor", { count: nights })} · {best.provider.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{t("ht.detail.pricenote")}</p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 rounded-full px-5 text-[15px]">
              <a href={best.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">{t("oc.view")} <ArrowRight className="size-5" aria-hidden="true" /></a>
            </Button>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
