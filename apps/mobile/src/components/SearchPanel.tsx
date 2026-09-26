import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import type { PickMode } from "../lib/calendar";
import { cabinLabel, formErrorText, passengerSummary, type AirportChoice, type SearchForm } from "../lib/searchForm";
import { useA11yLanguage, useI18n } from "../i18n";
import type { FormErrorCode } from "../i18n/ns/search";
import { Banner, PrimaryButton } from "./ui";
import { DateRangeSheet } from "./RangeCalendar";
import { TravellersSheet } from "./TravellersSheet";
import { Icon, type IconName } from "./Icon";
import { MOTION_MS, useReducedMotion } from "../lib/motion";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/** Verdien i en rad mens fra og til bytter plass: glir fra der den sto, og tones litt ned der de to krysser. */
type RowMotion = { key: number; style: { opacity: Animated.AnimatedInterpolation<number>; transform: { translateY: Animated.AnimatedInterpolation<number> }[] } };

/**
 * Ett bytte som glir: `from` er hvor langt verdiene står fra plassen sin når glidningen starter (1 = en hel rad unna),
 * `at` når den startet, `distance` avstanden mellom de to verdiene i punkter.
 */
type Exchange = { key: number; progress: Animated.Value; distance: number; from: number; at: number };

/** Kurven for pilene og glidningen: rask start, rolig landing. Samme funksjon regner ut hvor langt en glidning er kommet. */
const SWAP_EASING = Easing.out(Easing.cubic);

/**
 * Én ende av ruten, som en rad i det hvite rutefeltet: avgang- eller landingsikon og «Oslo (OSL)», eller et spørsmål
 * når ingenting er valgt. Ikonet sier hvilken ende det er uten en egen etikett. Plass til høyre for bytt-knappen, som
 * står på skillelinjen. `motion`: verdien glir inn fra den andre raden etter et bytte (ikonet står stille).
 */
