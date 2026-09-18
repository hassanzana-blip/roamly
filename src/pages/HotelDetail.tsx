import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import type { HotelRateOffer } from "@contracts/hotels";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
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

function ProviderLogo({ rate }: { rate: HotelRateOffer }) {
  const [failed, setFailed] = useState(false);
  if (!rate.provider.logoUrl || failed) {
    return <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">{rate.provider.name.slice(0, 1)}</span>;
  }
  return <img src={rate.provider.logoUrl} alt={rate.provider.name} loading="lazy" onError={() => setFailed(true)} className="h-7 w-auto max-w-[96px] shrink-0 object-contain" />;
}

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
  const backHref = `/hotell?place=${encodeURIComponent(place)}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}`;
  const best = h?.rates[0];

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="container-x pb-28 pt-20 outline-none sm:pt-24 lg:pb-16">
        <Link to={backHref} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-accent-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> {t("ht.detail.back")}
        </Link>

        {status.isSuccess && !enabled && <div className="mt-6"><DisabledState title={t("ht.disabled.title")} body={t("ht.disabled.body")} cta={t("ht.disabled.cta")} to="/hotell-bil?fane=hotell" /></div>}
        {detail.isLoading && (
          <div className="mt-6 space-y-4" aria-busy="true">
            <div className="shimmer aspect-[16/9] w-full rounded-2xl sm:aspect-[21/9]" />
            <div className="shimmer h-8 w-2/3 rounded-md" />
            <div className="shimmer h-4 w-1/2 rounded-md" />
          </div>
        )}
        {detail.isError && <div className="mt-6"><StateBlock kind="error" title={t("ht.error.title")} body={humanMessage(detail.error)} action={<RetryButton onClick={() => detail.refetch()} />} /></div>}

        {h && (
          <div className="mt-4 lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
            <div>
              {/* Galleri: kun hotellets egne bilder fra leverandøren. */}
              <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                <div className="relative aspect-[16/10] sm:aspect-[21/10]">
                  <HotelPhoto hotel={{ name: h.name, images: h.images.slice(photo, photo + 1) }} className="absolute inset-0 h-full w-full" sizes="(min-width: 1024px) 800px, 100vw" />
                  {h.images.length > 1 && <span className="absolute bottom-3 right-3 rounded-full bg-night/80 px-2.5 py-1 text-[11px] font-semibold text-white">{t("ht.detail.photos", { count: h.images.length })}</span>}
                </div>
                {h.images.length > 1 && (
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto p-2">
                    {h.images.slice(0, 12).map((img, i) => (
                      <button key={img.large} type="button" onClick={() => setPhoto(i)} aria-label={`${t("ht.detail.photos", { count: i + 1 })}`} aria-pressed={photo === i} className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2", photo === i ? "border-primary" : "border-transparent")}>
                        <img src={img.small ?? img.large} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars n={h.starRating} />
                  {detail.data?.sandbox && <SandboxBadge />}
                </div>
                <h1 className="t-h2 mt-1">{h.name}</h1>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" /> {h.address}
                  {h.distanceKm !== null ? ` · ${t("ht.distance", { km: String(h.distanceKm).replace(".", ",") })}` : ""}
                </p>
                <div className="mt-3"><RatingChip rating={h.guestRating} reviews={h.numberOfReviews} sentiment={h.ratingSentiment} /></div>
              </div>

              {h.description && (
                <section className="mt-8">
                  <h2 className="t-h3">{t("ht.detail.about")}</h2>
                  <p className="t-body mt-2 max-w-2xl whitespace-pre-line text-muted-foreground">{h.description}</p>
                </section>
              )}
              {h.reviewQuotes.length > 0 && (
                <section className="mt-8">
                  <h2 className="t-h3">{t("ht.detail.quotes")}</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {h.reviewQuotes.slice(0, 8).map((q) => <li key={q} className="rounded-full bg-secondary px-3 py-1.5 text-sm">«{q}»</li>)}
                  </ul>
                </section>
              )}
              {(h.featureSummary.length > 0 || h.policies.length > 0) && (
                <section className="mt-8">
                  <h2 className="t-h3">{t("ht.detail.facilities")}</h2>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[...h.policies, ...h.featureSummary].map((f) => (
                      <div key={`${f.name}-${f.description}`} className="rounded-xl border border-border bg-card p-3.5">
                        <dt className="text-xs font-semibold text-muted-foreground">{f.name}</dt>
                        <dd className="mt-0.5 text-sm">{f.description}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <section className="mt-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="t-h3">{t("ht.detail.rates", { count: new Set(h.rates.map((r) => r.provider.code)).size })}</h2>
                  <p className="text-xs text-muted-foreground">{formatDateShort(checkin)} – {formatDateShort(checkout)} · {t("ht.nights", { count: h.nights })} · {t("ht.adults", { count: adults })}</p>
                </div>
                {h.rates.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{t("ht.norates")}</p>}
                <ul className="mt-3 space-y-2.5">
                  {h.rates.map((r, i) => {
                    const perks = [r.freeCancellation ? t("ht.freecancel") : null, r.payLater ? t("ht.paylater") : null, ...r.inclusions.map((c) => inclusionLabel(c, t))].filter(Boolean) as string[];
                    return (
                      <li key={`${r.provider.code}-${r.roomName}-${i}`} className={cn("rounded-2xl border bg-card p-4", i === 0 ? "border-primary" : "border-border")}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProviderLogo rate={r} />
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                                {r.provider.name}
                                {r.provider.isDirect && <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">{t("ht.detail.direct")}</span>}
                                {i === 0 && <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">{t("ht.detail.best")}</span>}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{r.roomName}{perks.length ? ` · ${perks.join(" · ")}` : ""}{r.availableRooms > 0 && r.availableRooms <= 3 ? ` · ${t("ht.detail.roomsleft", { count: r.availableRooms })}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <div className="sm:text-right">
                              <p className="t-num text-xl font-bold leading-none">{formatMoney(r.perNightAmount, r.currency)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{t("ht.pernight")} · {formatMoney(r.totalAmount, r.currency)}</p>
                            </div>
                            <Button asChild size="md" variant={i === 0 ? "primary" : "outline"} className="rounded-full">
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
                <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <p className="text-xs font-semibold text-muted-foreground">{t("ht.detail.best")}</p>
                  <p className="t-price mt-1">{formatMoney(best.perNightAmount, best.currency)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("ht.pernight")} · {formatMoney(best.totalAmount, best.currency)} {t("ht.detail.from").length ? "" : ""}· {t("ht.nights", { count: h.nights })} · {best.provider.name}</p>
                  <Button asChild size="lg" className="mt-4 w-full rounded-full">
                    <a href={best.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                      {t("oc.view.at", { name: best.provider.name })} <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Mobil: klistret prislinje over bunnavigasjonen */}
      {best && (
        <div className="fixed inset-x-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:hidden" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div>
              <p className="t-num text-lg font-bold leading-none">{t("ht.detail.from")} {formatMoney(best.perNightAmount, best.currency)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("ht.pernight")} · {best.provider.name}</p>
            </div>
            <Button asChild size="md" className="rounded-full">
              <a href={best.bookUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">{t("oc.view")} <ExternalLink className="size-4" aria-hidden="true" /></a>
            </Button>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
