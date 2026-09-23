import { useMemo, type ReactNode } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import { fxNotice } from "../lib/price";
import { formatDay } from "../lib/format";
import { cabinLabel, passengerSummary } from "../lib/searchForm";
import { activeFilterCount, applyView, SORTS, type SortKey } from "../lib/resultsView";
import { OfferCard } from "../components/OfferCard";
import { Banner, Button, Chips, CircleButton, RouteHero, ScreenHeader, StateView } from "../components/ui";
import { colors, fonts, space } from "../lib/theme";

export default function ResultsScreen() {
  const router = useRouter();
  const { search, runSearch, form, view, setView } = useApp();

  const summary = [
    form.tripType === "roundtrip" ? `${formatDay(form.departDate)} – ${formatDay(form.returnDate)}` : formatDay(form.departDate),
    passengerSummary(form),
    cabinLabel(form.cabinClass),
  ]
    .filter(Boolean)
    .join(" · ");

  const from = form.origin ? { code: form.origin.iata, city: form.origin.city } : null;
  const to = form.destination ? { code: form.destination.iata, city: form.destination.city } : null;
  const route = from && to ? <RouteHero from={from} to={to} label={`Fra ${from.city} til ${to.city}`} /> : null;

  const offers = search.status === "done" ? search.result.offers : null;
  const shown = useMemo(() => (offers ? applyView(offers, view) : []), [offers, view]);
  const filters = activeFilterCount(view);

  const header = (children?: ReactNode, right?: ReactNode) => (
    <ScreenHeader title="Flyreiser" onBack={() => router.back()} right={right}>
      {route}
      {children}
    </ScreenHeader>
  );

  if (search.status === "idle") {
    // Åpnet uten et søk (lenke, omstart eller tilbakestilt tilstand): ingen evig spinner.
    return (
      <View style={styles.screen}>
        {header()}
        <StateView dark icon="search" title="Ingen søk ennå" body="Velg reisemål og datoer, så sammenligner vi prisene for deg." testID="results-empty">
          <Button testID="start-search" label="Start et søk" onPress={() => router.replace("/")} />
        </StateView>
      </View>
    );
  }

  if (search.status === "loading") {
    return (
      <View style={styles.screen}>
        {header(<Text style={styles.summary}>{summary}</Text>)}
        <StateView dark busy icon="plane" title="Vi sammenligner priser …" body="Det kan ta opptil 20 sekunder." testID="results-loading" />
      </View>
    );
  }

  if (search.status === "error") {
    return (
      <View style={styles.screen}>
        {header(<Text style={styles.summary}>{summary}</Text>)}
        <View style={styles.errorBox} testID="results-error">
          <Banner tone="error">{search.message}</Banner>
          <Button label="Prøv igjen" icon="refresh" onPress={() => runSearch()} />
          <Button label="Endre søk" variant="onDark" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const { result } = search;
  const notice = fxNotice(result);
  const sortSummary = SORTS.find((s) => s.value === view.sort)?.summary ?? "";
  const hidden = result.offers.length - shown.length;

  const listHeader = (
    <View>
      {header(
        <View style={{ gap: space.md }}>
          <Text style={styles.summary}>{summary}</Text>
          {result.offers.length > 1 ? (
            <Chips<SortKey>
              dark
              label="Sorter"
              value={view.sort}
              options={SORTS.map((s) => s.value)}
              format={(v) => SORTS.find((s) => s.value === v)?.label ?? v}
              onChange={(sort) => setView((v) => ({ ...v, sort }))}
              testIDPrefix="sort-"
            />
          ) : null}
        </View>,
        result.offers.length > 1 ? <CircleButton icon="filter" label="Filtrer" badge={filters} onPress={() => router.push("/filter")} testID="open-filters" /> : undefined,
      )}
      <View style={styles.notices}>
        {result.sandbox || result.demoMode ? (
          <Banner tone="warning" testID="sandbox-banner">
            Testdata: prisene er ikke ekte.
          </Banner>
        ) : null}
        {result.partial ? <Banner tone="warning">Ikke alle leverandører rakk å svare. Søk på nytt for å se flere reiser.</Banner> : null}
        {notice ? (
          <Banner tone={notice.tone} testID="fx-notice">
            {notice.text}
          </Banner>
        ) : null}
        {shown.length ? (
          <Text style={styles.count}>
            {`${shown.length} ${shown.length === 1 ? "reise" : "reiser"}, ${sortSummary}`}
            {hidden > 0 ? ` · ${hidden} skjult av filtre` : ""}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      testID="results-list"
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={shown}
      keyExtractor={(o) => o.offer.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        result.offers.length ? (
          <StateView dark icon="filter" title="Ingen reiser passer filtrene" body={`${result.offers.length} ${result.offers.length === 1 ? "reise er" : "reiser er"} skjult. Endre eller nullstill filtrene.`}>
            <Button label="Nullstill filtre" testID="reset-filters" onPress={() => setView((v) => ({ ...v, stops: "any", departBands: [] }))} />
          </StateView>
        ) : (
          <StateView dark icon="plane" title="Ingen fly funnet" body="Vi fant ingen fly for dette søket. Prøv andre datoer eller flyplasser.">
            <Button label="Endre søk" variant="onDark" onPress={() => router.back()} />
          </StateView>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <OfferCard item={item} onPress={() => router.push({ pathname: "/tilbud/[id]", params: { id: item.offer.id } })} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  list: { paddingBottom: space.xxxl },
  summary: { fontFamily: fonts.medium, fontSize: 13, color: colors.onDarkMuted, textAlign: "center" },
  notices: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onDarkMuted },
  item: { paddingHorizontal: space.lg },
  errorBox: { padding: space.lg, gap: space.md },
});