function AirportRow({ label, placeholder, icon, value, onPress, testID, onHeight, motion }: { label: string; placeholder: string; icon: IconName; value: AirportChoice | null; onPress: () => void; testID: string; onHeight?: (h: number) => void; motion?: RowMotion | null }) {
  const { t } = useI18n();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? t.home.airportLabel(label, value.city, value.name, value.iata) : `${label}: ${t.home.notChosen}`}
      accessibilityHint={t.home.airportHint}
      onLayout={onHeight ? (e) => onHeight(Math.round(e.nativeEvent.layout.height)) : undefined}
      style={({ pressed }) => [styles.airportRow, pressed && { backgroundColor: colors.inset }]}
    >
      <Icon name={icon} size={20} color={colors.textSecondary} />
      {/* Ny nøkkel for hvert bytte: verdien tegnes på sin nye rad og starter der den sto, i samme bilde – ingen hopp. */}
      <Animated.View key={motion?.key ?? 0} style={[styles.airportValue, motion?.style]} testID={`route-value-${testID}`}>
        {/* Lange bynavn og stor tekst bryter linjen i stedet for å kuttes. */}
        {value ? (
          <Text style={[type.bodyStrong, styles.airportText, { color: colors.text }]}>
            {value.city}
            <Text style={[type.body, { color: colors.textSecondary }]}>{`  (${value.iata})`}</Text>
          </Text>
        ) : (
          <Text style={[type.body, styles.airportText, { color: colors.textSecondary }]}>{placeholder}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Reisetypen som tekstfaner: valgt er hvit og halvfet med en strek under – ikke bare en annen farge. */
function TripTabs({ value, onChange }: { value: SearchForm["tripType"]; onChange: (v: SearchForm["tripType"]) => void }) {
  const lang = useA11yLanguage();
  const { t } = useI18n();
  const h = t.home;
  const options: { value: SearchForm["tripType"]; label: string }[] = [
    { value: "roundtrip", label: h.roundtrip },
    { value: "oneway", label: h.oneway },
  ];
  return (
    <View style={styles.tabs} accessibilityLanguage={lang} accessibilityRole="radiogroup" accessibilityLabel={h.tripType}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`segment-${o.value}`}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.tab, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[type.bodyStrong, { color: selected ? colors.onDark : colors.onDarkDim }]}>{o.label}</Text>
            <View style={[styles.tabLine, selected && styles.tabLineOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** En brikke på mørk grunn som åpner et ark (reisende, klasse). */
function PanelChip({ label, onPress, testID, accessibilityLabel, accessibilityHint }: { label: string; onPress: () => void; testID: string; accessibilityLabel: string; accessibilityHint: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={(TOUCH - 40) / 2}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <Text style={[type.calloutStrong, { color: colors.onDark, flexShrink: 1 }]}>{label}</Text>
      <Icon name="chevronDown" size={16} color={colors.onDarkMuted} />
    </Pressable>
  );
}

/**
 * Søkeskjemaet i en grafittøy – på forsiden, og i ruteoverskriften på resultatsiden når kunden åpner søket der:
 * reisetype som tekstfaner, fra og til under hverandre i ett hvitt felt med bytt-knappen på skillelinjen, avreise ▸
 * retur i ett felt, reisende og klasse som brikker, og én blå knapp. Alt leses fra og skrives til appens søkeskjema.
 *
 * `onSearched`: skjemaet står allerede på resultatsiden. Et gyldig søk kjøres da der, og `onSearched` kalles i stedet
 * for å legge en ny resultatside oppå (tilbake skal gå til forsiden, ikke til forrige søk). En feil i skjemaet vises i
 * panelet, som på forsiden, og `onSearched` kalles ikke.
 */
export function SearchPanel({ onSearched }: { onSearched?: () => void }) {
  const router = useRouter();
  const { form, setForm, runSearch } = useApp();
  const i18n = useI18n();
  const { t } = i18n;
  const h = t.home;
  // Feilen gjelder skjemaet slik det var da kunden trykket «Søk fly»; endres skjemaet (en brikke, et nytt valg), er den borte.
  const [problem, setProblem] = useState<{ code: FormErrorCode; form: SearchForm } | null>(null);
  const [travellersOpen, setTravellersOpen] = useState(false);
  // Kalenderen: én for begge datoene; åpnet på avreise eller retur, etter hvilken rute kunden trykket på.
  const [calendar, setCalendar] = useState<PickMode | null>(null);
  // Radenes høyde: bytt-knappen står midt på skillelinjen under fra-raden, også når en rad brytes (stor tekst), og
  // verdiene i et bytte glir akkurat den avstanden.
  const [originHeight, setOriginHeight] = useState(56);
  const [destinationHeight, setDestinationHeight] = useState(56);

  const onDates = useCallback((d: { departDate: string; returnDate: string }) => setForm((f) => ({ ...f, ...d })), [setForm]);

  // Bytt fra og til: pilene snur en halv runde, og de to verdiene bytter plass synlig – fra-teksten glir ned til
  // til-raden og til-teksten opp til fra-raden. Skjemaet byttes med én gang (et raskt «Søk fly» søker alltid den nye
  // ruten); bare tegningen starter der verdiene sto. Med «Reduser bevegelse»: ingen snuing og ingen glidning, bare
  // byttet. VoiceOver hører den nye ruten uansett.
  // Haptikk: et lett «tikk» (expo-haptics, selectionAsync) hører hjemme her, men pakken er ikke installert i appen.
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  const turns = useRef(0);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"], extrapolate: "extend" });
  // Ett bytte: 1 = verdiene står der de var før byttet, 0 = på plass. Avstanden måles når kunden trykker, så en
  // rad som endrer høyde under glidningen (ny tekst brytes annerledes) ikke flytter målet midt i bevegelsen.
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const rowMotion = useMemo(() => {
    if (!exchange) return null;
    const { key, progress, distance } = exchange;
    // Litt nedtonet der de to krysser hverandre på skillelinjen, så de ikke blir én uleselig klump.
    const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.55, 1] });
    const from = (dy: number): RowMotion => ({ key, style: { opacity, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }] } });
    // Ny fra-verdi kom fra til-raden (under), ny til-verdi fra fra-raden (over).
    return { origin: from(distance), destination: from(-distance) };
  }, [exchange]);
  useEffect(() => {
    if (!exchange) return;
    const anim = Animated.timing(exchange.progress, { toValue: 0, duration: MOTION_MS, easing: SWAP_EASING, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [exchange]);
  const swap = () => {
    const from = form.destination;
    const to = form.origin;
    setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }));
    if (!reduced) {
      turns.current += 1;
      Animated.timing(spin, { toValue: turns.current, duration: MOTION_MS, easing: SWAP_EASING, useNativeDriver: true }).start();
      // Et nytt trykk midt i en glidning: verdiene byttes tilbake der de faktisk står nå – den som var på vei ned, går
      // opp igjen fra akkurat det stedet – i stedet for å hoppe til en hel rad unna. Hvor langt glidningen er kommet,
      // regnes fra klokken med samme kurve som animasjonen (animasjonen går på iOS' egen tråd).
      const now = Date.now();
      const left = exchange ? exchange.from * (1 - SWAP_EASING(Math.min(1, (now - exchange.at) / MOTION_MS))) : 0;
      const start = 1 - left;
      // Fra midten av den ene teksten til midten av den andre: halve radene og skillelinjen mellom dem.
      setExchange({ key: turns.current, progress: new Animated.Value(start), distance: originHeight / 2 + StyleSheet.hairlineWidth + destinationHeight / 2, from: start, at: now });
    }
    AccessibilityInfo.announceForAccessibility(h.swapped(from?.city ?? h.notChosen, to?.city ?? h.notChosen));
  };

  const submit = () => {
    const err = runSearch();
    setProblem(err ? { code: err, form } : null);
    if (err) return;
    if (onSearched) onSearched();
    else router.push("/resultater");
  };

  const dayParts = (iso: string) => {
    // «fre. 9. okt.»: ukedagen dempet, datoen tydelig.
    const full = i18n.f.day(iso);
    const cut = full.indexOf(" ");
    const nbsp = (x: string) => x.replace(/ /g, "\u00A0");
    return cut > 0 ? { weekday: full.slice(0, cut), date: nbsp(full.slice(cut + 1)) } : { weekday: "", date: nbsp(full) };
  };
  const dateHalf = (iso: string) => {
    const p = dayParts(iso);
    return (
      <Text style={[type.bodyStrong, { color: colors.text }]}>
        {p.weekday ? <Text style={[type.body, { color: colors.textSecondary }]}>{`${p.weekday} `}</Text> : null}
        {p.date}
      </Text>
    );
  };
  const extras = [cabinLabel(form.cabinClass, i18n), ...(form.directOnly ? [h.directOnly] : [])];

  return (
    <View style={{ gap: space.sm }}>
      <TripTabs value={form.tripType} onChange={(tripType) => setForm((f) => ({ ...f, tripType }))} />

      {/* Fra og til under hverandre i ett hvitt felt, som de store søketjenestene; bytt-knappen står på skillelinjen. */}
      <View style={styles.routeCard}>
        <AirportRow
          testID="origin"
          label={h.from}
          placeholder={h.fromPlaceholder}
          icon="takeoff"
          value={form.origin}
          onHeight={setOriginHeight}
          motion={rowMotion?.origin}
          onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })}
        />
        <View style={styles.routeDivider} />
        <AirportRow
          testID="destination"
          label={h.to}
          placeholder={h.toPlaceholder}
          icon="landing"
          value={form.destination}
          onHeight={setDestinationHeight}
          motion={rowMotion?.destination}
          onPress={() => router.push({ pathname: "/flyplass", params: { felt: "til" } })}
        />
        <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel={h.swap} style={({ pressed }) => [styles.swap, { top: originHeight - TOUCH / 2 }, pressed && { backgroundColor: colors.inset }]} testID="swap">
          <Animated.View style={{ transform: [{ rotate }] }} testID="swap-icon">
            <Icon name="swap" size={20} color={colors.text} />
          </Animated.View>
        </Pressable>
      </View>

      {/* Avreise ▸ retur i ett felt; hver halvdel åpner den samme kalenderen på sin dato. VoiceOver hører hele datoen. */}
      <View style={styles.dateCard}>
        <Pressable
          testID="depart-date"
          onPress={() => setCalendar("depart")}
          accessibilityRole="button"
          accessibilityLabel={`${h.depart}: ${i18n.f.longDay(form.departDate)}`}
          accessibilityHint={h.calendarHint}
          style={({ pressed }) => [styles.dateHalf, pressed && { backgroundColor: colors.inset }]}
        >
          {dateHalf(form.departDate)}
        </Pressable>
        <View style={styles.dateArrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="chevronRight" size={16} color={colors.textSecondary} />
        </View>
        {form.tripType === "roundtrip" ? (
          <Pressable
            testID="return-date"
            onPress={() => setCalendar("return")}
            accessibilityRole="button"
            accessibilityLabel={`${h.return}: ${i18n.f.longDay(form.returnDate)}`}
            accessibilityHint={h.calendarHint}
            style={({ pressed }) => [styles.dateHalf, pressed && { backgroundColor: colors.inset }]}
          >
            {dateHalf(form.returnDate)}
          </Pressable>
        ) : (
          <Pressable
            testID="add-return"
            onPress={() => {
              setForm((f) => ({ ...f, tripType: "roundtrip" }));
              setCalendar("return");
            }}
            accessibilityRole="button"
            accessibilityLabel={h.addReturn}
            accessibilityHint={h.addReturnHint}
            style={({ pressed }) => [styles.dateHalf, pressed && { backgroundColor: colors.inset }]}
          >
            <Text style={[type.bodyStrong, { color: colors.blue }]}>{`+ ${h.addReturn}`}</Text>
          </Pressable>
        )}
      </View>

      {/* Reisende og klasse (og «Bare direktefly») som brikker; alle åpner det samme arket. */}
      <View style={styles.chips}>
        {/* Tallet og ordet holdes sammen: «1 barn», aldri «1» og «barn» på hver sin linje. */}
        <PanelChip
          testID="travellers"
          label={passengerSummary(form, i18n).replace(/(\d) /g, "$1\u00A0")}
          accessibilityLabel={`${h.travellers}: ${passengerSummary(form, i18n)}`}
          accessibilityHint={h.travellersHint}
          onPress={() => setTravellersOpen(true)}
        />
        <PanelChip testID="cabin" label={extras.join(" · ")} accessibilityLabel={`${h.cabin}: ${extras.join(", ")}`} accessibilityHint={h.travellersHint} onPress={() => setTravellersOpen(true)} />
      </View>

      {problem && problem.form === form ? (
        <Banner tone="error" dark testID="form-error">
          {formErrorText(problem.code, i18n)}
        </Banner>
      ) : null}
      <PrimaryButton testID="search-button" label={h.searchButton} onPress={submit} />

      <DateRangeSheet
        visible={calendar !== null}
        startMode={calendar ?? "depart"}
        roundTrip={form.tripType === "roundtrip"}
        dates={{ departDate: form.departDate, returnDate: form.returnDate }}
        onChange={onDates}
        onClose={() => setCalendar(null)}
        footer={<PrimaryButton testID="calendar-done-button" label={t.calendar.done} onPress={() => setCalendar(null)} />}
      />

      <TravellersSheet visible={travellersOpen} onClose={() => setTravellersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: space.xl },
  tab: { minHeight: TOUCH, justifyContent: "center", gap: 4, paddingTop: 6 },
  tabLine: { height: 2, borderRadius: 1, backgroundColor: "transparent" },
  tabLineOn: { backgroundColor: colors.blueOnDark },
  routeCard: { borderRadius: radius.input, backgroundColor: colors.white, overflow: "hidden" },
  // Plass til høyre for bytt-knappen; minHeight, så stor tekst gjør raden høyere i stedet for å kutte.
  airportRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: space.lg, paddingRight: 64, paddingVertical: space.sm },
  // Verdien (teksten) i raden: kan krympe og bryte linjen; det er den som glir i et bytte.
  airportValue: { flexShrink: 1 },
  airportText: { flexShrink: 1 },
  // Streken starter under teksten, ikke under ikonet.
  routeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lightBorder, marginLeft: space.lg + 20 + space.md },
  swap: { position: "absolute", right: space.md, width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  dateCard: { flexDirection: "row", alignItems: "stretch", borderRadius: radius.input, backgroundColor: colors.white, overflow: "hidden" },
  dateHalf: { flex: 1, minHeight: 56, justifyContent: "center", paddingHorizontal: space.lg, paddingVertical: space.sm },
  dateArrow: { justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, maxWidth: "100%", paddingHorizontal: space.md, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, backgroundColor: colors.bg },
});
