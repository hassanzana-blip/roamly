import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Airport } from "@contracts/airports";
import { useApp } from "../lib/appState";
import { normalizeQuery } from "../lib/searchForm";
import { ApiError } from "../lib/api";
import { Banner, Field, ScreenHeader, StateView } from "../components/ui";
import { Icon } from "../components/Icon";
import { colors, fonts, radius, space } from "../lib/theme";

/** Flyplassøk (flights.airports på serveren). Brukes for både «Fra» og «Til». */
export default function AirportPicker() {
  const router = useRouter();
  const { felt } = useLocalSearchParams<{ felt?: string }>();
  const field = felt === "til" ? "destination" : "origin";
  const { api, setForm } = useApp();
  const [query, setQuery] = useState("");
  // Svaret lagres sammen med søket det gjelder. Bare et svar for akkurat det
  // som står i feltet nå vises og kan velges – aldri treff fra forrige søk.
  const [answer, setAnswer] = useState<{ key: string; results: Airport[]; error: string | null } | null>(null);

  const q = normalizeQuery(query);
  const key = q.toLowerCase();
  const active = q.length >= 2;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .airports(q, 12)
        .then((results) => {
          if (!cancelled) setAnswer({ key, results, error: null });
        })
        .catch((e: unknown) => {
          if (!cancelled) setAnswer({ key, results: [], error: e instanceof ApiError ? e.message : "Kunne ikke søke etter flyplasser." });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, q, key, active]);

  // Alt som vises er utledet for søket som står i feltet nå.
  const current = active && answer?.key === key ? answer : null;
  const shown = current?.results ?? [];
  const shownError = current?.error ?? null;
  const loading = active && !current;

  const choose = (a: Airport) => {
    const choice = { iata: a.iata, name: a.name, city: a.city, country: a.country };
    setForm((f) => ({ ...f, [field]: choice }));
    router.back();
  };

  const question = field === "origin" ? "Hvor reiser du fra?" : "Hvor skal du?";

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Velg flyplass" onBack={() => router.back()} backIcon="close" backLabel="Lukk" />
      <View style={styles.sheet}>
        <Field
          label={question}
          icon="search"
          placeholder="By eller flyplass, f.eks. Barcelona"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          testID="airport-query"
        />
        {shownError ? (
          <Banner tone="error" testID="airport-error">
            {shownError}
          </Banner>
        ) : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.indigo} testID="airport-loading" />
            <Text style={styles.loadingText}>Søker …</Text>
          </View>
        ) : null}
        <FlatList
          data={shown}
          keyExtractor={(a) => a.iata}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: space.xxl }}
          ListEmptyComponent={
            !active ? (
              <StateView icon="mapPin" title="Finn flyplassen" body="Skriv minst to bokstaver: by, flyplass eller kode, for eksempel Barcelona eller BCN." />
            ) : !loading && !shownError ? (
              <StateView icon="search" title="Fant ingen flyplass" body="Ingen treff. Prøv et annet navn eller en flyplasskode." />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.city}, ${item.name}, ${item.country}, kode ${item.iata}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
              testID={`airport-${item.iata}`}
            >
              <View style={styles.codeBox}>
                <Text style={styles.code}>{item.iata}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.city} numberOfLines={1}>
                  {item.city}
                </Text>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}, {item.country}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  sheet: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, paddingTop: space.xl, gap: space.md },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  loadingText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.md, gap: space.md },
  codeBox: { width: 56, height: 44, borderRadius: radius.sm, backgroundColor: colors.indigoSoft, alignItems: "center", justifyContent: "center" },
  code: { fontFamily: fonts.heavy, fontSize: 16, color: colors.indigoInk, letterSpacing: 0.3 },
  city: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  name: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
});
