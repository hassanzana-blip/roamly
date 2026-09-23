import { StyleSheet, Text, View } from "react-native";
import type { MobileOfferPrice } from "@contracts/mobileSearch";
import { priceDisplay } from "../lib/price";
import { colors, type } from "../lib/theme";

/**
 * Prisen slik appen alltid viser den: kroner, «ca.»-kroner eller «Ingen pris i
 * kroner». Hovedbeløpet er én tekst med tabellsifre.
 */
export function PriceTag({ price, align = "left", size = "card", dark, testID }: { price: MobileOfferPrice; align?: "left" | "right"; size?: "card" | "large"; dark?: boolean; testID?: string }) {
  const d = priceDisplay(price);
  const fg = dark ? colors.onDark : colors.text;
  const sub = dark ? colors.onDarkMuted : colors.textSecondary;
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start", flexShrink: 1 }} accessible accessibilityLabel={d.accessibilityLabel} testID={testID}>
      <Text style={[size === "large" ? styles.large : type.price, { color: fg }, !d.available && styles.unavailable, !d.available && { color: sub }]}>{d.primary}</Text>
      {d.secondary ? <Text style={[type.caption, { color: sub, textAlign: align }]}>{d.secondary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  large: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  unavailable: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
});
