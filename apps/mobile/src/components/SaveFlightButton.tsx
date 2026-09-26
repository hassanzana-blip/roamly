import { AccessibilityInfo, StyleSheet } from "react-native";
import type { MobileOffer } from "@contracts/mobileSearch";
import { Pressable } from "./a11y";
import { Icon } from "./Icon";
import { useApp } from "../lib/appState";
import { flightFromOffer } from "../lib/savedTrips";
import { itinerarySignature } from "../lib/journeys";
import type { SearchForm } from "../lib/searchForm";
import { useI18n } from "../i18n";
import { colors, TOUCH } from "../lib/theme";

/**
 * Lagre / fjerne reisen i detaljene (Lagret → Lagrede fly). Et bilde av reisen og prisen kunden ser nå, med datoen
 * – aldri en holdt pris. Samme reise (samme flyvninger og tider) lagres bare én gang. 40 pt rund knapp med
 * trykkflate på 44 pt, som de andre knappene i tittellinjen; fylt bokmerke = lagret.
 */
export function SaveFlightButton({ item, query }: { item: MobileOffer; query: SearchForm | null }) {
  const { savedFlights, toggleFlight } = useApp();
  const { t } = useI18n();
  const s = t.saved;
  const key = itinerarySignature(item.offer);
  const on = savedFlights.some((f) => f.key === key);
  if (!query || !query.origin || !query.destination) return null;
  return (
    <Pressable
      onPress={() => {
        toggleFlight(flightFromOffer(item, query));
        AccessibilityInfo.announceForAccessibility(on ? s.flightRemovedNotice : s.flightSavedNotice);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? s.unsaveFlight : s.saveFlight}
      hitSlop={(TOUCH - 40) / 2 + 2}
      testID="save-flight"
      style={({ pressed }) => [styles.button, on && styles.on, pressed && { opacity: 0.7 }]}
    >
      <Icon name="bookmark" size={20} color={on ? colors.blue : colors.text} fill={on ? colors.blue : "none"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  on: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
});
