import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/a11y";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HotelDetailResult, HotelRateOffer } from "@contracts/hotels";
import { useApp } from "../../lib/appState";
import { useHotelsStatus } from "../../lib/useHotelsStatus";
import { handoffBlock, hotelInquiryUrl, ratePerNightNok, ratesByTotal, rateTotalNok, splitRooms, stayFromParams, stayParams, type HandoffBlock } from "../../lib/hotels";
import { stayLine } from "../../lib/hotelResults";
import { errorText } from "../../lib/errorText";
import { useI18n } from "../../i18n";
import { Banner, IconButton, InformationCard, LinkButton, PrimaryButton, SecondaryButton, StateView } from "../../components/ui";
import { HotelPhoto, hotelFacts } from "../../components/HotelCard";
import { Icon } from "../../components/Icon";
import { colors, radius, space, type } from "../../lib/theme";

type DetailState = { kind: "loading" } | { kind: "done"; result: HotelDetailResult } | { kind: "error"; error: unknown };

const HOTEL_KEY = /^khotel:\d{1,12}$/;
/** KAYAKs inklusjonskoder for frokost (samme som nettets filter). */
const BREAKFAST = new Set([0, 3, 4]);

function openUrl(url: string) {
  void WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined);
}

/** Én leverandørs rom: navn, totalpris for oppholdet, vilkår og – bare når det er tillatt – videre til leverandøren. */
function RateRow({ rate, nights, block, testID }: { rate: HotelRateOffer; nights: number; block: HandoffBlock; testID: string }) {
  const { t, f } = useI18n();
  const h = t.hotels;
  const total = rateTotalNok(rate);
  const perNight = ratePerNightNok(rate);
  const tags = [rate.freeCancellation ? h.freeCancellation : null, rate.payLater ? h.payLater : null, rate.inclusions.some((i) => BREAKFAST.has(i)) ? h.breakfast : null].filter((x): x is string => Boolean(x));
  const blockedText = block === "sandbox" ? h.blockedSandbox : block === "disabled" ? h.blockedDisabled : block === "invalid_link" ? h.blockedLink : block === "unverified" ? h.blockedUnverified : null;
  return (
    <View style={styles.rate} testID={testID}>
      <View style={styles.rateHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.calloutStrong, { color: colors.text }]}>{rate.provider.name}</Text>
          {rate.roomName ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{rate.roomName}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          {total !== null ? (
            <Text style={[type.headline, type.tabular, { color: colors.text }]} testID={`${testID}-price`}>
              {f.nok(total)}
            </Text>
          ) : (
            <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "right" }]}>{h.otherCurrency(rate.currency)}</Text>
          )}
          {total !== null ? <Text style={[type.caption, { color: colors.textSecondary }]}>{h.totalFor(h.nights(nights))}</Text> : null}
          {perNight !== null ? <Text style={[type.caption, { color: colors.textSecondary }]}>{h.perNight(f.nok(perNight))}</Text> : null}
        </View>
      </View>
      {tags.length || rate.availableRooms > 0 ? (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Icon name="check" size={13} color={colors.success} />
              <Text style={[type.caption, { color: colors.success }]}>{tag}</Text>
            </View>
          ))}
          {rate.availableRooms > 0 && rate.availableRooms <= 5 ? <Text style={[type.caption, { color: colors.warning }]}>{h.roomsLeft(rate.availableRooms)}</Text> : null}
        </View>
      ) : null}
      {blockedText ? (
        <View style={styles.blocked} testID={`${testID}-blocked`}>
          <Icon name="lock" size={15} color={colors.textSecondary} />
          <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{blockedText}</Text>
        </View>
      ) : (
        <PrimaryButton label={h.goTo(rate.provider.name)} icon="external" accessibilityHint={h.goToHint} onPress={() => openUrl(rate.bookUrl)} testID={`${testID}-go`} />
      )}
    </View>
  );
}

/**
 * Ett hotell: leverandørens bilder, fakta og beskrivelse, og rom og priser
 * fra hver leverandør. «Gå til …» finnes bare når serveren sier at hotellsøk
 * er på i produksjon og svaret ikke er testdata; ellers står det hvorfor ikke.
 *
 * «Cloud + Graphite»: lys grunn med tittellinjen øverst; bildet og fakta i ett hvitt kort (som hotellkortet i listen),
 * lyse meldinger og hvite seksjoner. Ingen grafittlinje nederst: hvert rom har sin egen handling hos sin leverandør,
 * og det finnes ingen ene pris å samle der.
 */
