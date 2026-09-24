import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Pressable, Text } from "./a11y";
import type { OfferSlice } from "@contracts/types";
import type { Journey } from "../lib/journeys";
import { PriceTag } from "./PriceTag";
import { AirlineLogo } from "./AirlineLogo";
import { Icon } from "./Icon";
import { dayOffset, formatTime } from "../lib/format";
import { useI18n } from "../i18n";
import { priceDisplay } from "../lib/price";
import { baggageCard, baggageFacts, baggageShort, priceBasis, type BagFact } from "../lib/offer";
import { cabinLabel } from "../lib/searchForm";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

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

/** Kjent bagasje, kort og dempet. «Ikke oppgitt» er ikke det samme som «ikke inkludert» – det står i ordene. */
export function BaggageSummary({ facts }: { facts: BagFact[] }) {
  const i18n = useI18n();
  return (
    <View style={styles.bags}>
      {facts.map((f) => (
        <View key={f.key} style={styles.bag}>
          <Icon name={f.key === "carryOn" ? "bag" : "luggage"} size={13} color={colors.textSecondary} strokeWidth={1.75} />
          <Text style={[type.caption, { color: f.state === "included" ? colors.text : colors.textSecondary }]}>{baggageCard(f, i18n)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Each leg has a scan-friendly route: local times at the ends, duration and
 * stops in the middle. At large text sizes it returns to a stacked layout. */
function CompactLeg({ slice, label }: { slice: OfferSlice; label?: string }) {
  const { f } = useI18n();
  const { fontScale, width } = useWindowDimensions();
  const plus = dayOffset(slice.departingAt, slice.arrivingAt);
  const stacked = fontScale > 1.35 || width < 360;
  return (
    <View style={styles.leg}>
      {label ? <Text style={styles.legLabel}>{label}</Text> : null}
      {stacked ? (
        <View style={styles.stackedLeg}>
          <Text style={[type.time, { color: colors.text }]}>
            {`${formatTime(slice.departingAt)} – ${formatTime(slice.arrivingAt)}`}
            {plus > 0 ? <Text style={styles.plusDay}>{` +${plus}`}</Text> : null}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{`${slice.origin.iata} → ${slice.destination.iata} · ${f.duration(slice.durationMinutes)} · ${f.stops(slice.stops)}`}</Text>
        </View>
      ) : (
        <View style={styles.routeGrid}>
          <View style={styles.endpoint}>
            <Text style={[type.time, type.tabular, { color: colors.text }]}>{formatTime(slice.departingAt)}</Text>
            <Text style={[type.caption, styles.airportCode]}>{slice.origin.iata}</Text>
          </View>
          <RouteLine top={f.duration(slice.durationMinutes)} bottom={f.stops(slice.stops)} />
          <View style={[styles.endpoint, styles.arrival]}>
            <Text style={[type.time, type.tabular, { color: colors.text }]}>
              {formatTime(slice.arrivingAt)}
              {plus > 0 ? <Text style={styles.plusDay}>{` +${plus}`}</Text> : null}
            </Text>
            <Text style={[type.caption, styles.airportCode]}>{slice.destination.iata}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Reisen som kompakt kort på den mørke resultatlisten, bygget for å
 * sammenligne: selskap og klasse på én linje, hver strekning på to linjer,
 * dempet bagasje og tydelig totalpris. Tur-retur viser både utreise og
 * hjemreise, så prisen aldri står ved bare halve reisen. VoiceOver leser
 * alt (se accessibilityLabel).
 */
export function OfferCard({ journey, onPress, totalConfirmed = true }: { journey: Journey; onPress: () => void; totalConfirmed?: boolean }) {
  const item = journey.best;
  const { offer, price } = item;
  const i18n = useI18n();
  const { t, f } = i18n;
  const d = priceDisplay(price, i18n);
  const facts = baggageFacts(offer, i18n);
  const sellers = journey.sellers.length;
  // Smale skjermer (f.eks. 320 pt): «Detaljer» uten pil og med mindre luft, så prisgrunnlaget får plass på én linje.
  const narrow = useWindowDimensions().width < 360;
  const roundTrip = offer.slices.length > 1;
  const legs = offer.slices
    .map((s) => t.results.card.leg(s.origin.city || s.origin.iata, s.destination.city || s.destination.iata, formatTime(s.departingAt), formatTime(s.arrivingAt), f.spokenDuration(s.durationMinutes), f.stops(s.stops).toLowerCase()))
    .join(". ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.owner.name}. ${legs}. ${facts.map((b) => baggageShort(b, i18n)).join(". ")}. ${d.accessibilityLabel}, ${priceBasis(offer, i18n, totalConfirmed).toLowerCase()}.${sellers > 1 ? t.results.card.providersSpoken(sellers) : ""}`}
      accessibilityHint={t.results.card.detailsHint}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      testID={`offer-${offer.id}`}
    >
      <View style={styles.top}>
        <AirlineLogo carrier={offer.owner} size={24} />
        <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>
          <Text style={[type.calloutStrong, { color: colors.text }]}>{offer.owner.name}</Text>
          {` · ${cabinLabel(offer.cabinClass, i18n)}`}
        </Text>
        {sellers > 1 ? (
          <View style={styles.sellers}>
            <Text style={[type.caption, { color: colors.text, fontWeight: "600" }]}>{t.results.providers(sellers)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.legs}>
        {offer.slices.map((s, i) => (
          <CompactLeg key={s.id || i} slice={s} label={roundTrip ? (i === 0 ? t.results.card.out(f.shortDay(s.departingAt)) : t.results.card.back(f.shortDay(s.departingAt))) : undefined} />
        ))}
      </View>

      <BaggageSummary facts={facts} />

      <View style={[styles.footer, narrow && { gap: space.sm }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <PriceTag price={price} compact testID={`price-${offer.id}`} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>{priceBasis(offer, i18n, totalConfirmed)}</Text>
        </View>
        <View style={[styles.details, narrow && styles.detailsNarrow]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[type.calloutStrong, { color: colors.text }]}>{t.results.card.details}</Text>
          {narrow ? null : <Icon name="arrowRight" size={16} color={colors.text} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.input, paddingHorizontal: space.lg, paddingVertical: 10, gap: space.sm },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sellers: { backgroundColor: colors.inset, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  legs: { gap: space.sm },
  leg: { gap: 2 },
  routeGrid: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  endpoint: { minWidth: 58, gap: 1 },
  arrival: { alignItems: "flex-end" },
  airportCode: { color: colors.textSecondary, fontWeight: "600", letterSpacing: 0.5 },
  stackedLeg: { gap: 1 },
  legLabel: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textSecondary },
  plusDay: { fontSize: 12, fontWeight: "600", color: colors.blue },
  route: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: space.sm },
  track: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 4 },
  line: { flex: 1, height: 1.5, borderRadius: 1 },
  plane: { paddingHorizontal: 2 },
  bags: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: 4 },
  bag: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  details: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white },
  detailsNarrow: { paddingHorizontal: space.sm },
});
