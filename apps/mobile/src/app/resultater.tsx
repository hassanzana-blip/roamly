import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, FlatList, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useApp } from "../lib/appState";
import { fxNotice } from "../lib/price";
import { addDays, formatClock, fromIsoDate, toIsoDate } from "../lib/format";
import { ApiError } from "../lib/api";
import { errorText } from "../lib/errorText";
import { pricesStale, providerDisplayName, resultKind } from "../lib/resultStatus";
import { useI18n } from "../i18n";
import { cabinLabel, passengerSummary } from "../lib/searchForm";
import { activeFilterCount, airlineOptions, applyView, clearedFilters, countWith, legThresholds, priceThresholds, SORTS, STOPS, TIME_BANDS, type ResultsView, type SortKey, type TimeBand } from "../lib/resultsView";
import { groupJourneys } from "../lib/journeys";
import { OfferCard } from "../components/OfferCard";
import { Banner, BottomSheet, Chip, DemoBadge, IconButton, Notices, PrimaryButton, SecondaryButton, StateView, type NoticeItem } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

const BAND_ICON: Record<TimeBand, IconName> = { night: "moon", morning: "sunrise", afternoon: "sun", evening: "sunset" };

/** Knapp i den flytende verktøylinjen nederst. */
function ToolButton({ icon, label, onPress, badge, testID, primary }: { icon: IconName; label: string; onPress: () => void; badge?: number; testID: string; primary?: boolean }) {
  const { t } = useI18n();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? t.common.activeCount(label, badge) : label}
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
function OptionRow({ label, detail, selected, disabled, onPress, testID, multi }: { label: string; detail?: string; selected: boolean; disabled?: boolean; onPress: () => void; testID?: string; multi?: boolean }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={multi ? { checked: selected, disabled: !!disabled } : { selected, disabled: !!disabled }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, disabled && { opacity: 0.4 }, pressed && !selected && { opacity: 0.7 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{label}</Text>
      {detail ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{detail}</Text> : null}
    </Pressable>
  );
}

/** Kan et nytt forsøk hjelpe? Nett, tidsavbrudd, travelt og leverandørbrudd: ja. Ugyldig søk o.l.: nei. */
const RETRY_CODES = new Set(["NETWORK", "TIMEOUT", "BAD_RESPONSE", "RATE_LIMITED", "INTERNAL", "SUPPLIER_UNAVAILABLE", "SUPPLIER_TIMEOUT"]);
function canRetry(err: unknown): boolean {
  return !(err instanceof ApiError) || err.retryable || RETRY_CODES.has(err.code);
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { search, runSearch, cancelSearch, form, setForm, view, setView } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const r = t.results.screen;
  const reiser = t.results.journeys;
  // «Endre søk» går alltid til søkeskjemaet på forsiden – også når søket startet fra Utforsk.
  const editSearch = () => router.navigate("/");
  // Klokke for «prisene kan ha endret seg»: oppdateres hvert halve minutt.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
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

  // VoiceOver: si fra én gang når et søk er ferdig – hvor mange reiser, eller hva som gikk galt.
  const doneCount = search.status === "done" ? groupJourneys(search.result.offers).length : null;
  const announced = search.status === "done" ? r.announceFound(t.results.journeys(doneCount ?? 0)) : search.status === "error" ? errorText(search.error, i18n) : null;
  useEffect(() => {
    if (announced) AccessibilityInfo.announceForAccessibility(announced);
  }, [announced]);
  const filters = activeFilterCount(view);

  // Overskriften beskriver søket som vises – ikke et skjema som er endret etterpå uten å søke.
  const q = search.status === "idle" ? form : search.query;
  const title = q.origin && q.destination ? `${q.origin.city} → ${q.destination.city}` : r.fallbackTitle;
  const dates = q.tripType === "roundtrip" ? `${f.shortDay(q.departDate)} – ${f.shortDay(q.returnDate)}` : f.shortDay(q.departDate);
  const subtitle = `${dates} · ${passengerSummary(q, i18n)} · ${cabinLabel(q.cabinClass, i18n)}`;
  const kind = search.status === "done" ? resultKind(search.result) : null;
  const demo = kind === "demo" || kind === "sandbox";

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <IconButton icon="chevronLeft" label={r.back} variant="plain" onPress={() => router.back()} testID="header-back" />
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          <Text style={[type.headline, { color: colors.onDark }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {demo ? <DemoBadge /> : null}
        </View>
        <Text style={[type.caption, { color: colors.onDarkMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <IconButton icon="search" label={r.editSearch} onPress={editSearch} testID="edit-search" />
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
      <StateView icon="search" title={r.idleTitle} body={r.idleBody} testID="results-empty">
        <PrimaryButton testID="start-search" label={r.startSearch} onPress={() => router.replace("/")} />
      </StateView>,
    );
  }

  if (search.status === "loading") {
    return shell(
      <StateView
        busy
        icon="plane"
        title={r.loadingTitle}
        body={slow ? r.loadingSlow : r.loadingBody}
        testID="results-loading"
      >
        <SecondaryButton
          dark
          testID="cancel-search"
          label={r.cancelSearch}
          onPress={() => {
            cancelSearch();
            router.back();
          }}
        />
      </StateView>,
    );
  }

  if (search.status === "error") {
    return shell(
      <View style={styles.errorBox} testID="results-error">
        <Banner tone="error" dark>
          {errorText(search.error, i18n)}
        </Banner>
        {/* «Prøv igjen» bare når et nytt forsøk kan hjelpe; ellers er «Endre søk» hovedvalget. */}
        {canRetry(search.error) ? (
          <>
            <PrimaryButton label={r.retry} icon="refresh" onPress={() => runSearch()} testID="retry-search" />
            <SecondaryButton dark label={r.editSearch} onPress={editSearch} testID="edit-search-state" />
          </>
        ) : (
          <PrimaryButton label={r.editSearch} onPress={editSearch} testID="edit-search-state" />
        )}
      </View>,
    );
  }

  const { result, at } = search;
  const all = result.offers;
  const notice = fxNotice(result, i18n);
  const checkedAt = formatClock(new Date(at));
  const stale = pricesStale(at, now);
  // Korte linjer, så første reise står høyt oppe; valutaforklaringen kan åpnes.
  // Demo og testmiljø sies rett ut; ekte priser merkes med når de ble sjekket.
  const notices: NoticeItem[] = [
    ...(kind === "demo" ? [{ key: "demo", tone: "warning" as const, text: r.status.demo, testID: "sandbox-banner" }] : []),
    ...(kind === "sandbox" ? [{ key: "sandbox", tone: "warning" as const, text: r.status.sandbox(providerDisplayName(result.provider)), testID: "sandbox-banner" }] : []),
    ...(kind === "unverified" ? [{ key: "unverified", tone: "warning" as const, text: r.status.unverified, testID: "unverified-banner" }] : []),
    ...(result.partial ? [{ key: "partial", tone: "warning" as const, text: r.status.partial, testID: "partial-banner" }] : []),
    // Alt omregnet (bare en opplysning): lukket bak «Om «ca.»-priser»; kortene har «ca.» og kilden.
    // Mangler kronepriser (en advarsel): alltid åpen.
    ...(notice
      ? notice.tone === "info"
        ? [{ key: "fx", tone: notice.tone, text: notice.text, label: t.price.fx.about, testID: "fx-notice" }]
        : [{ key: "fx", tone: notice.tone, text: notice.short, detail: notice.text !== notice.short ? notice.text : undefined, testID: "fx-notice" }]
      : []),
  ];
  const sortLabel = t.results.sorts[view.sort].summary;
  const clearFilters = () => setView(clearedFilters);
  const toggleStops = (value: "direct" | "max1") => setView((v) => ({ ...v, stops: v.stops === value ? "any" : value }));

  const chips: { key: string; label: string; selected: boolean; count: number; onPress: () => void }[] = [
    { key: "all", label: r.chips.all, selected: filters === 0, count: all.length, onPress: clearFilters },
    { key: "direct", label: r.chips.direct, selected: view.stops === "direct", count: countWith(all, view, { stops: "direct" }), onPress: () => toggleStops("direct") },
    { key: "max1", label: r.chips.max1, selected: view.stops === "max1", count: countWith(all, view, { stops: "max1" }), onPress: () => toggleStops("max1") },
    { key: "bags", label: r.chips.bags, selected: view.bags, count: countWith(all, view, { bags: true }), onPress: () => setView((v) => ({ ...v, bags: !v.bags })) },
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
      {kind === "live" || kind === "unverified" ? (
        <View style={styles.statusRow} testID="price-status">
          {stale ? (
            <>
              <Icon name="clock" size={14} color={colors.warningOnDark} />
              <Text style={[type.footnote, { color: colors.warningOnDark, flex: 1 }]}>{r.status.stale(checkedAt)}</Text>
              <Pressable onPress={() => runSearch()} accessibilityRole="button" hitSlop={10} style={styles.sortLink} testID="refresh-prices">
                <Text style={[type.footnoteStrong, { color: colors.onDark }]}>{r.status.refresh}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {kind === "live" ? <View style={styles.liveDot} /> : null}
              <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]}>{kind === "live" ? r.status.live(checkedAt) : r.status.checked(checkedAt)}</Text>
            </>
          )}
        </View>
      ) : null}
      {journeys.length ? (
        <View style={styles.countRow}>
          <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]} testID="result-count">
            {`${reiser(journeys.length)} · ${t.results.offers(shown.length)}`}
            {all.length - shown.length > 0 ? ` · ${t.results.hiddenByFilters(all.length - shown.length)}` : ""}
          </Text>
          <Pressable onPress={() => setSheet("sort")} accessibilityRole="button" accessibilityLabel={r.sortSpoken(sortLabel)} hitSlop={10} style={styles.sortLink} testID="open-sort">
            <Text style={[type.footnoteStrong, { color: colors.onDark }]}>{sortLabel}</Text>
            <Icon name="swap" size={14} color={colors.onDark} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const shownFor = (patch: Parameters<typeof countWith>[2]) => groupJourneys(applyView(all, { ...view, ...patch })).length;
  const hasReturn = all.some((o) => o.offer.slices.length > 1);
  const airlines = airlineOptions(all);
  const prices = priceThresholds(all);
  const legs = legThresholds(all);
  const bandGroup = (key: "departBands" | "returnBands", title: string, hint: string, prefix: string) => (
    <View style={{ gap: space.sm }}>
      <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{hint}</Text>
      <View style={styles.bands}>
        {TIME_BANDS.map((b) => {
          const selected = view[key].includes(b.value);
          const n = shownFor({ [key]: [b.value] } as Partial<ResultsView>);
          const disabled = n === 0 && !selected;
          return (
            <Pressable
              key={b.value}
              testID={`${prefix}-${b.value}`}
              onPress={() => setView((v) => ({ ...v, [key]: selected ? v[key].filter((x) => x !== b.value) : [...v[key], b.value] }))}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={r.bandSpoken(t.results.bands[b.value], b.range, reiser(n))}
              style={({ pressed }) => [styles.band, selected && styles.bandOn, disabled && { opacity: 0.4 }, pressed && !selected && { opacity: 0.7 }]}
            >
              <View style={styles.bandTop}>
                <Text style={[type.footnote, { color: selected ? colors.white : colors.textSecondary }]}>{t.results.bands[b.value]}</Text>
                <Icon name={BAND_ICON[b.value]} size={18} color={selected ? colors.white : colors.text} strokeWidth={1.75} />
              </View>
              <Text style={[type.bodyStrong, type.tabular, { color: selected ? colors.white : colors.text }]}>{b.range}</Text>
              <Text style={[type.caption, { color: selected ? colors.white : colors.textSecondary }]}>{reiser(n)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

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
            <StateView icon="filter" title={r.noMatchTitle} body={r.noMatchBody(reiser(all.length))}>
              <PrimaryButton label={r.clearFilters} testID="reset-filters" onPress={clearFilters} />
            </StateView>
          ) : (
            <StateView icon="plane" title={r.noFlightsTitle} body={r.noFlightsBody}>
              <SecondaryButton dark label={r.editSearch} onPress={editSearch} testID="edit-search-state" />
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
            <ToolButton icon="filter" label={r.filter} primary badge={filters} onPress={() => setSheet("filter")} testID="open-filters" />
            <View style={styles.toolDivider} />
            <ToolButton icon="swap" label={r.sort} onPress={() => setSheet("sort")} testID="open-sort-toolbar" />
            <View style={styles.toolDivider} />
            <ToolButton icon="calendar" label={r.dates} onPress={() => setSheet("dates")} testID="open-dates" />
          </View>
        </View>
      ) : null}

      <BottomSheet
        visible={sheet === "filter"}
        title={r.filter}
        onClose={() => setSheet(null)}
        testID="filter-sheet"
        footer={
          <View style={{ gap: space.sm }}>
            <PrimaryButton testID="filter-apply" label={shownFor({}) ? r.show(reiser(shownFor({}))) : r.noneMatch} disabled={!shownFor({})} onPress={() => setSheet(null)} />
            {filters ? <SecondaryButton label={r.clearFilters} onPress={clearFilters} testID="filter-reset" /> : null}
          </View>
        }
      >
        <ScrollView contentContainerStyle={{ gap: space.lg }} testID="filter-screen">
          <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.stopsTitle}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{r.stopsTitle}</Text>
            {STOPS.map((value) => {
              const n = shownFor({ stops: value });
              const selected = view.stops === value;
              return <OptionRow key={value} testID={`stops-${value}`} label={t.results.stops[value]} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, stops: value }))} />;
            })}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{r.bagsTitle}</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.bagsDetail(reiser(shownFor({ bags: true })))}</Text>
            </View>
            <Switch
              testID="bags-switch"
              accessibilityLabel={r.bagsTitle}
              value={view.bags}
              disabled={!view.bags && !shownFor({ bags: true })}
              onValueChange={(bags) => setView((v) => ({ ...v, bags }))}
              trackColor={{ true: colors.blue, false: colors.lightBorder }}
            />
          </View>
          {bandGroup("departBands", r.departTitle, r.departHint, "band")}
          {hasReturn ? bandGroup("returnBands", r.returnTitle, r.returnHint, "return-band") : null}
          {airlines.length > 1 ? (
            <View style={{ gap: space.sm }} accessibilityLabel={r.airlinesTitle}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{r.airlinesTitle}</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.airlinesHint}</Text>
              {airlines.map((a) => {
                const selected = view.airlines.includes(a.iata);
                const n = shownFor({ airlines: [a.iata] });
                return (
                  <OptionRow
                    key={a.iata}
                    multi
                    testID={`airline-${a.iata}`}
                    label={r.airlineRow(a.name, a.iata)}
                    detail={reiser(n)}
                    selected={selected}
                    disabled={!n && !selected}
                    onPress={() => setView((v) => ({ ...v, airlines: selected ? v.airlines.filter((x) => x !== a.iata) : [...v.airlines, a.iata] }))}
                  />
                );
              })}
            </View>
          ) : null}
          {prices.length ? (
            <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.priceTitle}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{r.priceTitle}</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.priceHint}</Text>
              <OptionRow testID="price-any" label={r.anyPrice} detail={reiser(shownFor({ maxPriceMinor: null }))} selected={view.maxPriceMinor === null} onPress={() => setView((v) => ({ ...v, maxPriceMinor: null }))} />
              {prices.map((p) => {
                const n = shownFor({ maxPriceMinor: p });
                const selected = view.maxPriceMinor === p;
                return <OptionRow key={p} testID={`price-${p}`} label={r.upTo(f.nok(p))} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, maxPriceMinor: p }))} />;
              })}
            </View>
          ) : null}
          {legs.length ? (
            <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.legTitle}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{r.legTitle}</Text>
              <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.legHint}</Text>
              <OptionRow testID="leg-any" label={r.anyLength} detail={reiser(shownFor({ maxLegMinutes: null }))} selected={view.maxLegMinutes === null} onPress={() => setView((v) => ({ ...v, maxLegMinutes: null }))} />
              {legs.map((m) => {
                const n = shownFor({ maxLegMinutes: m });
                const selected = view.maxLegMinutes === m;
                return <OptionRow key={m} testID={`leg-${m}`} label={r.upTo(f.duration(m))} detail={reiser(n)} selected={selected} disabled={!n && !selected} onPress={() => setView((v) => ({ ...v, maxLegMinutes: m }))} />;
              })}
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={sheet === "sort"} title={r.sort} onClose={() => setSheet(null)} testID="sort-sheet">
        <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={r.sortingLabel}>
          {SORTS.map((value) => (
            <OptionRow
              key={value}
              testID={`sort-${value}`}
              label={t.results.sorts[value].label}
              detail={t.results.sorts[value].summary}
              selected={view.sort === value}
              onPress={() => {
                setView((v) => ({ ...v, sort: value as SortKey }));
                setSheet(null);
              }}
            />
          ))}
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.noNokLast}</Text>
          {all.some((o) => o.price.nok.kind === "converted") ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{r.approxRanking}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === "dates"} title={r.dates} onClose={() => setSheet(null)} testID="dates-sheet">
        <View style={{ gap: space.md }}>
          <View style={styles.dateRow}>
            <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{r.departDate(f.day(form.departDate))}</Text>
            <DateTimePicker
              testID="dates-depart"
              value={fromIsoDate(form.departDate)}
              minimumDate={new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "compact" : "default"}
              locale={locale === "nb" ? "nb-NO" : "en-GB"}
              accentColor={colors.blue}
              themeVariant="light"
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                if (!d) return;
                const departDate = toIsoDate(d);
                setForm((prev) => ({ ...prev, departDate, returnDate: prev.returnDate < departDate ? addDays(departDate, 7) : prev.returnDate }));
              }}
            />
          </View>
          {form.tripType === "roundtrip" ? (
            <View style={styles.dateRow}>
              <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{r.returnDate(f.day(form.returnDate))}</Text>
              <DateTimePicker
                testID="dates-return"
                value={fromIsoDate(form.returnDate)}
                minimumDate={fromIsoDate(form.departDate)}
                mode="date"
                display={Platform.OS === "ios" ? "compact" : "default"}
                locale={locale === "nb" ? "nb-NO" : "en-GB"}
                accentColor={colors.blue}
                themeVariant="light"
                onChange={(_e: DateTimePickerEvent, d?: Date) => {
                  if (d) setForm((prev) => ({ ...prev, returnDate: toIsoDate(d) }));
                }}
              />
            </View>
          ) : null}
          <PrimaryButton
            testID="dates-search"
            label={r.searchAgain}
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
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm },
  headerText: { flex: 1, alignItems: "center", gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm, maxWidth: "100%" },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  notices: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xs, minHeight: 28 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3DDC84" },
  countRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.xs, minHeight: TOUCH },
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
