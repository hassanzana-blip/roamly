import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Airport } from "@contracts/airports";
import { useApp } from "../lib/appState";
import { ApiError } from "../lib/api";
import { Banner, Body, Field } from "../components/ui";
import { colors, fonts, space } from "../lib/theme";

/** Flyplassøk (flights.airports på serveren). Brukes for både «Fra» og «Til». */
export default function AirportPicker() {
  const router = useRouter();
  const { felt } = useLocalSearchParams<{ felt?: string }>();
  const field = felt === "til" ? "destination" : "origin";
  const { api, setForm } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();
  const active = q.length >= 2;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .airports(q, 12)
        .then((r) => {
          if (!cancelled) {
            setResults(r);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof ApiError ? e.message : "Kunne ikke søke etter flyplasser.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, q, active]);

  // Under to tegn: ingen treff og ingen feil å vise (utledet, ikke lagret).
  const shown = active ? results : [];
  const shownError = active ? error : null;

  const choose = (a: Airport) => {
    const choice = { iata: a.iata, name: a.name, city: a.city, country: a.country };
    setForm((f) => ({ ...f, [field]: choice }));
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Field
        label={field === "origin" ? "Hvor reiser du fra?" : "Hvor skal du?"}
        placeholder="By eller flyplass, f.eks. Barcelona"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        testID="airport-query"
      />
      {shownError ? <Banner tone="error">{shownError}</Banner> : null}
      {active && loading ? <ActivityIndicator color={colors.azure} /> : null}
      <FlatList
        data={shown}
        keyExtractor={(a) => a.iata}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={active && !loading && !shownError ? <Body muted>Ingen treff. Prøv et annet navn eller en flyplasskode.</Body> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => choose(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.city}, ${item.name}, ${item.country}, kode ${item.iata}`}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
            testID={`airport-${item.iata}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.city}>{item.city}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}, {item.country}
              </Text>
            </View>
            <Text style={styles.code}>{item.iata}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: space.md },
  city: { fontFamily: fonts.bold, fontSize: 16, color: colors.petrol },
  name: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  code: { fontFamily: fonts.bold, fontSize: 15, color: colors.azureInk },
});
