import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { MobileOffer } from "@contracts/mobileSearch";
import type { OfferSlice, Segment } from "@contracts/types";
import { useApp } from "../../lib/appState";
import { applyView } from "../../lib/resultsView";
import { journeyOf, sellerLabel } from "../../lib/journeys";
import { baggageFacts, baggageShort, conditionFacts, handoffLabel, offerExpired, priceBasis, providerHandoff, sellerKindLabel } from "../../lib/offer";
import { dayOffset, formatTime, minutesBetween } from "../../lib/format";
import { priceDisplay, serviceFeeNokMinor } from "../../lib/price";
import { journeyWarnings, type JourneyWarning } from "../../lib/warnings";
import { singleFlight } from "../../lib/singleFlight";
import { webSearchUrl } from "../../lib/webLinks";
import { providerDisplayName, resultKind } from "../../lib/resultStatus";
import { useA11yLanguage, useI18n, type I18n } from "../../i18n";
import { cabinLabel } from "../../lib/searchForm";
import { photoForAirport } from "../../lib/destinations";
import { PriceTag } from "../../components/PriceTag";
import { AirlineLogo } from "../../components/AirlineLogo";
import { BottomFade, PhotoBackdrop } from "../../components/Photo";
import { RouteLine } from "../../components/OfferCard";
import { Icon } from "../../components/Icon";
import { Banner, DarkTabs, IconButton, InfoRow, InformationCard, LinkButton, Notices, PrimaryButton, StateView } from "../../components/ui";
import { colors, radius, space, type } from "../../lib/theme";

type Tab = "overview" | "baggage" | "terms" | "itinerary";

/** «Bytte i København · 1 t 55 min» – uten varighet når tidspunktene ikke kan regnes trygt. */
function layoverText(city: string, arrive: string, depart: string, { t, f }: Pick<I18n, "t" | "f">): string {
  const minutes = minutesBetween(arrive, depart);
  return t.details.layover(city, minutes === null ? null : f.duration(minutes));
}

/** En advarsel som setning. */
function warningText(w: JourneyWarning, offerSliceLabel: (i: number) => string, { t, f }: Pick<I18n, "t" | "f">): string {
  switch (w.kind) {
    case "airportChange":
      return t.details.warnings.airportChange(w.city, w.from, w.to);
    case "overnight":
      return t.details.warnings.overnight(offerSliceLabel(w.slice), w.days);
    case "overnightLayover":
      return t.details.warnings.overnightLayover(w.city);
    case "longLayover":
      return t.details.warnings.longLayover(w.city, f.duration(w.minutes));
  }
}

/** Den ene enden av reisen i fotokortet. */
function Endpoint({ code, place, time, date, align, plus }: { code: string; place: string; time: string; date: string; align: "left" | "right"; plus?: number }) {
  const textAlign = align;
  return (
    <View style={[styles.endpoint, { alignItems: align === "left" ? "flex-start" : "flex-end" }]}>
      <Text style={[styles.heroCode]}>{code}</Text>
      <Text style={[type.caption, styles.heroPlace, { textAlign }]} numberOfLines={2}>
        {place}
      </Text>
      <Text style={[type.timeLarge, { color: colors.onDark, marginTop: space.sm }]}>
        {time}
        {plus ? <Text style={styles.heroPlus}>{` +${plus}`}</Text> : null}
      </Text>
      <Text style={[type.caption, { color: colors.onDarkMuted, textAlign }]}>{date}</Text>
    </View>
  );
}

