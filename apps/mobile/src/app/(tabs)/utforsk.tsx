import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StatusBarShield } from "../../components/StatusBarShield";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { DESTINATIONS, destinationChoice, type Destination } from "../../lib/destinations";
import { cabinLabel, formErrorText, passengerSummary } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, DarkTabs, PrimaryButton, SecondaryButton } from "../../components/ui";
import { Icon, type IconName } from "../../components/Icon";
import { DateRangeSheet } from "../../components/RangeCalendar";
import { TravellersSheet } from "../../components/TravellersSheet";
import { nightsBetween } from "../../lib/calendar";
import { DestinationSearch } from "../../components/DestinationSearch";
import { normalizeSearch, searchDestinations } from "../../lib/destinationSearch";
import { DestinationMap } from "../../components/DestinationMap";
import { DestinationPinCard } from "../../components/DestinationPinCard";
import { MAP_AREAS, MAP_POINTS, areaOfDestination, initialArea, pointsIn, type MapArea } from "../../lib/destinationMap";
import { DestinationCard } from "../../components/DestinationCard";
import { SaveButton } from "../../components/SaveButton";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

type ExploreView = "list" | "map";

/** Søket Utforsk bruker (fra-flyplass, datoer), som en knapp som endrer det på stedet. */
function ContextButton({ icon, label, onPress, testID, accessibilityLabel, accessibilityHint }: { icon: IconName; label: string; onPress: () => void; testID: string; accessibilityLabel: string; accessibilityHint: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // 36 pt høy knapp; trykkflaten når 44 pt.
      hitSlop={(TOUCH - 36) / 2}
      style={({ pressed }) => [styles.context, pressed && { opacity: 0.7 }]}
      testID={testID}
    >
      <Icon name={icon} size={15} color={colors.onDarkMuted} />
      <Text style={[type.footnoteStrong, { color: colors.onDark, flexShrink: 1 }]}>{label}</Text>
      <Icon name="chevronDown" size={14} color={colors.onDarkMuted} />
    </Pressable>
  );
}

