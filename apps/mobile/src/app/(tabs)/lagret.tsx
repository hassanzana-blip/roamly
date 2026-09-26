import { useState, type ReactNode } from "react";
import { AccessibilityInfo, ScrollView, Share, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FocusStatusBar } from "../../components/FocusStatusBar";
import { StatusBarShield } from "../../components/StatusBarShield";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { useAccountData } from "../../lib/accountData";
import { destinationChoice, type Destination } from "../../lib/destinations";
import { savedDestinations } from "../../lib/saved";
import { recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../../lib/recent";
import { flightIsPast, flightSearch, routeForm, routeKey, type SavedFlight, type SavedRoute } from "../../lib/savedTrips";
import { formatTime, keepDatesTogether } from "../../lib/format";
import { cabinLabel, formErrorText, initialForm, passengerSummary, type AirportChoice } from "../../lib/searchForm";
import { localizedChoice } from "../../lib/airportIndex";
import { webSearchUrlForForm } from "../../lib/webLinks";
import { WEB_PAGES } from "../../lib/config";
import { openWeb } from "../../components/minside/AccountModules";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, BottomSheet, Chip, LinkButton, PrimaryButton, SecondaryButton } from "../../components/ui";
import { Icon, type IconName } from "../../components/Icon";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

type Filter = "alle" | "fly" | "ruter" | "sok" | "varsler" | "reisemal";
const FILTERS: readonly Filter[] = ["alle", "fly", "ruter", "sok", "varsler", "reisemal"];
const isFilter = (v: unknown): v is Filter => typeof v === "string" && (FILTERS as readonly string[]).includes(v);

/**
 * En knapp ved siden av en rad (fjern, del, lagre ruten): selv 44 pt, uten hitSlop inn over radens knapp, med et
 * dempet ikon på den hvite raden. `selected` gir et fylt, blått ikon (en lagret rute).
 */
function SideButton({ icon, label, onPress, testID, selected }: { icon: IconName; label: string; onPress: () => void; testID: string; selected?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      testID={testID}
      style={({ pressed }) => [styles.side, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={selected ? colors.blue : colors.textSecondary} fill={selected ? colors.blue : "none"} />
    </Pressable>
  );
}

/** Seksjonsoverskrift med antall (små versaler) og ev. en lenke til høyre. */
function SectionHead({ title, count, testID, right }: { title: string; count: number | null; testID: string; right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel={count === null ? title : t.saved.sectionCount(title, count)} testID={testID}>
        {count ? `${title} · ${count}` : title}
      </Text>
      {right}
    </View>
  );
}

/** Tom seksjon: ikon, forklaring og (ev.) veien videre – i den samme hvite flaten som listene. */
function Empty({ icon, text, testID, children }: { icon: IconName; text: string; testID: string; children?: ReactNode }) {
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyRow}>
        <View style={styles.emptyIcon}>
          <Icon name={icon} size={18} color={colors.blue} />
        </View>
        <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{text}</Text>
      </View>
      {children}
    </View>
  );
}

/** Ruten som «Oslo → Barcelona», med byene på appens språk. */
function useRouteText() {
  const { locale } = useI18n();
  return (o: AirportChoice, d: AirportChoice) => `${localizedChoice(o, locale).city} → ${localizedChoice(d, locale).city}`;
}

/**
 * Lagret: fly, ruter, nylige søk, prisvarsler og favorittreisemål – bare på denne telefonen. Filtrene øverst viser
 * alt eller én del. Hver rad er én knapp med egne 44 pt-knapper ved siden av (aldri en knapp inni en knapp).
 *
 * Et lagret fly viser prisen kunden så da det ble lagret, med datoen – aldri som dagens pris; «Søk igjen» gir ferske.
 * En rute er to flyplasser uten datoer. Prisvarsler finnes ikke i appen ennå: seksjonen sier det, og viser kontoens
 * antall aktive varsler på hellosky.no når kontoen svarte.
 */
