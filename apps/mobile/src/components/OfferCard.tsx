import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileOffer } from "@contracts/mobileSearch";
import type { OfferSlice } from "@contracts/types";
import { PriceTag } from "./PriceTag";
import { formatDuration, formatStops, formatTime } from "../lib/format";
import { priceDisplay } from "../lib/price";
import { colors, fonts, radius, space } from "../lib/theme";

function SliceLine({ slice, label }: { slice: OfferSlice; label: string }) {
  return (
    <View style={styles.slice}>
      <Text style={styles.sliceLabel}>{label}</Text>
      <Text style={styles.times}>
        {formatTime(slice.departingAt)} – {formatTime(slice.arrivingAt)}
      </Text>
      <Text style={styles.meta}>
        {slice.origin.iata} → {slice.destination.iata} · {formatDuration(slice.durationMinutes)} · {formatStops(slice.stops)}
      </Text>
    </View>
  );
}

export function OfferCard({ item, onPress }: { item: MobileOffer; onPress: () => void }) {
  const { offer, price } = item;
  const seller = offer.booking?.kind === "external" ? `Selges av ${offer.booking.provider.name}` : "Kan ikke bestilles i appen ennå";
  const d = priceDisplay(price);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.owner.name}. ${d.accessibilityLabel}. ${seller}`}
      accessibilityHint="Viser detaljer om tilbudet"
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.sand }]}
      testID={`offer-${offer.id}`}
    >
      <View style={styles.top}>
        <Text style={styles.carrier} numberOfLines={1}>
          {offer.owner.name}
        </Text>
        <PriceTag price={price} testID={`price-${offer.id}`} />
      </View>
      {offer.slices.map((s, i) => (
        <SliceLine key={s.id || i} slice={s} label={offer.slices.length > 1 ? (i === 0 ? "Ut" : "Hjem") : "Reise"} />
      ))}
      <Text style={styles.seller}>{seller}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.md },
  carrier: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.petrol, paddingTop: 2 },
  slice: { gap: 1 },
  sliceLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textMuted },
  times: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  seller: { fontFamily: fonts.medium, fontSize: 13, color: colors.azureInk },
});
