import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import { fxNotice } from "../lib/price";
import { formatDay } from "../lib/format";
import { cabinLabel, passengerSummary } from "../lib/searchForm";
import { OfferCard } from "../components/OfferCard";
import { Banner, Body, Button, SectionTitle } from "../components/ui";
import { colors, space } from "../lib/theme";

export default function ResultsScreen() {
  const router = useRouter();
  const { search, runSearch, form } = useApp();

  const summary = [
    form.origin && form.destination ? `${form.origin.city} → ${form.destination.city}` : null,
    form.tripType === "roundtrip" ? `${formatDay(form.departDate)} – ${formatDay(form.returnDate)}` : formatDay(form.departDate),
    passengerSummary(form),
    cabinLabel(form.cabinClass),
  ]
    .filter(Boolean)
    .join(" · ");

  if (search.status === "loading" || search.status === "idle") {
    return (
      <View style={styles.center} testID="results-loading">
        <ActivityIndicator size="large" color={colors.azure} />
        <SectionTitle>Vi sammenligner priser …</SectionTitle>
        <Body muted style={{ textAlign: "center" }}>Det kan ta opptil 20 sekunder.</Body>
      </View>
    );
  }

  if (search.status === "error") {
    return (
      <View style={styles.center} testID="results-error">
        <Banner tone="error">{search.message}</Banner>
        <Button label="Prøv igjen" onPress={() => runSearch()} />
      </View>
    );
  }

  const { result } = search;
  const notice = fxNotice(result);
  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <Body muted>{summary}</Body>
      {result.sandbox || result.demoMode ? (
        <Banner tone="warning" testID="sandbox-banner">
          Testdata: prisene og lenkene er ikke ekte og kan ikke bestilles.
        </Banner>
      ) : null}
      {result.partial ? <Banner tone="warning">Ikke alle leverandører rakk å svare. Søk på nytt for å se flere reiser.</Banner> : null}
      {notice ? (
        <Banner tone={notice.tone} testID="fx-notice">
          {notice.text}
        </Banner>
      ) : null}
      {result.offers.length ? <Body muted>{`${result.offers.length} ${result.offers.length === 1 ? "reise" : "reiser"}, billigste i kroner først`}</Body> : null}
    </View>
  );

  return (
    <FlatList
      testID="results-list"
      style={{ backgroundColor: colors.sand }}
      contentContainerStyle={styles.list}
      data={result.offers}
      keyExtractor={(o) => o.offer.id}
      ListHeaderComponent={header}
      ListEmptyComponent={<Body>Vi fant ingen fly for dette søket. Prøv andre datoer eller flyplasser.</Body>}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      renderItem={({ item }) => <OfferCard item={item} onPress={() => router.push({ pathname: "/tilbud/[id]", params: { id: item.offer.id } })} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md, backgroundColor: colors.sand },
  list: { padding: space.lg, paddingBottom: space.xxl },
});
