import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable as RNPressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Pressable, Switch, Text } from "../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StatusBarShield } from "../components/StatusBarShield";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileOffer } from "@contracts/mobileSearch";
import { shownAnswer, useApp } from "../lib/appState";
import { fxNotice, priceDisplay } from "../lib/price";
import { formatClock, keepDatesTogether } from "../lib/format";
import { ApiError } from "../lib/api";
import { errorText } from "../lib/errorText";
import { exclusionSummary, pricesStale, providerDisplayName, resultKind, totalConfirmed } from "../lib/resultStatus";
import { useA11yLanguage, useI18n } from "../i18n";
import type { FormErrorCode } from "../i18n/ns/search";
import { cabinLabel, formErrorText, passengerSummary, type SearchForm } from "../lib/searchForm";
import { nightsBetween } from "../lib/calendar";
import { animateNextLayout, MOTION_MS, reducedMotionNow, useReducedMotion } from "../lib/motion";
import {
  activeFilterCount,
  airlineOptions,
  applyView,
  averageLegMinutes,
  clearedFilters,
  connectionOptions,
  countWith,
  journeyCount,
  journeysVia,
  legThresholds,
  priceThresholds,
  SORT_TABS,
  SORTS,
  STOPS,
  TIME_BANDS,
  topFor,
  type BandKey,
  type ResultsView,
  type SortKey,
  type TimeBand,
} from "../lib/resultsView";
import { activeFilterChips } from "../lib/filterChips";
import { nearbyDates } from "../lib/nearbyDates";
import { groupJourneys, type Journey } from "../lib/journeys";
import { OfferCard } from "../components/OfferCard";
import { DateRangeSheet } from "../components/RangeCalendar";
import { TravellersSheet } from "../components/TravellersSheet";
import { SearchPanel } from "../components/SearchPanel";
import { SortTabs, type SortTab } from "../components/SortTabs";
import { ResultsSkeleton } from "../components/ResultsSkeleton";
import { Banner, BottomSheet, Chip, DemoBadge, IconButton, PrimaryButton, SecondaryButton, Segmented, StateView, type NoticeItem } from "../components/ui";
import { LightNotices } from "../components/LightNotices";
import { Icon, type IconName } from "../components/Icon";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

const BAND_ICON: Record<TimeBand, IconName> = { night: "moon", morning: "sunrise", afternoon: "sun", evening: "sunset" };

