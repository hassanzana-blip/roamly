import { useCallback, useRef, useState, type ReactNode } from "react";
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
import { useReducedMotion } from "../lib/motion";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/**
 * Én ende av ruten, som en rad i det hvite rutefeltet: avgang- eller landingsikon og «Oslo (OSL)», eller et spørsmål
 * når ingenting er valgt. Ikonet sier hvilken ende det er uten en egen etikett. Plass til høyre for bytt-knappen, som
 * står på skillelinjen.
 */
function AirportRow({ label, placeholder, icon, value, onPress, testID, onHeight }: { label: string; placeholder: string; icon: IconName; value: AirportChoice | null; onPress: () => void; testID: string; onHeight?: (h: number) => void }) {
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
      {/* Lange bynavn og stor tekst bryter linjen i stedet for å kuttes. */}
      {value ? (
        <Text style={[type.bodyStrong, styles.airportText, { color: colors.text }]}>
          {value.city}
          <Text style={[type.body, { color: colors.textSecondary }]}>{`  (${value.iata})`}</Text>
        </Text>
      ) : (
        <Text style={[type.body, styles.airportText, { color: colors.textSecondary }]}>{placeholder}</Text>
      )}
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
 * Søkeskjemaet på forsiden, på mørk grunn: reisetype som tekstfaner, fra og til under hverandre i ett hvitt felt med
 * bytt-knappen på skillelinjen, avreise ▸ retur i ett felt, reisende og klasse som brikker, og én blå knapp. Alt leses
 * fra og skrives til appens søkeskjema.
 */
export function SearchPanel({ footer }: { footer?: ReactNode } = {}) {
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
  // Fra-radens høyde: bytt-knappen står midt på skillelinjen under den, også når en rad brytes (stor tekst).
  const [originHeight, setOriginHeight] = useState(56);

  const onDates = useCallback((d: { departDate: string; returnDate: string }) => setForm((f) => ({ ...f, ...d })), [setForm]);

  // Bytt fra og til: pilene snur en halv runde (ikke med «Reduser bevegelse»), og VoiceOver hører den nye ruten.
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  const turns = useRef(0);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"], extrapolate: "extend" });
  const swap = () => {
    const from = form.destination;
    const to = form.origin;
    setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }));
    if (!reduced) {
      turns.current += 1;
      Animated.timing(spin, { toValue: turns.current, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    AccessibilityInfo.announceForAccessibility(h.swapped(from?.city ?? h.notChosen, to?.city ?? h.notChosen));
  };

  const submit = () => {
    const err = runSearch();
    setProblem(err ? { code: err, form } : null);
    if (!err) router.push("/resultater");
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
        <AirportRow testID="origin" label={h.from} placeholder={h.fromPlaceholder} icon="takeoff" value={form.origin} onHeight={setOriginHeight} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })} />
        <View style={styles.routeDivider} />
        <AirportRow testID="destination" label={h.to} placeholder={h.toPlaceholder} icon="landing" value={form.destination} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "til" } })} />
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
      {footer}

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
