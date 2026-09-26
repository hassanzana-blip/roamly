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
import { useA11yLanguage, useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, PrimaryButton, SecondaryButton } from "../../components/ui";
import { Icon, type IconName } from "../../components/Icon";
import { DateRangeSheet } from "../../components/RangeCalendar";
import { TravellersSheet } from "../../components/TravellersSheet";
import { nightsBetween } from "../../lib/calendar";
import { keepDatesTogether } from "../../lib/format";
import { recentKey } from "../../lib/recent";
import { DestinationSearch } from "../../components/DestinationSearch";
import { normalizeSearch, searchDestinations } from "../../lib/destinationSearch";
import { DestinationMap } from "../../components/DestinationMap";
import { DestinationPinCard } from "../../components/DestinationPinCard";
import { MAP_AREAS, MAP_POINTS, areaOfDestination, initialArea, pointsIn, type MapArea } from "../../lib/destinationMap";
import { DestinationCard } from "../../components/DestinationCard";
import { SaveButton } from "../../components/SaveButton";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

type ExploreView = "list" | "map";

/** Søket Utforsk bruker (fra-flyplass, datoer), som en hvit pille på grunnen som endrer det på stedet. */
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
      <Icon name={icon} size={15} color={colors.textSecondary} />
      <Text style={[type.footnoteStrong, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
      <Icon name="chevronDown" size={14} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * Liste eller kart: to faner i et hvitt spor med lys kant på grunnen; den valgte er blå med hvit tekst (som `Segmented`).
 * For VoiceOver er det fortsatt faner («fane, valgt»). Hver fane er selv 44 pt høy, og etiketten brytes heller enn å
 * kuttes. Et trykk – også på den valgte – melder valget, som før.
 */
function ViewTabs({ value, onChange }: { value: ExploreView; onChange: (v: ExploreView) => void }) {
  const lang = useA11yLanguage();
  const { t } = useI18n();
  const tabs: { value: ExploreView; label: string }[] = [
    { value: "list", label: t.explore.viewList },
    { value: "map", label: t.explore.viewMap },
  ];
  return (
    <View accessibilityLanguage={lang} style={styles.viewTabs} accessibilityRole="tablist" testID="explore-view-tabs">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            testID={`tab-${tab.value}`}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [styles.viewTab, selected && styles.viewTabOn, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[type.calloutStrong, { color: selected ? colors.white : colors.text, textAlign: "center" }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Alle reisemålene HelloSky har godkjente bilder av, som liste eller kart, med
 * et søk som filtrerer begge likt (by, land, flyplass, IATA – bare de 24).
 * Et trykk (kort i listen, «Se flyreiser» på kartet) søker til reisemålets
 * flyplass med skjemaets fra-flyplass, datoer og reisende. Kartets nåler er
 * reisemål – aldri priser eller ledige plasser. Listen er alltid tilgjengelig.
 *
 * «Cloud + Graphite»: en lys skjerm uten grafittøy øverst, som forsiden – tittel, søket (hvite piller), søkefeltet og
 * Liste | Kart står på den lyse grunnen. Fotokortene beholder fotoet og overlegget; kartet selv er som før.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { form, setForm, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  // Feilen gjelder søket slik det var da kunden trykket på et reisemål; endres fra-flyplass, datoer eller reisende her
  // (eller på forsiden), er den borte.
  const [problem, setProblem] = useState<{ code: FormErrorCode; key: string } | null>(null);
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
    const destination = destinationChoice(d, locale);
    const err = runSearch({ destination });
    setProblem(err ? { code: err, key: recentKey({ ...form, destination }) } : null);
    if (!err) router.push("/resultater");
  };

  const roundTrip = form.tripType === "roundtrip";
  // Én vei sies på knappen, så den ikke ser ut som en tur-retur samme dag.
  const span = keepDatesTogether(f.dateSpan(form.departDate, roundTrip ? form.returnDate : null));
  const dates = roundTrip ? span : `${t.home.oneway} · ${span}`;
  const datesSpoken = t.calendar.summarySpoken(f.longDay(form.departDate), roundTrip ? f.longDay(form.returnDate) : null, roundTrip ? t.calendar.nights(nightsBetween(form.departDate, form.returnDate)) : null);
  // Reisende, og klassen og «bare direkte» når de ikke er standard.
  const travellers = [passengerSummary(form, i18n), ...(form.cabinClass !== "economy" ? [cabinLabel(form.cabinClass, i18n)] : []), ...(form.directOnly ? [t.home.directOnly] : [])].join(" · ");
  // Søket Utforsk bruker – fra-flyplass, datoer og reisende – endres her, uten å gå til forsiden. Én rad som ruller
  // sideveis, så reisemålene står like høyt oppe; luft over og under så trykkflatene (44 pt) ikke klippes.
  const context = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Med tastaturet oppe (søket etter reisemål) virker første trykk på en knapp, ikke bare på tastaturet.
      keyboardShouldPersistTaps="handled"
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
      <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
        {t.explore.title}
      </Text>
      {context}
      <DestinationSearch value={query} onChange={changeQuery} />
      {searching ? (
        <Text style={[type.footnoteStrong, { color: colors.textSecondary }]} accessibilityLiveRegion="polite" testID="explore-count">
          {t.explore.searchCount(matches.length, DESTINATIONS.length)}
        </Text>
      ) : null}
      <ViewTabs
        value={view}
        onChange={(v) => {
          setView(v);
          setProblem(null);
          if (v === "map" && !area) setArea(initialArea(selectedId));
        }}
      />
      {problem && problem.key === recentKey(form) ? (
        <Banner tone="error" testID="explore-error">
          {formErrorText(problem.code, i18n)}
        </Banner>
      ) : null}
    </View>
  );

  // Ingen treff: si det, og gi én knapp for å tømme søket (samme i liste og kart).
  const empty = searching && !matches.length ? (
    <View style={styles.empty} testID="explore-empty">
      <Text style={[type.calloutStrong, { color: colors.text }]}>{t.explore.searchEmpty(query.trim(), DESTINATIONS.length)}</Text>
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.explore.searchEmptyHint}</Text>
      <SecondaryButton label={t.explore.searchClear} icon="close" onPress={() => changeQuery("")} testID="explore-empty-clear" />
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
        <StatusBar style="dark" />
        <StatusBarShield tone="light" />
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
                <Text style={[type.footnoteStrong, { color: on ? colors.white : colors.text }]}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        )}
        {/* Kartet fyller resten; kortet ligger over bunnen av kartet i stedet for å krympe det. */}
        {empty ? (
          <View style={styles.mapArea}>{empty}</View>
        ) : (
        <View style={[styles.mapArea, native && styles.mapNative]} testID="explore-map-area">
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
      <StatusBar style="dark" />
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
            {/* På grunnen, under fotoet: sekundærtekst (5,3:1). Ingen linjegrense – stor tekst bryter linjen. */}
            <Text style={[type.caption, { color: colors.textSecondary }]} testID={`explore-country-${d.id}`}>
              {t.explore.countryCode(d.names[locale].country, d.iata)}
            </Text>
            {/* Under et søk: den nøyaktige flyplassen søket bruker, så det er tydelig hvilken flyplass kortet gjelder. */}
            {searching ? (
              <Text style={[type.caption, { color: colors.textSecondary }]} testID={`explore-airport-${d.id}`}>
                {t.explore.airportLine(d.names[locale].airport, d.iata)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
    <StatusBarShield tone="light" />
    {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  // «Cloud + Graphite»: lys grunn; tekst på den er `text` (tittel) og `textSecondary` (5,3:1).
  screen: { flex: 1, backgroundColor: colors.canvas },
  head: { paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.xl },
  contextScroll: { flexGrow: 0, marginHorizontal: -space.lg },
  contextRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 4 },
  // Hvite piller med lys kant og mørk tekst, som de nylige søkene på forsiden.
  context: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, maxWidth: "100%", paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  // Liste | Kart: hvitt spor med lys kant, så valget synes på grunnen; fanene deler sporet likt.
  viewTabs: { flexDirection: "row", gap: space.xs, padding: 3, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  viewTab: { flex: 1, minHeight: TOUCH, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill },
  viewTabOn: { backgroundColor: colors.blue },
  mapNote: { color: colors.textSecondary, paddingHorizontal: space.lg, marginBottom: space.sm },
  areas: { flexGrow: 0, flexShrink: 0 },
  areasContent: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  // Lyse brikker som filterbrikkene i resultatene (innfelt med lys kant, valgt blå); hele 44 pt synlig, uten hitSlop.
  area: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.inset },
  areaOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  // Kartet (eller reservelisten) fyller resten av skjermen; kortet ligger over bunnen, høyst 55 % høyt, og ruller.
  mapArea: { flex: 1, minHeight: 200, backgroundColor: colors.canvas },
  // Bak Apple-kartet (mørk, dempet stil, som før): samme mørke flate til kartet er tegnet, så det ikke blinker lyst.
  mapNative: { backgroundColor: colors.bg },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "55%" },
  cardContent: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  save: { position: "absolute", top: space.xs, right: space.xs },
  empty: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg, rowGap: space.lg },
});
