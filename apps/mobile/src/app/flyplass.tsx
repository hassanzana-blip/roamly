import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Pressable, Switch, Text } from "../components/a11y";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Airport } from "@contracts/airports";
import { useApp } from "../lib/appState";
import { normalizeQuery, type AirportChoice } from "../lib/searchForm";
import { recentAirports } from "../lib/recent";
import { countryFor, norwayAirports } from "../lib/norwayAirports";
import { DESTINATIONS, destinationChoice } from "../lib/destinations";
import { airportNames, airportRows, cityAlias, localizedChoice, type AirportRow as Row } from "../lib/airportIndex";
import { searchTokens } from "../lib/textMatch";
import { errorText } from "../lib/errorText";
import { useI18n } from "../i18n";
import { Banner, Field, IconButton, LinkButton, StateView } from "../components/ui";
import { MarkedText } from "../components/MarkedText";
import { Icon } from "../components/Icon";
import { colors, radius, space, type } from "../lib/theme";

const NO_TOKENS: readonly string[] = [];

/**
 * Én flyplass i listen: kode, by, navn og land. Under et søk er det kunden skrev uthevet, og koden står
 * invertert når søket er nøyaktig den koden. `alias` er bynavnet på det andre språket når det var det søket
 * traff («København (Copenhagen)»). `near` er byen raden er en annen flyplass for (Torp under Oslo).
 */
