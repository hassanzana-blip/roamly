import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../lib/appState";
import { addDays, toIsoDate } from "../lib/format";
import { CABINS, CHILD_AGES, DEFAULT_CHILD_AGE, DEFAULT_INFANT_AGE, INFANT_AGES, MAX_PASSENGERS, cabinLabel, passengerCount, passengerSummary, type AirportChoice } from "../lib/searchForm";
import { Banner, BottomSheet, Button, Card, Chips, Segmented, Stepper, Tile, Title, WorldTexture, Wordmark } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";
import { DateField } from "../components/DateField";
import { colors, fonts, radius, space, TOUCH } from "../lib/theme";

/** Fra/til som grå rad: ikon, stor flyplasskode, skillelinje, etikett og by. */
function AirportRow({ label, icon, value, onPress, testID }: { label: string; icon: IconName; value: AirportChoice | null; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value.city}, ${value.iata}` : `${label}: ikke valgt`}
      accessibilityHint="Åpner flyplassøk"
      style={({ pressed }) => [styles.airport, pressed && { backgroundColor: colors.border }]}
    >
      <View style={styles.airportCodeCol}>
        <Icon name={icon} size={18} color={colors.indigo} />
        <Text style={[styles.airportCode, !value && { color: colors.textMuted }]}>{value ? value.iata : "–––"}</Text>
      </View>
      <View style={styles.airportDivider} />
      <View style={{ flex: 1, paddingRight: TOUCH }}>
        <Text style={styles.airportLabel}>{label}</Text>
        <Text style={[styles.airportCity, !value && { color: colors.textMuted, fontFamily: fonts.medium }]} numberOfLines={1}>
          {value ? value.city : "Velg by eller flyplass"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { form, setForm, runSearch, auth } = useApp();
  const [problem, setProblem] = useState<string | null>(null);
  const [travellersOpen, setTravellersOpen] = useState(false);
  const today = toIsoDate(new Date());
  const total = passengerCount(form);

  const submit = () => {
    const err = runSearch();
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const signedIn = auth.status === "signedIn";
  const accountLabel = signedIn ? (auth.profile?.firstName ?? "Konto") : "Logg inn";

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
      <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
        <WorldTexture top={insets.top + 40} />
        <View style={styles.heroTop}>
          <Wordmark />
          <Pressable
            onPress={() => router.push("/konto")}
            accessibilityRole="button"
            accessibilityLabel={signedIn ? "Din konto" : "Logg inn"}
            style={({ pressed }) => [styles.account, pressed && { backgroundColor: colors.navyRaised }]}
            testID="account-button"
          >
            <Icon name="user" size={18} color={colors.white} />
            <Text style={styles.accountText} numberOfLines={1}>
              {accountLabel}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: space.xs }}>
          <Title onDark>Hvor vil du reise?</Title>
          <Text style={styles.heroSub}>Vi sammenligner flypriser og viser dem i norske kroner.</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Card floating style={styles.formCard}>
          <Segmented
            label="Reisetype"
            value={form.tripType}
            options={[
              { value: "roundtrip", label: "Tur-retur" },
              { value: "oneway", label: "Én vei" },
            ]}
            onChange={(tripType) => setForm((f) => ({ ...f, tripType }))}
          />

          <View style={{ gap: space.sm }}>
            <AirportRow testID="origin" label="Fra" icon="takeoff" value={form.origin} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })} />
            <AirportRow testID="destination" label="Til" icon="landing" value={form.destination} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "til" } })} />
            <Pressable
              onPress={() => setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }))}
              accessibilityRole="button"
              accessibilityLabel="Bytt fra og til"
              style={({ pressed }) => [styles.swap, pressed && { backgroundColor: colors.indigoPressed }]}
              testID="swap"
            >
              <Icon name="swap" size={20} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.row}>
            <DateField
              testID="depart-date"
              label="Utreise"
              value={form.departDate}
              minimum={today}
              onChange={(departDate) => setForm((f) => ({ ...f, departDate, returnDate: f.returnDate < departDate ? addDays(departDate, 7) : f.returnDate }))}
            />
            {form.tripType === "roundtrip" ? (
              <DateField testID="return-date" label="Hjemreise" value={form.returnDate} minimum={form.departDate} onChange={(returnDate) => setForm((f) => ({ ...f, returnDate }))} />
            ) : null}
          </View>

          <View style={styles.row}>
            <Tile testID="travellers" icon="users" label="Reisende" value={passengerSummary(form)} onPress={() => setTravellersOpen(true)} accessibilityHint="Velg antall reisende og reiseklasse" style={{ flex: 1 }} />
            <Tile testID="cabin" icon="seat" label="Klasse" value={cabinLabel(form.cabinClass)} onPress={() => setTravellersOpen(true)} accessibilityHint="Velg antall reisende og reiseklasse" style={{ flex: 1 }} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Bare direktefly</Text>
            <Switch accessibilityLabel="Bare direktefly" value={form.directOnly} onValueChange={(directOnly) => setForm((f) => ({ ...f, directOnly }))} trackColor={{ true: colors.indigo, false: colors.input }} />
          </View>

          {problem ? (
            <Banner tone="error" testID="form-error">
              {problem}
            </Banner>
          ) : null}
          <Button testID="search-button" label="Søk etter fly" icon="search" onPress={submit} />
        </Card>
        <Text style={styles.note}>Du trenger ikke logge inn for å søke.</Text>
      </View>

      <BottomSheet visible={travellersOpen} title="Reisende og klasse" onClose={() => setTravellersOpen(false)} testID="travellers-sheet">
        <ScrollView contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
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
              <Text style={styles.ageLabel}>Alder barn {i + 1}</Text>
              <Chips
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
              <Text style={styles.ageLabel}>Alder spedbarn {i + 1}</Text>
              <Chips
                label={`Alder spedbarn ${i + 1}`}
                value={age}
                options={INFANT_AGES}
                format={(n) => (n === 0 ? "Under 1 år" : "1 år")}
                onChange={(v) => setForm((f) => ({ ...f, infantAges: f.infantAges.map((x, xi) => (xi === i ? v : x)) }))}
              />
            </View>
          ))}
          <View style={styles.sheetDivider} />
          <Text style={styles.sheetSection}>Reiseklasse</Text>
          <Chips label="Reiseklasse" value={form.cabinClass} options={CABINS.map((c) => c.value)} format={(v) => CABINS.find((c) => c.value === v)?.label ?? v} onChange={(cabinClass) => setForm((f) => ({ ...f, cabinClass }))} />
        </ScrollView>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.navy, paddingHorizontal: space.xl, paddingBottom: 96, gap: space.xl, overflow: "hidden", borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroSub: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.onDarkMuted },
  account: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.navyLine, maxWidth: 170 },
  accountText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  body: { paddingHorizontal: space.lg, marginTop: -72, gap: space.lg },
  formCard: { padding: space.lg, gap: space.lg },
  airport: { flexDirection: "row", alignItems: "center", minHeight: 72, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: space.lg, gap: space.md },
  airportCodeCol: { width: 64, gap: 2 },
  airportCode: { fontFamily: fonts.heavy, fontSize: 22, letterSpacing: -0.2, color: colors.text },
  airportDivider: { width: 1, alignSelf: "stretch", marginVertical: space.md, backgroundColor: colors.input },
  airportLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  airportCity: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  swap: { position: "absolute", right: space.lg, top: 72 - TOUCH / 2 + space.sm / 2, width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.white },
  row: { flexDirection: "row", gap: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH, paddingHorizontal: space.xs },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: "center" },
  ageRow: { gap: space.sm, paddingBottom: space.sm },
  ageLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  sheetDivider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  sheetSection: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
