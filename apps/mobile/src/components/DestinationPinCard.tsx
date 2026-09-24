import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Text } from "./a11y";
import type { Destination } from "../lib/destinations";
import { useI18n } from "../i18n";
import { IconButton, PrimaryButton } from "./ui";
import { colors, radius, space, type } from "../lib/theme";

/**
 * Det valgte reisemålet på kartet: by, land, flyplass og nøyaktig IATA-kode,
 * og «Se flyreiser» med skjemaets fra-flyplass, datoer og reisende. Ingen
 * pris – den finnes først etter et søk.
 */
export function DestinationPinCard({ destination, onSearch, onClose }: { destination: Destination; onSearch: () => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const e = t.explore;
  const n = destination.names[locale];
  return (
    <View style={styles.card} testID="map-pin-card">
      <View style={styles.top}>
        <Image source={destination.photo.image} style={styles.thumb} contentFit="cover" accessible={false} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{e.destination}</Text>
          <Text style={[type.section, { color: colors.text }]} accessibilityRole="header" testID="map-pin-city">
            {n.city}
          </Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{n.country}</Text>
          <Text style={[type.footnoteStrong, { color: colors.text }]} testID="map-pin-airport">
            {e.airportLine(n.airport, destination.iata)}
          </Text>
        </View>
        <IconButton icon="close" label={e.close} variant="light" size={36} onPress={onClose} testID="map-pin-close" />
      </View>
      <Text style={[type.caption, { color: colors.textSecondary }]}>{e.noPrice}</Text>
      <PrimaryButton label={e.seeFlights} accessibilityLabel={e.seeFlightsTo(n.city, `${n.airport} (${destination.iata})`)} icon="arrowRight" onPress={onSearch} testID="map-pin-search" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.md },
  top: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.inset },
});
