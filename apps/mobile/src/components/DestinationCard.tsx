import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Destination } from "../lib/destinations";
import { BottomFade, PhotoBackdrop } from "./Photo";
import { colors, radius, space, type } from "../lib/theme";

/**
 * Reisemål med foto. Ingen «fra»-pris: vi har ingen verifisert pris uten
 * datoer og reisende, så kortet lover bare det det gjør – å søke.
 */
export function DestinationCard({ destination, onPress, style, testID }: { destination: Destination; onPress: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Se flyreiser til ${destination.city}, ${destination.airportName}`}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}
    >
      <PhotoBackdrop photo={destination.photo} scrim="light" credit={false} style={StyleSheet.absoluteFill}>
        <BottomFade />
      </PhotoBackdrop>
      <View style={styles.text}>
        <Text style={[type.calloutStrong, { color: colors.onDark }]} numberOfLines={1}>
          {destination.city}
        </Text>
        <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>
          Se flyreiser
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 136, height: 132, borderRadius: radius.input, overflow: "hidden", backgroundColor: colors.raised, justifyContent: "flex-end" },
  text: { padding: space.md, gap: 1 },
});