/** Knapp i den flytende verktøylinjen nederst. */
function ToolButton({ icon, label, onPress, badge, testID, primary }: { icon: IconName; label: string; onPress: () => void; badge?: number; testID: string; primary?: boolean }) {
  const { t } = useI18n();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? t.common.activeCount(label, badge) : label}
      style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.toolIcon, primary && { backgroundColor: colors.blue }]}>
        <Icon name={icon} size={16} color={colors.white} />
        {badge ? (
          <View style={styles.toolBadge}>
            <Text style={styles.toolBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[type.footnoteStrong, { color: colors.onDark }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Datoene eller de reisende i ruteoverskriften: en lys brikke på grafitt (som brikkene i søkeøya på forsiden), selv
 * 44 pt høy. Et trykk åpner arket som endrer akkurat det. Synlig: kort («23.–30. okt.»); VoiceOver hører hele datoene
 * eller hele teksten, og hva et trykk gjør. Teksten brytes heller enn å kuttes (stor tekst).
 */
function SummaryChip({ icon, label, spoken, hint, onPress, testID }: { icon: IconName; label: string; spoken: string; hint: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint={hint} style={({ pressed }) => [styles.summaryChip, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={15} color={colors.onDarkMuted} />
      <Text style={[type.footnoteStrong, styles.summaryText]}>{label}</Text>
      <Icon name="chevronDown" size={14} color={colors.onDarkMuted} />
    </Pressable>
  );
}

/** Radioknapp-rad i arkene. */
/**
 * Et valg i arket. `plain`: en avkrysningsliste der avkrysset er standard (alle flyplasser tillatt) – raden
 * fremheves ikke, bare haken viser valget, så det som skiller seg ut er det kunden har slått av.
 */
function OptionRow({ label, detail, selected, disabled, onPress, testID, multi, plain }: { label: string; detail?: string; selected: boolean; disabled?: boolean; onPress: () => void; testID?: string; multi?: boolean; plain?: boolean }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={multi ? { checked: selected, disabled: !!disabled } : { selected, disabled: !!disabled }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.option, selected && !plain && styles.optionSelected, disabled && { opacity: 0.4 }, pressed && (plain || !selected) && { opacity: 0.7 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{label}</Text>
      {detail ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{detail}</Text> : null}
    </Pressable>
  );
}

/** Kan et nytt forsøk hjelpe? Nett, tidsavbrudd, travelt og leverandørbrudd: ja. Ugyldig søk o.l.: nei. */
const RETRY_CODES = new Set(["NETWORK", "TIMEOUT", "BAD_RESPONSE", "RATE_LIMITED", "INTERNAL", "SUPPLIER_UNAVAILABLE", "SUPPLIER_TIMEOUT"]);
function canRetry(err: unknown): boolean {
  return !(err instanceof ApiError) || err.retryable || RETRY_CODES.has(err.code);
}

type FilterSheetProps = {
  visible: boolean;
  all: MobileOffer[];
  view: ResultsView;
  setView: (update: (v: ResultsView) => ResultsView) => void;
  confirmed: boolean;
  hasReturn: boolean;
};

/**
 * Filterarkets innhold. Hvert valg viser hvor mange reiser det gir – én gjennomgang av tilbudene per valg – så det
 * regnes bare mens arket er åpent. Lukket står det siste innholdet stille (også mens arket glir ned), og ingenting
 * regnes på nytt når listen tegnes (klokken, fanene, brikkene). Før arket er åpnet første gang, finnes det ikke.
 */
const FilterSheetBody = memo(function FilterSheetBody({ visible, all, view, ...rest }: FilterSheetProps) {
  const [shown, setShown] = useState<{ all: MobileOffer[]; view: ResultsView } | null>(visible ? { all, view } : null);
  if (visible && (shown?.all !== all || shown?.view !== view)) setShown({ all, view });
  const current = visible ? { all, view } : shown;
  if (!current) return null;
  return <FilterSheetContent all={current.all} view={current.view} {...rest} />;
});

const FilterSheetContent = memo(function FilterSheetContent({ all, view, setView, confirmed, hasReturn }: Omit<FilterSheetProps, "visible">) {
  const lang = useA11yLanguage();
  const { t, f } = useI18n();
  const r = t.results.screen;
  const reiser = t.results.journeys;
  // Tidsfiltrene: avgang eller ankomst vises for hver vei (begge kan være på samtidig).
  const [timeMode, setTimeMode] = useState<{ out: "depart" | "arrive"; back: "depart" | "arrive" }>({ out: "depart", back: "depart" });
  // Valgene kommer fra svaret og endres bare med det.
  const options = useMemo(() => ({ airlines: airlineOptions(all), prices: priceThresholds(all), legs: legThresholds(all), connections: connectionOptions(all) }), [all]);
  const { airlines, prices, legs, connections } = options;
  // Antall reiser et valg ville gitt (uten sortering – rekkefølgen betyr ingenting for en telling).
  const shownFor = (patch: Partial<ResultsView>) => journeyCount(all, { ...view, ...patch });
  const bandGroup = (key: BandKey, hint: string, prefix: string) => (
    <View style={{ gap: space.sm }}>
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{hint}</Text>
      <View style={styles.bands}>
        {TIME_BANDS.map((b) => {
          const selected = view[key].includes(b.value);
          const n = shownFor({ [key]: [b.value] } as Partial<ResultsView>);
          const disabled = n === 0 && !selected;
          return (
            <Pressable
              key={b.value}
              testID={`${prefix}-${b.value}`}
              onPress={() => setView((v) => ({ ...v, [key]: selected ? v[key].filter((x) => x !== b.value) : [...v[key], b.value] }))}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={r.bandSpoken(t.results.bands[b.value], b.range, reiser(n))}
              style={({ pressed }) => [styles.band, selected && styles.bandOn, disabled && { opacity: 0.4 }, pressed && !selected && { opacity: 0.7 }]}
            >
              <View style={styles.bandTop}>
                <Text style={[type.footnote, { color: selected ? colors.white : colors.textSecondary }]}>{t.results.bands[b.value]}</Text>
                <Icon name={BAND_ICON[b.value]} size={18} color={selected ? colors.white : colors.text} strokeWidth={1.75} />
              </View>
              <Text style={[type.bodyStrong, type.tabular, { color: selected ? colors.white : colors.text }]}>{b.range}</Text>
              <Text style={[type.caption, { color: selected ? colors.white : colors.textSecondary }]}>{reiser(n)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  // Én vei (ut) eller hjem: velg avgang eller ankomst, så tidsrommene for den. Et prikkmerke viser at det andre
  // valget også har et filter på. VoiceOver hører hvilken vei valget gjelder («Hjemreise: Ankomst»).
  const timeGroup = (leg: "out" | "back") => {
    const mode = timeMode[leg];
    const keys: Record<"depart" | "arrive", BandKey> = leg === "out" ? { depart: "departBands", arrive: "arriveBands" } : { depart: "returnBands", arrive: "returnArriveBands" };
    const title = leg === "back" ? r.timesBack : hasReturn ? r.timesOut : r.timesOneWay;
    const hint = leg === "out" ? (mode === "depart" ? r.departHint : r.arriveHint) : mode === "depart" ? r.returnHint : r.returnArriveHint;
    const option = (value: "depart" | "arrive") => {
      const on = view[keys[value]].length > 0;
      const spoken = `${title}: ${r.timeMode[value]}`;
      return { value, label: r.timeMode[value], dot: on, spoken: on ? r.timeModeActive(spoken) : spoken };
    };
    return {
      key: `times-${leg}`,
      title,
      body: (
        <View style={{ gap: space.sm }} testID={`times-${leg}`}>
          <Segmented
            value={mode}
            label={r.timeModeLabel(title)}
            testIDPrefix={`times-${leg}-`}
            options={[option("depart"), option("arrive")]}
            onChange={(m) => setTimeMode((tm) => ({ ...tm, [leg]: m }))}
          />
          {bandGroup(keys[mode], hint, leg === "out" ? (mode === "depart" ? "band" : "arrive-band") : mode === "depart" ? "return-band" : "return-arrive-band")}
        </View>
      ),
    };
  };

  // Arket er langt: hver del har en overskrift som blir stående øverst mens delen rulles forbi, og som VoiceOver kan
  // hoppe mellom (overskrifter i rotoren).
  const sections: { key: string; title?: string; body: ReactNode }[] = [
    {
      key: "stops",
      title: r.stopsTitle,
      body: (
        <View accessibilityLanguage={lang} style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.stopsTitle}>
          {STOPS.map((value) => {
            const n = shownFor({ stops: value });
            const selected = view.stops === value;
            return <OptionRow key={value} testID={`stops-${value}`} label={t.results.stops[value]} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, stops: value }))} />;
          })}
        </View>
      ),
    },
    {
      key: "bags",
      body: (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{r.bagsTitle}</Text>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.bagsDetail(reiser(shownFor({ bags: true })))}</Text>
          </View>
          <Switch
            testID="bags-switch"
            accessibilityLabel={r.bagsTitle}
            value={view.bags}
            disabled={!view.bags && !shownFor({ bags: true })}
            onValueChange={(bags) => setView((v) => ({ ...v, bags }))}
            trackColor={{ true: colors.blue, false: colors.lightBorder }}
          />
        </View>
      ),
    },
    timeGroup("out"),
    ...(hasReturn ? [timeGroup("back")] : []),
    ...(airlines.length > 1
      ? [
          {
            key: "airlines",
            title: r.airlinesTitle,
            body: (
              <View style={{ gap: space.sm }} accessibilityLabel={r.airlinesTitle}>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.airlinesHint}</Text>
                {airlines.map((a) => {
                  const selected = view.airlines.includes(a.iata);
                  const n = shownFor({ airlines: [a.iata] });
                  return (
                    <OptionRow
                      key={a.iata}
                      multi
                      testID={`airline-${a.iata}`}
                      label={r.airlineRow(a.name, a.iata)}
                      detail={reiser(n)}
                      selected={selected}
                      disabled={!n && !selected}
                      onPress={() => setView((v) => ({ ...v, airlines: selected ? v.airlines.filter((x) => x !== a.iata) : [...v.airlines, a.iata] }))}
                    />
                  );
                })}
              </View>
            ),
          },
        ]
      : []),
    ...(connections.length
      ? [
          {
            key: "via",
            title: r.viaTitle,
            body: (
              <View style={{ gap: space.sm }} accessibilityLabel={r.viaTitle} testID="via-group">
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.viaHint}</Text>
                {connections.map((c) => {
                  const allowed = !view.avoidConnections.includes(c.iata);
                  const n = journeysVia(all, view, c.iata);
                  return (
                    <OptionRow
                      key={c.iata}
                      multi
                      plain
                      testID={`via-${c.iata}`}
                      label={r.viaRow(c.city, c.iata)}
                      detail={reiser(n)}
                      selected={allowed}
                      disabled={!n && allowed}
                      onPress={() => setView((v) => ({ ...v, avoidConnections: allowed ? [...v.avoidConnections, c.iata] : v.avoidConnections.filter((x) => x !== c.iata) }))}
                    />
                  );
                })}
              </View>
            ),
          },
        ]
      : []),
    ...(prices.length && confirmed
      ? [
          {
            key: "price",
            title: r.priceTitle,
            body: (
              <View accessibilityLanguage={lang} style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.priceTitle}>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.priceHint}</Text>
                <OptionRow testID="price-any" label={r.anyPrice} detail={reiser(shownFor({ maxPriceMinor: null }))} selected={view.maxPriceMinor === null} onPress={() => setView((v) => ({ ...v, maxPriceMinor: null }))} />
                {prices.map((p) => {
                  const n = shownFor({ maxPriceMinor: p });
                  const selected = view.maxPriceMinor === p;
                  return <OptionRow key={p} testID={`price-${p}`} label={r.upTo(f.nok(p))} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, maxPriceMinor: p }))} />;
                })}
              </View>
            ),
          },
        ]
      : []),
    ...(legs.length
      ? [
          {
            key: "legs",
            title: r.legTitle,
            body: (
              <View accessibilityLanguage={lang} style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.legTitle}>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.legHint}</Text>
                <OptionRow testID="leg-any" label={r.anyLength} detail={reiser(shownFor({ maxLegMinutes: null }))} selected={view.maxLegMinutes === null} onPress={() => setView((v) => ({ ...v, maxLegMinutes: null }))} />
                {legs.map((m) => {
                  const n = shownFor({ maxLegMinutes: m });
                  const selected = view.maxLegMinutes === m;
                  return <OptionRow key={m} testID={`leg-${m}`} label={r.upTo(f.duration(m))} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, maxLegMinutes: m }))} />;
                })}
              </View>
            ),
          },
        ]
      : []),
  ];
  // Overskriftene som direkte barn av rullefeltet (så de kan bli stående), hver rett før sin del.
  const children: ReactNode[] = [];
  const sticky: number[] = [];
  sections.forEach((sec, i) => {
    if (sec.title) {
      sticky.push(children.length);
      children.push(
        <View key={`${sec.key}-title`} style={[styles.sectionHead, i === 0 && { paddingTop: 0 }]} testID={`filter-head-${sec.key}`}>
          <Text style={[type.bodyStrong, { color: colors.text }]} accessibilityRole="header">
            {sec.title}
          </Text>
        </View>,
      );
    }
    children.push(
      <View key={sec.key} style={!sec.title && i > 0 ? { paddingTop: space.lg } : undefined}>
        {sec.body}
      </View>,
    );
  });

  return (
    <ScrollView stickyHeaderIndices={sticky} testID="filter-screen">
      {children}
    </ScrollView>
  );
});

