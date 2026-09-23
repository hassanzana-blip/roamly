import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OfferSlice } from "@contracts/types";
import type { Journey } from "../lib/journeys";
import { PriceTag } from "./PriceTag";
import { AirlineLogo } from "./AirlineLogo";
import { Icon } from "./Icon";
import { dayOffset, formatTime } from "../lib/format";
import { useI18n } from "../i18n";
import { priceDisplay } from "../lib/price";
import { baggageFacts, baggageShort, priceBasis, type BagFact } from "../lib/offer";
import { cabinLabel } from "../lib/searchForm";
import { colors, radius, space, type } from "../lib/theme";

/** Tynn rute: linje med fly i midten. Varighet over, mellomlandinger under. */
export function RouteLine({ top, bottom, dark }: { top?: string; bottom?: string; dark?: boolean }) {
  const line = dark ? "rgba(255, 255, 255, 0.35)" : "rgba(7, 84, 248, 0.28)";
  const fg = dark ? colors.onDarkMuted : colors.textSecondary;
  return (
    <View style={styles.route} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {top ? <Text style={[type.caption, { color: fg }]}>{top}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.line, { backgroundColor: line }]} />
        <View style={styles.plane}>
          <Icon name="plane" size={16} color={dark ? colors.onDark : colors.blue} rotate={45} strokeWidth={1.75} />
        </View>
        <View style={[styles.line, { backgroundColor: line }]} />
      </View>
      {bottom ? <Text style={[type.caption, { color: fg }]}>{bottom}</Text> : null}
    </View>
  );
}

/** Klokkeslett med «+1» når ankomsten er et senere døgn (lokal tid). */
export function TimeText({ at, from, style }: { at: string; from?: string; style?: object }) {
  const plus = from ? dayOffset(from, at) : 0;
  return (
    <Text style={[type.time, { color: colors.text }, style]}>
      {formatTime(at)}
      {plus > 0 ? <Text style={styles.plusDay}>{` +${plus}`}</Text> : null}
    </Text>
  );
}

/** Én strekning: kode og tid i hver ende, rute i midten. */
export function FlightLegRow({ slice, label }: { slice: OfferSlice; label?: string }) {
  const { f } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.legLabel}>{label}</Text> : null}
      <View style={styles.leg}>
        <View style={styles.end}>
          <Text style={[type.codeSmall, { color: colors.text }]}>{slice.origin.iata}</Text>
          <TimeText at={slice.departingAt} />
        </View>
        <RouteLine top={f.duration(slice.durationMinutes)} bottom={f.stops(slice.stops)} />
        <View style={[styles.end, { alignItems: "flex-end" }]}>
          <Text style={[type.codeSmall, { color: colors.text }]}>{slice.destination.iata}</Text>
          <TimeText at={slice.arrivingAt} from={slice.departingAt} />
        </View>
      </View>
    </View>
  );
}

/** Kjent bagasje, kort. «Ikke oppgitt» er ikke det samme som «ikke inkludert». */
export function BaggageSummary({ facts }: { facts: BagFact[] }) {
  const i18n = useI18n();
  return (
    <View style={styles.bags}>
      {facts.map((f) => (
        <View key={f.key} style={styles.bag}>
          <Icon name={f.key === "carryOn" ? "bag" : "luggage"} size={14} color={f.state === "included" ? colors.text : colors.textSecondary} strokeWidth={1.75} />
          <Text style={[type.caption, { color: f.state === "included" ? colors.text : colors.textSecondary }]}>{baggageShort(f, i18n)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Reisen som hvitt kort på den mørke resultatlisten. Tur-retur viser både
 * utreise og hjemreise, så prisen aldri står ved bare halve reisen.
 */
export function OfferCard({ journey, onPress }: { journey: Journey; onPress: () => void }) {
  const item = journey.best;
  const { offer, price } = item;
  const i18n = useI18n();
  const { t, f } = i18n;
  const d = priceDisplay(price, i18n);
  const facts = baggageFacts(offer, i18n);
  const sellers = journey.sellers.length;
  const roundTrip = offer.slices.length > 1;
  const legs = offer.slices
    .map((s) => t.results.card.leg(s.origin.city || s.origin.iata, s.destination.city || s.destination.iata, formatTime(s.departingAt), formatTime(s.arrivingAt), f.spokenDuration(s.durationMinutes), f.stops(s.stops).toLowerCase()))
    .join(". ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.owner.name}. ${legs}. ${d.accessibilityLabel}, ${priceBasis(offer, i18n).toLowerCase()}.${sellers > 1 ? t.results.card.providersSpoken(sellers) : ""}`}
      accessibilityHint={t.results.card.detailsHint}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      testID={`offer-${offer.id}`}
    >
      <View style={styles.top}>
        <AirlineLogo carrier={offer.owner} />
        <View style={{ flex: 1 }}>
          <Text style={[type.calloutStrong, { color: colors.text }]} numberOfLines={1}>
            {offer.owner.name}
          </Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
            {`${f.stopsSummary(offer.slices)} · ${cabinLabel(offer.cabinClass, i18n)}`}
          </Text>
        </View>
        {sellers > 1 ? (
          <View style={styles.sellers}>
            <Text style={[type.caption, { color: colors.text, fontWeight: "600" }]}>{t.results.providers(sellers)}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: space.md }}>
        {offer.slices.map((s, i) => (
          <FlightLegRow key={s.id || i} slice={s} label={roundTrip ? (i === 0 ? t.results.card.out(f.shortDay(s.departingAt)) : t.results.card.back(f.shortDay(s.departingAt))) : undefined} />
        ))}
      </View>

      <BaggageSummary facts={facts} />

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={{ flex: 1, gap: 2 }}>
          <PriceTag price={price} testID={`price-${offer.id}`} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>{priceBasis(offer, i18n)}</Text>
        </View>
        <View style={styles.details} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[type.calloutStrong, { color: colors.text }]}>{t.results.card.details}</Text>
          <Icon name="arrowRight" size={16} color={colors.text} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.lg },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  sellers: { backgroundColor: colors.inset, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  legLabel: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textSecondary },
  leg: { flexDirection: "row", alignItems: "center" },
  end: { width: 72, gap: 2 },
  plusDay: { fontSize: 12, fontWeight: "600", color: colors.blue },
  route: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: space.sm },
  track: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 4 },
  line: { flex: 1, height: 1.5, borderRadius: 1 },
  plane: { paddingHorizontal: 2 },
  bags: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: 6 },
  bag: { flexDirection: "row", alignItems: "center", gap: 6 },
  divider: { height: 1, backgroundColor: colors.lightBorder },
  footer: { flexDirection: "row", alignItems: "center", gap: space.md },
  details: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white },
});
