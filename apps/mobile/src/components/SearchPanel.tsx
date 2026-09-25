import { useCallback, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import type { PickMode } from "../lib/calendar";
import { cabinLabel, formErrorText, passengerSummary, type AirportChoice, type SearchForm } from "../lib/searchForm";
import { useI18n } from "../i18n";
import type { FormErrorCode } from "../i18n/ns/search";
import { Banner, PrimaryButton, Segmented } from "./ui";
import { FormTile } from "./DateField";
import { DateRangeSheet } from "./RangeCalendar";
import { TravellersSheet } from "./TravellersSheet";
import { Icon } from "./Icon";
import { useReducedMotion } from "../lib/motion";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/** Én ende av ruten: etikett, stor flyplasskode og by. Trykk åpner flyplassøket. */
function AirportField({ label, value, onPress, testID, align }: { label: string; value: AirportChoice | null; onPress: () => void; testID: string; align: "left" | "right" }) {
  const { t } = useI18n();
  const alignItems = align === "left" ? "flex-start" : "flex-end";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? t.home.airportLabel(label, value.city, value.name, value.iata) : `${label}: ${t.home.notChosen}`}
      accessibilityHint={t.home.airportHint}
      style={({ pressed }) => [styles.airport, { alignItems }, pressed && { opacity: 0.6 }]}
    >
      <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
      {/* Tomt felt: vanlig mørk tekst, ikke en blå flate som konkurrerer med «Søk fly». */}
      <Text style={value ? [type.code, { color: colors.text }] : [type.title, styles.empty]} numberOfLines={1}>
        {value ? value.iata : t.home.choose}
      </Text>
      {/* Lange bynavn og stor tekst bryter linjen. */}
      <Text style={[type.footnote, { color: colors.textSecondary, textAlign: align }]}>{value ? value.city : t.home.cityOrAirport}</Text>
    </Pressable>
  );
}

/**
 * Søkeskjemaet på forsiden: reisetype, rute med bytteknapp, datoer, reisende og
 * reiseklasse, og én blå knapp. Alt leses fra og skrives til appens søkeskjema.
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

  return (
    <View style={{ gap: space.sm }}>
      <Segmented
        label={h.tripType}
        value={form.tripType}
        options={[
          { value: "roundtrip", label: h.roundtrip, icon: "repeat" },
          { value: "oneway", label: h.oneway, icon: "oneWay" },
        ]}
        onChange={(tripType) => setForm((f) => ({ ...f, tripType }))}
      />

      <View style={styles.route}>
        <AirportField testID="origin" label={h.from} align="left" value={form.origin} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })} />
        <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel={h.swap} style={({ pressed }) => [styles.swap, pressed && { backgroundColor: colors.inset }]} testID="swap">
          <Animated.View style={{ transform: [{ rotate }] }} testID="swap-icon">
            <Icon name="swapHorizontal" size={18} color={colors.text} />
          </Animated.View>
        </Pressable>
        <AirportField testID="destination" label={h.to} align="right" value={form.destination} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "til" } })} />
      </View>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <FormTile testID="depart-date" icon="calendar" label={h.depart} value={i18n.f.day(form.departDate)} onPress={() => setCalendar("depart")} accessibilityHint={h.calendarHint} />
          {form.tripType === "roundtrip" ? (
            <FormTile testID="return-date" icon="calendar" label={h.return} value={i18n.f.day(form.returnDate)} onPress={() => setCalendar("return")} accessibilityHint={h.calendarHint} />
          ) : (
            <FormTile
              testID="add-return"
              icon="calendar"
              label={h.return}
              value={h.add}
              action
              accessibilityLabel={h.addReturn}
              accessibilityHint={h.addReturnHint}
              onPress={() => {
                setForm((f) => ({ ...f, tripType: "roundtrip" }));
                setCalendar("return");
              }}
            />
          )}
        </View>
        <View style={styles.gridRow}>
          {/* Tallet og ordet holdes sammen når linjen brytes: «1 barn», aldri «1» og «barn» på hver sin linje. */}
          <FormTile testID="travellers" icon="user" label={h.travellers} value={passengerSummary(form, i18n).replace(/(\d) /g, "$1\u00A0")} onPress={() => setTravellersOpen(true)} accessibilityHint={h.travellersHint} />
          <FormTile testID="cabin" icon="seat" label={h.cabin} value={cabinLabel(form.cabinClass, i18n)} onPress={() => setTravellersOpen(true)} accessibilityHint={h.travellersHint} />
        </View>
      </View>

      {problem && problem.form === form ? (
        <Banner tone="error" testID="form-error">
          {formErrorText(problem.code, i18n)}
        </Banner>
      ) : null}
      <PrimaryButton testID="search-button" label={h.searchButton} icon="arrowRight" onPress={submit} />
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
  route: { flexDirection: "row", alignItems: "center", borderRadius: radius.card - 4, borderWidth: 1, borderColor: colors.lightBorder, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 80 },
  // Samme linjehøyde som flyplasskoden, så ruteboksen ikke hopper når et felt fylles ut.
  empty: { color: colors.text, lineHeight: 30 },
  airport: { flex: 1, gap: 1, minHeight: TOUCH, justifyContent: "center" },
  swap: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginHorizontal: space.sm },
  grid: { gap: 6 },
  gridRow: { flexDirection: "row", gap: 6 },
});