export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vis } = useLocalSearchParams<{ vis?: string }>();
  const app = useApp();
  const { saved, toggleSaved, recent, removeRecent, clearRecent, setForm, runSearch, savedFlights, toggleFlight, savedRoutes, toggleRoute } = app;
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const s = t.saved;
  const routeText = useRouteText();
  const [problem, setProblem] = useState<FormErrorCode | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(isFilter(vis) ? vis : "alle");
  // Åpnet fra Min side med et valg (f.eks. «Nylige søk»): filteret følger lenken.
  const [seenVis, setSeenVis] = useState(vis);
  if (vis !== seenVis) {
    setSeenVis(vis);
    if (isFilter(vis)) setFilter(vis);
  }
  const [openFlight, setOpenFlight] = useState<SavedFlight | null>(null);
  const destinations = savedDestinations(saved);
  const today = new Date();
  const show = (x: Filter) => filter === "alle" || filter === x;
  const counts: Record<Filter, number | null> = { alle: null, fly: savedFlights.length, ruter: savedRoutes.length, sok: recent.length, varsler: null, reisemal: destinations.length };

  const applyToSearch = (d: Destination) => {
    setForm((form) => ({ ...form, destination: destinationChoice(d, locale) }));
    setProblem(null);
    router.navigate("/");
  };
  const searchAgain = (r: RecentSearch) => {
    const err = runSearch(r);
    setProblem(err);
    if (!err) router.push("/resultater");
  };
  const chooseNewDates = (r: RecentSearch) => {
    setForm(() => withFreshDates(r));
    setProblem(null);
    router.navigate("/");
  };
  const applyRoute = (r: SavedRoute) => {
    setForm((form) => routeForm(r, form));
    setProblem(null);
    router.navigate("/");
  };
  const shareRoute = (r: SavedRoute) => {
    const url = webSearchUrlForForm(routeForm(r, initialForm()));
    if (url) Share.share({ message: s.shareRoute(routeText(r.origin, r.destination), url) }).catch(() => undefined);
  };
  const flightAgain = (fl: SavedFlight) => {
    const { form, freshDates } = flightSearch(fl);
    setOpenFlight(null);
    if (freshDates) {
      setForm(() => form);
      setProblem(null);
      router.navigate("/");
      return;
    }
    const err = runSearch(form);
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  return (
    <View style={styles.screen}>
      <FocusStatusBar style="dark" />
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space.xxxl, paddingHorizontal: space.lg, gap: space.md }} testID="saved-screen">
        <View style={{ gap: 2 }}>
          <View style={styles.titleRow}>
            <Text style={[type.title, { color: colors.text, flex: 1 }]} accessibilityRole="header" testID="saved-title">
              {s.title}
            </Text>
            <Pressable
              onPress={() => setInfoOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel={s.infoLabel}
              accessibilityState={{ expanded: infoOpen }}
              testID="saved-info"
              style={({ pressed }) => [styles.info, infoOpen && styles.infoOn, pressed && { opacity: 0.7 }]}
            >
              <Icon name="info" size={20} color={infoOpen ? colors.blue : colors.text} />
            </Pressable>
          </View>
          <Text style={[type.footnote, { color: colors.textSecondary }]} testID="saved-note">
            {s.shortNote}
          </Text>
          {infoOpen ? (
            <View style={styles.detail} testID="saved-note-detail">
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{s.deviceNote}</Text>
            </View>
          ) : null}
        </View>

        {/* Filtrene rulles sidelengs og går ut til skjermkantene; hvert filter sier antallet til VoiceOver. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent} accessibilityLabel={s.filterLabel} testID="saved-filters">
          {FILTERS.map((x) => {
            const n = counts[x];
            const label = s.filters[x];
            return <Chip key={x} dark={false} label={n ? `${label} ${n}` : label} accessibilityLabel={n === null ? label : s.filterCount(label, n)} selected={filter === x} onPress={() => setFilter(x)} testID={`saved-filter-${x}`} />;
          })}
        </ScrollView>

        {problem ? (
          <Banner tone="error" testID="saved-error">
            {formErrorText(problem, i18n)}
          </Banner>
        ) : null}

        {show("fly") ? (
          <View style={styles.section} testID="saved-flights">
            <SectionHead title={s.flightsTitle} count={savedFlights.length} testID="saved-flights-title" />
            {savedFlights.length ? (
              <View style={styles.list} testID="saved-flights-list">
                {savedFlights.map((fl, i) => (
                  <FlightRow key={fl.key} flight={fl} separated={i > 0} onOpen={() => setOpenFlight(fl)} onRemove={() => toggleFlight(fl)} />
                ))}
              </View>
            ) : (
              <Empty icon="plane" text={s.flightsEmpty} testID="saved-flights-empty">
                <LinkButton label={s.toSearch} onPress={() => router.navigate("/")} testID="saved-flights-to-search" />
              </Empty>
            )}
          </View>
        ) : null}

        {show("ruter") ? (
          <View style={styles.section} testID="saved-routes">
            <SectionHead title={s.routesTitle} count={savedRoutes.length} testID="saved-routes-title" />
            {savedRoutes.length ? (
              <View style={styles.list} testID="saved-routes-list">
                {savedRoutes.map((r, i) => {
                  const route = routeText(r.origin, r.destination);
                  const id = routeKey(r);
                  return (
                    <View key={id} style={[styles.row, i > 0 && styles.divider]} testID={`route-${id}`}>
                      <Pressable onPress={() => applyRoute(r)} accessibilityRole="button" accessibilityLabel={s.useRouteLabel(route)} accessibilityHint={s.useRouteHint} testID={`route-use-${id}`} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
                        <View style={styles.rowIcon}>
                          <Icon name="route" size={18} color={colors.textSecondary} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[type.calloutStrong, { color: colors.text }]}>{route}</Text>
                          <Text style={[type.footnote, { color: colors.textSecondary }]}>{`${r.origin.iata}‑${r.destination.iata}`}</Text>
                          <Text style={[type.footnoteStrong, { color: colors.blue }]}>{s.useRoute}</Text>
                        </View>
                      </Pressable>
                      <SideButton icon="share" label={s.shareLabel(route)} onPress={() => shareRoute(r)} testID={`route-share-${id}`} />
                      <SideButton icon="close" label={s.removeLabel(route)} onPress={() => toggleRoute(r.origin, r.destination)} testID={`route-remove-${id}`} />
                    </View>
                  );
                })}
              </View>
            ) : (
              <Empty icon="route" text={s.routesEmpty} testID="saved-routes-empty" />
            )}
          </View>
        ) : null}

        {show("sok") ? (
          <View style={styles.section} testID="recent-searches">
            <SectionHead title={s.recentTitle} count={recent.length} testID="recent-title" right={recent.length ? <LinkButton label={s.clearRecent} onPress={clearRecent} testID="recent-clear" /> : null} />
            {recent.length ? (
              <View style={styles.list} testID="recent-list">
                {recent.map((r, i) => {
                  const key = recentKey(r);
                  const id = `${r.origin.iata}-${r.destination.iata}-${r.departDate}`;
                  const route = `${r.origin.city} → ${r.destination.city}`;
                  // VoiceOver: hele datoer med ukedag. Hver dato holdes samlet («tor. 15. okt.» brytes aldri inni).
                  const day = (iso: string) => f.day(iso).replace(/ /g, " ");
                  const dates = r.tripType === "roundtrip" ? `${day(r.departDate)} – ${day(r.returnDate)}` : day(r.departDate);
                  // Synlig: kort datospenn som på forsiden («9.–16. okt.»), så raden holder seg på få linjer; én vei sies, så
                  // den ikke ser ut som en tur-retur samme dag. Linjen kan bare brytes mellom datoene.
                  const span = keepDatesTogether(f.dateSpan(r.departDate, r.tripType === "roundtrip" ? r.returnDate : null));
                  const when = r.tripType === "roundtrip" ? span : `${t.home.oneway} · ${span}`;
                  const people = `${passengerSummary(r, i18n)} · ${cabinLabel(r.cabinClass, i18n)}`;
                  const detail = `${dates} · ${people}`;
                  const past = recentIsPast(r, today);
                  const routeOn = savedRoutes.some((x) => routeKey(x) === routeKey(r));
                  return (
                    <View key={key} style={[styles.row, i > 0 && styles.divider]} testID={`recent-${id}`}>
                      <Pressable
                        onPress={() => (past ? chooseNewDates(r) : searchAgain(r))}
                        accessibilityRole="button"
                        accessibilityLabel={past ? `${s.chooseNewDatesLabel(route)}. ${s.datesPassed}: ${dates}` : s.searchAgainLabel(route, detail)}
                        accessibilityHint={past ? s.chooseNewDatesHint : undefined}
                        testID={past ? `recent-newdates-${id}` : `recent-again-${id}`}
                        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                      >
                        <View style={styles.rowIcon}>
                          <Icon name="clock" size={18} color={colors.textSecondary} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[type.calloutStrong, { color: colors.text }]}>{route}</Text>
                          {/* Nøyaktige flyplasskoder med ikke-brytende bindestrek (aldri «OSL–» / «BCN»), så datoene. */}
                          <Text style={[type.footnote, { color: past ? colors.textSecondary : colors.text }]}>{`${r.origin.iata}‑${r.destination.iata} · ${when}`}</Text>
                          <Text style={[type.footnote, { color: colors.textSecondary }]}>{people}</Text>
                          {past ? (
                            <View style={styles.past} testID={`recent-past-${id}`}>
                              <Icon name="alert" size={14} color={colors.warning} />
                              <Text style={[type.footnoteStrong, { color: colors.warning }]}>{s.datesPassed}</Text>
                            </View>
                          ) : null}
                          <Text style={[type.footnoteStrong, { color: colors.blue }]}>{past ? s.chooseNewDates : s.searchAgain}</Text>
                        </View>
                      </Pressable>
                      <SideButton
                        icon="bookmark"
                        label={routeOn ? s.unsaveRouteLabel(route) : s.saveRouteLabel(route)}
                        selected={routeOn}
                        onPress={() => {
                          toggleRoute(r.origin, r.destination);
                          AccessibilityInfo.announceForAccessibility(routeOn ? s.flightRemovedNotice : s.routeSaved);
                        }}
                        testID={`recent-route-${id}`}
                      />
                      <SideButton icon="close" label={s.removeLabel(route)} onPress={() => removeRecent(key)} testID={`recent-remove-${id}`} />
                    </View>
                  );
                })}
              </View>
            ) : (
              <Empty icon="clock" text={s.recentEmpty} testID="recent-empty" />
            )}
          </View>
        ) : null}

        {show("varsler") ? <AlertsSection /> : null}

        {show("reisemal") ? (
          <View style={styles.section} testID="saved-destinations">
            <SectionHead title={s.favouritesTitle} count={destinations.length} testID="saved-destinations-title" />
            {destinations.length ? (
              <View style={styles.list} testID="saved-destinations-list">
                {destinations.map((d, i) => {
                  const n = d.names[locale];
                  const airport = `${n.airport} (${d.iata})`;
                  return (
                    <View key={d.id} style={[styles.row, i > 0 && styles.divider]} testID={`saved-${d.id}`}>
                      <Pressable
                        onPress={() => applyToSearch(d)}
                        accessibilityRole="button"
                        accessibilityLabel={s.useInSearchLabel(n.city, airport)}
                        accessibilityHint={s.useInSearchHint}
                        testID={`saved-use-${d.id}`}
                        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                      >
                        <Image source={d.photo.image} style={styles.thumb} contentFit="cover" accessible={false} />
                        <View style={styles.rowText}>
                          <Text style={[type.calloutStrong, { color: colors.text }]}>{`${n.city}, ${n.country}`}</Text>
                          <Text style={[type.footnote, { color: colors.textSecondary }]} testID={`saved-airport-${d.id}`}>
                            {airport}
                          </Text>
                          <Text style={[type.footnoteStrong, { color: colors.blue }]}>{s.useInSearch}</Text>
                        </View>
                        <Icon name="chevronRight" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <SideButton icon="close" label={s.removeLabel(`${n.city} (${d.iata})`)} onPress={() => toggleSaved(d)} testID={`saved-remove-${d.id}`} />
                    </View>
                  );
                })}
              </View>
            ) : (
              <Empty icon="mapPin" text={s.destinationsEmpty} testID="saved-destinations-empty">
                <LinkButton label={s.toExplore} onPress={() => router.navigate("/utforsk")} testID="saved-to-explore" />
              </Empty>
            )}
          </View>
        ) : null}
      </ScrollView>
      <StatusBarShield tone="light" />
      <FlightSheet flight={openFlight} onClose={() => setOpenFlight(null)} onSearch={flightAgain} />
    </View>
  );
}

