import { StyleSheet } from "react-native";
import { Pressable } from "./a11y";
import type { Destination } from "../lib/destinations";
import { useApp } from "../lib/appState";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { colors, TOUCH } from "../lib/theme";

/**
 * Lagre / fjerne et reisemål på denne telefonen (Lagret-fanen). 44 pt rund
 * knapp; fylt bokmerke = lagret. «glass» over foto, «light» på hvitt kort.
 */
export function SaveButton({ destination, variant = "glass", testID }: { destination: Destination; variant?: "glass" | "light"; testID?: string }) {
  const { saved, toggleSaved } = useApp();
  const { t, locale } = useI18n();
  const on = saved.some((s) => s.id === destination.id);
  const city = destination.names[locale].city;
  const fg = variant === "glass" ? colors.white : colors.text;
  return (
    <Pressable
      onPress={() => toggleSaved(destination)}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? t.explore.unsaveLabel(city, destination.iata) : t.explore.saveLabel(city, destination.iata)}
      testID={testID ?? `save-${destination.id}`}
      style={({ pressed }) => [styles.button, variant === "glass" ? styles.glass : styles.light, on && variant === "light" && styles.lightOn, pressed && { opacity: 0.7 }]}
    >
      <Icon name="bookmark" size={20} color={on && variant === "light" ? colors.blue : fg} fill={on ? (variant === "light" ? colors.blue : colors.white) : "none"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
  glass: { backgroundColor: colors.scrim },
  light: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  lightOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
});
