import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../../components/a11y";
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
import { MAP_POINTS } from "../../lib/destinationMap";
import { DestinationCard } from "../../components/DestinationCard";
import { colors, space, type } from "../../lib/theme";

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
  const selected = MAP_POINTS.find((p) => p.destination.id === selectedId)?.destination ?? null;
  const cardWidth = (width - space.lg * 2 - space.md) / 2;

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const dates = form.tripType === "roundtrip" ? `${f.shortDay(form.departDate)} – ${f.shortDay(form.returnDate)}` : f.shortDay(form.departDate);

  const head = (
    <View style={styles.head}>
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
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.lg }]} testID="explore-screen">
        <StatusBar style="light" />
        {head}
        <Text style={[type.caption, styles.mapNote]} testID="map-note">
          {t.explore.mapNote}
        </Text>
        {native ? (
          <View style={styles.mapArea}>
            <DestinationMap points={MAP_POINTS} selectedId={selectedId} onSelect={setSelectedId} bottomInset={0} />
          </View>
        ) : (
          <ScrollView style={styles.mapArea} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
            <DestinationMap points={MAP_POINTS} selectedId={selectedId} onSelect={setSelectedId} bottomInset={0} />
          </ScrollView>
        )}
        {selected ? (
          // Kortet kan bli høyere enn plassen (stor tekst): da ruller det, og «Se flyreiser» er alltid til å nå.
          <ScrollView style={styles.cardWrap} contentContainerStyle={styles.cardContent} testID="map-pin-card-scroll">
            <DestinationPinCard destination={selected} onSearch={() => searchTo(selected)} onClose={() => setSelectedId(null)} />
          </ScrollView>
        ) : null}
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
  mapNote: { color: colors.onDarkMuted, paddingHorizontal: space.lg, marginTop: -space.md, marginBottom: space.sm },
  // Kartet (eller reservelisten) gir plass først; kortet får sin naturlige høyde, høyst 55 %, og ruller over det.
  mapArea: { flexGrow: 1, flexShrink: 1, minHeight: 140, backgroundColor: colors.bg },
  cardWrap: { flexGrow: 0, flexShrink: 0, maxHeight: "55%", backgroundColor: colors.bg },
  cardContent: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg, rowGap: space.lg },
});