/**
 * Et lagret fly i listen: rute, koder og datoer, tider, flyselskap og bytter, og prisen kunden så med datoen – eller at
 * det ikke var en kronepris. DEMO står når dataene var demo. En reise som har gått, sier det.
 */
function FlightRow({ flight, separated, onOpen, onRemove }: { flight: SavedFlight; separated: boolean; onOpen: () => void; onRemove: () => void }) {
  const { t, f } = useI18n();
  const s = t.saved;
  const routeText = useRouteText();
  const out = flight.legs[0]!;
  const back = flight.legs[1];
  const route = routeText(out.origin, out.destination);
  const dates = keepDatesTogether(f.dateSpan(out.departingAt.slice(0, 10), back ? back.departingAt.slice(0, 10) : null));
  const times = `${formatTime(out.departingAt)}–${formatTime(out.arrivingAt)} · ${out.carriers.map((c) => c.name).join(", ")} · ${f.stopsSummary(flight.legs)}`;
  const savedDay = f.shortDay(flight.savedAt.slice(0, 10));
  const price = flight.seenPrice ? (flight.seenPrice.estimate ? t.price.approx(f.nok(flight.seenPrice.amountMinor)) : f.nok(flight.seenPrice.amountMinor)) : null;
  const past = flightIsPast(flight);
  const spokenPrice = flight.seenPrice ? s.seenPriceSpoken(flight.seenPrice.estimate ? t.price.approx(f.spokenNok(flight.seenPrice.amountMinor)) : f.spokenNok(flight.seenPrice.amountMinor), savedDay) : s.noSeenPrice;
  const id = flight.key.slice(0, 40);
  return (
    <View style={[styles.row, separated && styles.divider]} testID={`flight-${id}`}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={s.flightLabel(route, [dates, times, flight.demo ? s.demoSpoken : null, spokenPrice, past ? s.tripPassed : null].filter(Boolean).join(". "))}
        accessibilityHint={s.openFlightHint}
        testID={`flight-open-${id}`}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <View style={styles.rowIcon}>
          <Icon name="plane" size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.rowText}>
          <View style={styles.inline}>
            <Text style={[type.calloutStrong, { color: colors.text, flexShrink: 1 }]}>{route}</Text>
            {flight.demo ? (
              <View style={styles.demo}>
                <Text style={[type.caption, { color: colors.warning, fontWeight: "700" }]}>{s.demo}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[type.footnote, { color: past ? colors.textSecondary : colors.text }]}>{`${out.origin.iata}‑${out.destination.iata} · ${dates}`}</Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{times}</Text>
          <Text style={[type.footnoteStrong, type.tabular, { color: colors.text }]} testID={`flight-price-${id}`}>
            {price ? s.seenPrice(price, savedDay) : s.noSeenPrice}
          </Text>
          {past ? (
            <View style={styles.past}>
              <Icon name="alert" size={14} color={colors.warning} />
              <Text style={[type.footnoteStrong, { color: colors.warning }]}>{s.tripPassed}</Text>
            </View>
          ) : null}
        </View>
        <Icon name="chevronRight" size={18} color={colors.textSecondary} />
      </Pressable>
      <SideButton icon="close" label={s.removeLabel(route)} onPress={onRemove} testID={`flight-remove-${id}`} />
    </View>
  );
}

