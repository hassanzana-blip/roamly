import { useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { DESTINATIONS, destinationChoice, type Destination } from "../../lib/destinations";
import { formErrorText, passengerSummary } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
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
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const [problem, setProblem] = useState<FormErrorCode | null>(null);
  const cardWidth = (width - space.lg * 2 - space.md) / 2;

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const dates = form.tripType === "roundtrip" ? `${f.shortDay(form.departDate)} – ${f.shortDay(form.returnDate)}` : f.shortDay(form.departDate);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxxl }} testID="explore-screen">
      <StatusBar style="light" />
      <View style={styles.head}>
        <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
          {t.explore.title}
        </Text>
        <Text style={[type.footnote, { color: colors.onDarkMuted }]}>
          {form.origin ? t.explore.fromSummary(form.origin.city, form.origin.iata, dates, passengerSummary(form, i18n)) : t.explore.chooseOrigin}
        </Text>
        {problem ? (
          <Banner tone="error" dark testID="explore-error">
            {formErrorText(problem, i18n)}
          </Banner>
        ) : null}
      </View>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg, rowGap: space.lg },
});
