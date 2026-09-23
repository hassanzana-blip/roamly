import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
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
import { dayOffset, formatDay, formatDuration, formatNok, formatStops, formatTime, minutesBetween } from "../../lib/format";
import { CONVERTED_NOTICE, priceDisplay, serviceFeeNokMinor } from "../../lib/price";
import { cabinLabel } from "../../lib/searchForm";
import { photoForAirport } from "../../lib/destinations";
import { PriceTag } from "../../components/PriceTag";
import { AirlineLogo } from "../../components/AirlineLogo";
import { BottomFade, PhotoBackdrop } from "../../components/Photo";
import { RouteLine } from "../../components/OfferCard";
import { Icon } from "../../components/Icon";
import { Banner, DarkTabs, IconButton, InfoRow, InformationCard, Notices, PrimaryButton, StateView } from "../../components/ui";
import { colors, radius, space, type } from "../../lib/theme";

type Tab = "overview" | "baggage" | "terms" | "itinerary";

/** «Bytte i København · 1 t 55 min» – uten varighet når tidspunktene ikke kan regnes trygt. */
function layoverText(city: string, arrive: string, depart: string): string {
  const minutes = minutesBetween(arrive, depart);
  return minutes === null ? `Bytte i ${city}` : `Bytte i ${city} · ${formatDuration(minutes)}`;
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
  const { offer } = item;
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
          <Text style={[type.calloutStrong, { color: colors.onDark }]} numberOfLines={1}>
            {offer.owner.name}
          </Text>
          <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>{`${flights} · ${cabinLabel(offer.cabinClass)}`}</Text>
        </View>
      </View>
      <View style={styles.summaryRoute} accessible accessibilityLabel={`Utreise ${formatDay(out.departingAt)}: ${out.origin.city} ${formatTime(out.departingAt)} til ${out.destination.city} ${formatTime(out.arrivingAt)}, ${formatDuration(out.durationMinutes)}, ${formatStops(out.stops).toLowerCase()}`}>
        <Endpoint code={out.origin.iata} place={out.origin.name || out.origin.city} time={formatTime(out.departingAt)} date={formatDay(out.departingAt)} align="left" />
        <RouteLine dark top={formatDuration(out.durationMinutes)} bottom={formatStops(out.stops)} />
        <Endpoint code={out.destination.iata} place={out.destination.name || out.destination.city} time={formatTime(out.arrivingAt)} date={formatDay(out.arrivingAt)} align="right" plus={dayOffset(out.departingAt, out.arrivingAt)} />
      </View>
      {back ? (
        <View style={styles.returnRow} accessible accessibilityLabel={`Hjemreise ${formatDay(back.departingAt)}: ${back.origin.city} ${formatTime(back.departingAt)} til ${back.destination.city} ${formatTime(back.arrivingAt)}, ${formatDuration(back.durationMinutes)}, ${formatStops(back.stops).toLowerCase()}`}>
          <Text style={[type.caption, styles.returnLabel]}>{`HJEM · ${formatDay(back.departingAt)} · ${formatStops(back.stops)}`}</Text>
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
            {[airport, terminal ? `Terminal ${terminal}` : ""].filter(Boolean).join(" · ")}
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
  const operated = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? `Flys av ${seg.operatingCarrier.name}` : null;
  return (
    <View>
      <Stop time={formatTime(seg.departingAt)} plus={dayOffset(sliceStart, seg.departingAt)} city={seg.origin.city} iata={seg.origin.iata} airport={seg.origin.name} terminal={seg.origin.terminal} first={first} />
      <Between>
        <View style={styles.flightBar}>
          <AirlineLogo carrier={seg.carrier} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={[type.footnoteStrong, { color: colors.text }]} numberOfLines={1}>
              {seg.carrier.name}
            </Text>
            {seg.flightNumber || operated || seg.aircraft ? (
              <Text style={[type.caption, type.tabular, { color: colors.textSecondary }]}>{[seg.flightNumber ? `${seg.carrier.iata}${seg.flightNumber}` : null, operated, seg.aircraft].filter(Boolean).join(" · ")}</Text>
            ) : null}
          </View>
          {formatDuration(seg.durationMinutes) ? (
            <View style={styles.durationPill}>
              <Text style={[type.caption, type.tabular, { color: colors.text }]}>{formatDuration(seg.durationMinutes)}</Text>
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
  return (
    <InformationCard title={`${title} · ${formatDay(slice.departingAt)}`}>
      <Text style={[type.footnote, { color: colors.textSecondary, marginTop: -space.sm }]}>{`${formatDuration(slice.durationMinutes)} · ${formatStops(slice.stops)}`}</Text>
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
                      <Text style={[type.footnoteStrong, { color: colors.warning }]}>{layoverText(seg.destination.city, seg.arrivingAt, next.departingAt)}</Text>
                    </View>
                    {airportChange ? (
                      <View style={styles.row6} testID="airport-change">
                        <Icon name="alert" size={16} color={colors.danger} />
                        <Text style={[type.footnoteStrong, { color: colors.danger }]}>{`Bytte av flyplass: ${seg.destination.iata} → ${next.origin.iata}`}</Text>
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
  const h = providerHandoff(item.offer);
  const d = priceDisplay(item.price);
  const bags = baggageFacts(item.offer);
  const conds = conditionFacts(item.offer);
  const kind = h.kind === "external" ? sellerKindLabel(h.sellerKind) : "HelloSky";
  return (
    <Pressable
      onPress={onPress}
      testID={`seller-${item.offer.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${sellerLabel(item.offer)}, ${kind}. ${d.accessibilityLabel}. ${bags.map(baggageShort).join(". ")}`}
      style={({ pressed }) => [styles.seller, selected && styles.sellerOn, pressed && !selected && { opacity: 0.7 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.calloutStrong, { color: colors.text }]} numberOfLines={1}>
          {sellerLabel(item.offer)}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={2}>
          {[kind, ...bags.map(baggageShort), ...conds.map((c) => `${c.label}: ${c.value.toLowerCase()}`)].join(" · ")}
        </Text>
      </View>
      <Text style={[type.calloutStrong, type.tabular, { color: d.available ? colors.text : colors.textSecondary }]}>{d.primary}</Text>
    </Pressable>
  );
}

export default function OfferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { search, view, trackClick } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [chosen, setChosen] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

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
          <IconButton icon="chevronLeft" label="Tilbake" onPress={() => router.back()} testID="header-back" />
          <Text style={[type.headline, styles.topTitle]}>Flydetaljer</Text>
          <View style={{ width: 40 }} />
        </View>
        <StateView icon="refresh" title="Tilbudet er borte" body="Tilbudet er ikke lenger tilgjengelig. Søk på nytt for å se oppdaterte priser.">
          <PrimaryButton label="Til søket" onPress={() => router.replace("/")} />
        </StateView>
      </View>
    );
  }

  const selected = journey.sellers.find((s) => s.item.offer.id === (chosen ?? id))?.item ?? journey.best;
  const { offer, price } = selected;
  const handoff = providerHandoff(offer);
  const expired = offerExpired(offer);
  const demo = result.sandbox === true || result.demoMode;
  const feeNok = serviceFeeNokMinor(price);
  const bags = baggageFacts(offer);
  const conds = conditionFacts(offer);
  const disclosure = handoff.kind === "external" ? handoff.disclosure : null;
  const hasTerms = conds.length > 0 || Boolean(disclosure);
  const d = priceDisplay(price);
  const flightNumbers = [...new Set(offer.slices.flatMap((s) => s.segments.map((g) => `${g.carrier.iata}${g.flightNumber}`)))].join(", ");
  const operators = [...new Set(offer.slices.flatMap((s) => s.segments.filter((g) => g.operatingCarrier && g.operatingCarrier.iata !== g.carrier.iata).map((g) => g.operatingCarrier!.name)))];
  const aircraft = [...new Set(offer.slices.flatMap((s) => s.segments.map((g) => g.aircraft).filter(Boolean)))];
  const sliceTitle = (i: number) => (offer.slices.length > 1 ? (i === 0 ? "Utreise" : "Hjemreise") : "Reise");

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: "Oversikt" },
    { value: "baggage", label: "Bagasje" },
    ...(hasTerms ? [{ value: "terms" as const, label: "Vilkår" }] : []),
    { value: "itinerary", label: "Reiseplan" },
  ];

  const share = () => {
    const out = offer.slices[0]!;
    const back = offer.slices.length > 1 ? offer.slices[offer.slices.length - 1] : null;
    const when = back ? `${formatDay(out.departingAt)} – ${formatDay(back.departingAt)}` : formatDay(out.departingAt);
    Share.share({ message: `${out.origin.city} → ${out.destination.city}, ${when}: ${d.primary} (${priceBasis(offer).toLowerCase()}), ${offer.owner.name}. Funnet med HelloSky.` }).catch(() => undefined);
  };

  const open = async () => {
    if (handoff.kind !== "external") return;
    setOpenError(null);
    setOpening(true);
    // Nettets egen klikkmåling, «fire and forget»; lenken er leverandørens egen, urørt.
    trackClick(offer.id);
    try {
      await WebBrowser.openBrowserAsync(handoff.url, { controlsColor: colors.blue, dismissButtonStyle: "close" });
    } catch {
      setOpenError("Kunne ikke åpne tilbyderens side. Prøv igjen.");
    } finally {
      setOpening(false);
    }
  };

  const barNote =
    handoff.kind === "external"
      ? "Bestillingen fullføres hos tilbyderen."
      : handoff.kind === "invalid_link"
        ? "Lenken til tilbyderen ser ikke trygg ut, så vi åpner den ikke."
        : "Dette tilbudet kan ikke bestilles i appen.";

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 190 }} testID="offer-screen">
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <IconButton icon="chevronLeft" label="Tilbake" onPress={() => router.back()} testID="header-back" />
          <Text style={[type.headline, styles.topTitle]} accessibilityRole="header">
            Flydetaljer
          </Text>
          <IconButton icon="share" label="Del reisen" onPress={share} testID="share" />
        </View>

        <JourneySummary item={selected} />

        <View style={styles.body}>
          {demo ? <Notices items={[{ key: "demo", tone: "warning", text: "Demo: testdata, ikke et ekte tilbud.", testID: "demo-banner" }]} /> : null}
          <DarkTabs value={tab} tabs={tabs} onChange={setTab} />

          {tab === "overview" ? (
            <>
              <InformationCard title="Reiseinformasjon">
                <InfoRow icon="plane" title={offer.owner.name} subtitle={[flightNumbers, operators.length ? `Flys av ${operators.join(", ")}` : ""].filter(Boolean).join(" · ")} />
                <InfoRow icon="seat" title={cabinLabel(offer.cabinClass)} subtitle="Reiseklasse" />
                {offer.slices.map((s, i) => (
                  <InfoRow
                    key={s.id || i}
                    icon={i === 0 ? "clock" : "repeat"}
                    title={`${sliceTitle(i)} · ${formatDuration(s.durationMinutes)}`}
                    subtitle={s.stops ? `${formatStops(s.stops)} (${s.segments.slice(0, -1).map((g) => g.destination.city).join(", ")})` : "Direkte"}
                  />
                ))}
                {aircraft.length ? <InfoRow icon="plane" title={aircraft.join(", ")} subtitle="Flytype" /> : null}
              </InformationCard>

              <InformationCard title="Pris" testID="price-card">
                <View style={{ gap: 2 }}>
                  <PriceTag price={price} size="large" testID="offer-price" />
                  <Text style={[type.footnote, { color: colors.textSecondary }]}>{priceBasis(offer)}</Text>
                </View>
                {price.nok.kind === "converted" ? <Text style={[type.footnote, { color: colors.textSecondary }]} testID="fx-details">{CONVERTED_NOTICE}</Text> : null}
                {feeNok !== null ? (
                  <Text style={[type.footnote, { color: colors.textSecondary }]} testID="service-fee">{`Herav HelloSkys servicegebyr: ${formatNok(feeNok)}`}</Text>
                ) : price.serviceFee ? (
                  <Text style={[type.footnote, { color: colors.textSecondary }]} testID="service-fee">
                    Prisen inkluderer HelloSkys servicegebyr.
                  </Text>
                ) : null}
                {journey.sellers.length === 1 && handoff.kind === "external" ? (
                  <InfoRow testID="seller" icon="info" title={`Selges av ${handoff.providerName}`} subtitle={sellerKindLabel(handoff.sellerKind)} />
                ) : null}
                {expired ? (
                  <Banner tone="warning" testID="offer-expired">
                    Prisen kan ha endret seg siden søket. Søk på nytt for oppdaterte priser.
                  </Banner>
                ) : null}
              </InformationCard>

              {journey.sellers.length > 1 ? (
                <InformationCard title="Tilbydere" testID="sellers">
                  <Text style={[type.footnote, { color: colors.textSecondary, marginTop: -space.sm }]}>
                    {`Samme reise hos ${journey.sellers.length} tilbydere. Pris, bagasje og vilkår gjelder den du velger.`}
                  </Text>
                  <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
                    {journey.sellers.map((s) => (
                      <SellerOfferRow key={s.item.offer.id} item={s.item} selected={s.item.offer.id === offer.id} onPress={() => setChosen(s.item.offer.id)} />
                    ))}
                  </View>
                </InformationCard>
              ) : null}
            </>
          ) : null}

          {tab === "baggage" ? (
            <InformationCard title="Bagasje" testID="baggage-card">
              <Text style={[type.footnote, { color: colors.textSecondary, marginTop: -space.sm }]}>Per reisende, slik tilbyderen oppga det.</Text>
              {bags.map((b) => (
                <InfoRow
                  key={b.key}
                  testID={`bag-${b.key}`}
                  icon={b.key === "carryOn" ? "bag" : "luggage"}
                  title={b.label}
                  subtitle={b.state === "unknown" ? "Tilbyderen oppga ikke dette" : null}
                  value={b.state === "included" ? b.value : b.state === "unknown" ? "Ikke oppgitt" : "Ikke inkludert"}
                  valueTone={b.state === "included" ? "good" : "muted"}
                />
              ))}
              <Text style={[type.caption, { color: colors.textSecondary }]}>Mål og vekt bekreftes hos tilbyderen.</Text>
            </InformationCard>
          ) : null}

          {tab === "terms" && hasTerms ? (
            <InformationCard title="Vilkår" testID="terms-card">
              {conds.map((c) => (
                <InfoRow key={c.key} icon={c.allowed ? "check" : "close"} title={c.label} subtitle={c.value} />
              ))}
              {disclosure ? <Text style={[type.footnote, { color: colors.text }]} testID="disclosure">{disclosure}</Text> : null}
              <Text style={[type.caption, { color: colors.textSecondary }]}>Endelige vilkår bekreftes hos tilbyderen før du betaler.</Text>
            </InformationCard>
          ) : null}

          {tab === "itinerary" ? offer.slices.map((s, i) => <SliceTimeline key={s.id || i} slice={s} title={sliceTitle(i)} />) : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]} testID="offer-bar">
        {openError ? (
          <Banner tone="error" dark>
            {openError}
          </Banner>
        ) : null}
        <View style={styles.barRow} accessible accessibilityLabel={`${d.accessibilityLabel}. ${priceBasis(offer)}`}>
          <Text style={[type.price, { color: d.available ? colors.onDark : colors.onDarkMuted }]} numberOfLines={1}>
            {d.primary}
          </Text>
          <Text style={[type.caption, { color: colors.onDarkMuted, flex: 1, textAlign: "right" }]} numberOfLines={2}>
            {priceBasis(offer)}
          </Text>
        </View>
        {handoff.kind === "external" ? (
          <PrimaryButton testID="handoff-button" label={handoffLabel(handoff)} icon="external" loading={opening} onPress={open} accessibilityHint="Åpner tilbyderens side i en nettleser. Bestillingen fullføres der." />
        ) : (
          <PrimaryButton label="Ikke i appen" disabled onPress={() => undefined} />
        )}
        <Text style={[type.caption, { color: colors.onDarkMuted, textAlign: "center" }]} testID={handoff.kind === "external" ? "handoff-note" : handoff.kind === "invalid_link" ? "handoff-invalid" : "handoff-not-in-app"}>
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
  tlRow: { flexDirection: "row", alignItems: "stretch" },
  tlTime: { width: 58, color: colors.text, paddingTop: 1 },
  plus: { fontSize: 11, fontWeight: "600", color: colors.blue },
  rail: { width: 20, alignItems: "center" },
  railLine: { position: "absolute", top: 0, bottom: 0, width: 1.5, backgroundColor: colors.lightBorder },
  dot: { marginTop: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.white },
  tlBody: { flex: 1, paddingLeft: space.sm, paddingBottom: space.sm },
  flightBar: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.inset, borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: space.sm },
  durationPill: { borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  seller: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder },
  sellerOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.darkBorder, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: space.md },
});
