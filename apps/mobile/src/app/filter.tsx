import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../lib/appState";
import { applyView, countWith, DEFAULT_VIEW, SORTS, STOPS, TIME_BANDS, type SortKey, type TimeBand } from "../lib/resultsView";
import { Button, Card, Chips, LinkButton, ScreenHeader, SectionTitle, StateView } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";
import { colors, fonts, radius, space, TOUCH } from "../lib/theme";

const BAND_ICON: Record<TimeBand, IconName> = { night: "moon", morning: "sunrise", afternoon: "sun", evening: "sunset" };

function reiser(n: number): string {
  return `${n} ${n === 1 ? "reise" : "reiser"}`;
}

/** Sortering og filtre for resultatlisten. Endringer gjelder med én gang; knappen går tilbake til listen. */
export default function FilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { search, view, setView } = useApp();
  const offers = search.status === "done" ? search.result.offers : null;

  if (!offers || offers.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Filtrer" onBack={() => router.back()} backIcon="close" backLabel="Lukk" />
        <StateView dark icon="filter" title="Ingen reiser å filtrere" body="Søk etter fly først, så kan du sortere og filtrere resultatene." testID="filter-empty" />
      </View>
    );
  }

  const shown = applyView(offers, view).length;
  const toggleBand = (b: TimeBand) =>
    setView((v) => ({ ...v, departBands: v.departBands.includes(b) ? v.departBands.filter((x) => x !== b) : [...v.departBands, b] }));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Filtrer" onBack={() => router.back()} backIcon="close" backLabel="Lukk" />
      <ScrollView contentContainerStyle={styles.content} testID="filter-screen">
        <Card>
          <SectionTitle right={view.sort !== DEFAULT_VIEW.sort ? <LinkButton label="Nullstill" accessibilityLabel="Nullstill sortering" onPress={() => setView((v) => ({ ...v, sort: DEFAULT_VIEW.sort }))} /> : null}>
            Sortering
          </SectionTitle>
          <Chips<SortKey> label="Sorter" value={view.sort} options={SORTS.map((s) => s.value)} format={(v) => SORTS.find((s) => s.value === v)?.label ?? v} onChange={(sort) => setView((v) => ({ ...v, sort }))} testIDPrefix="filter-sort-" />
          <Text style={styles.note}>Tilbud uten pris i kroner står alltid nederst.</Text>
        </Card>

        <Card>
          <SectionTitle right={view.stops !== "any" ? <LinkButton label="Nullstill" accessibilityLabel="Nullstill antall bytter" onPress={() => setView((v) => ({ ...v, stops: "any" }))} /> : null}>
            Antall bytter
          </SectionTitle>
          <View accessibilityRole="radiogroup" accessibilityLabel="Antall bytter" style={{ gap: space.sm }}>
            {STOPS.map((s) => {
              const selected = view.stops === s.value;
              const n = countWith(offers, view, { stops: s.value });
              const disabled = n === 0 && !selected;
              return (
                <Pressable
                  key={s.value}
                  testID={`stops-${s.value}`}
                  onPress={() => setView((v) => ({ ...v, stops: s.value }))}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${s.label}, ${reiser(n)}`}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, disabled && { opacity: 0.45 }, pressed && !selected && { opacity: 0.7 }]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Icon name="check" size={14} color={colors.white} strokeWidth={3} /> : null}</View>
                  <Text style={styles.optionLabel}>{s.label}</Text>
                  <Text style={styles.optionCount}>{reiser(n)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <SectionTitle right={view.departBands.length ? <LinkButton label="Nullstill" accessibilityLabel="Nullstill avgangstid" onPress={() => setView((v) => ({ ...v, departBands: [] }))} /> : null}>
            Avgangstid, utreise
          </SectionTitle>
          <Text style={styles.note}>Lokal tid på flyplassen du reiser fra. Velg ett eller flere tidsrom.</Text>
          <View style={styles.bands}>
            {TIME_BANDS.map((b) => {
              const selected = view.departBands.includes(b.value);
              const n = countWith(offers, view, { departBands: [b.value] });
              const disabled = n === 0 && !selected;
              return (
                <Pressable
                  key={b.value}
                  testID={`band-${b.value}`}
                  onPress={() => toggleBand(b.value)}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled }}
                  accessibilityLabel={`${b.label}, ${b.range}, ${reiser(n)}`}
                  style={({ pressed }) => [styles.band, selected && styles.bandSelected, disabled && { opacity: 0.45 }, pressed && !selected && { opacity: 0.7 }]}
                >
                  <View style={styles.bandTop}>
                    <Text style={[styles.bandLabel, selected && { color: colors.onDarkMuted }]}>{b.label}</Text>
                    <Icon name={BAND_ICON[b.value]} size={22} color={selected ? colors.white : colors.indigo} />
                  </View>
                  <Text style={[styles.bandRange, selected && { color: colors.white }]}>{b.range}</Text>
                  <Text style={[styles.bandCount, selected && { color: colors.onDarkMuted }]}>{reiser(n)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button testID="filter-apply" label={shown ? `Vis ${reiser(shown)}` : "Ingen reiser passer"} disabled={!shown} onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  optionSelected: { backgroundColor: colors.indigoSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.input, alignItems: "center", justifyContent: "center" },
  radioSelected: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  optionLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  optionCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  band: { flexBasis: "48%", flexGrow: 1, minHeight: TOUCH * 2, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: space.md, gap: 2 },
  bandSelected: { backgroundColor: colors.indigo },
  bandTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bandLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  bandRange: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text },
  bandCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.navy },
});
