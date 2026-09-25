import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Pressable, Text } from "./a11y";
import type { Destination } from "../lib/destinations";
import { BottomFade, PhotoBackdrop } from "./Photo";
import { Icon } from "./Icon";
import { colors, radius, space, type } from "../lib/theme";
import { useI18n } from "../i18n";

/**
 * Reisemål med foto. Ingen «fra»-pris: vi har ingen verifisert pris uten
 * datoer og reisende, så kortet lover bare det det gjør – å søke.
 */
export function DestinationCard({ destination, onPress, style, testID }: { destination: Destination; onPress: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { t, locale } = useI18n();
  const names = destination.names[locale];
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t.explore.seeFlightsTo(names.city, names.airport)}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}
    >
      <PhotoBackdrop photo={destination.photo} scrim="light" style={StyleSheet.absoluteFill}>
        <BottomFade />
      </PhotoBackdrop>
      <View style={styles.text}>
        <Text style={[type.calloutStrong, { color: colors.onDark }]} numberOfLines={1}>
          {names.city}
        </Text>
        <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>
          {t.explore.seeFlights}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Reisemål som et hvitt kort i raden på forsiden, som de store søketjenestenes tilbudskort – men uten pris: foto øverst,
 * så by, land og flyplasskode, og «Se flyreiser». Vi viser ingen «fra»-pris før det er søkt med datoer og reisende.
 */
export function DestinationRailCard({ destination, onPress, testID }: { destination: Destination; onPress: () => void; testID?: string }) {
  const { t, locale } = useI18n();
  const names = destination.names[locale];
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t.explore.seeFlightsTo(names.city, names.airport)}
      style={({ pressed }) => [styles.railCard, pressed && { opacity: 0.9 }]}
    >
      <PhotoBackdrop photo={destination.photo} scrim="light" style={styles.railPhoto} />
      <View style={styles.railText}>
        {/* Ingen linjegrense: lange navn og stor tekst bryter linjen; kortene i raden blir like høye. */}
        <Text style={[type.section, { color: colors.text }]}>{names.city}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.explore.countryCode(names.country, destination.iata)}</Text>
        <View style={styles.railAction}>
          <Text style={[type.footnoteStrong, { color: colors.blue }]}>{t.explore.seeFlights}</Text>
          <Icon name="chevronRight" size={14} color={colors.blue} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  railCard: { width: 248, borderRadius: radius.card, backgroundColor: colors.white, padding: space.sm, gap: space.sm },
  railPhoto: { height: 132, borderRadius: radius.input },
  railText: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: 2 },
  railAction: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: space.xs },
  card: { width: 136, height: 132, borderRadius: radius.input, overflow: "hidden", backgroundColor: colors.raised, justifyContent: "flex-end" },
  text: { padding: space.md, gap: 1 },
});
