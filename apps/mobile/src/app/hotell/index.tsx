import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HotelPlace } from "@contracts/hotels";
import { useApp } from "../../lib/appState";
import { useHotelsStatus } from "../../lib/useHotelsStatus";
import { addDays, toIsoDate } from "../../lib/format";
import { defaultDates, HOTEL_LIMITS, hotelInquiryUrl, nightsOf, stayError, stayParams, type HotelStayError } from "../../lib/hotels";
import { normalizeQuery, DEFAULT_CHILD_AGE } from "../../lib/searchForm";
import { errorText } from "../../lib/errorText";
import { useI18n } from "../../i18n";
import { Banner, BottomSheet, ChoiceChips, Field, IconButton, PrimaryButton, SecondaryButton, StateView, Stepper } from "../../components/ui";
import { DateField, FormTile } from "../../components/DateField";
import { ServiceSwitch } from "../../components/ServiceSwitch";
import { Icon } from "../../components/Icon";
import { colors, radius, space, type } from "../../lib/theme";

const CHILD_AGES = Array.from({ length: HOTEL_LIMITS.childAge + 1 }, (_, i) => i);

function openWeb(url: string) {
  void WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined);
}

/** Stedsforslag fra KAYAK (hotels.places) for teksten som står i feltet nå. */
function usePlaces(query: string, enabled: boolean) {
  const { api } = useApp();
  const q = normalizeQuery(query);
  const key = q.toLowerCase();
  const active = enabled && q.length >= 2;
  const [answer, setAnswer] = useState<{ key: string; results: HotelPlace[]; error: unknown } | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .hotelPlaces(q)
        .then((results) => {
          if (!cancelled) setAnswer({ key, results, error: null });
        })
        .catch((e: unknown) => {
          if (!cancelled) setAnswer({ key, results: [], error: e ?? new Error("places") });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, q, key, active]);
  // Bare svaret for akkurat det som står i feltet vises – aldri treff fra forrige tekst.
  const current = active && answer?.key === key ? answer : null;
  return { active, loading: active && !current, results: current?.results ?? [], error: current?.error ?? null };
}

/**
 * Hotellsøket: sted, datoer, gjester og rom. Skjemaet vises bare når serveren
 * har svart at hotellsøk er slått på; ellers forklares det, og kunden får
 * nettets hotellforespørsel i stedet. Ingen priser eller hotell uten svar fra leverandøren.
 */