/** Øverst: bybildet, flyselskapet og utreisen i store tall; hjemreisen kort under. */
function JourneySummary({ item }: { item: MobileOffer }) {
  const lang = useA11yLanguage();
  const { offer } = item;
  const i18n = useI18n();
  const { t, f } = i18n;
  const out = offer.slices[0]!;
  const back = offer.slices.length > 1 ? offer.slices[offer.slices.length - 1]! : null;
  const flights = out.segments.map((s) => `${s.carrier.iata}${s.flightNumber}`).join(" + ");
  const photo = photoForAirport(out.destination.iata);
  return (
    <PhotoBackdrop photo={photo} scrim="medium" style={styles.summary} testID="journey-summary">
      <BottomFade height="70%" strength={0.8} />
      <View style={styles.summaryTop}>
        <AirlineLogo carrier={offer.owner} size={40} />
        <View style={{ flex: 1 }}>
          {/* Hele navnet, også når det er langt: det er selskapet som flyr deg. */}
          <Text style={[type.calloutStrong, { color: colors.onDark }]}>{offer.owner.name}</Text>
          <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>{`${flights} · ${cabinLabel(offer.cabinClass, i18n)}`}</Text>
        </View>
      </View>
      <View accessibilityLanguage={lang} style={styles.summaryRoute} accessible accessibilityLabel={t.details.sliceSpoken(offer.slices.length > 1 ? t.details.outbound : t.details.journey, f.day(out.departingAt), out.origin.city, formatTime(out.departingAt), out.destination.city, formatTime(out.arrivingAt), f.spokenDuration(out.durationMinutes), f.stops(out.stops).toLowerCase())}>
        <Endpoint code={out.origin.iata} place={out.origin.name || out.origin.city} time={formatTime(out.departingAt)} date={f.day(out.departingAt)} align="left" />
        <RouteLine dark top={f.duration(out.durationMinutes)} bottom={f.stops(out.stops)} />
        <Endpoint code={out.destination.iata} place={out.destination.name || out.destination.city} time={formatTime(out.arrivingAt)} date={f.day(out.arrivingAt)} align="right" plus={dayOffset(out.departingAt, out.arrivingAt)} />
      </View>
      {back ? (
        <View accessibilityLanguage={lang} style={styles.returnRow} accessible accessibilityLabel={t.details.sliceSpoken(t.details.inbound, f.day(back.departingAt), back.origin.city, formatTime(back.departingAt), back.destination.city, formatTime(back.arrivingAt), f.spokenDuration(back.durationMinutes), f.stops(back.stops).toLowerCase())}>
          <Text style={[type.caption, styles.returnLabel]}>{t.details.returnRow(f.day(back.departingAt), f.stops(back.stops))}</Text>
          <Text style={[type.footnoteStrong, type.tabular, { color: colors.onDark }]}>
            {`${back.origin.iata} ${formatTime(back.departingAt)} → ${back.destination.iata} ${formatTime(back.arrivingAt)}`}
            {dayOffset(back.departingAt, back.arrivingAt) ? <Text style={styles.heroPlus}>{` +${dayOffset(back.departingAt, back.arrivingAt)}`}</Text> : null}
          </Text>
        </View>
      ) : null}
    </PhotoBackdrop>
  );
}

