import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Airport } from "@contracts/airports";
import { useApp } from "../lib/appState";
import { normalizeQuery } from "../lib/searchForm";
import { errorText } from "../lib/errorText";
import { useI18n } from "../i18n";
import { Banner, Field, IconButton, StateView } from "../components/ui";
import { Icon } from "../components/Icon";
import { colors, radius, space, type } from "../lib/theme";

/**
 * Flyplassøk (flights.airports på serveren), for både «Fra» og «Til».
 * Registeret har bare enkeltflyplasser, og søket bruker nøyaktig den som
 * velges – aldri andre flyplasser i samme by.
 */
export default function AirportPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { felt } = useLocalSearchParams<{ felt?: string }>();
  const field = felt === "til" ? "destination" : "origin";
  const { api, setForm } = useApp();
  const i18n = useI18n();
  const a = i18n.t.airport;
  const [query, setQuery] = useState("");
  // Svaret lagres sammen med søket det gjelder. Bare et svar for akkurat det
  // som står i feltet nå vises og kan velges – aldri treff fra forrige søk.
  const [answer, setAnswer] = useState<{ key: string; results: Airport[]; error: unknown } | null>(null);

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
          if (!cancelled) setAnswer({ key, results: [], error: e ?? new Error("airports") });
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

  const question = field === "origin" ? a.from : a.to;

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, space.lg) }]}>
      <View style={styles.head}>
        <IconButton icon="close" label={a.close} variant="light" onPress={() => router.back()} testID="header-back" />
        <Text style={[type.headline, styles.title]} accessibilityRole="header">
          {a.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.body}>
        <Field
          label={question}
          icon="search"
          placeholder={a.placeholder}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          testID="airport-query"
        />
        <Text style={[type.caption, { color: colors.textSecondary }]}>{a.exactOnly}</Text>
        {shownError ? (
          <Banner tone="error" testID="airport-error">
            {errorText(shownError, i18n, { BAD_RESPONSE: a.error })}
          </Banner>
        ) : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} testID="airport-loading" />
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{a.searching}</Text>
          </View>
        ) : null}
        <FlatList
          data={shown}
          keyExtractor={(a) => a.iata}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            !active ? (
              <StateView dark={false} icon="mapPin" title={a.emptyTitle} body={a.emptyBody} />
            ) : !loading && !shownError ? (
              <StateView dark={false} icon="search" title={a.noneTitle} body={a.noneBody} />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={a.rowLabel(item.city, item.name, item.country, item.iata)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.inset }]}
              testID={`airport-${item.iata}`}
            >
              <View style={styles.codeBox}>
                <Text style={[type.calloutStrong, { color: colors.text, letterSpacing: 0.3 }]}>{item.iata}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                  {item.city}
                </Text>
                <Text style={[type.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.name}, {item.country}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.md },
  title: { flex: 1, textAlign: "center", color: colors.text },
  body: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.input, gap: space.md },
  codeBox: { width: 52, height: 40, borderRadius: radius.sm, backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lightBorder, marginLeft: 64 },
});