export default function HotelSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const i18n = useI18n();
  const h = i18n.t.hotels;
  const { state, retry } = useHotelsStatus();

  const today = toIsoDate(new Date());
  const [dates, setDates] = useState(() => defaultDates(today));
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<HotelPlace | null>(null);
  const [adults, setAdults] = useState(2);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [rooms, setRooms] = useState(1);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [problem, setProblem] = useState<HotelStayError | null>(null);

  const enabled = state.kind === "ok" && state.status.enabled;
  const places = usePlaces(query, enabled && !place);

  const choosePlace = (p: HotelPlace) => {
    setPlace(p);
    setQuery(p.name);
    setProblem(null);
  };

  const guestsValue = [h.adultsCount(adults), childAges.length ? h.childrenCount(childAges.length) : null, h.roomsCount(rooms)].filter(Boolean).join(" · ");

  const submit = () => {
    const stay = { placeKey: place?.key ?? "", placeName: place ? (place.fullName ?? place.name) : "", checkin: dates.checkin, checkout: dates.checkout, adults, childAges, rooms };
    const err = stayError(stay, today);
    setProblem(err);
    if (err) return;
    router.push({ pathname: "/hotell/resultater", params: stayParams(stay) });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  let body;
  if (state.kind === "loading") {
    body = <StateView dark={false} busy icon="bed" title={h.checking} testID="hotels-status-loading" />;
  } else if (state.kind === "error") {
    body = (
      <StateView dark={false} icon="alert" title={h.statusErrorTitle} body={errorText(state.error, i18n)} testID="hotels-status-error">
        <SecondaryButton label={h.retry} icon="refresh" onPress={retry} testID="hotels-status-retry" />
        <SecondaryButton label={h.disabledButton} icon="external" onPress={() => openWeb(hotelInquiryUrl())} accessibilityHint={h.disabledHint} testID="hotels-inquiry" />
      </StateView>
    );
  } else if (!state.status.enabled) {
    body = (
      <View style={{ gap: space.lg }} testID="hotels-disabled">
        <StateView dark={false} icon="bed" title={h.disabledTitle} body={h.disabledBody} />
        <PrimaryButton label={h.disabledButton} icon="external" onPress={() => openWeb(hotelInquiryUrl())} accessibilityHint={h.disabledHint} testID="hotels-inquiry" />
      </View>
    );
  } else {
    const nights = nightsOf(dates.checkin, dates.checkout);
    body = (
      <View style={{ gap: space.md }} testID="hotel-form">
        {state.status.mode !== "production" ? (
          <Banner tone="warning" testID="hotels-sandbox">
            {h.sandboxNotice}
          </Banner>
        ) : null}
        <Field
          label={h.where}
          icon="search"
          placeholder={h.wherePlaceholder}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            if (place) setPlace(null);
          }}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          testID="hotel-place-query"
        />
        {place ? (
          <View style={styles.chosen} testID="hotel-place-chosen">
            <Icon name="mapPin" size={16} color={colors.blue} />
            <Text style={[type.footnote, { color: colors.text, flex: 1 }]}>{h.placeChosen(place.fullName ?? place.name)}</Text>
          </View>
        ) : null}
        {places.loading ? (
          <View style={styles.row}>
            <ActivityIndicator color={colors.text} />
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.placeSearching}</Text>
          </View>
        ) : null}
        {places.error ? (
          <Banner tone="error" testID="hotel-place-error">
            {h.placeError}
          </Banner>
        ) : null}
        {places.active && !places.loading && !places.error && places.results.length === 0 ? (
          <Text style={[type.footnote, { color: colors.textSecondary }]} testID="hotel-place-none">
            {h.placeNone}
          </Text>
        ) : null}
        {places.results.length ? (
          <View style={styles.suggestions} testID="hotel-place-results">
            {places.results.slice(0, 8).map((p, i) => (
              <Pressable
                key={p.key}
                onPress={() => choosePlace(p)}
                accessibilityRole="button"
                accessibilityLabel={p.fullName ?? p.name}
                testID={`hotel-place-${p.key}`}
                style={({ pressed }) => [styles.suggestion, i > 0 && styles.suggestionBorder, pressed && { backgroundColor: colors.inset }]}
              >
                <Icon name={p.type === "hotel" ? "bed" : "mapPin"} size={18} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{p.name}</Text>
                  {p.fullName && p.fullName !== p.name ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{p.fullName}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.dates}>
          <DateField
            label={h.checkin}
            value={dates.checkin}
            minimum={today}
            testID="hotel-checkin"
            onChange={(checkin) => setDates((d) => ({ checkin, checkout: d.checkout > checkin ? d.checkout : addDays(checkin, 1) }))}
          />
          <DateField label={h.checkout} value={dates.checkout} minimum={addDays(dates.checkin, 1)} testID="hotel-checkout" onChange={(checkout) => setDates((d) => ({ ...d, checkout }))} />
        </View>
        <Text style={[type.caption, { color: colors.textSecondary }]} testID="hotel-nights">
          {h.nights(nights)}
        </Text>
        <FormTile icon="users" label={h.guests} value={guestsValue} onPress={() => setGuestsOpen(true)} accessibilityHint={h.guestsHint} testID="hotel-guests" />
        {problem ? (
          <Banner tone="error" testID="hotel-form-error">
            {h.stayErrors[problem]}
          </Banner>
        ) : null}
        <PrimaryButton label={h.searchButton} icon="arrowRight" onPress={submit} testID="hotel-search-button" />
        <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{h.disclosure}</Text>

        <BottomSheet visible={guestsOpen} title={h.guestsSheet} onClose={() => setGuestsOpen(false)} testID="hotel-guests-sheet">
          <ScrollView contentContainerStyle={{ gap: space.xs, paddingBottom: space.md }}>
            <Stepper label={h.adults} value={adults} min={Math.max(1, rooms)} max={HOTEL_LIMITS.adults} onChange={setAdults} />
            <Stepper
              label={h.children}
              hint={h.childrenHint}
              value={childAges.length}
              min={0}
              max={HOTEL_LIMITS.children}
              onChange={(n) => setChildAges((a) => (n > a.length ? [...a, DEFAULT_CHILD_AGE] : a.slice(0, n)))}
            />
            {childAges.map((age, i) => (
              <View key={`c${i}`} style={{ gap: space.xs, paddingVertical: space.xs }}>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.childAge(i + 1)}</Text>
                <ChoiceChips label={h.childAge(i + 1)} value={age} options={CHILD_AGES} format={(n) => String(n)} onChange={(v) => setChildAges((a) => a.map((x, xi) => (xi === i ? v : x)))} />
              </View>
            ))}
            <Stepper label={h.rooms} hint={h.roomsHint} value={rooms} min={1} max={Math.min(HOTEL_LIMITS.rooms, adults)} onChange={setRooms} />
          </ScrollView>
        </BottomSheet>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon="chevronLeft" label={h.back} variant="plain" onPress={back} testID="header-back" />
        <Text style={[type.headline, styles.headerTitle]} accessibilityRole="header">
          {h.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
        <ServiceSwitch active="hotels" onSelect={back} />
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
          {h.heading}
        </Text>
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  headerTitle: { flex: 1, textAlign: "center", color: colors.onDark },
  sheetScroll: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  sheet: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chosen: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.input, backgroundColor: colors.blueSoft },
  suggestions: { borderWidth: 1, borderColor: colors.lightBorder, borderRadius: radius.input, overflow: "hidden" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.md, paddingVertical: space.sm },
  suggestionBorder: { borderTopWidth: 1, borderTopColor: colors.lightBorder },
  dates: { flexDirection: "row", gap: space.sm },
});
