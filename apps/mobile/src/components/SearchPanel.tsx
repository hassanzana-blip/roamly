import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import { addDays, toIsoDate } from "../lib/format";
import { CABINS, CHILD_AGES, DEFAULT_CHILD_AGE, DEFAULT_INFANT_AGE, INFANT_AGES, MAX_PASSENGERS, cabinLabel, passengerCount, passengerSummary, type AirportChoice } from "../lib/searchForm";
import { Banner, BottomSheet, ChoiceChips, PrimaryButton, Segmented, Stepper } from "./ui";
import { DateField, FormTile } from "./DateField";
import { Icon } from "./Icon";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/** Én ende av ruten: etikett, stor flyplasskode og by. Trykk åpner flyplassøket. */
function AirportField({ label, value, onPress, testID, align }: { label: string; value: AirportChoice | null; onPress: () => void; testID: string; align: "left" | "right" }) {
  const alignItems = align === "left" ? "flex-start" : "flex-end";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value.city}, ${value.name}, ${value.iata}` : `${label}: ikke valgt`}
      accessibilityHint="Åpner flyplassøket"
      style={({ pressed }) => [styles.airport, { alignItems }, pressed && { opacity: 0.6 }]}
    >
      <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[type.code, { color: value ? colors.text : colors.blue }]} numberOfLines={1}>
        {value ? value.iata : "Velg"}
      </Text>
      <Text style={[type.footnote, { color: colors.textSecondary, textAlign: align }]} numberOfLines={1}>
        {value ? value.city : "By eller flyplass"}
      </Text>
    </Pressable>
  );
}

/**
 * Søkeskjemaet på forsiden: reisetype, rute med bytteknapp, datoer, reisende og
 * reiseklasse, og én blå knapp. Alt leses fra og skrives til appens søkeskjema.
 */
export function SearchPanel() {
  const router = useRouter();
  const { form, setForm, runSearch } = useApp();
  const [problem, setProblem] = useState<string | null>(null);
  const [travellersOpen, setTravellersOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const today = toIsoDate(new Date());
  const total = passengerCount(form);

  const submit = () => {
    const err = runSearch();
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  return (
    <View style={{ gap: space.md }}>
      <Segmented
        label="Reisetype"
        value={form.tripType}
        options={[
          { value: "roundtrip", label: "Tur-retur", icon: "repeat" },
          { value: "oneway", label: "Én vei", icon: "oneWay" },
        ]}
        onChange={(tripType) => setForm((f) => ({ ...f, tripType }))}
      />

      <View style={styles.route}>
        <AirportField testID="origin" label="Fra" align="left" value={form.origin} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })} />
        <Pressable
          onPress={() => setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }))}
          accessibilityRole="button"
          accessibilityLabel="Bytt fra og til"
          style={({ pressed }) => [styles.swap, pressed && { backgroundColor: colors.inset }]}
          testID="swap"
        >
          <Icon name="swapHorizontal" size={18} color={colors.text} />
        </Pressable>
        <AirportField testID="destination" label="Til" align="right" value={form.destination} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "til" } })} />
      </View>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <DateField
            testID="depart-date"
            label="Avreise"
            value={form.departDate}
            minimum={today}
            onChange={(departDate) => setForm((f) => ({ ...f, departDate, returnDate: f.returnDate < departDate ? addDays(departDate, 7) : f.returnDate }))}
          />
          {form.tripType === "roundtrip" ? (
            <DateField testID="return-date" label="Retur" value={form.returnDate} minimum={form.departDate} onChange={(returnDate) => setForm((f) => ({ ...f, returnDate }))} open={returnOpen} onOpenChange={setReturnOpen} />
          ) : (
            <FormTile
              testID="add-return"
              icon="calendar"
              label="Retur"
              value="Legg til"
              action
              accessibilityLabel="Legg til retur"
              accessibilityHint="Gjør søket til tur-retur og åpner kalenderen"
              onPress={() => {
                setForm((f) => ({ ...f, tripType: "roundtrip" }));
                setReturnOpen(true);
              }}
            />
          )}
        </View>
        <View style={styles.gridRow}>
          <FormTile testID="travellers" icon="user" label="Reisende" value={passengerSummary(form)} onPress={() => setTravellersOpen(true)} accessibilityHint="Velg antall reisende og reiseklasse" />
          <FormTile testID="cabin" icon="seat" label="Reiseklasse" value={cabinLabel(form.cabinClass)} onPress={() => setTravellersOpen(true)} accessibilityHint="Velg antall reisende og reiseklasse" />
        </View>
      </View>

      {problem ? (
        <Banner tone="error" testID="form-error">
          {problem}
        </Banner>
      ) : null}
      <PrimaryButton testID="search-button" label="Søk fly" icon="arrowRight" onPress={submit} />

      <BottomSheet visible={travellersOpen} title="Reisende og reiseklasse" onClose={() => setTravellersOpen(false)} testID="travellers-sheet">
        <ScrollView contentContainerStyle={{ gap: space.xs, paddingBottom: space.md }}>
          <Stepper label="Voksne" hint="12 år og eldre" value={form.adults} min={1} max={MAX_PASSENGERS - total + form.adults} onChange={(adults) => setForm((f) => ({ ...f, adults, infantAges: f.infantAges.slice(0, adults) }))} />
          <Stepper
            label="Barn"
            hint="2–11 år"
            value={form.childAges.length}
            min={0}
            max={Math.min(8, MAX_PASSENGERS - total + form.childAges.length)}
            onChange={(n) => setForm((f) => ({ ...f, childAges: n > f.childAges.length ? [...f.childAges, DEFAULT_CHILD_AGE] : f.childAges.slice(0, n) }))}
          />
          {form.childAges.map((age, i) => (
            <View key={`c${i}`} style={styles.ageRow}>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>Alder barn {i + 1}</Text>
              <ChoiceChips
                label={`Alder barn ${i + 1}`}
                value={age}
                options={CHILD_AGES}
                format={(n) => String(n)}
                onChange={(v) => setForm((f) => ({ ...f, childAges: f.childAges.map((x, xi) => (xi === i ? v : x)) }))}
              />
            </View>
          ))}
          <Stepper
            label="Spedbarn"
            hint="Under 2 år, på fanget"
            value={form.infantAges.length}
            min={0}
            max={Math.min(4, form.adults, MAX_PASSENGERS - total + form.infantAges.length)}
            onChange={(n) => setForm((f) => ({ ...f, infantAges: n > f.infantAges.length ? [...f.infantAges, DEFAULT_INFANT_AGE] : f.infantAges.slice(0, n) }))}
          />
          {form.infantAges.map((age, i) => (
            <View key={`i${i}`} style={styles.ageRow}>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>Alder spedbarn {i + 1}</Text>
              <ChoiceChips
                label={`Alder spedbarn ${i + 1}`}
                value={age}
                options={INFANT_AGES}
                format={(n) => (n === 0 ? "Under 1 år" : "1 år")}
                onChange={(v) => setForm((f) => ({ ...f, infantAges: f.infantAges.map((x, xi) => (xi === i ? v : x)) }))}
              />
            </View>
          ))}
          <View style={styles.sheetDivider} />
          <Text style={[type.bodyStrong, { color: colors.text }]}>Reiseklasse</Text>
          <ChoiceChips label="Reiseklasse" value={form.cabinClass} options={CABINS.map((c) => c.value)} format={(v) => CABINS.find((c) => c.value === v)?.label ?? v} onChange={(cabinClass) => setForm((f) => ({ ...f, cabinClass }))} />
          <View style={styles.sheetDivider} />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Bare direktefly</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>Søker bare etter reiser uten mellomlanding.</Text>
            </View>
            <Switch accessibilityLabel="Bare direktefly" value={form.directOnly} onValueChange={(directOnly) => setForm((f) => ({ ...f, directOnly }))} trackColor={{ true: colors.blue, false: colors.lightBorder }} />
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  route: { flexDirection: "row", alignItems: "center", borderRadius: radius.card - 4, borderWidth: 1, borderColor: colors.lightBorder, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 88 },
  airport: { flex: 1, gap: 1, minHeight: TOUCH, justifyContent: "center" },
  swap: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginHorizontal: space.sm },
  grid: { gap: space.sm },
  gridRow: { flexDirection: "row", gap: space.sm },
  ageRow: { gap: space.sm, paddingBottom: space.sm },
  sheetDivider: { height: 1, backgroundColor: colors.lightBorder, marginVertical: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
});
