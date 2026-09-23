import { StyleSheet, Text, View } from "react-native";
import type { MobileOfferPrice } from "@contracts/mobileSearch";
import { priceDisplay } from "../lib/price";
import { useI18n } from "../i18n";
import { colors, type } from "../lib/theme";

/**
 * Prisen slik appen alltid viser den: kroner, «ca.»-kroner eller «Ingen pris i
 * kroner». Hovedbeløpet er én tekst med tabellsifre.
 *
 * `compact` (resultatkortene): «ca.» står lite foran beløpet på samme linje,
 * og kilden står kort under («Norges Banks kurs 22.09.2026»). Mangler
 * kroneprisen, står grunnen alltid.
 */
export function PriceTag({ price, align = "left", size = "card", dark, compact, testID }: { price: MobileOfferPrice; align?: "left" | "right"; size?: "card" | "large"; dark?: boolean; compact?: boolean; testID?: string }) {
  const i18n = useI18n();
  const d = priceDisplay(price, i18n);
  const fg = dark ? colors.onDark : colors.text;
  const sub = dark ? colors.onDarkMuted : colors.textSecondary;
  const secondary = compact ? d.secondaryShort : d.secondary;
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start", flexShrink: 1 }} accessible accessibilityLabel={d.accessibilityLabel} testID={testID}>
      {compact && d.approx && d.amount ? (
        <Text style={[type.price, { color: fg }]}>
          <Text style={[styles.approx, { color: sub }]}>{`${i18n.t.price.approxLabel} `}</Text>
          {d.amount}
        </Text>
      ) : (
        <Text style={[size === "large" ? styles.large : type.price, { color: fg }, !d.available && styles.unavailable, !d.available && { color: sub }]}>{d.primary}</Text>
      )}
      {secondary ? <Text style={[type.caption, { color: sub, textAlign: align }]}>{secondary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  large: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  unavailable: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  approx: { fontSize: 14, fontWeight: "600", letterSpacing: 0 },
});
