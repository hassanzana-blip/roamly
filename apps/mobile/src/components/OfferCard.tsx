import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileOffer } from "@contracts/mobileSearch";
import type { OfferSlice } from "@contracts/types";
import { PriceTag } from "./PriceTag";
import { Icon } from "./Icon";
import { CarrierBadge, Pill, RouteLine, TicketDivider } from "./ui";
import { formatDuration, formatStops, formatTime } from "../lib/format";
import { priceDisplay } from "../lib/price";
import { sellerName } from "../lib/offer";
import { cabinLabel } from "../lib/searchForm";
import { colors, fonts, radius, shadow, space } from "../lib/theme";

/** Én strekning som på en billett: avgang og kode til venstre, rute i midten, ankomst til høyre. */
function SliceRow({ slice, label }: { slice: OfferSlice; label: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={styles.sliceLabel}>{label}</Text> : null}
      <View style={styles.sliceRow}>
        <View style={styles.end}>
          <Text style={styles.code}>{slice.origin.iata}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {slice.origin.city}
          </Text>
          <Text style={styles.time}>{formatTime(slice.departingAt)}</Text>
        </View>
        <RouteLine top={formatDuration(slice.durationMinutes)} bottom={formatStops(slice.stops)} />
        <View style={[styles.end, { alignItems: "flex-end" }]}>
          <Text style={styles.code}>{slice.destination.iata}</Text>
          <Text style={[styles.city, { textAlign: "right" }]} numberOfLines={1}>
            {slice.destination.city}
          </Text>
          <Text style={styles.time}>{formatTime(slice.arrivingAt)}</Text>
        </View>
      </View>
    </View>
  );
}

/** Tilbudet som et billettkort på den mørke resultatlisten. */
export function OfferCard({ item, onPress }: { item: MobileOffer; onPress: () => void }) {
  const { offer, price } = item;
  const name = sellerName(offer);
  const seller = name ? `Selges av ${name}` : null;
  const d = priceDisplay(price);
  const legs = offer.slices.map((s) => `${s.origin.iata} til ${s.destination.iata} ${formatTime(s.departingAt)}–${formatTime(s.arrivingAt)}, ${formatStops(s.stops).toLowerCase()}`).join("; ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.owner.name}. ${d.accessibilityLabel}. ${legs}.${seller ? ` ${seller}.` : ""}`}
      accessibilityHint="Viser detaljer om tilbudet"
      style={({ pressed }) => [styles.card, shadow.card, pressed && { transform: [{ scale: 0.985 }] }]}
      testID={`offer-${offer.id}`}
    >
      <View style={styles.top}>
        <CarrierBadge code={offer.owner.iata || offer.owner.name} />
        <Text style={styles.carrier} numberOfLines={2}>
          {offer.owner.name}
        </Text>
        <Pill tone="neutral">{cabinLabel(offer.cabinClass)}</Pill>
      </View>
      {offer.slices.map((s, i) => (
        <SliceRow key={s.id || i} slice={s} label={offer.slices.length > 1 ? (i === 0 ? "Ut" : "Hjem") : null} />
      ))}
      <TicketDivider />
      <View style={styles.footer}>
        <View style={styles.sellerRow}>
          {seller ? (
            <>
              <Icon name="info" size={16} color={colors.textSecondary} />
              <Text style={styles.seller} numberOfLines={2}>
                {seller}
              </Text>
            </>
          ) : (
            <Text style={styles.seller}>Se detaljer</Text>
          )}
          <Icon name="chevronRight" size={16} color={colors.textMuted} />
        </View>
        <PriceTag price={price} testID={`price-${offer.id}`} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.md, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  carrier: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sliceLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textMuted },
  sliceRow: { flexDirection: "row", alignItems: "center" },
  end: { width: 88 },
  code: { fontFamily: fonts.heavy, fontSize: 24, lineHeight: 28, letterSpacing: -0.3, color: colors.text },
  city: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  time: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md },
  sellerRow: { flex: 1, minWidth: 120, flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 2 },
  seller: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