/**
 * Et lagret fly åpnet: hele reisen (hver strekning med tider, flyselskap, flynumre og bytter), klasse og reisende, og
 * prisen kunden så med dato og klokkeslett – med beskjed om at den kan ha endret seg. Handlingene: søk igjen (med
 * nye datoer når reisen har gått), del, lagre ruten, følg prisen (på hellosky.no inntil appen har prisvarsler) og fjern.
 */
function FlightSheet({ flight, onClose, onSearch }: { flight: SavedFlight | null; onClose: () => void; onSearch: (f: SavedFlight) => void }) {
  const { savedRoutes, toggleRoute, toggleFlight } = useApp();
  const i18n = useI18n();
  const { t, f } = i18n;
  const s = t.saved;
  const routeText = useRouteText();
  const out = flight?.legs[0];
  if (!flight || !out) return <BottomSheet visible={false} title={s.flightSheetTitle} onClose={onClose}>{null}</BottomSheet>;
  const back = flight.legs[1];
  const route = routeText(out.origin, out.destination);
  const dates = keepDatesTogether(f.dateSpan(out.departingAt.slice(0, 10), back ? back.departingAt.slice(0, 10) : null));
  const past = flightIsPast(flight);
  const routeOn = savedRoutes.some((r) => routeKey(r) === routeKey(out));
  const saved = new Date(flight.savedAt);
  const when = `${f.shortDay(flight.savedAt.slice(0, 10))} ${String(saved.getHours()).padStart(2, "0")}:${String(saved.getMinutes()).padStart(2, "0")}`;
  const price = flight.seenPrice ? (flight.seenPrice.estimate ? t.price.approx(f.nok(flight.seenPrice.amountMinor)) : f.nok(flight.seenPrice.amountMinor)) : null;
  const share = () => {
    const url = webSearchUrlForForm(flightSearch(flight).form);
    if (url) Share.share({ message: s.shareFlight(route, dates, url) }).catch(() => undefined);
  };
  return (
    <BottomSheet visible title={s.flightSheetTitle} onClose={onClose} testID="flight-sheet">
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <Text style={[type.section, { color: colors.text }]} accessibilityRole="header">
            {route}
          </Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{`${dates} · ${passengerSummary(flight.query, i18n)} · ${cabinLabel(flight.cabinClass, i18n)}`}</Text>
        </View>
        {flight.legs.map((l, i) => (
          <View key={i} style={styles.leg} testID={`flight-leg-${i}`}>
            <Text style={[type.footnoteStrong, { color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 }]}>{`${i === 0 ? s.outbound : s.inbound} · ${f.day(l.departingAt.slice(0, 10))}`}</Text>
            <Text style={[type.timeLarge, { color: colors.text }]}>{`${formatTime(l.departingAt)} – ${formatTime(l.arrivingAt)}`}</Text>
            <Text style={[type.callout, { color: colors.text }]}>{`${l.origin.iata}‑${l.destination.iata} · ${f.duration(l.durationMinutes)} · ${f.stops(l.stops)}`}</Text>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{`${l.carriers.map((c) => c.name).join(", ")} · ${s.flightNumbers(l.flightNumbers.join(", "))}`}</Text>
          </View>
        ))}
        <View style={styles.seen} testID="flight-seen">
          <Icon name="clock" size={16} color={colors.textSecondary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.footnote, { color: colors.text }]}>{price ? s.seenAt(price, when) : s.noSeenPrice}</Text>
            {flight.seenPrice?.estimate ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{s.seenEstimate}</Text> : null}
            {flight.demo ? <Text style={[type.footnoteStrong, { color: colors.warning }]}>{s.demoSpoken}</Text> : null}
          </View>
        </View>
        <PrimaryButton label={past ? s.searchNewDates : s.searchAgain} onPress={() => onSearch(flight)} testID="flight-search" />
        <View style={styles.sheetActions}>
          <SecondaryButton label={s.share} icon="share" onPress={share} testID="flight-share" />
          <SecondaryButton label={routeOn ? s.routeSaved : s.saveRoute} icon="bookmark" onPress={() => (routeOn ? undefined : toggleRoute(out.origin, out.destination))} testID="flight-save-route" />
        </View>
        <View style={styles.follow} testID="flight-follow">
          <Text style={[type.footnoteStrong, { color: colors.text }]}>{s.followPrice}</Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{s.followPriceNote}</Text>
          <LinkButton label={s.followOnWeb} onPress={() => openWeb(WEB_PAGES.priceWatches)} testID="flight-follow-web" />
        </View>
        <LinkButton
          label={s.removeFlight}
          onPress={() => {
            toggleFlight(flight);
            onClose();
          }}
          testID="flight-remove"
        />
      </ScrollView>
    </BottomSheet>
  );
}

