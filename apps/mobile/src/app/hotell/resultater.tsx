import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "../../components/a11y";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HotelSearchResult, HotelSummary } from "@contracts/hotels";
import { useApp } from "../../lib/appState";
import { hotelInquiryUrl, nightsOf, splitRooms, stayFromParams, stayParams } from "../../lib/hotels";
import { sortHotels, stayLine, type HotelSort } from "../../lib/hotelResults";
import { errorText } from "../../lib/errorText";
import { useI18n } from "../../i18n";
import { Chip, IconButton, Notices, PrimaryButton, SecondaryButton, StateView, type NoticeItem } from "../../components/ui";
import { HotelCard } from "../../components/HotelCard";
import { colors, space, type } from "../../lib/theme";

type SearchState = { kind: "loading" } | { kind: "done"; result: HotelSearchResult } | { kind: "error"; error: unknown };

/**
 * Hotellresultatene: KAYAKs rekkefølge som «Anbefalt», eller sortert på
 * totalpris eller gjestevurdering. Alt som vises er fra leverandørens svar;
 * testdata (sandbox), et ufullstendig søk og flere rom står tydelig over listen.
 */
export default function HotelResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { api, sessionId } = useApp();
  const i18n = useI18n();
  const { t, locale } = i18n;
  const h = t.hotels;
  const stay = useMemo(() => stayFromParams(params as Record<string, string>), [params]);
  // Svaret lagres med søket det gjelder; til svaret for akkurat dette søket er kommet, vises lasting.
  const [answer, setAnswer] = useState<{ key: string; state: SearchState } | null>(null);
  const [sort, setSort] = useState<HotelSort>("recommended");
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const stayKey = stay ? JSON.stringify(stayParams(stay)) : "";
  const requestKey = `${stayKey}#${attempt}`;
  const state: SearchState = answer?.key === requestKey ? answer.state : { kind: "loading" };
  useEffect(() => {
    if (!stay) return;
    const abort = new AbortController();
    abortRef.current = abort;
    api
      .hotelSearch({ destination: stay.placeKey, checkin: stay.checkin, checkout: stay.checkout, rooms: splitRooms(stay.adults, stay.childAges, stay.rooms), language: locale, sessionId }, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) setAnswer({ key: requestKey, state: { kind: "done", result } });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setAnswer({ key: requestKey, state: { kind: "error", error: error ?? new Error("hotels.search") } });
      });
    return () => abort.abort();
    // requestKey dekker oppholdet og nye forsøk; språket endrer ikke søket som allerede er gjort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, requestKey, sessionId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    router.back();
  }, [router]);

  const openHotel = (hotel: HotelSummary) => {
    if (!stay) return;
    router.push({ pathname: "/hotell/detaljer", params: { ...stayParams(stay), hotell: hotel.key } });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/hotell"));
  const nights = state.kind === "done" ? state.result.nights : stay ? nightsOf(stay.checkin, stay.checkout) : 0;
  const title = stay?.placeName || h.resultsTitle;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <IconButton icon="chevronLeft" label={h.back} variant="plain" onPress={back} testID="header-back" />
      <View style={styles.headerText}>
        <Text style={[type.headline, { color: colors.onDark, textAlign: "center" }]} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {stay ? (
          <Text style={[type.caption, { color: colors.onDarkMuted, textAlign: "center" }]} testID="hotel-stay-line">
            {stayLine(stay, i18n, nights)}
          </Text>
        ) : null}
      </View>
      <IconButton icon="search" label={h.editSearch} onPress={back} testID="hotel-edit-search" />
    </View>
  );

  let content;
  if (!stay) {
    content = (
      <StateView icon="search" title={h.emptyTitle} body={h.stayErrors.place} testID="hotel-results-invalid">
        <PrimaryButton label={h.editSearch} onPress={back} />
      </StateView>
    );
  } else if (state.kind === "loading") {
    content = (
      <StateView busy icon="bed" title={h.searchingTitle} body={h.searchingBody} testID="hotel-results-loading">
        <SecondaryButton dark label={h.cancel} onPress={cancel} testID="hotel-search-cancel" />
      </StateView>
    );
  } else if (state.kind === "error") {
    const message = errorText(state.error, i18n, { SUPPLIER_UNAVAILABLE: h.supplierError, SUPPLIER_TIMEOUT: h.supplierError });
    content = (
      <StateView icon="alert" title={h.errorTitle} body={message} testID="hotel-results-error">
        <PrimaryButton label={h.retry} icon="refresh" onPress={() => setAttempt((n) => n + 1)} testID="hotel-results-retry" />
        <SecondaryButton
          dark
          label={h.disabledButton}
          icon="external"
          accessibilityHint={h.disabledHint}
          onPress={() => void WebBrowser.openBrowserAsync(hotelInquiryUrl(stay.placeName), { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined)}
          testID="hotel-results-inquiry"
        />
      </StateView>
    );
  } else {
    const { result } = state;
    const list = sortHotels(result.results, sort);
    const notices: NoticeItem[] = [];
    if (result.sandbox) notices.push({ key: "sandbox", tone: "warning", text: h.sandboxNotice, testID: "hotel-sandbox-notice" });
    if (!result.complete) notices.push({ key: "partial", tone: "info", text: h.partial, testID: "hotel-partial-notice" });
    if (stay.rooms > 1) notices.push({ key: "rooms", tone: "info", text: h.multiRoom(stay.rooms), testID: "hotel-rooms-notice" });
    content = (
      <FlatList
        data={list}
        keyExtractor={(x) => x.key}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.xxxl }]}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.md }}>
            <Notices items={notices} />
            {list.length ? (
              <>
                <Text style={[type.calloutStrong, { color: colors.onDark }]} testID="hotel-results-count">
                  {h.resultsCount(list.length)}
                </Text>
                <View style={styles.sortRow} accessibilityRole="radiogroup" accessibilityLabel={h.sort}>
                  {(
                    [
                      ["recommended", h.sortRecommended],
                      ["price", h.sortPrice],
                      ["rating", h.sortRating],
                    ] as const
                  ).map(([value, label]) => (
                    <Chip key={value} label={label} selected={sort === value} onPress={() => setSort(value)} testID={`hotel-sort-${value}`} />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <StateView icon="bed" title={h.emptyTitle} body={h.emptyBody} testID="hotel-results-empty">
            <PrimaryButton label={h.editSearch} onPress={back} />
          </StateView>
        }
        ListFooterComponent={
          list.length ? (
            <View style={{ gap: space.xs, marginTop: space.lg }}>
              <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{h.localFees}</Text>
              <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID="hotel-disclosure">
                {h.disclosure}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <HotelCard hotel={item} onPress={() => openHotel(item)} testID={`hotel-${item.key}`} />}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  headerText: { flex: 1, alignItems: "center", gap: 2 },
  list: { paddingHorizontal: space.lg, paddingTop: space.sm },
  sortRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
