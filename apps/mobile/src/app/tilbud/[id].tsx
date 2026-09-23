import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { OfferSlice, Segment } from "@contracts/types";
import { useApp } from "../../lib/appState";
import { offerExpired, sellerName } from "../../lib/offer";
import { formatDay, formatDuration, formatNok, formatStops, formatTime, minutesBetween } from "../../lib/format";
import { CONVERTED_NOTICE, serviceFeeNokMinor } from "../../lib/price";
import { cabinLabel } from "../../lib/searchForm";
import { PriceTag } from "../../components/PriceTag";
import { Icon } from "../../components/Icon";
import { Banner, Body, Button, Card, CarrierBadge, Pill, RouteHero, ScreenHeader, SectionTitle, StateView, TicketDivider } from "../../components/ui";
import { colors, fonts, radius, space } from "../../lib/theme";

/** «Bytte i København · 1 t 55 min» – uten varighet når tidspunktene ikke kan regnes trygt. */
function layoverText(city: string, arrive: string, depart: string): string {
  const minutes = minutesBetween(arrive, depart);
  return minutes === null ? `Bytte i ${city}` : `Bytte i ${city} · ${formatDuration(minutes)}`;
}

/** Ett punkt på tidslinjen: klokkeslett, prikk på linjen og sted. */
function Stop({ time, city, iata, airport, first, last }: { time: string; city: string; iata: string; airport: string; first?: boolean; last?: boolean }) {
  return (
    <View style={styles.tlRow}>
      <Text style={styles.tlTime}>{time}</Text>
      <View style={styles.rail}>
        <View style={[styles.railLine, first && { top: 12 }, last && { bottom: undefined, height: 12 }]} />
        <View style={styles.dot} />
      </View>
      <View style={styles.tlBody}>
        <Text style={styles.tlPlace}>{`${city} (${iata})`}</Text>
        {airport ? (
          <Text style={styles.tlAirport} numberOfLines={2}>
            {airport}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Mellomrad på tidslinjen (flyging eller bytte). */
function Between({ children }: { children: ReactNode }) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlTimeSpacer} />
      <View style={styles.rail}>
        <View style={styles.railLine} />
      </View>
      <View style={[styles.tlBody, { paddingVertical: space.sm }]}>{children}</View>
    </View>
  );
}

function SegmentBlock({ seg, first, last }: { seg: Segment; first: boolean; last: boolean }) {
  const operated = seg.operatingCarrier && seg.operatingCarrier.iata !== seg.carrier.iata ? `Flys av ${seg.operatingCarrier.name}` : null;
  return (
    <View>
      <Stop time={formatTime(seg.departingAt)} city={seg.origin.city} iata={seg.origin.iata} airport={seg.origin.name} first={first} />
      <Between>
        <View style={styles.flightBar}>
          <CarrierBadge code={seg.carrier.iata || seg.carrier.name} size={30} />
          <View style={{ flex: 1 }}>
            <Text style={styles.flightName} numberOfLines={1}>
              {seg.carrier.name}
              {seg.flightNumber ? ` · ${seg.carrier.iata}${seg.flightNumber}` : ""}
            </Text>
            {operated ? <Text style={styles.tlAirport}>{operated}</Text> : null}
          </View>
          {formatDuration(seg.durationMinutes) ? <Pill tone="neutral">{formatDuration(seg.durationMinutes)}</Pill> : null}
        </View>
      </Between>
      <Stop time={formatTime(seg.arrivingAt)} city={seg.destination.city} iata={seg.destination.iata} airport={seg.destination.name} last={last} />
    </View>
  );
}

function SliceBlock({ slice, title }: { slice: OfferSlice; title: string }) {
  return (
    <Card floating>
      <SectionTitle>{`${title} · ${formatDay(slice.departingAt)}`}</SectionTitle>
      <View style={styles.sliceMeta}>
        <Pill tone="indigo" icon="clock">
          {formatDuration(slice.durationMinutes)}
        </Pill>
        <Pill tone={slice.stops === 0 ? "success" : "neutral"}>{formatStops(slice.stops)}</Pill>
      </View>
      <View style={{ marginTop: space.xs }}>
        {slice.segments.map((seg, i) => {
          const next = slice.segments[i + 1];
          return (
            <View key={seg.id || i}>
              <SegmentBlock seg={seg} first={i === 0} last={!next} />
              {next ? (
                <Between>
                  <View style={styles.layover}>
                    <Icon name="clock" size={16} color={colors.layover} />
                    <Text style={styles.layoverText}>{layoverText(seg.destination.city, seg.arrivingAt, next.departingAt)}</Text>
                  </View>
                </Between>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export default function OfferScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { search } = useApp();

  const result = search.status === "done" ? search.result : null;
  const item = result?.offers.find((o) => o.offer.id === id);
  if (!result || !item) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Tilbud" onBack={() => router.back()} />
        <StateView dark icon="refresh" title="Tilbudet er borte" body="Tilbudet er ikke lenger tilgjengelig. Søk på nytt for å se oppdaterte priser.">
          <Button label="Til søket" onPress={() => router.replace("/")} />
        </StateView>
      </View>
    );
  }

  const { offer, price } = item;
  const seller = sellerName(offer);
  const expired = offerExpired(offer);
  const testData = result.sandbox === true || result.demoMode;
  const bag = offer.baggage;
  const feeNok = serviceFeeNokMinor(price);
  const outbound = offer.slices[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="offer-screen">
      <ScreenHeader title="Tilbud" onBack={() => router.back()}>
        {outbound ? (
          <RouteHero
            from={{ code: outbound.origin.iata, city: outbound.origin.city }}
            to={{ code: outbound.destination.iata, city: outbound.destination.city }}
            label={`${offer.slices.length > 1 ? "Tur-retur" : "Én vei"} fra ${outbound.origin.city} til ${outbound.destination.city}`}
          />
        ) : null}
      </ScreenHeader>

      <View style={styles.cards}>
        {testData ? <Banner tone="warning">Testdata: prisen er ikke ekte.</Banner> : null}

        <Card floating>
          <View style={styles.carrierRow}>
            <CarrierBadge code={offer.owner.iata || offer.owner.name} size={40} />
            <Text style={styles.carrier} numberOfLines={2}>
              {offer.owner.name}
            </Text>
          </View>
          <TicketDivider />
          <PriceTag price={price} align="left" large testID="offer-price" />
          {price.nok.kind === "converted" ? <Body muted testID="fx-details">{CONVERTED_NOTICE}</Body> : null}
          {feeNok !== null ? (
            <Body muted testID="service-fee">{`Herav HelloSkys servicegebyr: ${formatNok(feeNok)}`}</Body>
          ) : price.serviceFee ? (
            <Body muted testID="service-fee">Prisen inkluderer HelloSkys servicegebyr.</Body>
          ) : null}
          <View style={styles.pills}>
            <Pill tone="neutral" icon="seat">
              {cabinLabel(offer.cabinClass)}
            </Pill>
            <Pill tone={offer.refundable ? "success" : "neutral"}>{offer.refundable ? "Kan refunderes" : "Kan ikke refunderes"}</Pill>
            <Pill tone={offer.changeable ? "success" : "neutral"}>{offer.changeable ? "Kan endres" : "Kan ikke endres"}</Pill>
          </View>
          {seller ? (
            <View style={styles.bagRow} testID="seller">
              <Icon name="info" size={18} color={colors.textSecondary} />
              <Body muted>{`Selges av ${seller}`}</Body>
            </View>
          ) : null}
          {expired ? (
            <Banner tone="warning" testID="offer-expired">
              Prisen kan ha endret seg siden søket. Søk på nytt for oppdaterte priser.
            </Banner>
          ) : null}
        </Card>

        {offer.slices.map((s, i) => (
          <SliceBlock key={s.id || i} slice={s} title={offer.slices.length > 1 ? (i === 0 ? "Utreise" : "Hjemreise") : "Reise"} />
        ))}

        <Card floating>
          <SectionTitle>Bagasje per person</SectionTitle>
          <View style={styles.bagRow}>
            <Icon name="bag" size={20} color={colors.indigo} />
            <Body>{`Håndbagasje: ${bag.carryOnUnknown ? "ikke oppgitt" : bag.carryOnBags}`}</Body>
          </View>
          <View style={styles.bagRow}>
            <Icon name="bag" size={20} color={colors.indigo} />
            <Body>{`Innsjekket bagasje: ${bag.checkedUnknown ? "ikke oppgitt" : bag.checkedBags}`}</Body>
          </View>
        </Card>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  content: { paddingBottom: space.xxxl },
  cards: { paddingHorizontal: space.lg, gap: space.md },
  carrierRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  carrier: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  sliceMeta: { flexDirection: "row", gap: space.sm },
  tlRow: { flexDirection: "row", alignItems: "stretch" },
  tlTime: { width: 52, fontFamily: fonts.heavy, fontSize: 16, color: colors.text, paddingTop: 2 },
  tlTimeSpacer: { width: 52 },
  rail: { width: 22, alignItems: "center" },
  railLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: colors.indigoSoft },
  dot: { marginTop: 7, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.indigo, borderWidth: 2, borderColor: colors.white },
  tlBody: { flex: 1, paddingLeft: space.sm, paddingBottom: space.xs },
  tlPlace: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  tlAirport: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  flightBar: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  flightName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  layover: { flexDirection: "row", alignItems: "center", gap: 6 },
  layoverText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.layover },
  bagRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