/** Ett punkt på tidslinjen: klokkeslett, prikk og sted (lokal tid på flyplassen). */
function Stop({ time, plus, city, iata, airport, terminal, first, last }: { time: string; plus?: number; city: string; iata: string; airport: string; terminal?: string; first?: boolean; last?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={styles.tlRow}>
      <Text style={[type.calloutStrong, type.tabular, styles.tlTime]}>
        {time}
        {plus ? <Text style={styles.plus}>{` +${plus}`}</Text> : null}
      </Text>
      <View style={styles.rail}>
        <View style={[styles.railLine, first && { top: 11 }, last && { bottom: undefined, height: 11 }]} />
        <View style={styles.dot} />
      </View>
      <View style={styles.tlBody}>
        <Text style={[type.calloutStrong, { color: colors.text }]}>{`${city} (${iata})`}</Text>
        {airport || terminal ? (
          <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={2}>
            {[airport, terminal ? t.details.terminal(terminal) : ""].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Between({ children }: { children: ReactNode }) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlTime} />
      <View style={styles.rail}>
        <View style={styles.railLine} />
      </View>
      <View style={[styles.tlBody, { paddingVertical: space.sm }]}>{children}</View>
    </View>
  );
}

function SegmentBlock({ seg, first, last, sliceStart }: { seg: Segment; first: boolean; last: boolean; sliceStart: string }) {
  const { t, f } = useI18n();
  const operated = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? t.details.operated(seg.operatingCarrier.name) : null;
  return (
    <View>
      <Stop time={formatTime(seg.departingAt)} plus={dayOffset(sliceStart, seg.departingAt)} city={seg.origin.city} iata={seg.origin.iata} airport={seg.origin.name} terminal={seg.origin.terminal} first={first} />
      <Between>
        {/* Kort navn: logo, navn og varighet på én linje. Får ikke navnet plass på én linje, legger varigheten seg
            under, så navnet får hele bredden og ikke deles midt i et ord. */}
        <View style={styles.flightBar} testID={`flight-${seg.id}`}>
          <View style={styles.flightWho}>
            <AirlineLogo carrier={seg.carrier} size={28} />
            <View style={{ flexShrink: 1 }}>
              <Text style={[type.footnoteStrong, { color: colors.text }]}>{seg.carrier.name}</Text>
              {seg.flightNumber || operated || seg.aircraft ? (
                <Text style={[type.caption, type.tabular, { color: colors.textSecondary }]}>{[seg.flightNumber ? `${seg.carrier.iata}${seg.flightNumber}` : null, operated, seg.aircraft].filter(Boolean).join(" · ")}</Text>
              ) : null}
            </View>
          </View>
          {f.duration(seg.durationMinutes) ? (
            <View style={styles.durationPill}>
              <Text style={[type.caption, type.tabular, { color: colors.text }]}>{f.duration(seg.durationMinutes)}</Text>
            </View>
          ) : null}
        </View>
      </Between>
      <Stop time={formatTime(seg.arrivingAt)} plus={dayOffset(sliceStart, seg.arrivingAt)} city={seg.destination.city} iata={seg.destination.iata} airport={seg.destination.name} terminal={seg.destination.terminal} last={last} />
    </View>
  );
}

/** Hele strekningen med alle fly, bytter, flyplassbytte og døgnskifte. */
function SliceTimeline({ slice, title }: { slice: OfferSlice; title: string }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  return (
    <InformationCard title={`${title} · ${f.day(slice.departingAt)}`}>
      <Text style={[type.footnote, { color: colors.textSecondary, marginTop: -space.sm }]}>{`${f.duration(slice.durationMinutes)} · ${f.stops(slice.stops)}`}</Text>
      <View>
        {slice.segments.map((seg, i) => {
          const next = slice.segments[i + 1];
          const airportChange = next && next.origin.iata !== seg.destination.iata;
          return (
            <View key={seg.id || i}>
              <SegmentBlock seg={seg} first={i === 0} last={!next} sliceStart={slice.departingAt} />
              {next ? (
                <Between>
                  <View style={{ gap: 4 }}>
                    <View style={styles.row6}>
                      <Icon name="clock" size={16} color={colors.warning} />
                      <Text style={[type.footnoteStrong, { color: colors.warning }]}>{layoverText(seg.destination.city, seg.arrivingAt, next.departingAt, i18n)}</Text>
                    </View>
                    {airportChange ? (
                      <View style={styles.row6} testID="airport-change">
                        <Icon name="alert" size={16} color={colors.danger} />
                        <Text style={[type.footnoteStrong, { color: colors.danger }]}>{t.details.airportChange(seg.destination.iata, next.origin.iata)}</Text>
                      </View>
                    ) : null}
                  </View>
                </Between>
              ) : null}
            </View>
          );
        })}
      </View>
    </InformationCard>
  );
}

/** Én selger av reisen: pris, bagasje og vilkår hører til akkurat denne selgeren. */
function SellerOfferRow({ item, selected, onPress }: { item: MobileOffer; selected: boolean; onPress: () => void }) {
  const i18n = useI18n();
  const h = providerHandoff(item.offer);
  const d = priceDisplay(item.price, i18n);
  const bags = baggageFacts(item.offer, i18n);
  const conds = conditionFacts(item.offer, i18n);
  const kind = h.kind === "external" ? sellerKindLabel(h.sellerKind, i18n) : i18n.t.offer.soldByHelloSky;
  const short = (b: (typeof bags)[number]) => baggageShort(b, i18n);
  return (
    <Pressable
      onPress={onPress}
      testID={`seller-${item.offer.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${sellerLabel(item.offer)}, ${kind}. ${d.accessibilityLabel}. ${bags.map(short).join(". ")}`}
      style={({ pressed }) => [styles.seller, selected && styles.sellerOn, pressed && !selected && { opacity: 0.7 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      {/* Ingen linjegrense: det som skiller selgerne (bagasje, vilkår) skal aldri kuttes. */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.calloutStrong, { color: colors.text }]}>{sellerLabel(item.offer)}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{i18n.t.details.sellerDetail([kind, ...conds.map((c) => `${c.label}: ${c.value.toLowerCase()}`)])}</Text>
        <Text style={[type.caption, { color: colors.text }]} testID={`sellerbags-${item.offer.id}`}>
          {i18n.t.details.sellerDetail(bags.map(short))}
        </Text>
      </View>
      <Text style={[type.calloutStrong, type.tabular, { color: d.available ? colors.text : colors.textSecondary }]}>{d.primary}</Text>
    </Pressable>
  );
}

export default function OfferScreen() {
  const lang = useA11yLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { search, view, trackClick, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f } = i18n;
  const dt = t.details;
  const [tab, setTab] = useState<Tab>("overview");
  const [chosen, setChosen] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);
  // Bunnlinjens faktiske høyde (stor tekst, lange navn), så det siste kortet kan rulles helt fram.
  const [barHeight, setBarHeight] = useState(0);
  // Brytes selve beløpet over flere linjer (stor tekst og et femsifret beløp ved siden av knappen), får prisen
  // hele raden og knappen legger seg under – ellers deles «18 450 kr» midt i et ord. Gjelder for tekststørrelsen
  // det ble målt med; endres den, måles det på nytt.
  const { fontScale } = useWindowDimensions();
  const [priceWrappedAt, setPriceWrappedAt] = useState<number | null>(null);
  const priceAlone = priceWrappedAt === fontScale;
  // Ett bevisst trykk = én måling og én nettleser, også ved raske dobbelttrykk.
  // Lenken og tilbudet sendes med hvert trykk (valgt tilbyder kan endres).
  const openOnce = useMemo(
    () =>
      singleFlight(async (url: string, offerId: string) => {
        setOpenError(false);
        setOpening(true);
        // Nettets egen klikkmåling, «fire and forget»; lenken er leverandørens egen, urørt.
        trackClick(offerId);
        try {
          await WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" });
        } catch {
          setOpenError(true);
        } finally {
          setOpening(false);
        }
      }),
    [trackClick],
  );

  const result = search.status === "done" ? search.result : null;
  // Selgerne som passer filtrene i listen; finnes ikke reisen der lenger, alle selgerne.
  const journey = useMemo(() => {
    if (!result || !id) return null;
    return journeyOf(applyView(result.offers, view), id) ?? journeyOf(result.offers, id);
  }, [result, view, id]);

  if (!result || !journey) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <IconButton icon="chevronLeft" label={dt.back} onPress={() => router.back()} testID="header-back" />
          <Text style={[type.headline, styles.topTitle]}>{dt.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <StateView icon="refresh" title={dt.goneTitle} body={dt.goneBody}>
          <PrimaryButton label={dt.toSearch} onPress={() => router.replace("/")} />
        </StateView>
      </View>
    );
  }

  const selected = journey.sellers.find((s) => s.item.offer.id === (chosen ?? id))?.item ?? journey.best;
  const { offer, price } = selected;
  const handoff = providerHandoff(offer);
  const expired = offerExpired(offer);
  const kind = resultKind(result);
  const feeNok = serviceFeeNokMinor(price);
  const bags = baggageFacts(offer, i18n);
  const conds = conditionFacts(offer, i18n);
  const disclosure = handoff.kind === "external" ? handoff.disclosure : null;
  const hasTerms = conds.length > 0 || Boolean(disclosure);
  const d = priceDisplay(price, i18n);
  const basis = priceBasis(offer, i18n);
  const flightNumbers = [...new Set(offer.slices.flatMap((s) => s.segments.map((g) => `${g.carrier.iata}${g.flightNumber}`)))].join(", ");
  const operators = [...new Set(offer.slices.flatMap((s) => s.segments.filter((g) => g.operatingCarrier && g.operatingCarrier.iata !== g.carrier.iata).map((g) => g.operatingCarrier!.name)))];
  const aircraft = [...new Set(offer.slices.flatMap((s) => s.segments.map((g) => g.aircraft).filter(Boolean)))];
  const sliceTitle = (i: number) => (offer.slices.length > 1 ? (i === 0 ? dt.outbound : dt.inbound) : dt.journey);
  const warnings = journeyWarnings(offer);

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: dt.tabs.overview },
    { value: "baggage", label: dt.tabs.baggage },
    ...(hasTerms ? [{ value: "terms" as const, label: dt.tabs.terms }] : []),
    { value: "itinerary", label: dt.tabs.itinerary },
  ];

  const share = () => {
    const out = offer.slices[0]!;
    const back = offer.slices.length > 1 ? offer.slices[offer.slices.length - 1] : null;
    const when = back ? `${f.day(out.departingAt)} – ${f.day(back.departingAt)}` : f.day(out.departingAt);
    Share.share({ message: dt.shareMessage(out.origin.city, out.destination.city, when, d.primary, basis.toLowerCase(), offer.owner.name, webSearchUrl(offer)) }).catch(() => undefined);
  };

  const open = () => {
    if (handoff.kind === "external") void openOnce(handoff.url, offer.id);
  };

  // Utløpt pris: det ekte alternativet er et nytt søk (samme skjema) – ingen oppdiktet «oppdater pris».
  const searchAgain = () => {
    runSearch();
    router.back();
  };

  // HelloSky selger selv noen billetter; de bestilles på hellosky.no, med det samme søket.
  const webUrl = handoff.kind === "not_in_app" ? webSearchUrl(offer) : null;
  const barNote = handoff.kind === "external" ? dt.handoffNote : handoff.kind === "invalid_link" ? dt.invalidLink : webUrl ? dt.webNote : dt.notInApp;
  const statusNotice =
    kind === "demo" ? dt.demo : kind === "sandbox" ? dt.sandbox(providerDisplayName(result.provider)) : kind === "unverified" ? dt.unverified : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: (barHeight || insets.bottom + 160) + space.lg }} testID="offer-screen">
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <IconButton icon="chevronLeft" label={dt.back} onPress={() => router.back()} testID="header-back" />
          <Text style={[type.headline, styles.topTitle]} accessibilityRole="header">
            {dt.title}
          </Text>
          <IconButton icon="share" label={dt.share} onPress={share} testID="share" />
        </View>

        <JourneySummary item={selected} />

        <View style={styles.body}>
          {statusNotice ? <Notices items={[{ key: "demo", tone: "warning", text: statusNotice, testID: "demo-banner" }]} /> : null}
          {warnings.length ? (
            <View accessibilityLanguage={lang} style={styles.warnings} testID="journey-warnings" accessibilityRole="summary">
              <Text style={[type.footnoteStrong, { color: colors.warningOnDark }]}>{dt.warningsTitle}</Text>
              {warnings.map((w, i) => (
                <View key={i} style={styles.row6}>
                  <Icon name={w.kind === "airportChange" ? "alert" : w.kind === "longLayover" ? "clock" : "moon"} size={14} color={colors.warningOnDark} />
                  <Text style={[type.footnote, { color: colors.onDark, flex: 1 }]} testID={`warning-${w.kind}`}>
                    {warningText(w, sliceTitle, i18n)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <DarkTabs value={tab} tabs={tabs} onChange={setTab} />

          {tab === "overview" ? (
            <>
              {/* Flere selgere av samme reise: sammenligningen først – pris, bagasje og vilkår per selger. */}
              {journey.sellers.length > 1 ? (
                <InformationCard title={dt.sellersTitle} testID="sellers">
                  <Text style={[type.footnote, { color: colors.textSecondary, marginTop: -space.sm }]}>{dt.sellersIntro(journey.sellers.length)}</Text>
                  <View accessibilityLanguage={lang} style={{ gap: space.sm }} accessibilityRole="radiogroup">
                    {journey.sellers.map((s) => (
                      <SellerOfferRow key={s.item.offer.id} item={s.item} selected={s.item.offer.id === offer.id} onPress={() => setChosen(s.item.offer.id)} />
                    ))}
                  </View>
                </InformationCard>
              ) : null}
              <InformationCard title={dt.infoTitle}>
                <InfoRow icon="plane" title={offer.owner.name} subtitle={[flightNumbers, operators.length ? dt.operatedBy(operators.join(", ")) : ""].filter(Boolean).join(" · ")} />
                <InfoRow icon="seat" title={cabinLabel(offer.cabinClass, i18n)} subtitle={dt.cabinSubtitle} />
                {offer.slices.map((s, i) => (
                  <InfoRow
                    key={s.id || i}
                    icon={i === 0 ? "clock" : "repeat"}
                    title={dt.sliceSummary(sliceTitle(i), f.duration(s.durationMinutes))}
                    subtitle={s.stops ? dt.viaStops(f.stops(s.stops), s.segments.slice(0, -1).map((g) => g.destination.city).join(", ")) : f.stops(0)}
                  />
                ))}
                {aircraft.length ? <InfoRow icon="plane" title={aircraft.join(", ")} subtitle={dt.aircraftSubtitle} /> : null}
              </InformationCard>

              <InformationCard title={dt.priceTitle} testID="price-card">
                <View style={{ gap: 2 }}>
                  <PriceTag price={price} size="large" testID="offer-price" />
                  <Text style={[type.footnote, { color: colors.textSecondary }]}>{basis}</Text>
                </View>
                {price.nok.kind === "converted" ? <Text style={[type.footnote, { color: colors.textSecondary }]} testID="fx-details">{t.price.convertedNotice}</Text> : null}
                {feeNok !== null ? (
                  <Text style={[type.footnote, { color: colors.textSecondary }]} testID="service-fee">{t.price.serviceFee(f.nok(feeNok))}</Text>
                ) : price.serviceFee ? (
                  <Text style={[type.footnote, { color: colors.textSecondary }]} testID="service-fee">
                    {t.price.serviceFeeIncluded}
                  </Text>
                ) : null}
                {journey.sellers.length === 1 && handoff.kind === "external" ? (
                  <InfoRow testID="seller" icon="info" title={dt.soldBy(handoff.providerName)} subtitle={sellerKindLabel(handoff.sellerKind, i18n)} />
                ) : null}
                {expired ? (
                  <Banner tone="warning" testID="offer-expired">
                    {dt.expired}
                  </Banner>
                ) : null}
              </InformationCard>

            </>
          ) : null}

          {tab === "baggage" ? (
            <InformationCard title={dt.baggageTitle} testID="baggage-card">
              <Text style={[type.footnote, { color: colors.textSecondary, marginTop: -space.sm }]}>{dt.baggageIntro}</Text>
              {bags.map((b) => (
                <InfoRow
                  key={b.key}
                  testID={`bag-${b.key}`}
                  icon={b.key === "carryOn" ? "bag" : "luggage"}
                  title={b.label}
                  subtitle={b.state === "unknown" ? dt.baggageNotStated : null}
                  value={b.value}
                  valueTone={b.state === "included" ? "good" : "muted"}
                />
              ))}
              <Text style={[type.caption, { color: colors.textSecondary }]}>{dt.baggageConfirm}</Text>
            </InformationCard>
          ) : null}

          {tab === "terms" && hasTerms ? (
            <InformationCard title={dt.termsTitle} testID="terms-card">
              {conds.map((c) => (
                <InfoRow key={c.key} icon={c.state === "allowed" ? "check" : c.state === "fee" ? "info" : "close"} title={c.label} subtitle={c.value} testID={`condition-${c.key}`} />
              ))}
              {disclosure ? <Text style={[type.footnote, { color: colors.text }]} testID="disclosure">{disclosure}</Text> : null}
              <Text style={[type.caption, { color: colors.textSecondary }]}>{dt.termsConfirm}</Text>
            </InformationCard>
          ) : null}

          {tab === "itinerary" ? offer.slices.map((s, i) => <SliceTimeline key={s.id || i} slice={s} title={sliceTitle(i)} />) : null}
        </View>
      </ScrollView>

      {/*
        Én rad: pris og grunnlag til venstre, handlingen til høyre. Blir teksten stor
        eller knappen bred, brytes raden – knappen legger seg under i full bredde i
        stedet for å kuttes. Valgt tilbyder står rett under, ved handlingen.
      */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]} testID="offer-bar" onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        {openError ? (
          <Banner tone="error" dark>
            {dt.openError}
          </Banner>
        ) : null}
        <View style={styles.barRow}>
          <View accessibilityLanguage={lang} style={[styles.barPrice, priceAlone && styles.barPriceAlone]} accessible accessibilityLabel={`${d.accessibilityLabel}. ${basis}`} testID="bar-price">
            <Text
              style={[type.price, { color: d.available ? colors.onDark : colors.onDarkMuted }]}
              testID="bar-amount"
              onLayout={(e) => {
                if (!priceAlone && e.nativeEvent.layout.height > type.price.lineHeight * fontScale * 1.5) setPriceWrappedAt(fontScale);
              }}
            >
              {d.primary}
            </Text>
            <Text style={[type.caption, { color: colors.onDarkMuted }]}>{basis}</Text>
          </View>
          {expired ? (
            <PrimaryButton testID="search-again" label={dt.searchAgain} icon="refresh" onPress={searchAgain} style={styles.barAction} />
          ) : handoff.kind === "external" ? (
            <PrimaryButton
              testID="handoff-button"
              label={t.offer.handoffShort}
              accessibilityLabel={handoffLabel(handoff, i18n)}
              icon="external"
              loading={opening}
              onPress={open}
              accessibilityHint={dt.handoffHint}
              style={styles.barAction}
            />
          ) : handoff.kind === "not_in_app" && webUrl ? (
            <PrimaryButton
              testID="web-handoff"
              label={dt.webButton}
              icon="external"
              accessibilityHint={dt.webHint}
              style={styles.barAction}
              onPress={() => void WebBrowser.openBrowserAsync(webUrl, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined)}
            />
          ) : null}
        </View>
        {expired && handoff.kind === "external" ? (
          <LinkButton dark testID="handoff-button" label={dt.openAnyway(handoff.providerName)} accessibilityLabel={dt.openAnyway(handoff.providerName)} onPress={open} />
        ) : null}
        <Text style={[type.caption, { color: colors.onDarkMuted }]} testID={handoff.kind === "external" ? "handoff-note" : handoff.kind === "invalid_link" ? "handoff-invalid" : "handoff-not-in-app"}>
          {handoff.kind === "external" ? <Text style={{ color: colors.onDark, fontWeight: "600" }} testID="bar-provider">{`${handoff.providerName} · `}</Text> : null}
          {barNote}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  topTitle: { flex: 1, textAlign: "center", color: colors.onDark },
  summary: { marginHorizontal: space.lg, borderRadius: radius.card, padding: space.lg, paddingBottom: space.xxl, gap: space.lg, minHeight: 240, justifyContent: "space-between" },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  summaryRoute: { flexDirection: "row", alignItems: "flex-start" },
  endpoint: { width: 112 },
  // Plass til to linjer på begge sider, så klokkeslettene alltid står på linje.
  heroPlace: { color: colors.onDarkMuted, minHeight: 32 },
  heroCode: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.5, color: colors.onDark },
  heroPlus: { fontSize: 13, fontWeight: "600", color: colors.blueOnDark },
  returnRow: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.3)", paddingTop: space.md },
  returnLabel: { color: colors.onDarkMuted, fontWeight: "600", letterSpacing: 0.6 },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  row6: { flexDirection: "row", alignItems: "center", gap: 6 },
  warnings: { gap: space.xs, backgroundColor: colors.raised, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, padding: space.md },
  tlRow: { flexDirection: "row", alignItems: "stretch" },
  tlTime: { width: 58, color: colors.text, paddingTop: 1 },
  plus: { fontSize: 11, fontWeight: "600", color: colors.blue },
  rail: { width: 20, alignItems: "center" },
  railLine: { position: "absolute", top: 0, bottom: 0, width: 1.5, backgroundColor: colors.lightBorder },
  dot: { marginTop: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.white },
  tlBody: { flex: 1, paddingLeft: space.sm, paddingBottom: space.sm },
  flightBar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, backgroundColor: colors.inset, borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: space.sm },
  // Logo og navn: så bredt som navnet trenger (høyst hele linjen); varigheten brytes ned når de ikke får plass sammen.
  flightWho: { flexDirection: "row", alignItems: "center", gap: space.sm, flexGrow: 1, flexShrink: 1, flexBasis: "auto" },
  durationPill: { marginLeft: "auto", borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  seller: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder },
  sellerOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.darkBorder, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  // Brytes når pris (minst 120 pt) og knapp ikke får plass på én linje; da får begge full bredde.
  barRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.md, rowGap: space.sm },
  // Samme linje: prisen tar nesten all ledig plass og knappen beholder sin bredde. Alene på en linje tar knappen hele.
  barPrice: { flexGrow: 100, flexShrink: 1, flexBasis: 120, gap: 2 },
  // Beløpet fikk ikke plass på én linje: prisen alene på raden, knappen under i full bredde.
  barPriceAlone: { flexBasis: "100%" },
  barAction: { flexGrow: 1 },
});