export default function HotelDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { api, sessionId } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const h = t.hotels;
  const stay = useMemo(() => stayFromParams(params as Record<string, string>), [params]);
  const hotelKey = typeof params.hotell === "string" && HOTEL_KEY.test(params.hotell) ? params.hotell : null;
  const { state: status, retry: retryStatus } = useHotelsStatus();
  // Svaret lagres med søket det gjelder; til svaret for akkurat dette søket er kommet, vises lasting.
  const [answer, setAnswer] = useState<{ key: string; state: DetailState } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const stayKey = stay ? JSON.stringify(stayParams(stay)) : "";
  const requestKey = `${stayKey}#${hotelKey}#${attempt}`;
  const state: DetailState = answer?.key === requestKey ? answer.state : { kind: "loading" };
  useEffect(() => {
    if (!stay || !hotelKey) return;
    const abort = new AbortController();
    api
      .hotelDetail({ hotelKey, checkin: stay.checkin, checkout: stay.checkout, rooms: splitRooms(stay.adults, stay.childAges, stay.rooms), language: locale, sessionId }, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) setAnswer({ key: requestKey, state: { kind: "done", result } });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setAnswer({ key: requestKey, state: { kind: "error", error: error ?? new Error("hotels.detail") } });
      });
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, requestKey, sessionId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/hotell"));

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <IconButton icon="chevronLeft" label={h.back} variant="light" onPress={back} testID="header-back" />
      <Text style={[type.headline, styles.headerTitle]} accessibilityRole="header">
        {h.detailTitle}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  );

  let content;
  if (!stay || !hotelKey) {
    content = <StateView icon="bed" title={h.detailErrorTitle} body={h.stayErrors.place} testID="hotel-detail-invalid" dark={false} />;
  } else if (state.kind === "loading" || status.kind === "loading") {
    content = <StateView busy icon="bed" title={h.loadingDetail} testID="hotel-detail-loading" dark={false} />;
  } else if (state.kind === "error") {
    content = (
      <StateView icon="alert" title={h.detailErrorTitle} body={errorText(state.error, i18n, { SUPPLIER_UNAVAILABLE: h.supplierError, SUPPLIER_TIMEOUT: h.supplierError })} testID="hotel-detail-error" dark={false}>
        <PrimaryButton label={h.retry} icon="refresh" onPress={() => setAttempt((n) => n + 1)} testID="hotel-detail-retry" />
        <SecondaryButton label={h.disabledButton} icon="external" accessibilityHint={h.disabledHint} onPress={() => openUrl(hotelInquiryUrl(stay.placeName))} testID="hotel-detail-inquiry" />
      </StateView>
    );
  } else {
    const { result } = state;
    const hotel = result.hotel;
    const statusValue = status.kind === "ok" ? status.status : null;
    const rates = ratesByTotal(hotel.rates);
    const facts = hotelFacts(hotel, i18n);
    const rating = typeof hotel.guestRating === "number" && hotel.guestRating > 0 ? h.ratingLabel(f.decimal1(hotel.guestRating), h.reviews(hotel.numberOfReviews, f.int(hotel.numberOfReviews))) : null;
    const hasCoords = Number.isFinite(hotel.lat) && Number.isFinite(hotel.lng) && !(hotel.lat === 0 && hotel.lng === 0);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasCoords ? `${hotel.lat},${hotel.lng}` : [hotel.name, hotel.address].filter(Boolean).join(", "))}`;
    content = (
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }} testID="hotel-detail">
        <View style={styles.body}>
          {/* Bildet og fakta i ett hvitt kort, som hotellkortet i listen; bildet har runde hjørner øverst. */}
          <View style={styles.summary} testID="hotel-detail-summary">
            <View style={styles.photo}>
              <HotelPhoto image={hotel.images[0]} height={200} testID="hotel-detail-photo" />
            </View>
            <View style={styles.summaryText}>
              <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
                {hotel.name}
              </Text>
              {facts ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{facts}</Text> : null}
              {hotel.address ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{hotel.address}</Text> : null}
              {rating ? <Text style={[type.footnoteStrong, { color: colors.text }]}>{rating}</Text> : null}
              <Text style={[type.caption, { color: colors.textSecondary }]} testID="hotel-detail-stay">
                {stayLine(stay, i18n, hotel.nights)}
              </Text>
              {/* Lenken er selv 44 pt høy; luften rundt den (hitSlop) ligger inne i kortets marg. */}
              <View style={{ alignSelf: "flex-start" }}>
                <LinkButton label={h.map} accessibilityLabel={`${h.map}. ${h.mapHint}`} onPress={() => openUrl(mapUrl)} testID="hotel-map" />
              </View>
            </View>
          </View>

          {result.sandbox || statusValue?.mode === "sandbox" ? (
            <Banner tone="warning" testID="hotel-detail-sandbox">
              {h.sandboxNotice}
            </Banner>
          ) : null}
          {status.kind === "error" ? (
            <Banner tone="error" testID="hotel-detail-status-error">
              {h.statusErrorTitle}
            </Banner>
          ) : null}
          {stay.rooms > 1 ? (
            <Banner tone="info" testID="hotel-detail-rooms">
              {h.multiRoom(stay.rooms)}
            </Banner>
          ) : null}

          <InformationCard title={h.roomsAndPrices} testID="hotel-rates">
            {rates.length ? (
              <View style={{ gap: space.md }}>
                {rates.map((r, i) => (
                  <RateRow key={`${r.provider.code}-${i}`} rate={r} nights={hotel.nights} block={handoffBlock(statusValue, result.sandbox, r.bookUrl)} testID={`hotel-rate-${i}`} />
                ))}
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.handoffNote}</Text>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.localFees}</Text>
              </View>
            ) : (
              <Text style={[type.callout, { color: colors.textSecondary }]} testID="hotel-no-rates">
                {h.noRates}
              </Text>
            )}
          </InformationCard>
          {status.kind === "error" ? <SecondaryButton label={h.retry} icon="refresh" onPress={retryStatus} testID="hotel-detail-status-retry" /> : null}

          {hotel.description ? (
            <InformationCard title={h.about}>
              <Text style={[type.callout, { color: colors.text }]}>{hotel.description}</Text>
            </InformationCard>
          ) : null}
          {hotel.featureSummary.length ? (
            <InformationCard title={h.facilities}>
              <View style={{ gap: space.sm }}>
                {hotel.featureSummary.slice(0, 12).map((x) => (
                  <View key={x.name} style={styles.feature}>
                    <Icon name="check" size={15} color={colors.text} />
                    <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{x.description ? `${x.name}: ${x.description}` : x.name}</Text>
                  </View>
                ))}
              </View>
            </InformationCard>
          ) : null}
          {hotel.policies.length ? (
            <InformationCard title={h.policies}>
              <View style={{ gap: space.sm }}>
                {hotel.policies.map((p) => (
                  <Text key={p.code} style={[type.footnote, { color: colors.text }]}>
                    <Text style={[type.footnoteStrong, { color: colors.text }]}>{p.name}</Text>
                    {p.description ? `: ${p.description}` : ""}
                  </Text>
                ))}
              </View>
            </InformationCard>
          ) : null}
          <Text style={[type.footnote, { color: colors.textSecondary }]} testID="hotel-detail-disclosure">
            {h.disclosure}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen} testID="hotel-detail-screen">
      {/* Toppen er den lyse grunnen: mørk tekst i statuslinjen. Tittellinjen står fast; innholdet ruller under den. */}
      <StatusBar style="dark" />
      {header}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  // «Cloud + Graphite»: lys grunn bak tittellinjen og de hvite kortene; tekst på grunnen i `text`/`textSecondary`.
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.lg },
  summary: { backgroundColor: colors.white, borderRadius: radius.card },
  // Bare bildet klippes (runde hjørner øverst); kortet selv klipper ikke, så lenkens luft ikke kuttes.
  photo: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: "hidden" },
  summaryText: { padding: space.lg, gap: space.xs },
  rate: { gap: space.sm, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.lightBorder },
  rateHead: { flexDirection: "row", gap: space.md },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  blocked: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.input, backgroundColor: colors.inset },
  feature: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
});
