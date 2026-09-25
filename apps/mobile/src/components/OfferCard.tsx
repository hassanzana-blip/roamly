import { memo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Pressable, Text } from "./a11y";
import type { CabinClass, OfferSlice } from "@contracts/types";
import type { Journey } from "../lib/journeys";
import { PriceTag } from "./PriceTag";
import { AirlineLogo } from "./AirlineLogo";
import { Icon } from "./Icon";
import { dayOffset, formatTime } from "../lib/format";
import { useI18n, type I18n } from "../i18n";
import { priceDisplay } from "../lib/price";
import { baggageCard, baggageFacts, baggageShort, priceBasis, priceBasisCard, type BagFact } from "../lib/offer";
import { journeyWarnings } from "../lib/warnings";
import { cabinLabel } from "../lib/searchForm";
import { colors, radius, space, type } from "../lib/theme";

/** Tynn rute: linje med fly i midten. Varighet over, mellomlandinger under. */
export function RouteLine({ top, bottom, dark }: { top?: string; bottom?: string; dark?: boolean }) {
  const line = dark ? "rgba(255, 255, 255, 0.35)" : "rgba(7, 84, 248, 0.28)";
  const fg = dark ? colors.onDarkMuted : colors.textSecondary;
  return (
    <View style={styles.route} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {top ? <Text style={[type.caption, { color: fg }]}>{top}</Text> : null}
      <Track color={line} plane={dark ? colors.onDark : colors.blue} />
      {bottom ? <Text style={[type.caption, { color: fg }]}>{bottom}</Text> : null}
    </View>
  );
}

