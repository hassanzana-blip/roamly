import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Pressable, Text } from "./a11y";
import { Icon } from "./Icon";
import type { HotelImage, HotelSummary } from "@contracts/hotels";
import { cheapestRate, ratePerNightNok, rateTotalNok } from "../lib/hotels";
import { useI18n } from "../i18n";
import { colors, radius, space, type } from "../lib/theme";

/** Hotellets eget bilde (bare https fra leverandøren). Mangler det eller lastes ikke: en rolig flate som sier hvilket av delene, aldri et lånt bilde. */
export function HotelPhoto({ image, height, testID }: { image: HotelImage | undefined; height: number; testID?: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const uri = image?.large ?? image?.small;
  if (!uri || failed) {
    return (
      <View style={[styles.noPhoto, { height }]} testID={testID ? `${testID}-none` : undefined}>
        <Icon name="bed" size={22} color={colors.textSecondary} />
        <Text style={[type.caption, { color: colors.textSecondary }]}>{uri ? t.hotels.photoFailed : t.hotels.noPhoto}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ height, width: "100%" }} contentFit="cover" onError={() => setFailed(true)} accessible={false} testID={testID} />;
}

/** Stjerner og (når oppgitt) avstand – én dempet linje. */
export function hotelFacts(hotel: Pick<HotelSummary, "starRating" | "selfRated" | "distanceKm">, i18n: ReturnType<typeof useI18n>): string {
  const h = i18n.t.hotels;
  const parts: string[] = [];
  const stars = Math.round(hotel.starRating);
  if (stars >= 1 && stars <= 5) parts.push(hotel.selfRated ? `${h.stars(stars)} (${h.selfRated})` : h.stars(stars));
  if (typeof hotel.distanceKm === "number" && Number.isFinite(hotel.distanceKm)) parts.push(h.distance(i18n.f.decimal1(hotel.distanceKm)));
  return parts.join(" · ");
}

/**
 * Ett hotell i resultatlisten: bilde, navn, stjerner, gjestevurdering og
 * laveste totalpris for hele oppholdet – slik leverandøren oppga den, i NOK.
 * Ingen pris hvis ingen leverandør har en, og ingen omregning fra annen valuta.
 */
export function HotelCard({ hotel, onPress, testID }: { hotel: HotelSummary; onPress: () => void; testID?: string }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const h = t.hotels;
  const best = cheapestRate(hotel);
  const totalMinor = best ? rateTotalNok(best) : null;
  const nightMinor = best ? ratePerNightNok(best) : null;
  const nights = h.nights(hotel.nights);
  const facts = hotelFacts(hotel, i18n);
  const rating = typeof hotel.guestRating === "number" && hotel.guestRating > 0 ? { score: f.decimal1(hotel.guestRating), reviews: h.reviews(hotel.numberOfReviews, f.int(hotel.numberOfReviews)) } : null;
  const priceText = best ? (totalMinor !== null ? `${h.from} ${f.nok(totalMinor)}` : h.otherCurrency(best.currency)) : h.noPrice;
  const label = [hotel.name, facts, rating ? h.ratingLabel(rating.score, rating.reviews) : null, best && totalMinor !== null ? `${h.from} ${f.spokenNok(totalMinor)}, ${h.totalFor(nights)}` : priceText].filter(Boolean).join(". ");

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={h.openHotelHint} testID={testID} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <HotelPhoto image={hotel.images[0]} height={148} testID={testID ? `${testID}-photo` : undefined} />
      <View style={styles.body}>
        <Text style={[type.headline, { color: colors.text }]}>{hotel.name}</Text>
        {facts ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{facts}</Text> : null}
        {rating ? (
          <View style={styles.ratingRow}>
            <View style={styles.score}>
              <Text style={[type.footnoteStrong, type.tabular, { color: colors.white }]}>{rating.score}</Text>
            </View>
            <Text style={[type.footnote, { color: colors.text }]}>{rating.reviews}</Text>
          </View>
        ) : null}
        <View style={styles.priceBlock}>
          {best && totalMinor !== null ? (
            <>
              <Text style={[type.price, { color: colors.text }]} testID={testID ? `${testID}-price` : undefined}>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{`${h.from} `}</Text>
                {f.nok(totalMinor)}
              </Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.totalFor(nights)}</Text>
              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {[nightMinor !== null ? h.perNight(f.nok(nightMinor)) : null, h.quotedBy(best.provider.name)].filter(Boolean).join(" · ")}
              </Text>
            </>
          ) : (
            <Text style={[type.footnote, { color: colors.textSecondary }]} testID={testID ? `${testID}-noprice` : undefined}>
              {priceText}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.card, overflow: "hidden" },
  body: { padding: space.lg, gap: space.xs },
  noPhoto: { width: "100%", alignItems: "center", justifyContent: "center", gap: space.xs, backgroundColor: colors.inset },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xxs },
  score: { minWidth: 36, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.blue, alignItems: "center" },
  priceBlock: { marginTop: space.sm, gap: 2 },
});
