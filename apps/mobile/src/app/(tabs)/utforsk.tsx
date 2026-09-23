import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { formatShortDay } from "../../lib/format";
import { DESTINATIONS, type Destination } from "../../lib/destinations";
import { passengerSummary } from "../../lib/searchForm";
import { Banner } from "../../components/ui";
import { DestinationCard } from "../../components/DestinationCard";
import { colors, space, type } from "../../lib/theme";

/**
 * Alle reisemålene HelloSky har godkjente bilder av. Et trykk søker til
 * reisemålets flyplass med skjemaets fra-flyplass, datoer og reisende.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { form, runSearch } = useApp();
  const [problem, setProblem] = useState<string | null>(null);
  const cardWidth = (width - space.lg * 2 - space.md) / 2;

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: { iata: d.iata, name: d.airportName, city: d.city, country: d.country } });
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const dates = form.tripType === "roundtrip" ? `${formatShortDay(form.departDate)} – ${formatShortDay(form.returnDate)}` : formatShortDay(form.departDate);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxxl }} testID="explore-screen">
      <StatusBar style="light" />
      <View style={styles.head}>
        <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
          Utforsk reisemål
        </Text>
        <Text style={[type.footnote, { color: colors.onDarkMuted }]}>
          {form.origin ? `Fra ${form.origin.city} (${form.origin.iata}) · ${dates} · ${passengerSummary(form)}` : "Velg hvor du reiser fra på forsiden."}
        </Text>
        {problem ? (
          <Banner tone="error" dark testID="explore-error">
            {problem}
          </Banner>
        ) : null}
      </View>
      <View style={styles.grid}>
        {DESTINATIONS.map((d) => (
          <View key={d.id} style={{ width: cardWidth, gap: space.xs }}>
            <DestinationCard destination={d} onPress={() => searchTo(d)} style={{ width: cardWidth, height: cardWidth * 0.9 }} testID={`explore-${d.id}`} />
            <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>{`${d.country} · ${d.iata}`}</Text>
          </View>
        ))}
      </View>
      <Text style={[type.caption, styles.credit]}>Foto: Unsplash. Se Profil for kreditering.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg, rowGap: space.lg },
  credit: { color: colors.onDarkDim, paddingHorizontal: space.lg, marginTop: space.xl },
});