/**
 * Prisvarsler: ikke i appen ennå – det sies rett ut. Innlogget med en konto som svarte: antallet aktive varsler på
 * hellosky.no og lenken dit. Gjest: hva en konto gir, og «Logg inn» (Min side).
 */
function AlertsSection() {
  const router = useRouter();
  const { auth } = useApp();
  const account = useAccountData();
  const { t } = useI18n();
  const s = t.saved;
  const signedIn = auth.status === "signedIn";
  const hub = account.status === "ready" ? account.hub : null;
  return (
    <View style={styles.section} testID="saved-alerts">
      <SectionHead title={s.alertsTitle} count={null} testID="saved-alerts-title" />
      <Empty icon="bell" text={signedIn ? s.alertsSignedIn : s.alertsGuest} testID="saved-alerts-card">
        {hub ? (
          <Text style={[type.footnoteStrong, { color: colors.text }]} testID="saved-alerts-count">
            {s.alertsCount(hub.priceWatches)}
          </Text>
        ) : null}
        {signedIn ? <LinkButton label={s.alertsOpen} onPress={() => openWeb(WEB_PAGES.priceWatches)} testID="saved-alerts-web" /> : <LinkButton label={s.alertsLogin} onPress={() => router.navigate("/profil")} testID="saved-alerts-login" />}
      </Empty>
    </View>
  );
}