function AirportRow({ airport, onPress, tokens, near, alias }: { airport: AirportChoice; onPress: () => void; tokens?: readonly string[]; near?: string | null; alias?: string | null }) {
  const { t } = useI18n();
  const a = t.airport;
  const marked = tokens && tokens.length > 0;
  const codeHit = marked && tokens.length === 1 && tokens[0] === airport.iata.toLowerCase();
  const city = alias ? `${airport.city} (${alias})` : airport.city;
  const label = a.rowLabel(city, airport.name, airport.country, airport.iata);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={near ? `${label}. ${a.near(near)}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.inset }]}
      testID={`airport-${airport.iata}`}
    >
      <View style={[styles.codeBox, codeHit && styles.codeBoxHit]} testID={codeHit ? `airport-${airport.iata}-code-hit` : undefined}>
        <Text style={[type.calloutStrong, { color: codeHit ? colors.white : colors.text, letterSpacing: 0.3 }]}>{airport.iata}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {near ? (
          <Text style={[type.caption, { color: colors.textSecondary }]} testID={`airport-${airport.iata}-near`}>
            {a.near(near)}
          </Text>
        ) : null}
        {marked ? (
          <MarkedText text={city} tokens={tokens} style={[type.body, { color: colors.text }]} markStyle={styles.markPrimary} testID={`airport-${airport.iata}-city`} />
        ) : (
          <Text style={[type.bodyStrong, { color: colors.text }]}>{city}</Text>
        )}
        <MarkedText
          text={airport.country ? `${airport.name}, ${airport.country}` : airport.name}
          tokens={marked ? tokens : NO_TOKENS}
          style={[type.footnote, { color: colors.textSecondary }]}
          markStyle={styles.markSecondary}
          testID={`airport-${airport.iata}-detail`}
        />
      </View>
      <Icon name="chevronRight" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * Før kunden har skrevet noe: flyplassene fra nylige søk, og forslag (Norges
 * hovedflyplasser for «Fra», appens reisemål for «Til»). Alt velges med ett trykk.
 */
function Suggestions({ field, choose }: { field: "origin" | "destination"; choose: (a: AirportChoice) => void }) {
  const { recent } = useApp();
  const { t, locale } = useI18n();
  const a = t.airport;
  // Det kunden ser, er det skjemaet får: navn på appens språk, Norges land som «Norge»/«Norway».
  const shown = (x: AirportChoice) => {
    const c = localizedChoice(x, locale);
    return { ...c, country: countryFor(c, locale) };
  };
  const recents = recentAirports(recent, field).map(shown);
  const pool = (field === "origin" ? norwayAirports(locale) : DESTINATIONS.slice(0, 8).map((d) => destinationChoice(d, locale))).map(shown);
  const suggestions = pool.filter((p) => !recents.some((r) => r.iata === p.iata));
  const section = (title: string, list: AirportChoice[], testID: string) =>
    list.length ? (
      <View style={{ gap: space.xs }} testID={testID}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {list.map((ap) => (
          <AirportRow key={`${testID}-${ap.iata}`} airport={ap} onPress={() => choose(ap)} />
        ))}
      </View>
    ) : null;
  return (
    <View style={{ gap: space.lg, paddingTop: space.sm }}>
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{a.emptyBody}</Text>
      {section(a.recentTitle, recents, "airport-recent")}
      {section(field === "origin" ? a.suggestOrigins : a.suggestDestinations, suggestions, "airport-suggestions")}
    </View>
  );
}

/**
 * Flyplassøk for både «Fra» og «Til». Registerets flyplasser (også på engelsk) vises med én gang; serverens
 * verdensregister (flights.airports) fyller på under når det svarer. Hver rad er én flyplass, og søket bruker
 * nøyaktig den som velges – aldri andre flyplasser i samme by.
 *
 * `hjem=1` (sammen med `felt=fra`): åpnet fra Min side for å velge den vanlige avreiseflyplassen. Da er valget
 * den – det huskes og blir «Fra» i skjemaet – så bryteren «Husk …» står ikke, bare hva det betyr.
 */
export default function AirportPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { felt, hjem } = useLocalSearchParams<{ felt?: string; hjem?: string }>();
  const field = felt === "til" ? "destination" : "origin";
  const homeMode = felt === "fra" && hjem === "1";
  const { api, setForm, homeAirport, setHomeAirport } = useApp();
  // Bare når kunden selv slår det på (eller velger den fra Min side), huskes «Fra» som vanlig avreiseflyplass.
  const [remember, setRemember] = useState(false);
  const i18n = useI18n();
  const { locale } = i18n;
  const a = i18n.t.airport;
  const [query, setQuery] = useState("");
  // Svaret lagres sammen med søket det gjelder. Bare et svar for akkurat det
  // som står i feltet nå vises og kan velges – aldri treff fra forrige søk.
  const [answer, setAnswer] = useState<{ key: string; results: Airport[]; error: unknown } | null>(null);

  const q = normalizeQuery(query);
  const key = q.toLowerCase();
  const active = q.length >= 2;
  const tokens = useMemo(() => searchTokens(q), [q]);

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

  // Alt som vises er utledet for søket som står i feltet nå: registerets treff med én gang, serverens når
  // svaret for akkurat dette søket er her.
  const current = active && answer?.key === key ? answer : null;
  const rows = useMemo(() => (active ? airportRows(q, current?.results ?? null) : []), [active, q, current]);
  const shownError = current?.error ?? null;
  const loading = active && !current;

  const choose = (a: AirportChoice) => {
    const choice = { iata: a.iata, name: a.name, city: a.city, country: a.country };
    setForm((f) => ({ ...f, [field]: choice }));
    if (field === "origin" && (remember || homeMode)) setHomeAirport(choice);
    router.back();
  };
  // Raden viser – og skjemaet får – navnene på appens språk.
  const choiceFor = (row: Row): AirportChoice => ({ iata: row.airport.iata, ...airportNames(row.airport, locale) });

  const question = homeMode ? a.homeQuestion : field === "origin" ? a.from : a.to;
  // Den vanlige avreiseflyplassen med byen på appens språk, som på Min side (lagret «København», vist «Copenhagen»).
  const home = homeAirport ? localizedChoice(homeAirport, locale) : null;

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, space.lg) }]}>
      {/*
        Sidekortet ligger over iOS' svarte bakgrunn, og statuslinjen står over den svarte kanten: lys tekst, som i Expos
        mal for modaler. Appen styrer statuslinjen selv (UIViewControllerBasedStatusBarAppearance er av), så fanen under
        ville ellers bestemt – ofte mørk tekst på svart. Den monteres sist og vinner så lenge søket er oppe.
      */}
      <StatusBar style="light" />
      <View style={styles.head}>
        <IconButton icon="close" label={a.close} variant="light" onPress={() => router.back()} testID="header-back" />
        <Text style={[type.headline, styles.title]} accessibilityRole="header">
          {homeMode ? a.homeTitle : a.title}
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
        {/*
          Tastaturet: bare søkefeltet står fast. Alt annet – forklaringen, «vanlig
          flyplass», feil, lasting, treff, forslag og «Tøm søket» – ligger i listen, som
          på iOS slutter der tastaturet begynner (automaticallyAdjustKeyboardInsets). Da
          kan hver rad rulles fram og trykkes med tastaturet oppe, også med stor tekst;
          første trykk velger (keyboardShouldPersistTaps), og et drag legger bort tastaturet.
        */}
        <FlatList
          style={styles.list}
          data={rows}
          keyExtractor={(r) => r.airport.iata}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          testID="airport-list"
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
          ListHeaderComponent={
            <View style={styles.listHead} testID="airport-list-head">
              <Text style={[type.caption, { color: colors.textSecondary }]}>{a.exactOnly}</Text>
              {field === "origin" ? (
                <View style={{ gap: space.xs }}>
                  {home ? (
                    <View style={styles.homeRow} testID="home-airport">
                      <Text style={[type.footnote, { color: colors.text, flex: 1 }]}>{a.usual(home.city, home.iata)}</Text>
                      <LinkButton label={a.forget} onPress={() => setHomeAirport(null)} testID="forget-home-airport" />
                    </View>
                  ) : null}
                  {homeMode ? (
                    <Text style={[type.footnote, { color: colors.textSecondary }]} testID="home-airport-note">
                      {a.rememberHint}
                    </Text>
                  ) : (
                    <View style={styles.homeRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.footnote, { color: colors.text }]}>{a.remember}</Text>
                        <Text style={[type.caption, { color: colors.textSecondary }]}>{a.rememberHint}</Text>
                      </View>
                      <Switch testID="remember-home-airport" accessibilityLabel={a.remember} value={remember} onValueChange={setRemember} trackColor={{ true: colors.blue, false: colors.lightBorder }} />
                    </View>
                  )}
                </View>
              ) : null}
              {shownError && rows.length === 0 ? (
                <Banner tone="error" testID="airport-error">
                  {errorText(shownError, i18n, { BAD_RESPONSE: a.error })}
                </Banner>
              ) : null}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            !active ? (
              <Suggestions field={field} choose={choose} />
            ) : !loading && !shownError ? (
              <StateView dark={false} icon="search" title={a.noneTitle} body={a.noneBody}>
                <LinkButton label={a.clearQuery} onPress={() => setQuery("")} testID="airport-clear" />
              </StateView>
            ) : null
          }
          // Under treffene: at flere kan komme, eller at de ikke kom. Treffene over står stille imens.
          ListFooterComponent={
            loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.text} testID="airport-loading" />
                <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{rows.length ? a.searchingMore : a.searching}</Text>
              </View>
            ) : shownError && rows.length ? (
              <Text style={[type.footnote, styles.moreError]} testID="airport-more-error">
                {`${a.moreFailed} ${errorText(shownError, i18n, { BAD_RESPONSE: a.error })}`}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const choice = choiceFor(item);
            return (
              <AirportRow
                airport={choice}
                tokens={tokens}
                alias={cityAlias(item.airport, q, locale)}
                near={item.near ? airportNames(item.near, locale).city : null}
                onPress={() => choose(choice)}
              />
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.md },
  title: { flex: 1, textAlign: "center", color: colors.text },
  body: { flex: 1, paddingHorizontal: space.lg, gap: space.sm },
  list: { flex: 1 },
  listHead: { gap: space.md, paddingBottom: space.sm },
  loading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xs },
  moreError: { color: colors.textSecondary, paddingVertical: space.md, paddingHorizontal: space.xs },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.input, gap: space.md },
  // Minst 52 × 40; stor tekst gjør boksen større i stedet for at koden renner ut (hvit på hvitt når den er uthevet).
  codeBox: { minWidth: 52, minHeight: 40, paddingHorizontal: 6, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },
  codeBoxHit: { backgroundColor: colors.text, borderColor: colors.text },
  markPrimary: { fontWeight: "600" },
  markSecondary: { fontWeight: "600", color: colors.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lightBorder, marginLeft: 64 },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textSecondary },
  homeRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
});