/**
 * Alle reisemålene HelloSky har godkjente bilder av, som liste eller kart, med
 * et søk som filtrerer begge likt (by, land, flyplass, IATA – bare de 24).
 * Et trykk (kort i listen, «Se flyreiser» på kartet) søker til reisemålets
 * flyplass med skjemaets fra-flyplass, datoer og reisende. Kartets nåler er
 * reisemål – aldri priser eller ledige plasser. Listen er alltid tilgjengelig.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { form, setForm, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const [problem, setProblem] = useState<FormErrorCode | null>(null);
  const [view, setView] = useState<ExploreView>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Kartets område: Europa først (eller det valgte reisemålets område); knappene bytter.
  const [area, setArea] = useState<MapArea | null>("europe");
  const [areaRequest, setAreaRequest] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [query, setQuery] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [travellersOpen, setTravellersOpen] = useState(false);
  const onDates = useCallback((d: { departDate: string; returnDate: string }) => setForm((f) => ({ ...f, ...d })), [setForm]);
  const matches = searchDestinations(query);
  const searching = normalizeSearch(query) !== "";
  const shownIds = new Set(matches.map((m) => m.destination.id));
  const shownPoints = searching ? MAP_POINTS.filter((p) => shownIds.has(p.destination.id)) : MAP_POINTS;
  const selected = shownPoints.find((p) => p.destination.id === selectedId)?.destination ?? null;
  const changeQuery = (q: string) => {
    setQuery(q);
    setProblem(null);
    // Det valgte reisemålet står bare så lenge det passer søket.
    if (selectedId && !searchDestinations(q).some((m) => m.destination.id === selectedId)) setSelectedId(null);
    // Søket tømt på kartet: tilbake til et område.
    if (!normalizeSearch(q) && searching && view === "map") {
      setArea(initialArea(selectedId));
      setAreaRequest((n) => n + 1);
    }
  };
  const cardWidth = (width - space.lg * 2 - space.md) / 2;

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const roundTrip = form.tripType === "roundtrip";
  const dates = f.dateSpan(form.departDate, roundTrip ? form.returnDate : null);
  const datesSpoken = t.calendar.summarySpoken(f.longDay(form.departDate), roundTrip ? f.longDay(form.returnDate) : null, roundTrip ? t.calendar.nights(nightsBetween(form.departDate, form.returnDate)) : null);
  // Reisende, og klassen og «bare direkte» når de ikke er standard.
  const travellers = [passengerSummary(form, i18n), ...(form.cabinClass !== "economy" ? [cabinLabel(form.cabinClass, i18n)] : []), ...(form.directOnly ? [t.home.directOnly] : [])].join(" · ");
  // Søket Utforsk bruker – fra-flyplass, datoer og reisende – endres her, uten å gå til forsiden. Én rad som ruller
  // sideveis, så reisemålene står like høyt oppe; luft over og under så trykkflatene (44 pt) ikke klippes.
  const context = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.contextScroll}
      contentContainerStyle={styles.contextRow}
      testID="explore-summary"
    >
      <ContextButton
        icon="plane"
        label={form.origin ? t.explore.fromChip(form.origin.city, form.origin.iata) : t.explore.chooseOriginChip}
        accessibilityLabel={form.origin ? t.explore.fromChip(form.origin.city, form.origin.iata) : t.explore.chooseOriginChip}
        accessibilityHint={t.explore.originHint}
        onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })}
        testID="context-origin"
      />
      <ContextButton icon="calendar" label={dates} accessibilityLabel={datesSpoken} accessibilityHint={t.explore.datesHint} onPress={() => setDatesOpen(true)} testID="context-dates" />
      <ContextButton icon="user" label={travellers} accessibilityLabel={t.explore.travellersSpoken(travellers)} accessibilityHint={t.explore.travellersHint} onPress={() => setTravellersOpen(true)} testID="context-travellers" />
    </ScrollView>
  );
  const datesSheet = (
    <DateRangeSheet
      testID="context-calendar"
      visible={datesOpen}
      roundTrip={roundTrip}
      dates={{ departDate: form.departDate, returnDate: form.returnDate }}
      onChange={onDates}
      onClose={() => setDatesOpen(false)}
      footer={<PrimaryButton testID="context-dates-done" label={t.calendar.done} onPress={() => setDatesOpen(false)} />}
    />
  );
  const sheets = (
    <>
      {datesSheet}
      <TravellersSheet visible={travellersOpen} onClose={() => setTravellersOpen(false)} />
    </>
  );

  const head = (
    <View style={[styles.head, view === "map" && { marginBottom: space.md }]}>
      <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
        {t.explore.title}
      </Text>
      {context}
      <DestinationSearch value={query} onChange={changeQuery} />
      {searching ? (
        <Text style={[type.footnoteStrong, { color: colors.onDarkMuted }]} accessibilityLiveRegion="polite" testID="explore-count">
          {t.explore.searchCount(matches.length, DESTINATIONS.length)}
        </Text>
      ) : null}
      <DarkTabs
        value={view}
        onChange={(v) => {
          setView(v);
          setProblem(null);
          if (v === "map" && !area) setArea(initialArea(selectedId));
        }}
        tabs={[
          { value: "list", label: t.explore.viewList },
          { value: "map", label: t.explore.viewMap },
        ]}
      />
      {problem ? (
        <Banner tone="error" dark testID="explore-error">
          {formErrorText(problem, i18n)}
        </Banner>
      ) : null}
    </View>
  );

  // Ingen treff: si det, og gi én knapp for å tømme søket (samme i liste og kart).
  const empty = searching && !matches.length ? (
    <View style={styles.empty} testID="explore-empty">
      <Text style={[type.calloutStrong, { color: colors.onDark }]}>{t.explore.searchEmpty(query.trim(), DESTINATIONS.length)}</Text>
      <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{t.explore.searchEmptyHint}</Text>
      <SecondaryButton dark label={t.explore.searchClear} icon="close" onPress={() => changeQuery("")} testID="explore-empty-clear" />
    </View>
  ) : null;

  if (view === "map") {
    const native = Platform.OS === "ios";
    const chooseArea = (a: MapArea) => {
      setArea(a);
      setAreaRequest((n) => n + 1);
      // Et valgt reisemål utenfor det nye området ville stå utenfor kartet.
      if (selectedId && a !== "world" && areaOfDestination(selectedId) !== a) setSelectedId(null);
    };
    const mapProps = { points: shownPoints, selectedId: selected ? selectedId : null, onSelect: setSelectedId, bottomInset: selected ? cardHeight : 0, area: searching ? null : area, areaRequest, onLeaveArea: () => setArea(null), fitToPoints: searching };
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.lg }]} testID="explore-screen">
        <StatusBar style="light" />
        <StatusBarShield />
        {head}
        <Text style={[type.caption, styles.mapNote]} testID="map-note">
          {t.explore.mapNote}
        </Text>
        {searching ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areas} contentContainerStyle={styles.areasContent} accessibilityLabel={t.explore.areasLabel} testID="map-areas">
          {MAP_AREAS.map((a) => {
            const on = a === area;
            const name = t.explore.areas[a];
            return (
              <Pressable
                key={a}
                onPress={() => chooseArea(a)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.explore.areaLabel(name, pointsIn(a).length)}
                testID={`map-area-${a}`}
                style={({ pressed }) => [styles.area, on && styles.areaOn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[type.footnoteStrong, { color: on ? colors.text : colors.onDark }]}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        )}
        {/* Kartet fyller resten; kortet ligger over bunnen av kartet i stedet for å krympe det. */}
        {empty ? (
          <View style={styles.mapArea}>{empty}</View>
        ) : (
        <View style={styles.mapArea}>
          {native ? (
            <DestinationMap {...mapProps} />
          ) : (
            <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: (selected ? cardHeight : 0) + space.lg }}>
              <DestinationMap {...mapProps} />
            </ScrollView>
          )}
          {selected ? (
            // Kortet kan bli høyere enn plassen (stor tekst): da ruller det, og «Se flyreiser» er alltid til å nå.
            <ScrollView
              style={styles.cardWrap}
              contentContainerStyle={styles.cardContent}
              onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}
              testID="map-pin-card-scroll"
            >
              <DestinationPinCard destination={selected} onSearch={() => searchTo(selected)} onClose={() => setSelectedId(null)} />
            </ScrollView>
          ) : null}
        </View>
        )}
        {sheets}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxxl }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      testID="explore-screen"
    >
      <StatusBar style="light" />
      {head}
      {empty}
      <View style={styles.grid}>
        {matches.map(({ destination: d }) => (
          <View key={d.id} style={{ width: cardWidth, gap: space.xs }}>
            <View>
              <DestinationCard destination={d} onPress={() => searchTo(d)} style={{ width: cardWidth, height: cardWidth * 0.9 }} testID={`explore-${d.id}`} />
              {/* Egen knapp ved siden av kortets knapp (ikke inni den), så skjermleseren får to tydelige valg. */}
              <View style={styles.save}>
                <SaveButton destination={d} />
              </View>
            </View>
            <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>{t.explore.countryCode(d.names[locale].country, d.iata)}</Text>
            {/* Under et søk: den nøyaktige flyplassen søket bruker, så det er tydelig hvilken flyplass kortet gjelder. */}
            {searching ? (
              <Text style={[type.caption, { color: colors.onDarkMuted }]} testID={`explore-airport-${d.id}`}>
                {t.explore.airportLine(d.names[locale].airport, d.iata)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
    <StatusBarShield />
    {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.xl },
  contextScroll: { flexGrow: 0, marginHorizontal: -space.lg },
  contextRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 4 },
  context: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, maxWidth: "100%", paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  mapNote: { color: colors.onDarkMuted, paddingHorizontal: space.lg, marginBottom: space.sm },
  areas: { flexGrow: 0, flexShrink: 0 },
  areasContent: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  area: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.onDarkMuted },
  areaOn: { backgroundColor: colors.white, borderColor: colors.white },
  // Kartet (eller reservelisten) fyller resten av skjermen; kortet ligger over bunnen, høyst 55 % høyt, og ruller.
  mapArea: { flex: 1, minHeight: 200, backgroundColor: colors.bg },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "55%" },
  cardContent: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  save: { position: "absolute", top: space.xs, right: space.xs },
  empty: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg, rowGap: space.lg },
});