function Track({ color, plane }: { color: string; plane: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <View style={styles.plane}>
        <Icon name="plane" size={16} color={plane} rotate={45} strokeWidth={1.75} />
      </View>
      <View style={[styles.line, { backgroundColor: color }]} />
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
          <Text style={[type.caption, { color: f.state === "included" ? colors.text : colors.textSecondary, flexShrink: 1 }]}>{baggageCard(f, i18n)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Flyplassene der reisende bytter fly på en strekning (i rekkefølge, uten gjentakelser). */
function stopCodes(slice: OfferSlice): string[] {
  return [...new Set(slice.segments.slice(0, -1).map((g) => g.destination.iata).filter(Boolean))];
}
function stopCities(slice: OfferSlice): string[] {
  return [...new Set(slice.segments.slice(0, -1).map((g) => g.destination.city || g.destination.iata).filter(Boolean))];
}

/** «Direkte» eller «1 mellomlanding · CPH». */
function stopsLine(slice: OfferSlice, { t, f }: Pick<I18n, "t" | "f">): string {
  const codes = stopCodes(slice);
  return slice.stops > 0 && codes.length ? t.results.card.via(f.stops(slice.stops), codes.join(", ")) : f.stops(slice.stops);
}

/**
 * Én strekning på to linjer. Øverst: «UT · fre. 9. okt.» til venstre, reisetid og mellomlandinger (med
 * byttested) til høyre. Under: avgang, rutelinje og ankomst, med flyplasskodene ved klokkeslettene. Med stor
 * tekst eller en smal skjerm står det samme under hverandre, så ingenting kuttes.
 */
function CompactLeg({ slice, label }: { slice: OfferSlice; label?: string }) {
  const i18n = useI18n();
  const { f } = i18n;
  const { fontScale, width } = useWindowDimensions();
  const plus = dayOffset(slice.departingAt, slice.arrivingAt);
  const stacked = fontScale > 1.35 || width < 360;
  const direct = slice.stops === 0;
  const meta = (
    <Text style={[type.caption, styles.meta]}>
      {`${f.duration(slice.durationMinutes)} · `}
      <Text style={direct ? styles.direct : null}>{stopsLine(slice, i18n)}</Text>
    </Text>
  );
  const arrival = (
    <Text style={[type.time, { color: colors.text }]}>
      {formatTime(slice.arrivingAt)}
      {plus > 0 ? <Text style={styles.plusDay}>{` +${plus}`}</Text> : null}
    </Text>
  );
  if (stacked) {
    return (
      <View style={styles.leg}>
        {label ? <Text style={styles.legLabel}>{label}</Text> : null}
        <Text style={[type.time, { color: colors.text }]}>
          {`${formatTime(slice.departingAt)} – ${formatTime(slice.arrivingAt)}`}
          {plus > 0 ? <Text style={styles.plusDay}>{` +${plus}`}</Text> : null}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {`${slice.origin.iata} → ${slice.destination.iata} · ${f.duration(slice.durationMinutes)} · `}
          <Text style={direct ? styles.direct : null}>{stopsLine(slice, i18n)}</Text>
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.leg}>
      <View style={styles.legHead}>
        {label ? <Text style={styles.legLabel}>{label}</Text> : null}
        {meta}
      </View>
      <View style={styles.legRoute}>
        <Text style={[type.time, { color: colors.text }]}>{formatTime(slice.departingAt)}</Text>
        <Text style={styles.code}>{slice.origin.iata}</Text>
        <View style={styles.legTrack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Track color="rgba(7, 84, 248, 0.28)" plane={colors.blue} />
        </View>
        <Text style={styles.code}>{slice.destination.iata}</Text>
        {arrival}
      </View>
    </View>
  );
}

/**
 * Det reisende bør se før de åpner reisen: bytte av flyplass, bytte over natten og lange ventetider (6 t+). Samme
 * bytte nevnes én gang («Bytte over natten i München (8 t 55 min)»), og like linjer for ut- og hjemreise slås sammen.
 */
export function cardRisks(journey: Journey, { t, f }: Pick<I18n, "t" | "f">): string[] {
  const r = t.results.card.risks;
  const slices = journey.best.offer.slices.length;
  // Tekst → strekningene den gjelder, i den rekkefølgen de ble funnet.
  const found = new Map<string, Set<number>>();
  const add = (text: string, slice: number) => found.set(text, (found.get(text) ?? new Set()).add(slice));
  const layovers = new Map<string, { slice: number; city: string; overnight: boolean; minutes: number | null }>();
  for (const w of journeyWarnings(journey.best.offer)) {
    if (w.kind === "airportChange") add(r.airportChange(w.city), w.slice);
    else if (w.kind === "overnightLayover" || w.kind === "longLayover") {
      const key = `${w.slice}|${w.city}`;
      const cur = layovers.get(key) ?? { slice: w.slice, city: w.city, overnight: false, minutes: null };
      if (w.kind === "overnightLayover") cur.overnight = true;
      else cur.minutes = w.minutes;
      layovers.set(key, cur);
    }
  }
  for (const l of layovers.values()) {
    add(l.overnight ? (l.minutes ? r.overnightLayoverFor(l.city, f.duration(l.minutes)) : r.overnightLayover(l.city)) : r.longLayover(l.city, f.duration(l.minutes ?? 0)), l.slice);
  }
  // Tur-retur: si hvilken vei (eller begge). Én vei: bare teksten.
  return [...found].map(([text, on]) => (slices !== 2 ? text : on.size === 2 ? r.bothWays(text) : on.has(0) ? r.outbound(text) : r.inbound(text)));
}

/** Selskapene som flyr reisen (markedsførende, i rekkefølge): «Norwegian», «SAS · Lufthansa», «SAS · KLM +1». */
function airlineNames(journey: Journey): string {
  const names = [...new Set(journey.best.offer.slices.flatMap((s) => s.segments.map((g) => g.carrier.name || g.carrier.iata)).filter(Boolean))];
  if (!names.length) return journey.best.offer.owner.name;
  return names.length > 2 ? `${names.slice(0, 2).join(" · ")} +${names.length - 2}` : names.join(" · ");
}

/**
 * Reisen som kompakt kort på den mørke resultatlisten, bygget for å sammenligne raskt: selskap øverst, hver
 * strekning på to linjer (med byttested), det som bør vekke oppmerksomhet (bytte over natten, flyplassbytte, lang
 * ventetid) med ord og ikon, og bagasjen ved siden av en tydelig totalpris. Hele kortet er knappen. Tur-retur viser
 * både utreise og hjemreise, så prisen aldri står ved bare halve reisen. Reiseklassen står bare når den er en annen
 * enn den kunden søkte. VoiceOver leser alt (se accessibilityLabel).
 */
export const OfferCard = memo(function OfferCard({ journey, onOpen, totalConfirmed = true, searchedCabin }: { journey: Journey; onOpen: (offerId: string) => void; totalConfirmed?: boolean; searchedCabin?: CabinClass }) {
  const item = journey.best;
  const { offer, price } = item;
  const i18n = useI18n();
  const { t, f } = i18n;
  const d = priceDisplay(price, i18n);
  const facts = baggageFacts(offer, i18n);
  const sellers = journey.sellers.length;
  const roundTrip = offer.slices.length > 1;
  const risks = cardRisks(journey, i18n);
  const cabinDiffers = searchedCabin && offer.cabinClass !== searchedCabin ? cabinLabel(offer.cabinClass, i18n) : null;
  const names = airlineNames(journey);
  const basis = priceBasis(offer, i18n, totalConfirmed);
  const legs = offer.slices
    .map((s) => {
      const cities = stopCities(s);
      const stops = s.stops > 0 && cities.length ? t.results.card.viaSpoken(f.stops(s.stops).toLowerCase(), cities.join(", ")) : f.stops(s.stops).toLowerCase();
      return t.results.card.leg(s.origin.city || s.origin.iata, s.destination.city || s.destination.iata, formatTime(s.departingAt), formatTime(s.arrivingAt), f.spokenDuration(s.durationMinutes), stops);
    })
    .join(". ");
  const spoken = [
    [names, cabinDiffers].filter(Boolean).join(", "),
    legs,
    ...risks,
    facts.map((b) => baggageShort(b, i18n)).join(". "),
    `${d.accessibilityLabel}, ${basis.toLowerCase()}`,
  ].join(". ");
  return (
    <Pressable
      onPress={() => onOpen(offer.id)}
      accessibilityRole="button"
      accessibilityLabel={`${spoken}.${sellers > 1 ? t.results.card.providersSpoken(sellers) : ""}`}
      accessibilityHint={t.results.card.detailsHint}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`offer-${offer.id}`}
    >
      <View style={styles.top}>
        <AirlineLogo carrier={offer.owner} size={22} />
        {/* Ingen linjegrense: et langt selskapsnavn brytes i stedet for å kuttes. */}
        <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>
          <Text style={[type.footnoteStrong, { color: colors.text }]}>{names}</Text>
          {cabinDiffers ? ` · ${cabinDiffers}` : ""}
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

      {risks.length ? (
        <View style={styles.risks} testID={`risks-${offer.id}`}>
          {risks.map((r) => (
            <View key={r} style={styles.risk}>
              <Icon name="alert" size={13} color={colors.warning} />
              <Text style={[type.caption, { color: colors.warning, fontWeight: "600", flexShrink: 1 }]}>{r}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerBags}>
          <BaggageSummary facts={facts} />
        </View>
        <View style={styles.footerPrice}>
          <PriceTag price={price} compact align="right" testID={`price-${offer.id}`} />
          <Text style={[type.caption, { color: colors.textSecondary, textAlign: "right" }]} testID={`basis-${offer.id}`}>
            {priceBasisCard(offer, i18n, totalConfirmed)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.input, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, gap: 10 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sellers: { backgroundColor: colors.inset, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  legs: { gap: 10 },
  leg: { gap: 2 },
  legHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: space.sm },
  legLabel: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textSecondary },
  meta: { color: colors.textSecondary, flexShrink: 1, textAlign: "right", marginLeft: "auto" },
  direct: { color: colors.success, fontWeight: "600" },
  legRoute: { flexDirection: "row", alignItems: "center", gap: 6 },
  legTrack: { flex: 1, paddingHorizontal: 2 },
  code: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.5, color: colors.textSecondary },
  plusDay: { fontSize: 12, fontWeight: "600", color: colors.blue },
  route: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: space.sm },
  track: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 4 },
  line: { flex: 1, height: 1.5, borderRadius: 1 },
  plane: { paddingHorizontal: 2 },
  risks: { gap: 2 },
  risk: { flexDirection: "row", alignItems: "center", gap: 5 },
  bags: { gap: 3 },
  bag: { flexDirection: "row", alignItems: "center", gap: 5 },
  footer: { flexDirection: "row", alignItems: "flex-end", gap: space.md, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  footerBags: { flex: 1, paddingBottom: 1 },
  footerPrice: { alignItems: "flex-end", flexShrink: 1, maxWidth: "58%" },
});
