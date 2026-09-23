import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { OfferSlice, Segment } from "@contracts/types";
import { useApp } from "../../lib/appState";
import { bookingHandoff, handoffLabel, offerExpired } from "../../lib/booking";
import { formatDay, formatDuration, formatForeign, formatNumericDate, formatStops, formatTime } from "../../lib/format";
import { rateDescription } from "../../lib/price";
import { cabinLabel } from "../../lib/searchForm";
import { PriceTag } from "../../components/PriceTag";
import { Banner, Body, Button, Card, SectionTitle } from "../../components/ui";
import { colors, fonts, space } from "../../lib/theme";

/** Minutter mellom to lokale tider på samme flyplass (bytte). */
function layoverMinutes(arrive: string, depart: string): number {
  const a = Date.parse(`${arrive.slice(0, 16)}:00Z`);
  const d = Date.parse(`${depart.slice(0, 16)}:00Z`);
  return Number.isFinite(a) && Number.isFinite(d) ? Math.round((d - a) / 60_000) : 0;
}

function SegmentRow({ seg }: { seg: Segment }) {
  return (
    <View style={styles.segment}>
      <Text style={styles.segTimes}>
        {formatTime(seg.departingAt)} {seg.origin.city} ({seg.origin.iata})
      </Text>
      <Text style={styles.segMeta}>
        {seg.carrier.name} {seg.flightNumber ? `· ${seg.carrier.iata}${seg.flightNumber}` : ""} · {formatDuration(seg.durationMinutes)}
        {seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? ` · Flys av ${seg.operatingCarrier.name}` : ""}
      </Text>
      <Text style={styles.segTimes}>
        {formatTime(seg.arrivingAt)} {seg.destination.city} ({seg.destination.iata})
      </Text>
    </View>
  );
}

function SliceBlock({ slice, title }: { slice: OfferSlice; title: string }) {
  return (
    <Card>
      <SectionTitle>{`${title} · ${formatDay(slice.departingAt)}`}</SectionTitle>
      <Body muted>
        {formatDuration(slice.durationMinutes)} · {formatStops(slice.stops)}
      </Body>
      {slice.segments.map((seg, i) => {
        const next = slice.segments[i + 1];
        return (
          <View key={seg.id || i} style={{ gap: space.sm }}>
            <SegmentRow seg={seg} />
            {next ? <Text style={styles.layover}>{`Bytte i ${seg.destination.city} · ${formatDuration(layoverMinutes(seg.arrivingAt, next.departingAt))}`}</Text> : null}
          </View>
        );
      })}
    </Card>
  );
}

export default function OfferScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { search } = useApp();
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const result = search.status === "done" ? search.result : null;
  const item = result?.offers.find((o) => o.offer.id === id);
  if (!result || !item) {
    return (
      <View style={styles.missing}>
        <Body>Tilbudet er ikke lenger tilgjengelig. Søk på nytt for å se oppdaterte priser.</Body>
        <Button label="Til søket" variant="secondary" onPress={() => router.replace("/")} />
      </View>
    );
  }

  const { offer, price } = item;
  const handoff = bookingHandoff(offer);
  const expired = offerExpired(offer);
  const testData = result.sandbox === true || result.demoMode;
  const bag = offer.baggage;

  const open = async (url: string) => {
    setOpenError(null);
    setOpening(true);
    try {
      // SFSafariViewController: lenken åpnes urørt, og leverandørens side har ikke tilgang til appen.
      await WebBrowser.openBrowserAsync(url, { controlsColor: colors.azure, dismissButtonStyle: "close" });
    } catch {
      setOpenError("Kunne ikke åpne leverandørens side. Prøv igjen.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={styles.content} testID="offer-screen">
      {testData ? <Banner tone="warning">Testdata: prisen og lenken er ikke ekte.</Banner> : null}
      <Card>
        <Text style={styles.carrier}>{offer.owner.name}</Text>
        <PriceTag price={price} align="left" large testID="offer-price" />
        {price.nok.kind === "converted" ? (
          <View style={{ gap: 2 }} testID="fx-details">
            <Body muted>{`Leverandørens pris: ${formatForeign(price.total.amount, price.total.currency)}`}</Body>
            {price.serviceFee ? <Body muted>{`Herav HelloSkys servicegebyr: ${formatForeign(price.serviceFee.amount, price.serviceFee.currency)}`}</Body> : null}
            <Body muted>{`Kurs: ${rateDescription(price.nok.rate)} (Norges Bank, ${formatNumericDate(price.nok.rate.rateDate)}, veiledende midtkurs)`}</Body>
          </View>
        ) : null}
        <Body muted>{`${cabinLabel(offer.cabinClass)} · ${offer.refundable ? "Kan refunderes" : "Kan ikke refunderes"} · ${offer.changeable ? "Kan endres" : "Kan ikke endres"}`}</Body>
      </Card>

      {offer.slices.map((s, i) => (
        <SliceBlock key={s.id || i} slice={s} title={offer.slices.length > 1 ? (i === 0 ? "Utreise" : "Hjemreise") : "Reise"} />
      ))}

      <Card>
        <SectionTitle>Bagasje per person</SectionTitle>
        <Body>{`Håndbagasje: ${bag.carryOnUnknown ? "ikke oppgitt" : bag.carryOnBags}`}</Body>
        <Body>{`Innsjekket bagasje: ${bag.checkedUnknown ? "ikke oppgitt" : bag.checkedBags}`}</Body>
      </Card>

      <Card>
        <SectionTitle>Bestilling</SectionTitle>
        {handoff.kind === "external" ? (
          <View style={{ gap: space.md }} testID="handoff-external">
            <Body>{`Du bestiller og betaler hos ${handoff.providerName}, ikke hos HelloSky. Prisen kan endre seg når du kommer dit.`}</Body>
            {price.nok.kind === "converted" ? <Body muted>{`${handoff.providerName} tar betalt i ${price.total.currency.toUpperCase()}.`}</Body> : null}
            {handoff.disclosure ? <Body muted>{handoff.disclosure}</Body> : null}
            {expired ? <Banner tone="warning">Tilbudet kan ha utløpt. Søk gjerne på nytt før du bestiller.</Banner> : null}
            {openError ? <Banner tone="error">{openError}</Banner> : null}
            <Button testID="handoff-button" label={handoffLabel(handoff)} loading={opening} onPress={() => open(handoff.url)} accessibilityHint="Åpner leverandørens side i en nettleser" />
          </View>
        ) : handoff.kind === "invalid_link" ? (
          <Banner tone="warning" testID="handoff-invalid">
            Lenken til leverandøren ser ikke trygg ut, så vi åpner den ikke.
          </Banner>
        ) : (
          <Body testID="handoff-not-in-app">Dette tilbudet selges av HelloSky og kan foreløpig ikke bestilles i appen.</Body>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  missing: { flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center", backgroundColor: colors.sand },
  carrier: { fontFamily: fonts.bold, fontSize: 18, color: colors.petrol },
  segment: { gap: 2, borderLeftWidth: 2, borderLeftColor: colors.mintDeep, paddingLeft: space.md },
  segTimes: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  segMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  layover: { fontFamily: fonts.medium, fontSize: 13, color: colors.warning, paddingLeft: space.md },
});
