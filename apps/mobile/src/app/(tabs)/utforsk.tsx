import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { DESTINATIONS, destinationChoice, type Destination } from "../../lib/destinations";
import { formErrorText, passengerSummary } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, DarkTabs } from "../../components/ui";
import { DestinationMap } from "../../components/DestinationMap";
import { DestinationPinCard } from "../../components/DestinationPinCard";
import { MAP_AREAS, MAP_POINTS, areaOfDestination, initialArea, pointsIn, type MapArea } from "../../lib/destinationMap";
import { DestinationCard } from "../../components/DestinationCard";
import { colors, radius, space, type } from "../../lib/theme";

type ExploreView = "list" | "map";

/**
 * Alle reisemålene HelloSky har godkjente bilder av, som liste eller kart.
 * Et trykk (kort i listen, «Se flyreiser» på kartet) søker til reisemålets
 * flyplass med skjemaets fra-flyplass, datoer og reisende. Kartets nåler er
 * reisemål – aldri priser eller ledige plasser. Listen er alltid tilgjengelig.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { form, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const [problem, setProblem] = useState<FormErrorCode | null>(null);
  const [view, setView] = useState<ExploreView>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Kartets område: Europa først (eller det valgte reisemålets område); knappene bytter.
  const [area, setArea] = useState<MapArea | null>("europe");
  const [areaRequest, setAreaRequest] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const selected = MAP_POINTS.find((p) => p.destination.id === selectedId)?.destination ?? null;
  const cardWidth = (width - space.lg * 2 - space.md) / 2;

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const dates = form.tripType === "roundtrip" ? `${f.shortDay(form.departDate)} – ${f.shortDay(form.returnDate)}` : f.shortDay(form.departDate);

  const head = (
    <View style={[styles.head, view === "map" && { marginBottom: space.md }]}>
      <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
        {t.explore.title}
      </Text>
      <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID="explore-summary">
        {form.origin ? t.explore.fromSummary(form.origin.city, form.origin.iata, dates, passengerSummary(form, i18n)) : t.explore.chooseOrigin}
      </Text>
      <DarkTabs
        value={view}
        onChange={(v) => {
          setView(v);
          setProblem(null);
          if (v === "map" && !area) setArea(initialArea(selectedId));
        }}
        tabs={[
          { value: "list", label: t.explore.viewList },
          { value: "map", label: t.explore.viewMap },
        ]}
      />
      {problem ? (
        <Banner tone="error" dark testID="explore-error">
          {formErrorText(problem, i18n)}
        </Banner>
      ) : null}
    </View>
  );

  if (view === "map") {
    const native = Platform.OS === "ios";
    const chooseArea = (a: MapArea) => {
      setArea(a);
      setAreaRequest((n) => n + 1);
      // Et valgt reisemål utenfor det nye området ville stå utenfor kartet.
      if (selectedId && a !== "world" && areaOfDestination(selectedId) !== a) setSelectedId(null);
    };
    const mapProps = { points: MAP_POINTS, selectedId, onSelect: setSelectedId, bottomInset: selected ? cardHeight : 0, area, areaRequest, onLeaveArea: () => setArea(null) };
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.lg }]} testID="explore-screen">
        <StatusBar style="light" />
        {head}
        <Text style={[type.caption, styles.mapNote]} testID="map-note">
          {t.explore.mapNote}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areas} contentContainerStyle={styles.areasContent} accessibilityLabel={t.explore.areasLabel} testID="map-areas">
          {MAP_AREAS.map((a) => {
            const on = a === area;
            const name = t.explore.areas[a];
            return (
              <Pressable
                key={a}
                onPress={() => chooseArea(a)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.explore.areaLabel(name, pointsIn(a).length)}
                testID={`map-area-${a}`}
                style={({ pressed }) => [styles.area, on && styles.areaOn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[type.footnoteStrong, { color: on ? colors.text : colors.onDark }]}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {/* Kartet fyller resten; kortet ligger over bunnen av kartet i stedet for å krympe det. */}
        <View style={styles.mapArea}>
          {native ? (
            <DestinationMap {...mapProps} />
          ) : (
            <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: (selected ? cardHeight : 0) + space.lg }}>
              <DestinationMap {...mapProps} />
            </ScrollView>
          )}
          {selected ? (
            // Kortet kan bli høyere enn plassen (stor tekst): da ruller det, og «Se flyreiser» er alltid til å nå.
            <ScrollView
              style={styles.cardWrap}
              contentContainerStyle={styles.cardContent}
              onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}
              testID="map-pin-card-scroll"
            >
              <DestinationPinCard destination={selected} onSearch={() => searchTo(selected)} onClose={() => setSelectedId(null)} />
            </ScrollView>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxxl }} testID="explore-screen">
      <StatusBar style="light" />
      {head}
      <View style={styles.grid}>
        {DESTINATIONS.map((d) => (
          <View key={d.id} style={{ width: cardWidth, gap: space.xs }}>
            <DestinationCard destination={d} onPress={() => searchTo(d)} style={{ width: cardWidth, height: cardWidth * 0.9 }} testID={`explore-${d.id}`} />
            <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>{t.explore.countryCode(d.names[locale].country, d.iata)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.xl },
  mapNote: { color: colors.onDarkMuted, paddingHorizontal: space.lg, marginBottom: space.sm },
  areas: { flexGrow: 0, flexShrink: 0 },
  areasContent: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  area: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.onDarkMuted },
  areaOn: { backgroundColor: colors.white, borderColor: colors.white },
  // Kartet (eller reservelisten) fyller resten av skjermen; kortet ligger over bunnen, høyst 55 % høyt, og ruller.
  mapArea: { flex: 1, minHeight: 200, backgroundColor: colors.bg },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "55%" },
  cardContent: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg, rowGap: space.lg },
});