export default function ResultsScreen() {
  const lang = useA11yLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { search, runSearch, cancelSearch, form, setForm, view: storedView, setView } = useApp();
  const i18n = useI18n();
  const { t, f } = i18n;
  const r = t.results.screen;
  const reiser = t.results.journeys;
  const reduced = useReducedMotion();
  // Stabil, så kortene (memo) ikke tegnes på nytt ved hver endring i listen.
  const openOffer = useCallback((id: string) => router.push({ pathname: "/tilbud/[id]", params: { id } }), [router]);
  const onDates = useCallback((d: { departDate: string; returnDate: string }) => setForm((f) => ({ ...f, ...d })), [setForm]);
  // Klokke for «prisene kan ha endret seg»: oppdateres hvert halve minutt.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const [sheet, setSheet] = useState<null | "filter" | "sort" | "dates" | "travellers">(null);
  const listRef = useRef<FlatList<Journey>>(null);

  // Ankomst etter et søk: ruten og brikkene tones inn og glir 8 pt på plass mens skjermen skyves inn, så søkeøya fra
  // forsiden «blir» overskriften. Skyvingen mellom skjermene er iOS' egen og er urørt. Bare når vi vet at «Reduser
  // bevegelse» er av – ellers (eller før iOS har svart) står alt på plass fra første bilde.
  const [arrival] = useState(() => {
    const moving = reducedMotionNow() === false;
    return { moving, progress: new Animated.Value(moving ? 0 : 1) };
  });
  useEffect(() => {
    if (!arrival.moving) return;
    let active = true;
    const anim = Animated.timing(arrival.progress, { toValue: 1, duration: MOTION_MS, delay: 80, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    // Avbrutt mens skjermen står: rett på plass, aldri halvveis gjennomsiktig. (Når lastingen blir til en liste midt i
    // ankomsten, bygges øya på nytt i samme tegning; React Native kobler da verdien over uten å stoppe animasjonen.)
    anim.start(({ finished }) => {
      if (!finished && active) arrival.progress.setValue(1);
    });
    return () => {
      active = false;
      anim.stop();
    };
  }, [arrival]);
  const settle = useMemo(() => ({ opacity: arrival.progress, transform: [{ translateY: arrival.progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }), [arrival]);

  // ─── Søket i toppen: kompakt (ruten og to brikker) eller åpent som hele søkeskjemaet ───────────────────────────
  // «Endre søk» (ruten, søkeknappen, knappene i tomme tilstander) åpner søket der det står – ruteoverskriften vokser til
  // den samme søkeøya som på forsiden, og krymper tilbake når kunden søker eller lukker. Ingen tur til forsiden.
  const [editing, setEditing] = useState(false);
  // Endringer herfra starter alltid fra søket som vises (overskriften) – ikke fra et skjema som er endret uten å søke –
  // så «Søk fly» og «Søk på nytt» aldri tar med noe kunden ikke ser. Uten et søk (åpnet fra en lenke) er skjemaet det
  // som vises.
  const fromShown = () => {
    if (search.status !== "idle") setForm(() => search.query);
  };
  // VoiceOver følger forvandlingen: til overskriften i skjemaet når det åpnes, tilbake til ruten når det lukkes.
  const focusAfter = useRef<"editor" | "route" | null>(null);
  const editorTitle = useRef<ComponentRef<typeof RNText>>(null);
  const routeButton = useRef<ComponentRef<typeof RNPressable>>(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const node = target === "editor" ? editorTitle.current : routeButton.current;
    if (node) AccessibilityInfo.sendAccessibilityEvent?.(node, "focus");
  }, [editing]);
  const openEditor = () => {
    fromShown();
    // Ruten og brikkene forsvinner nå; kommer de tilbake, skal de stå helt på plass – også om kunden var raskere enn
    // ankomsten.
    if (arrival.moving) arrival.progress.setValue(1);
    // Øya vokser der den står; er listen rullet ned, går den først til toppen, så hele skjemaet synes.
    listRef.current?.scrollToOffset({ offset: 0, animated: !reduced });
    animateNextLayout(reduced);
    focusAfter.current = "editor";
    setEditing(true);
  };
  const collapse = () => {
    animateNextLayout(reduced);
    focusAfter.current = "route";
    setEditing(false);
  };
  // «Lukk» uten å søke: skjemaet blir igjen søket som vises, og listen står som før.
  const closeEditor = () => {
    fromShown();
    collapse();
  };
  // Et gyldig søk fra skjemaet i øya er allerede startet (SearchPanel); øya krymper til ruten og brikkene, som nå
  // viser det nye søket, og listen under viser at det lastes – samme flyt som et søk fra forsiden.
  const searched = collapse;

  // Datoer og reisende rett fra brikkene (og «Datoer» i verktøylinjen): arket endrer skjemaet, og «Søk på nytt» søker
  // med én gang. «Ferdig» lukker uten å søke. En feil i skjemaet (f.eks. en dato som har passert mens appen sto åpen)
  // står i arket, over knappen, til skjemaet endres.
  const [sheetProblem, setSheetProblem] = useState<{ code: FormErrorCode; form: SearchForm } | null>(null);
  const quickEdit = (which: "dates" | "travellers") => {
    fromShown();
    setSheetProblem(null);
    setSheet(which);
  };
  const searchFromSheet = () => {
    const err = runSearch();
    if (err) {
      setSheetProblem({ code: err, form });
      return;
    }
    setSheet(null);
  };

  // Den flytende linjens faktiske høyde (stor tekst gjør den høyere), så det siste kortet kan rulles helt over den.
  const [toolbarHeight, setToolbarHeight] = useState(0);
  // Statuslinjen følger det som står under den: lys tekst over grafittøya øverst. Når øya har rullet ut under
  // statuslinjen, mørk tekst og en lys skjerm over grunnen, så kortene ikke glir inn under klokken (som på forsiden).
  const headerHeight = useRef(0);
  const [pastHeader, setPastHeader] = useState(false);
  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setPastHeader(headerHeight.current > 0 && e.nativeEvent.contentOffset.y > headerHeight.current - insets.top),
    [insets.top],
  );
  // En treg leverandør: si fra etter en stund, i stedet for å bare vise en
  // spinner. Tidtakeren merker akkurat dette søket; et nytt søk starter på nytt.
  const [slowSearch, setSlowSearch] = useState<object | null>(null);
  useEffect(() => {
    if (search.status !== "loading") return;
    const t = setTimeout(() => setSlowSearch(search), 8_000);
    return () => clearTimeout(t);
  }, [search]);
  const slow = search.status === "loading" && slowSearch === search;

  // Svaret som vises: det ferdige, eller det forrige mens samme søk oppdateres (dra ned, «Oppdater prisene»).
  const answer = useMemo(() => shownAnswer(search), [search]);
  const refreshing = search.status === "loading" && !!search.previous;
  // Startet oppdateringen med «dra ned», viser iOS sin egen spinner øverst. Startet den fra lenken eller arket, er linjen
  // over fanene nok – listen skal ikke hoppe ned.
  const [pulled, setPulled] = useState(false);
  if (pulled && !refreshing) setPulled(false);
  // Uten et svar vises ingen liste; neste liste starter øverst, med øya under statuslinjen.
  if (pastHeader && !answer) setPastHeader(false);
  const offers = answer ? answer.result.offers : null;
  // Ubekreftet total: et prisfilter («Opptil 3 000 kr») ville vært et løfte om en total. Det tas bort – også i den
  // første tegningen av svaret, før effekten under har rukket å nullstille det lagrede valget (liste, tall og brikker).
  const unconfirmedTotal = !!answer && !totalConfirmed(answer.result);
  const view = useMemo(() => (unconfirmedTotal && storedView.maxPriceMinor !== null ? { ...storedView, maxPriceMinor: null } : storedView), [unconfirmedTotal, storedView]);
  useEffect(() => {
    if (unconfirmedTotal && storedView.maxPriceMinor !== null) setView((v) => ({ ...v, maxPriceMinor: null }));
  }, [unconfirmedTotal, storedView.maxPriceMinor, setView]);
  const shown = useMemo(() => (offers ? applyView(offers, view) : []), [offers, view]);
  const journeys = useMemo(() => groupJourneys(shown), [shown]);
  // Best / Billigst / Raskest: hva som står øverst med hver sortering, med filtrene som gjelder. Ekte tall fra svaret.
  const sortTabs = useMemo<SortTab[]>(() => {
    if (!offers) return [];
    return SORT_TABS.map((key) => {
      const top = topFor(offers, view, key);
      const d = top ? priceDisplay(top.best.price, i18n) : null;
      const avg = top ? averageLegMinutes(top.best) : null;
      const oneWay = top ? top.best.offer.slices.length === 1 : true;
      const label = i18n.t.results.sorts[key].label;
      // Synlig: bare reisetiden (per vei), så den får plass i en smal fane. VoiceOver sier «i snitt … per vei».
      const detail = avg ? i18n.f.duration(avg) : null;
      const nok = top?.best.price.nok;
      const spokenPrice = !nok || nok.kind === "unavailable" ? "" : nok.kind === "converted" ? i18n.t.results.tabs.spokenApprox(i18n.f.spokenNok(nok.amountMinor)) : i18n.f.spokenNok(nok.amountMinor);
      return { key, label, price: d?.available ? d.primary : null, detail, spoken: i18n.t.results.tabs.spoken(label, spokenPrice, avg ? i18n.f.spokenDuration(avg) : "", oneWay) };
    });
  }, [offers, view, i18n]);

  const doneCount = answer ? groupJourneys(answer.result.offers).length : null;
  // VoiceOver: si fra én gang når et søk er ferdig – hvor mange reiser, eller hva som gikk galt. En oppdatering av
  // samme søk sier at prisene er oppdatert, eller at det feilet (listen står da).
  const refreshedFrom = useRef(false);
  useEffect(() => {
    if (search.status === "loading") {
      refreshedFrom.current = !!search.previous;
      // Linjen over fanene leses ikke opp av seg selv på iOS: VoiceOver hører at prisene oppdateres.
      if (search.previous) AccessibilityInfo.announceForAccessibility(r.status.refreshingSpoken);
      return;
    }
    const refresh = refreshedFrom.current;
    refreshedFrom.current = false;
    let text: string | null = null;
    if (search.status === "done") {
      // Antallet kunden ser: med filtrene som står (de står gjennom en oppdatering).
      const found = t.results.journeys(journeys.length);
      const why = search.refreshError ? errorText(search.refreshError, i18n) : null;
      text = why !== null ? (search.result.offers.length ? r.status.refreshFailed(why, formatClock(new Date(search.at))) : r.status.refreshFailedEmpty(why)) : refresh ? r.status.refreshed(found) : r.announceFound(found);
    } else if (search.status === "error") {
      text = errorText(search.error, i18n);
    }
    if (text) AccessibilityInfo.announceForAccessibility(text);
    // Bare når søket endrer seg – ikke ved hver tegning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const filters = activeFilterCount(view);

  // Overskriften beskriver søket som vises – ikke et skjema som er endret etterpå uten å søke.
  const q = search.status === "idle" ? form : search.query;
  const title = q.origin && q.destination ? `${q.origin.city} → ${q.destination.city}` : r.fallbackTitle;
  const routeSpoken = q.origin && q.destination ? r.header.routeSpoken(q.origin.city, q.destination.city) : r.fallbackTitle;
  // Datoene: kort på brikken («23.–30. okt.»; én vei sier det), hele datoene og antall netter for VoiceOver.
  const roundTrip = q.tripType === "roundtrip";
  const span = keepDatesTogether(f.dateSpan(q.departDate, roundTrip ? q.returnDate : null));
  const datesLabel = roundTrip ? span : r.header.datesOneWay(span);
  const datesSummary = t.calendar.summarySpoken(f.longDay(q.departDate), roundTrip ? f.longDay(q.returnDate) : null, roundTrip ? t.calendar.nights(nightsBetween(q.departDate, q.returnDate)) : null);
  const datesSpoken = roundTrip ? datesSummary : r.header.datesOneWaySpoken(datesSummary);
  // Reisende og klasse (og «Direkte» når søket bare gjaldt direktefly); tallet og ordet holdes sammen («2 voksne»).
  const travellersLabel = [passengerSummary(q, i18n).replace(/(\d) /g, "$1\u00A0"), cabinLabel(q.cabinClass, i18n), ...(q.directOnly ? [r.chips.direct] : [])].join(" · ");
  const travellersSpoken = r.header.travellersSpoken([passengerSummary(q, i18n), cabinLabel(q.cabinClass, i18n), ...(q.directOnly ? [r.header.directOnlySpoken] : [])].join(", "));
  const kind = answer ? resultKind(answer.result) : null;
  const demo = kind === "demo" || kind === "sandbox";

  // Kompakt: tilbake, ruten (en knapp som åpner søket her; teksten er skjermens overskrift) og søkeknappen, og under
  // dem datoene og de reisende som brikker. «DEMO» står ved ruten, som eget element for VoiceOver. Ingen linjegrense:
  // stor tekst og lange bynavn brytes i stedet for å kuttes.
  const compact = (
    <>
      <View style={styles.headerRow}>
        <IconButton icon="chevronLeft" label={r.back} variant="plain" onPress={() => router.back()} testID="header-back" />
        <Animated.View style={[styles.routeWrap, settle]}>
          {/* iOS gir ett element én rolle: for VoiceOver er ruten knappen «Endre søk: Oslo til Barcelona». Teksten inni
              er skjermens overskrift i treet; «Endre søk» til høyre gjør det samme. */}
          <RNPressable
            ref={routeButton}
            testID="header-route"
            onPress={openEditor}
            accessibilityRole="button"
            accessibilityLabel={r.header.routeLabel(routeSpoken)}
            accessibilityHint={r.header.editHint}
            accessibilityLanguage={lang}
            style={({ pressed }) => [styles.route, pressed && { opacity: 0.7 }]}
          >
            <Text style={[type.headline, styles.title]} accessibilityRole="header">
              {title}
            </Text>
            <Icon name="chevronDown" size={16} color={colors.onDarkMuted} />
          </RNPressable>
          {/* Merket er laget for å stå øverst i en kolonne (alignSelf: flex-start); her står det midt på linjen med ruten. */}
          {demo ? (
            <View style={styles.demoWrap}>
              <DemoBadge />
            </View>
          ) : null}
        </Animated.View>
        <IconButton icon="search" label={r.editSearch} onPress={openEditor} testID="edit-search" />
      </View>
      <Animated.View style={[styles.summary, settle]} testID="header-summary">
        <SummaryChip testID="header-dates" icon="calendar" label={datesLabel} spoken={datesSpoken} hint={r.header.datesHint} onPress={() => quickEdit("dates")} />
        <SummaryChip testID="header-travellers" icon="user" label={travellersLabel} spoken={travellersSpoken} hint={r.header.travellersHint} onPress={() => quickEdit("travellers")} />
      </Animated.View>
    </>
  );

  // Åpent: hele søkeskjemaet fra forsiden i den samme øya, med «Lukk» øverst til høyre. Et søk kjøres her (ingen ny
  // resultatside oppå), og en feil i skjemaet står i panelet. Flyplassradene åpner flyplassøket, som kommer tilbake hit
  // med skjemaet endret – øya står åpen imens. VoiceOvers «tilbake»-gest (to fingre, Z) lukker som «Lukk».
  const editor = (
    <View style={styles.editor} testID="results-header-editor" onAccessibilityEscape={closeEditor}>
      <View style={styles.editorHead}>
        <RNText ref={editorTitle} style={[type.headline, styles.editorTitle]} accessibilityRole="header" accessibilityLanguage={lang}>
          {r.editSearch}
        </RNText>
        <Pressable testID="header-editor-close" onPress={closeEditor} accessibilityRole="button" accessibilityLabel={r.header.close} accessibilityHint={r.header.closeHint} style={({ pressed }) => [styles.editorClose, pressed && { opacity: 0.7 }]}>
          <Text style={[type.bodyStrong, { color: colors.blueOnDark }]}>{r.header.close}</Text>
        </Pressable>
      </View>
      <SearchPanel onSearched={searched} />
    </View>
  );

  // Ruteoverskriften («Cloud + Graphite»): en grafittøy helt ut til kantene og opp under statuslinjen, med runde
  // hjørner nederst – kompakt eller åpen. Kompakt med et svar står også prisstatusen og fanene Best / Billigst /
  // Raskest (`extra`) i den. Øya klipper innholdet, så skjemaet avdekkes mens den vokser og dekkes mens den krymper.
  // Alt under øya står på den lyse grunnen.
  const headerIsland = (extra?: ReactNode) => (
    <View
      style={[styles.header, { paddingTop: insets.top + space.sm }]}
      testID="results-header"
      onLayout={(e) => {
        headerHeight.current = e.nativeEvent.layout.height;
      }}
    >
      {editing ? editor : compact}
      {editing ? null : extra}
    </View>
  );

  // En feil i skjemaet fra et av arkene under, over «Søk på nytt» (hvit flate: lys melding).
  const sheetError =
    sheetProblem && sheetProblem.form === form ? (
      <Banner tone="error" testID="sheet-error">
        {formErrorText(sheetProblem.code, i18n)}
      </Banner>
    ) : null;
  // Datoer og reisende kan endres i alle tilstandene (også mens et søk lastes eller etter en feil), så arkene står her.
  const quickSheets = (
    <>
      <DateRangeSheet
        testID="dates-sheet"
        visible={sheet === "dates"}
        roundTrip={form.tripType === "roundtrip"}
        dates={{ departDate: form.departDate, returnDate: form.returnDate }}
        onChange={onDates}
        onClose={() => setSheet(null)}
        footer={
          <View style={{ gap: space.sm }}>
            {sheetError}
            <PrimaryButton testID="dates-search" label={r.searchAgain} icon="search" onPress={searchFromSheet} />
          </View>
        }
      />
      <TravellersSheet
        visible={sheet === "travellers"}
        onClose={() => setSheet(null)}
        footer={
          <View style={{ gap: space.sm }}>
            {sheetError}
            <PrimaryButton testID="travellers-search" label={r.searchAgain} icon="search" onPress={searchFromSheet} />
          </View>
        }
      />
    </>
  );

  // Uten liste står øya fast øverst, og ingenting ruller inn under statuslinjen: lys tekst, ingen skjerm. Innholdet
  // kan likevel rulles når søket står åpent i øya og ikke får plass (liten skjerm, stor tekst), så «Søk fly» alltid nås.
  const shell = (children: ReactNode) => (
    <View style={styles.screen} testID="results-screen">
      <StatusBar style="light" />
      <ScrollView style={styles.fill} contentContainerStyle={styles.shellContent} alwaysBounceVertical={false} testID="results-shell">
        {headerIsland()}
        {children}
      </ScrollView>
      {quickSheets}
    </View>
  );

  if (search.status === "idle") {
    // Åpnet uten et søk (lenke, omstart eller tilbakestilt tilstand): ingen evig spinner.
    return shell(
      <StateView icon="search" title={r.idleTitle} body={r.idleBody} testID="results-empty" dark={false}>
        <PrimaryButton testID="start-search" label={r.startSearch} onPress={() => router.replace("/")} />
      </StateView>,
    );
  }

  if (search.status === "loading" && !answer) {
    // Søket står i toppen; under: hva som skjer og plassholderkort i samme form som svaret. «Stopp søket» står der
    // verktøylinjen kommer, innen rekkevidde for tommelen – og i grafitt, som den.
    return shell(
      <View style={styles.loading}>
        <ResultsSkeleton title={r.loadingTitle} body={slow ? r.loadingSlow : r.loadingBody} testID="results-loading" />
        <View style={[styles.toolbarWrap, { bottom: insets.bottom + space.sm }]} pointerEvents="box-none">
          <SecondaryButton
            dark
            icon="close"
            testID="cancel-search"
            label={r.cancelSearch}
            onPress={() => {
              cancelSearch();
              router.back();
            }}
          />
        </View>
      </View>,
    );
  }

  if (search.status === "error") {
    return shell(
      <View style={styles.errorBox} testID="results-error">
        <Banner tone="error">{errorText(search.error, i18n)}</Banner>
        {/* «Prøv igjen» bare når et nytt forsøk kan hjelpe; ellers er «Endre søk» hovedvalget. «Endre søk» åpner søket
            i øya rett over, som ruten og søkeknappen. */}
        {canRetry(search.error) ? (
          <>
            <PrimaryButton label={r.retry} icon="refresh" onPress={() => runSearch()} testID="retry-search" />
            <SecondaryButton label={r.editSearch} onPress={openEditor} testID="edit-search-state" />
          </>
        ) : (
          <PrimaryButton label={r.editSearch} onPress={openEditor} testID="edit-search-state" />
        )}
      </View>,
    );
  }

  // Her er det et svar: det ferdige, eller det forrige mens samme søk oppdateres.
  if (!answer) return null;
  const { result, at } = answer;
  const refreshError = search.status === "done" ? search.refreshError : undefined;
  // «Oppdater prisene» og «dra ned»: søket som vises – ikke datoer som er valgt i arket uten å søke.
  const refreshShown = () => {
    runSearch(search.query);
  };
  const all = result.offers;
  const notice = fxNotice(result, i18n);
  // Tilbud som ikke gjaldt søket (annen flyplass eller dato, manglende retur): sagt rett ut, aldri erstattet.
  const excluded = exclusionSummary(result, i18n);
  // Er totalen for alle reisende ikke bekreftet, sies det rett ut, og prisfilteret («Opptil …») vises ikke.
  const confirmed = totalConfirmed(result);
  const checkedAt = formatClock(new Date(at));
  const stale = pricesStale(at, now);
  // Korte linjer, så første reise står høyt oppe; valutaforklaringen kan åpnes.
  // Demo og testmiljø sies rett ut; ekte priser merkes med når de ble sjekket.
  const notices: NoticeItem[] = [
    // En oppdatering som feilet: sagt først; prisene under er de forrige, med tidspunktet de ble sjekket.
    ...(refreshError
      ? [{ key: "refresh", tone: "warning" as const, text: all.length ? r.status.refreshFailed(errorText(refreshError, i18n), checkedAt) : r.status.refreshFailedEmpty(errorText(refreshError, i18n)), testID: "refresh-error" }]
      : []),
    ...(kind === "demo" ? [{ key: "demo", tone: "warning" as const, text: r.status.demo, testID: "sandbox-banner" }] : []),
    ...(kind === "sandbox" ? [{ key: "sandbox", tone: "warning" as const, text: r.status.sandbox(providerDisplayName(result.provider)), testID: "sandbox-banner" }] : []),
    ...(kind === "unverified" ? [{ key: "unverified", tone: "warning" as const, text: r.status.unverified, testID: "unverified-banner" }] : []),
    ...(result.partial ? [{ key: "partial", tone: "warning" as const, text: r.status.partial, testID: "partial-banner" }] : []),
    ...(!confirmed && all.length ? [{ key: "basis", tone: "warning" as const, text: t.offer.priceUnverifiedExplained, testID: "price-basis-notice" }] : []),
    ...(excluded && all.length ? [{ key: "excluded", tone: "info" as const, text: r.status.excluded(excluded.count, excluded.why), testID: "excluded-notice" }] : []),
    // Alt omregnet (bare en opplysning): lukket bak «Om «ca.»-priser»; kortene har «ca.» og kilden.
    // Mangler kronepriser (en advarsel): alltid åpen.
    // Uten tilbud er det ingen priser å forklare.
    ...(notice && all.length
      ? notice.tone === "info"
        ? [{ key: "fx", tone: notice.tone, text: notice.text, label: t.price.fx.about, testID: "fx-notice" }]
        : [{ key: "fx", tone: notice.tone, text: notice.short, detail: notice.text !== notice.short ? notice.text : undefined, testID: "fx-notice" }]
      : []),
  ];
  const sortLabel = view.sort === "price" && !confirmed ? r.sortPriceUnconfirmed : t.results.sorts[view.sort].summary;
  const hasReturn = all.some((o) => o.offer.slices.length > 1);
  const clearFilters = () => setView(clearedFilters);
  const toggleStops = (value: "direct" | "max1") => setView((v) => ({ ...v, stops: v.stops === value ? "any" : value }));

  // Filtrene fra arket, synlige over listen når arket er lukket – et trykk fjerner filteret. Selskapsnavnene trengs
  // bare når et selskap er valgt.
  const activeChips = activeFilterChips(view, { airlines: view.airlines.length ? airlineOptions(all) : [], roundTrip: hasReturn }, i18n);
  // Et fjernet filter: VoiceOver mister brikken den sto på, så den hører hva som skjedde og hvor mange reiser det nå er.
  const removeFilter = (chip: (typeof activeChips)[number]) => {
    setView(chip.clear);
    AccessibilityInfo.announceForAccessibility(r.active.removed(chip.label, reiser(journeyCount(all, chip.clear(view)))));
  };
  const chips: { key: string; label: string; selected: boolean; count: number; onPress: () => void }[] = [
    { key: "all", label: r.chips.all, selected: filters === 0, count: all.length, onPress: clearFilters },
    { key: "direct", label: r.chips.direct, selected: view.stops === "direct", count: countWith(all, view, { stops: "direct" }), onPress: () => toggleStops("direct") },
    { key: "max1", label: r.chips.max1, selected: view.stops === "max1", count: countWith(all, view, { stops: "max1" }), onPress: () => toggleStops("max1") },
    { key: "bags", label: r.chips.bags, selected: view.bags, count: countWith(all, view, { bags: true }), onPress: () => setView((v) => ({ ...v, bags: !v.bags })) },
  ];

  // Ingen reiser: samme reise noen dager før eller etter, som nye søk – uten priser (dem har vi ikke før det er søkt).
  const nearby = all.length ? [] : nearbyDates(search.query);
  const nearbyRow = nearby.length ? (
    <View style={styles.nearby} testID="nearby-dates">
      <Text style={[type.footnoteStrong, { color: colors.text, textAlign: "center" }]}>{r.nearbyTitle}</Text>
      <View style={styles.nearbyRow}>
        {nearby.map((d) => {
          const back = search.query.tripType === "roundtrip" ? d.returnDate : null;
          return (
            <Chip
              key={d.days}
              testID={`nearby-${d.days}`}
              label={back ? f.dateSpan(d.departDate, back) : f.day(d.departDate)}
              accessibilityLabel={r.nearbySpoken(f.day(d.departDate), back ? f.day(back) : null)}
              selected={false}
              dark={false}
              // Søket som vises, med nye datoer – ikke et skjema som kan være endret etterpå.
              onPress={() => runSearch({ ...search.query, departDate: d.departDate, returnDate: d.returnDate })}
            />
          );
        })}
      </View>
    </View>
  ) : null;

  const listHeader = (
    <View>
      {headerIsland(
        <>
          {refreshing ? (
            // Samme søk kjøres på nytt: listen står, og linjen sier hva som skjer og hvor gamle prisene som vises er.
            <View style={styles.statusRow} testID="price-refreshing">
              <ActivityIndicator size="small" color={colors.onDarkMuted} />
              <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]}>{r.status.refreshing(checkedAt)}</Text>
            </View>
          ) : (kind === "live" || kind === "unverified") && all.length ? (
            <View style={styles.statusRow} testID="price-status">
              {stale ? (
                <>
                  <Icon name="clock" size={14} color={colors.warningOnDark} />
                  <Text style={[type.footnote, { color: colors.warningOnDark, flex: 1 }]}>{r.status.stale(checkedAt)}</Text>
                  {/* Lenken er selv 44 pt høy; luften til sidene når ikke naboene (søkeknappen over, fanene under). */}
                  <Pressable onPress={refreshShown} accessibilityRole="button" hitSlop={{ left: 10, right: 10 }} style={styles.sortLink} testID="refresh-prices">
                    <Text style={[type.footnoteStrong, { color: colors.blueOnDark }]}>{r.status.refresh}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {kind === "live" ? <View style={styles.liveDot} /> : null}
                  <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]}>{kind === "live" ? r.status.live(checkedAt) : r.status.checked(checkedAt)}</Text>
                </>
              )}
            </View>
          ) : null}
          {journeys.length > 1 ? (
            <SortTabs tabs={sortTabs} value={view.sort} label={t.results.tabs.label} note={hasReturn ? t.results.tabs.averageNote : null} onChange={(sort) => setView((v) => ({ ...v, sort }))} />
          ) : null}
        </>,
      )}
      {/* Under øya, på den lyse grunnen: filterbrikkene, meldingene og antallet – så de hvite kortene. */}
      <View style={styles.belowHeader}>
        {all.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} testID="results-chips">
            {chips
              .filter((c) => c.key === "all" || c.selected || c.count > 0)
              .flatMap((c) => {
                const chip = <Chip key={c.key} testID={`chip-${c.key}`} label={c.label} selected={c.selected} dark={false} onPress={c.onPress} />;
                // De aktive filtrene fra arket rett etter «Alle», så de synes uten å rulle.
                return c.key === "all"
                  ? [chip, ...activeChips.map((a) => <Chip key={`active-${a.key}`} testID={`active-${a.key}`} label={a.label} accessibilityLabel={a.spoken} selected removable dark={false} onPress={() => removeFilter(a)} />)]
                  : [chip];
              })}
          </ScrollView>
        ) : null}
        {notices.length ? (
          <View style={styles.notices}>
            <LightNotices items={notices} testID="results-notices" />
          </View>
        ) : null}
        {journeys.length ? (
          <View style={styles.countRow}>
            <Text style={[type.footnote, { color: colors.textSecondary, flexShrink: 1 }]} testID="result-count">
              {`${reiser(journeys.length)} · ${t.results.offers(shown.length)}`}
              {all.length - shown.length > 0 ? ` · ${t.results.hiddenByFilters(all.length - shown.length)}` : ""}
            </Text>
            {/* Gjeldende sortering som tekst; den endres med «Sorter» i den flytende linjen (én kontroll, 44 pt). */}
            <Text style={[type.footnote, styles.sortSummary]} testID="sort-summary">
              {sortLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen} testID="results-screen">
      <StatusBar style={pastHeader ? "dark" : "light"} animated />
      {/* Bak listen, øverst: samme grafitt som øya. Dras listen ned (oppdater), strekker øya seg i stedet for at den
          lyse grunnen åpner seg over den, og iOS' spinner står på grafitt. Lenger ned er grunnen lys. */}
      <View style={styles.backdrop} pointerEvents="none" />
      <FlatList
        ref={listRef}
        testID="results-list"
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.sm + (toolbarHeight || 60) + space.lg }]}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        data={journeys}
        keyExtractor={(j) => j.key}
        // Dra ned: samme søk på nytt, som «Oppdater prisene». Listen står til de nye prisene er her.
        refreshControl={
          <RefreshControl
            refreshing={pulled && refreshing}
            onRefresh={() => {
              setPulled(true);
              refreshShown();
            }}
            tintColor={colors.onDarkMuted}
            // Spinneren under statuslinjen, ikke bak skjermkanten øverst.
            progressViewOffset={insets.top}
            testID="results-refresh"
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          all.length ? (
            <StateView icon="filter" title={r.noMatchTitle} body={r.noMatchBody(reiser(doneCount ?? all.length))} dark={false}>
              <PrimaryButton label={r.clearFilters} testID="reset-filters" onPress={clearFilters} />
            </StateView>
          ) : excluded ? (
            <StateView icon="plane" title={r.status.excludedEmptyTitle} body={r.status.excludedEmptyBody(excluded.count, excluded.why)} testID="results-excluded-empty" dark={false}>
              {nearbyRow}
              <SecondaryButton label={r.editSearch} onPress={openEditor} testID="edit-search-state" />
            </StateView>
          ) : (
            <StateView icon="plane" title={r.noFlightsTitle} body={r.noFlightsBody} testID="results-none" dark={false}>
              {nearbyRow}
              <SecondaryButton label={r.editSearch} onPress={openEditor} testID="edit-search-state" />
            </StateView>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <OfferCard journey={item} totalConfirmed={confirmed} searchedCabin={search.query.cabinClass} onOpen={openOffer} />
          </View>
        )}
      />

      {/* Mens søket står åpent i øya, er verktøylinjen borte: den gjelder listen, og skjemaet har sine egne datoer. */}
      {all.length && !editing ? (
        <View style={[styles.toolbarWrap, { bottom: insets.bottom + space.sm }]} pointerEvents="box-none">
          <View style={styles.toolbar} onLayout={(e) => setToolbarHeight(e.nativeEvent.layout.height)} testID="results-toolbar">
            <ToolButton icon="filter" label={r.filter} primary badge={filters} onPress={() => setSheet("filter")} testID="open-filters" />
            <View style={styles.toolDivider} />
            <ToolButton icon="swap" label={r.sort} onPress={() => setSheet("sort")} testID="open-sort-toolbar" />
            <View style={styles.toolDivider} />
            <ToolButton icon="calendar" label={r.dates} onPress={() => quickEdit("dates")} testID="open-dates" />
          </View>
        </View>
      ) : null}

      <BottomSheet
        visible={sheet === "filter"}
        title={r.filter}
        onClose={() => setSheet(null)}
        testID="filter-sheet"
        footer={
          <View style={{ gap: space.sm }}>
            <PrimaryButton testID="filter-apply" label={journeys.length ? r.show(reiser(journeys.length)) : r.noneMatch} disabled={!journeys.length} onPress={() => setSheet(null)} />
            {filters ? <SecondaryButton label={r.clearFilters} onPress={clearFilters} testID="filter-reset" /> : null}
          </View>
        }
      >
        <FilterSheetBody visible={sheet === "filter"} all={all} view={view} setView={setView} confirmed={confirmed} hasReturn={hasReturn} />
      </BottomSheet>

      <BottomSheet visible={sheet === "sort"} title={r.sort} onClose={() => setSheet(null)} testID="sort-sheet">
        <View accessibilityLanguage={lang} style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.sortingLabel}>
          {SORTS.map((value) => (
            <OptionRow
              key={value}
              testID={`sort-${value}`}
              label={t.results.sorts[value].label}
              detail={value === "price" && !confirmed ? r.sortPriceUnconfirmed : t.results.sorts[value].summary}
              selected={view.sort === value}
              onPress={() => {
                setView((v) => ({ ...v, sort: value as SortKey }));
                setSheet(null);
              }}
            />
          ))}
          <Text style={[type.footnote, { color: colors.textSecondary }]} testID="best-explained">{t.results.tabs.bestExplained}</Text>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.noNokLast}</Text>
          {all.some((o) => o.price.nok.kind === "converted") ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.approxRanking}</Text> : null}
        </View>
      </BottomSheet>

      {quickSheets}

      {/* Når øya har rullet ut under statuslinjen: en lys skjerm bak klokken (mørk tekst), som på forsiden. */}
      <StatusBarShield visible={pastHeader} tone="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  // «Cloud + Graphite»: lys grunn bak brikker, meldinger og de hvite kortene.
  screen: { flex: 1, backgroundColor: colors.canvas },
  // Ruteoverskriften: grafittøy helt ut til kantene og opp under statuslinjen, med runde hjørner nederst. Den klipper
  // innholdet, så søkeskjemaet avdekkes mens øya vokser og dekkes mens den krymper (ingen flate utenfor øya).
  header: { backgroundColor: colors.raised, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, paddingBottom: space.md, gap: space.sm, overflow: "hidden" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md },
  // Ruten (og «DEMO») midt mellom tilbake og søkeknappen; ruten er selv minst 44 pt høy.
  routeWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  demoWrap: { alignSelf: "center" },
  route: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: TOUCH, flexShrink: 1, paddingHorizontal: space.xs },
  // På øya (`raised`): onDark 16,4:1, onDarkMuted 8,4:1. Midtstilt også når teksten brytes over flere linjer.
  title: { color: colors.onDark, flexShrink: 1, textAlign: "center" },
  // Datoer og reisende under ruten: midtstilt, og under hverandre når de ikke får plass side om side (stor tekst).
  summary: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, paddingHorizontal: space.lg },
  // Som brikkene i søkeøya på forsiden: `bg` med mørk kant, lys tekst (onDark på `bg` 18,4:1) – og selv 44 pt høy.
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: TOUCH, maxWidth: "100%", paddingHorizontal: space.md, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, backgroundColor: colors.bg },
  summaryText: { color: colors.onDark, flexShrink: 1 },
  // Søket åpent i øya: samme luft som søkeøya på forsiden.
  editor: { paddingHorizontal: space.lg, gap: space.md },
  editorHead: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH },
  editorTitle: { color: colors.onDark, flex: 1 },
  // «Lukk» er en lenke på grafitt (blueOnDark 5,4:1), selv minst 44 × 44 pt.
  editorClose: { minHeight: TOUCH, minWidth: TOUCH, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xs },
  fill: { flex: 1 },
  // Innholdet uten liste fyller skjermen (lasting og feil under øya), men kan bli høyere enn den.
  shellContent: { flexGrow: 1 },
  // Grafitt bak listens øvre del (synlig bare når listen dras ned forbi toppen); lenger ned er skjermen lys.
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, height: "50%", backgroundColor: colors.raised },
  list: { flex: 1 },
  // Listens innhold fyller minst hele skjermen med den lyse grunnen, så grafitten bak bare synes over toppen.
  listContent: { flexGrow: 1, backgroundColor: colors.canvas },
  belowHeader: { paddingTop: space.sm },
  nearby: { gap: space.sm, alignSelf: "stretch", paddingBottom: space.xs },
  nearbyRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm },
  // Luft over og under brikkene inne i rullefeltet, så hitSlop (4 pt) når 44 pt – en ScrollView klipper det som stikker utenfor.
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.xs, paddingBottom: 6 },
  notices: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, minHeight: 28 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3DDC84" },
  // Antallet og sorteringen deler raden; blir teksten stor, legger forklaringen seg under i stedet for å presse antallet.
  countRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", columnGap: space.md, rowGap: 2, paddingHorizontal: space.lg, paddingVertical: 6 },
  // På grunnen: textSecondary 5,3:1.
  sortSummary: { color: colors.textSecondary, textAlign: "right", flexGrow: 1, flexShrink: 1, flexBasis: 150 },
  sortLink: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: TOUCH },
  item: { paddingHorizontal: space.lg },
  errorBox: { padding: space.lg, gap: space.md },
  loading: { flex: 1, overflow: "hidden" },
  toolbarWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.raised, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.darkBorder, paddingHorizontal: space.sm, paddingVertical: 6 },
  tool: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: TOUCH, paddingHorizontal: space.md },
  toolIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.darkBorder, alignItems: "center", justifyContent: "center" },
  toolBadge: { position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  toolBadgeText: { fontSize: 10, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  toolDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: colors.darkBorder },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder },
  optionSelected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  // Overskrift i filterarket: hvit bak, så delen som rulles forbi under den ikke synes gjennom.
  sectionHead: { backgroundColor: colors.white, paddingTop: space.lg, paddingBottom: space.sm },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  band: { flexBasis: "47%", flexGrow: 1, minHeight: 84, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder, padding: space.md, gap: 2 },
  bandOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  bandTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