const styles = StyleSheet.create({
  // «Cloud + Graphite»: lys grunn; overskrifter i `text`, hjelpetekst i `textSecondary` (5,3:1 på grunnen).
  screen: { flex: 1, backgroundColor: colors.canvas },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  // «Om Lagret»: lys ikonknapp (hvit med lys kant); åpen er den svakt blå med blå kant, som et valgt lagre-merke.
  info: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  infoOn: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  // Hele forklaringen i et hvitt kort på grunnen (sekundærtekst 5,8:1 på hvitt).
  detail: { marginTop: space.xs, padding: space.md, borderRadius: radius.input, backgroundColor: colors.white },
  // Filtrene går ut til skjermkantene og ruller under dem; første og siste står på sidemargen.
  filters: { flexGrow: 0, marginHorizontal: -space.lg },
  filtersContent: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.xs },
  section: { gap: space.xs },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH },
  sectionTitle: { ...type.footnoteStrong, color: colors.text, textTransform: "uppercase", letterSpacing: 0.6, flexShrink: 1 },
  // Én hvit gruppe med tynne skiller – ikke et stort kort per rad.
  list: { borderRadius: radius.input, backgroundColor: colors.white, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingLeft: space.md, paddingRight: space.xs },
  pressed: { backgroundColor: colors.inset },
  rowText: { flex: 1, gap: 1 },
  rowIcon: { width: 32, alignItems: "center" },
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  demo: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.warningSoft },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.inset },
  past: { flexDirection: "row", alignItems: "center", gap: 4 },
  side: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
  // Tom seksjon: samme hvite flate, med et lite blått ikon, teksten og ev. lenken.
  empty: { gap: space.xs, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xs, borderRadius: radius.input, backgroundColor: colors.white, minHeight: 64 },
  emptyRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start", paddingBottom: space.sm },
  emptyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  leg: { gap: 2, padding: space.md, borderRadius: radius.input, backgroundColor: colors.inset },
  seen: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder },
  sheetActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  follow: { gap: 2, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
});
