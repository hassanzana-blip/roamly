import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useApp } from "../lib/appState";
import { fxNotice } from "../lib/price";
import { addDays, formatDay, formatShortDay, fromIsoDate, toIsoDate } from "../lib/format";
import { cabinLabel, passengerSummary } from "../lib/searchForm";
import { activeFilterCount, applyView, countWith, SORTS, STOPS, TIME_BANDS, type SortKey, type TimeBand } from "../lib/resultsView";
import { groupJourneys } from "../lib/journeys";
import { OfferCard } from "../components/OfferCard";
import { Banner, BottomSheet, Chip, DemoBadge, IconButton, Notices, PrimaryButton, SecondaryButton, StateView, type NoticeItem } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

const BAND_ICON: Record<TimeBand, IconName> = { night: "moon", morning: "sunrise", afternoon: "sun", evening: "sunset" };
const reiser = (n: number) => `${n} ${n === 1 ? "reise" : "reiser"}`;

/** Knapp i den flytende verktøylinjen nederst. */
function ToolButton({ icon, label, onPress, badge, testID, primary }: { icon: IconName; label: string; onPress: () => void; badge?: number; testID: string; primary?: boolean }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} aktive` : label}
      style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.toolIcon, primary && { backgroundColor: colors.blue }]}>
        <Icon name={icon} size={16} color={colors.white} />
        {badge ? (
          <View style={styles.toolBadge}>
            <Text style={styles.toolBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[type.footnoteStrong, { color: colors.onDark }]}>{label}</Text>
    </Pressable>
  );
}

/** Radioknapp-rad i arkene. */
function OptionRow({ label, detail, selected, disabled, onPress, testID }: { label: string; detail?: string; selected: boolean; disabled?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, disabled && { opacity: 0.4 }, pressed && !selected && { opacity: 0.7 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{label}</Text>
      {detail ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{detail}</Text> : null}
    </Pressable>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { search, runSearch, form, setForm, view, setView } = useApp();
  const [sheet, setSheet] = useState<null | "filter" | "sort" | "dates">(null);
  // En treg leverandør: si fra etter en stund, i stedet for å bare vise en
  // spinner. Tidtakeren merker akkurat dette søket; et nytt søk starter på nytt.
  const [slowSearch, setSlowSearch] = useState<object | null>(null);
  useEffect(() => {
    if (search.status !== "loading") return;
    const t = setTimeout(() => setSlowSearch(search), 8_000);
    return () => clearTimeout(t);
  }, [search]);
  const slow = search.status === "loading" && slowSearch === search;

  const offers = search.status === "done" ? search.result.offers : null;
  const shown = useMemo(() => (offers ? applyView(offers, view) : []), [offers, view]);
  const journeys = useMemo(() => groupJourneys(shown), [shown]);
  const filters = activeFilterCount(view);

  const title = form.origin && form.destination ? `${form.origin.city} → ${form.destination.city}` : "Flyreiser";
  const dates = form.tripType === "roundtrip" ? `${formatShortDay(form.departDate)} – ${formatShortDay(form.returnDate)}` : formatShortDay(form.departDate);
  const subtitle = `${dates} · ${passengerSummary(form)} · ${cabinLabel(form.cabinClass)}`;
  const demo = search.status === "done" && (search.result.sandbox === true || search.result.demoMode);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <IconButton icon="chevronLeft" label="Tilbake" variant="plain" onPress={() => router.back()} testID="header-back" />
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          <Text style={[type.headline, { color: colors.onDark }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {demo ? <DemoBadge /> : null}
        </View>
        <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <IconButton icon="search" label="Endre søk" onPress={() => router.back()} testID="edit-search" />
    </View>
  );

  const shell = (children: ReactNode) => (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {header}
      {children}
    </View>
  );

  if (search.status === "idle") {
    // Åpnet uten et søk (lenke, omstart eller tilbakestilt tilstand): ingen evig spinner.
    return shell(
      <StateView icon="search" title="Ingen søk ennå" body="Velg reisemål og datoer, så sammenligner vi prisene for deg." testID="results-empty">
        <PrimaryButton testID="start-search" label="Start et søk" onPress={() => router.replace("/")} />
      </StateView>,
    );
  }

  if (search.status === "loading") {
    return shell(
      <StateView
        busy
        icon="plane"
        title="Vi sammenligner priser …"
        body={slow ? "Noen tilbydere bruker lenger tid enn vanlig. Vi venter på svarene deres." : "Det kan ta opptil 20 sekunder."}
        testID="results-loading"
      />,
    );
  }

  if (search.status === "error") {
    return shell(
      <View style={styles.errorBox} testID="results-error">
        <Banner tone="error" dark>
          {search.message}
        </Banner>
        <PrimaryButton label="Prøv igjen" icon="refresh" onPress={() => runSearch()} />
        <SecondaryButton dark label="Endre søk" onPress={() => router.back()} />
      </View>,
    );
  }

  const { result } = search;
  const all = result.offers;
  const notice = fxNotice(result);
  // Korte linjer, så første reise står høyt oppe; valutaforklaringen kan åpnes.
  const notices: NoticeItem[] = [
    ...(demo ? [{ key: "demo", tone: "warning" as const, text: "Demo: testdata, ikke ekte tilbud.", testID: "sandbox-banner" }] : []),
    ...(result.partial ? [{ key: "partial", tone: "warning" as const, text: "Ikke alle tilbydere rakk å svare. Søk på nytt for å se flere reiser." }] : []),
    ...(notice ? [{ key: "fx", tone: notice.tone, text: notice.short, detail: notice.text !== notice.short ? notice.text : undefined, testID: "fx-notice" }] : []),
  ];
  const sortLabel = SORTS.find((s) => s.value === view.sort)?.summary ?? "";
  const clearFilters = () => setView((v) => ({ ...v, stops: "any", bags: false, departBands: [] }));
  const toggleStops = (value: "direct" | "max1") => setView((v) => ({ ...v, stops: v.stops === value ? "any" : value }));

  const chips: { key: string; label: string; selected: boolean; count: number; onPress: () => void }[] = [
    { key: "all", label: "Alle", selected: filters === 0, count: all.length, onPress: clearFilters },
    { key: "direct", label: "Direkte", selected: view.stops === "direct", count: countWith(all, view, { stops: "direct" }), onPress: () => toggleStops("direct") },
    { key: "max1", label: "Maks 1 mellomlanding", selected: view.stops === "max1", count: countWith(all, view, { stops: "max1" }), onPress: () => toggleStops("max1") },
    { key: "bags", label: "Bagasje inkludert", selected: view.bags, count: countWith(all, view, { bags: true }), onPress: () => setView((v) => ({ ...v, bags: !v.bags })) },
  ];

  const listHeader = (
    <View>
      {header}
      {all.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips
            .filter((c) => c.key === "all" || c.selected || c.count > 0)
            .map((c) => (
              <Chip key={c.key} testID={`chip-${c.key}`} label={c.label} selected={c.selected} onPress={c.onPress} />
            ))}
        </ScrollView>
      ) : null}
      {notices.length ? (
        <View style={styles.notices}>
          <Notices items={notices} />
        </View>
      ) : null}
      {journeys.length ? (
        <View style={styles.countRow}>
          <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]} testID="result-count">
            {`${reiser(journeys.length)} · ${shown.length} tilbud`}
            {all.length - shown.length > 0 ? ` · ${all.length - shown.length} skjult av filtre` : ""}
          </Text>
          <Pressable onPress={() => setSheet("sort")} accessibilityRole="button" accessibilityLabel={`Sortering: ${sortLabel}. Endre`} hitSlop={10} style={styles.sortLink} testID="open-sort">
            <Text style={[type.footnoteStrong, { color: colors.onDark }]}>{sortLabel}</Text>
            <Icon name="swap" size={14} color={colors.onDark} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const shownFor = (patch: Parameters<typeof countWith>[2]) => groupJourneys(applyView(all, { ...view, ...patch })).length;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <FlatList
        testID="results-list"
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        data={journeys}
        keyExtractor={(j) => j.key}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          all.length ? (
            <StateView icon="filter" title="Ingen reiser passer filtrene" body={`${reiser(all.length)} er skjult. Endre eller nullstill filtrene.`}>
              <PrimaryButton label="Nullstill filtre" testID="reset-filters" onPress={clearFilters} />
            </StateView>
          ) : (
            <StateView icon="plane" title="Ingen fly funnet" body="Vi fant ingen fly for dette søket. Prøv andre datoer eller flyplasser.">
              <SecondaryButton dark label="Endre søk" onPress={() => router.back()} />
            </StateView>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <OfferCard journey={item} onPress={() => router.push({ pathname: "/tilbud/[id]", params: { id: item.best.offer.id } })} />
          </View>
        )}
      />

      {all.length ? (
        <View style={[styles.toolbarWrap, { bottom: insets.bottom + space.sm }]} pointerEvents="box-none">
          <View style={styles.toolbar}>
            <ToolButton icon="filter" label="Filtrer" primary badge={filters} onPress={() => setSheet("filter")} testID="open-filters" />
            <View style={styles.toolDivider} />
            <ToolButton icon="swap" label="Sorter" onPress={() => setSheet("sort")} testID="open-sort-toolbar" />
            <View style={styles.toolDivider} />
            <ToolButton icon="calendar" label="Datoer" onPress={() => setSheet("dates")} testID="open-dates" />
          </View>
        </View>
      ) : null}

      <BottomSheet
        visible={sheet === "filter"}
        title="Filtrer"
        onClose={() => setSheet(null)}
        testID="filter-sheet"
        footer={
          <View style={{ gap: space.sm }}>
            <PrimaryButton testID="filter-apply" label={shownFor({}) ? `Vis ${reiser(shownFor({}))}` : "Ingen reiser passer"} disabled={!shownFor({})} onPress={() => setSheet(null)} />
            {filters ? <SecondaryButton label="Nullstill filtre" onPress={clearFilters} testID="filter-reset" /> : null}
          </View>
        }
      >
        <ScrollView contentContainerStyle={{ gap: space.lg }} testID="filter-screen">
          <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Mellomlandinger">
            <Text style={[type.bodyStrong, { color: colors.text }]}>Mellomlandinger</Text>
            {STOPS.map((s) => {
              const n = shownFor({ stops: s.value });
              const selected = view.stops === s.value;
              return <OptionRow key={s.value} testID={`stops-${s.value}`} label={s.label} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, stops: s.value }))} />;
            })}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Innsjekket bagasje inkludert</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{`Ifølge tilbyderen · ${reiser(shownFor({ bags: true }))}`}</Text>
            </View>
            <Switch
              testID="bags-switch"
              accessibilityLabel="Innsjekket bagasje inkludert"
              value={view.bags}
              disabled={!view.bags && !shownFor({ bags: true })}
              onValueChange={(bags) => setView((v) => ({ ...v, bags }))}
              trackColor={{ true: colors.blue, false: colors.lightBorder }}
            />
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>Avgangstid, utreise</Text>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>Lokal tid på flyplassen du reiser fra.</Text>
            <View style={styles.bands}>
              {TIME_BANDS.map((b) => {
                const selected = view.departBands.includes(b.value);
                const n = shownFor({ departBands: [b.value] });
                const disabled = n === 0 && !selected;
                return (
                  <Pressable
                    key={b.value}
                    testID={`band-${b.value}`}
                    onPress={() => setView((v) => ({ ...v, departBands: selected ? v.departBands.filter((x) => x !== b.value) : [...v.departBands, b.value] }))}
                    disabled={disabled}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled }}
                    accessibilityLabel={`${b.label}, ${b.range}, ${reiser(n)}`}
                    style={({ pressed }) => [styles.band, selected && styles.bandOn, disabled && { opacity: 0.4 }, pressed && !selected && { opacity: 0.7 }]}
                  >
                    <View style={styles.bandTop}>
                      <Text style={[type.footnote, { color: selected ? colors.white : colors.textSecondary }]}>{b.label}</Text>
                      <Icon name={BAND_ICON[b.value]} size={18} color={selected ? colors.white : colors.text} strokeWidth={1.75} />
                    </View>
                    <Text style={[type.bodyStrong, type.tabular, { color: selected ? colors.white : colors.text }]}>{b.range}</Text>
                    <Text style={[type.caption, { color: selected ? colors.white : colors.textSecondary }]}>{reiser(n)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={sheet === "sort"} title="Sorter" onClose={() => setSheet(null)} testID="sort-sheet">
        <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Sortering">
          {SORTS.map((s) => (
            <OptionRow
              key={s.value}
              testID={`sort-${s.value}`}
              label={s.label}
              selected={view.sort === s.value}
              onPress={() => {
                setView((v) => ({ ...v, sort: s.value as SortKey }));
                setSheet(null);
              }}
            />
          ))}
          <Text style={[type.footnote, { color: colors.textSecondary }]}>Tilbud uten pris i kroner står alltid nederst.</Text>
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === "dates"} title="Datoer" onClose={() => setSheet(null)} testID="dates-sheet">
        <View style={{ gap: space.md }}>
          <View style={styles.dateRow}>
            <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{`Avreise · ${formatDay(form.departDate)}`}</Text>
            <DateTimePicker
              testID="dates-depart"
              value={fromIsoDate(form.departDate)}
              minimumDate={new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "compact" : "default"}
              locale="nb-NO"
              accentColor={colors.blue}
              themeVariant="light"
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                if (!d) return;
                const departDate = toIsoDate(d);
                setForm((f) => ({ ...f, departDate, returnDate: f.returnDate < departDate ? addDays(departDate, 7) : f.returnDate }));
              }}
            />
          </View>
          {form.tripType === "roundtrip" ? (
            <View style={styles.dateRow}>
              <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{`Retur · ${formatDay(form.returnDate)}`}</Text>
              <DateTimePicker
                testID="dates-return"
                value={fromIsoDate(form.returnDate)}
                minimumDate={fromIsoDate(form.departDate)}
                mode="date"
                display={Platform.OS === "ios" ? "compact" : "default"}
                locale="nb-NO"
                accentColor={colors.blue}
                themeVariant="light"
                onChange={(_e: DateTimePickerEvent, d?: Date) => {
                  if (d) setForm((f) => ({ ...f, returnDate: toIsoDate(d) }));
                }}
              />
            </View>
          ) : null}
          <PrimaryButton
            testID="dates-search"
            label="Søk på nytt"
            icon="search"
            onPress={() => {
              setSheet(null);
              runSearch();
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  headerText: { flex: 1, alignItems: "center", gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm, maxWidth: "100%" },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md },
  notices: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  countRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md, minHeight: TOUCH },
  sortLink: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: TOUCH },
  item: { paddingHorizontal: space.lg },
  errorBox: { padding: space.lg, gap: space.md },
  toolbarWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.raised, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.darkBorder, paddingHorizontal: space.sm, paddingVertical: 6 },
  tool: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: TOUCH, paddingHorizontal: space.md },
  toolIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.darkBorder, alignItems: "center", justifyContent: "center" },
  toolBadge: { position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  toolBadgeText: { fontSize: 10, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  toolDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: colors.darkBorder },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder },
  optionSelected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  band: { flexBasis: "47%", flexGrow: 1, minHeight: 84, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder, padding: space.md, gap: 2 },
  bandOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  bandTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52 },
});
