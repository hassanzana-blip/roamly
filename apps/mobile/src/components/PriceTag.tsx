import { StyleSheet, Text, View } from "react-native";
import type { MobileOfferPrice } from "@contracts/mobileSearch";
import { priceDisplay } from "../lib/price";
import { colors, fonts } from "../lib/theme";

/** Prisen slik appen alltid viser den: kroner, «ca.»-kroner eller «Ingen pris i kroner». */
export function PriceTag({ price, align = "right", large, testID }: { price: MobileOfferPrice; align?: "left" | "right"; large?: boolean; testID?: string }) {
  const d = priceDisplay(price);
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start", gap: 2, flexShrink: 1 }} accessible accessibilityLabel={d.accessibilityLabel} testID={testID}>
      <Text style={[styles.primary, large && styles.large, !d.available && styles.unavailable]}>{d.primary}</Text>
      {d.secondary ? <Text style={[styles.secondary, { textAlign: align }]}>{d.secondary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: { fontFamily: fonts.heavy, fontSize: 20, letterSpacing: -0.3, color: colors.indigoInk },
  large: { fontSize: 32, lineHeight: 38, color: colors.text },
  unavailable: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  secondary: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textSecondary, maxWidth: 180 },
});
