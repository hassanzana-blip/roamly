import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../lib/appState";
import { addDays, toIsoDate } from "../lib/format";
import { CABINS, CHILD_AGES, DEFAULT_CHILD_AGE, DEFAULT_INFANT_AGE, INFANT_AGES, MAX_PASSENGERS, passengerCount, type AirportChoice } from "../lib/searchForm";
import { Banner, Body, Button, Card, Chips, SectionTitle, Segmented, Stepper, Title, Wordmark } from "../components/ui";
import { DateField } from "../components/DateField";
import { colors, fonts, radius, space } from "../lib/theme";

function AirportButton({ label, value, onPress, testID }: { label: string; value: AirportChoice | null; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value.city}, ${value.iata}` : `${label}: ikke valgt`}
      accessibilityHint="Åpner flyplassøk"
      style={({ pressed }) => [styles.airport, pressed && { backgroundColor: colors.sand }]}
    >
      <Text style={styles.airportLabel}>{label}</Text>
      {value ? (
        <Text style={styles.airportValue} numberOfLines={1}>
          {value.city} <Text style={styles.iata}>{value.iata}</Text>
        </Text>
      ) : (
        <Text style={styles.airportPlaceholder}>Velg by eller flyplass</Text>
      )}
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { form, setForm, runSearch, auth } = useApp();
  const [problem, setProblem] = useState<string | null>(null);
  const today = toIsoDate(new Date());
  const total = passengerCount(form);

  const submit = () => {
    const err = runSearch();
    setProblem(err);
    if (!err) router.push("/resultater");
  };

  const accountLabel = auth.status === "signedIn" ? (auth.profile?.firstName ?? "Konto") : "Logg inn";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.sand }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Wordmark />
          <Pressable onPress={() => router.push("/konto")} accessibilityRole="button" accessibilityLabel={auth.status === "signedIn" ? "Din konto" : "Logg inn"} style={styles.accountButton} testID="account-button">
            <Text style={styles.accountText}>{accountLabel}</Text>
          </Pressable>
        </View>

        <Title>Hvor vil du reise?</Title>
        <Body muted>Vi sammenligner flypriser og viser dem i norske kroner.</Body>

        <Card>
          <Segmented
            label="Reisetype"
            value={form.tripType}
            options={[
              { value: "roundtrip", label: "Tur-retur" },
              { value: "oneway", label: "Én vei" },
            ]}
            onChange={(tripType) => setForm((f) => ({ ...f, tripType }))}
          />
          <View>
            <AirportButton testID="origin" label="Fra" value={form.origin} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "fra" } })} />
            <Pressable
              onPress={() => setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }))}
              accessibilityRole="button"
              accessibilityLabel="Bytt fra og til"
              style={styles.swap}
              testID="swap"
            >
              <Text style={styles.swapText}>⇅</Text>
            </Pressable>
            <AirportButton testID="destination" label="Til" value={form.destination} onPress={() => router.push({ pathname: "/flyplass", params: { felt: "til" } })} />
          </View>
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
        </Card>

        <Card>
          <SectionTitle>Reisende</SectionTitle>
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
        </Card>

        <Card>
          <SectionTitle>Reiseklasse</SectionTitle>
          <Chips label="Reiseklasse" value={form.cabinClass} options={CABINS.map((c) => c.value)} format={(v) => CABINS.find((c) => c.value === v)?.label ?? v} onChange={(cabinClass) => setForm((f) => ({ ...f, cabinClass }))} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Bare direktefly</Text>
            <Switch accessibilityLabel="Bare direktefly" value={form.directOnly} onValueChange={(directOnly) => setForm((f) => ({ ...f, directOnly }))} trackColor={{ true: colors.azure, false: colors.input }} />
          </View>
        </Card>

        {problem ? (
          <Banner tone="error" testID="form-error">
            {problem}
          </Banner>
        ) : null}
        <Button testID="search-button" label="Søk etter fly" onPress={submit} />
        <Body muted style={{ textAlign: "center" }}>
          Du trenger ikke logge inn for å søke.
        </Body>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accountButton: { minHeight: 44, paddingHorizontal: space.md, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  accountText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.azureInk },
  airport: { minHeight: 60, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.white, justifyContent: "center", marginBottom: space.sm },
  airportLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.textMuted },
  airportValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.petrol },
  iata: { fontFamily: fonts.medium, color: colors.textSecondary },
  airportPlaceholder: { fontFamily: fonts.medium, fontSize: 16, color: colors.textMuted },
  swap: { position: "absolute", right: space.md, top: 42, zIndex: 1, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.input, alignItems: "center", justifyContent: "center" },
  swapText: { fontSize: 18, color: colors.azureInk },
  ageRow: { gap: space.xs, paddingLeft: space.sm },
  ageLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
