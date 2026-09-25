import { useCallback, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Switch, Text } from "./a11y";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import type { PickMode } from "../lib/calendar";
import { CABINS, CHILD_AGES, DEFAULT_CHILD_AGE, DEFAULT_INFANT_AGE, INFANT_AGES, MAX_PASSENGERS, cabinLabel, formErrorText, passengerCount, passengerSummary, type AirportChoice, type SearchForm } from "../lib/searchForm";
import { useI18n } from "../i18n";
import type { FormErrorCode } from "../i18n/ns/search";
import { Banner, BottomSheet, ChoiceChips, PrimaryButton, Segmented, Stepper } from "./ui";
import { FormTile } from "./DateField";
import { DateRangeSheet } from "./RangeCalendar";
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
  const total = passengerCount(form);

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
  const infants = form.infantAges.length;

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

      <BottomSheet visible={travellersOpen} title={h.travellersSheet} onClose={() => setTravellersOpen(false)} testID="travellers-sheet">
        <ScrollView contentContainerStyle={{ gap: space.xs, paddingBottom: space.md }}>
          {/* Hva som er valgt, samlet øverst – også når barnas alder har skjøvet resten nedover. */}
          <Text style={[type.footnote, { color: colors.textSecondary }]} testID="travellers-summary">
            {[passengerSummary(form, i18n), cabinLabel(form.cabinClass, i18n), ...(form.directOnly ? [h.directOnly] : [])].join(" · ")}
          </Text>
          {/* Et spedbarn sitter på fanget til en voksen: færre voksne enn spedbarn går ikke – det sies der det stopper. */}
          <Stepper
            testID="adults"
            label={h.adults}
            hint={h.adultsHint}
            value={form.adults}
            min={Math.max(1, infants)}
            max={MAX_PASSENGERS - total + form.adults}
            note={infants > 1 && form.adults === infants ? h.adultsForInfants : null}
            onChange={(adults) => setForm((f) => ({ ...f, adults, infantAges: f.infantAges.slice(0, adults) }))}
          />
          <Stepper
            label={h.children}
            hint={h.childrenHint}
            value={form.childAges.length}
            min={0}
            max={Math.min(8, MAX_PASSENGERS - total + form.childAges.length)}
            onChange={(n) => setForm((f) => ({ ...f, childAges: n > f.childAges.length ? [...f.childAges, DEFAULT_CHILD_AGE] : f.childAges.slice(0, n) }))}
          />
          {form.childAges.map((age, i) => (
            <View key={`c${i}`} style={styles.ageRow}>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.childAge(i + 1)}</Text>
              <ChoiceChips
                label={h.childAge(i + 1)}
                value={age}
                options={CHILD_AGES}
                format={(n) => String(n)}
                onChange={(v) => setForm((f) => ({ ...f, childAges: f.childAges.map((x, xi) => (xi === i ? v : x)) }))}
              />
            </View>
          ))}
          <Stepper
            testID="infants"
            label={h.infants}
            hint={h.infantsHint}
            value={form.infantAges.length}
            min={0}
            max={Math.min(4, form.adults, MAX_PASSENGERS - total + form.infantAges.length)}
            note={infants > 0 && infants >= form.adults && total < MAX_PASSENGERS ? h.infantPerAdult : null}
            onChange={(n) => setForm((f) => ({ ...f, infantAges: n > f.infantAges.length ? [...f.infantAges, DEFAULT_INFANT_AGE] : f.infantAges.slice(0, n) }))}
          />
          {form.infantAges.map((age, i) => (
            <View key={`i${i}`} style={styles.ageRow}>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.infantAge(i + 1)}</Text>
              <ChoiceChips
                label={h.infantAge(i + 1)}
                value={age}
                options={INFANT_AGES}
                format={(n) => (n === 0 ? h.infantUnder1 : h.infant1)}
                onChange={(v) => setForm((f) => ({ ...f, infantAges: f.infantAges.map((x, xi) => (xi === i ? v : x)) }))}
              />
            </View>
          ))}
          {total >= MAX_PASSENGERS ? (
            <View style={styles.ruleNote} testID="travellers-max-note">
              <Icon name="info" size={14} color={colors.textSecondary} />
              <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{h.maxTravellers(MAX_PASSENGERS)}</Text>
            </View>
          ) : null}
          <View style={styles.sheetDivider} />
          <Text style={[type.bodyStrong, { color: colors.text }]}>{h.cabin}</Text>
          <ChoiceChips label={h.cabin} value={form.cabinClass} options={CABINS} format={(v) => cabinLabel(v, i18n)} onChange={(cabinClass) => setForm((f) => ({ ...f, cabinClass }))} />
          <View style={styles.sheetDivider} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{h.directOnly}</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.directOnlyHint}</Text>
            </View>
            <Switch accessibilityLabel={h.directOnly} value={form.directOnly} onValueChange={(directOnly) => setForm((f) => ({ ...f, directOnly }))} trackColor={{ true: colors.blue, false: colors.lightBorder }} />
          </View>
        </ScrollView>
      </BottomSheet>
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
  ageRow: { gap: space.sm, paddingBottom: space.sm },
  sheetDivider: { height: 1, backgroundColor: colors.lightBorder, marginVertical: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  ruleNote: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
});
