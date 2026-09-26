import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Switch, Text } from "./a11y";
import { useApp } from "../lib/appState";
import { CABINS, CHILD_AGES, DEFAULT_CHILD_AGE, DEFAULT_INFANT_AGE, INFANT_AGES, MAX_PASSENGERS, cabinLabel, passengerCount, passengerSummary } from "../lib/searchForm";
import { useI18n } from "../i18n";
import { BottomSheet, ChoiceChips, Stepper } from "./ui";
import { Icon } from "./Icon";
import { colors, space, type } from "../lib/theme";

/**
 * Reisende, reiseklasse og «bare direktefly» i ett ark – på forsiden, i Utforsk og fra søket i toppen av resultatene.
 * Sammendraget står øverst, og en regel som stopper en knapp (spedbarn per voksen, ni reisende) står rett under den.
 * Alt skrives til søkeskjemaet. `footer`: handlingen nederst der valget skal bekreftes (resultatene: «Søk på nytt»).
 */
export function TravellersSheet({ visible, onClose, footer }: { visible: boolean; onClose: () => void; footer?: ReactNode }) {
  const { form, setForm } = useApp();
  const i18n = useI18n();
  const h = i18n.t.home;
  const total = passengerCount(form);
  const infants = form.infantAges.length;
  return (
    <BottomSheet visible={visible} title={h.travellersSheet} onClose={onClose} testID="travellers-sheet" footer={footer}>
      <ScrollView contentContainerStyle={{ gap: space.xs, paddingBottom: space.md }}>
        {/* Hva som er valgt, samlet øverst – også når barnas alder har skjøvet resten nedover. */}
        <Text style={[type.footnote, { color: colors.textSecondary }]} testID="travellers-summary">
          {[passengerSummary(form, i18n), cabinLabel(form.cabinClass, i18n), ...(form.directOnly ? [h.directOnly] : [])].join(" · ")}
        </Text>
        {/* Et spedbarn sitter på fanget til en voksen: færre voksne enn spedbarn går ikke – det sies der det stopper. */}
        <Stepper
          testID="adults"
          label={h.adults}
          hint={h.adultsHint}
          value={form.adults}
          min={Math.max(1, infants)}
          max={MAX_PASSENGERS - total + form.adults}
          note={infants > 1 && form.adults === infants ? h.adultsForInfants : null}
          onChange={(adults) => setForm((f) => ({ ...f, adults, infantAges: f.infantAges.slice(0, adults) }))}
        />
        <Stepper
          label={h.children}
          hint={h.childrenHint}
          value={form.childAges.length}
          min={0}
          max={Math.min(8, MAX_PASSENGERS - total + form.childAges.length)}
          onChange={(n) => setForm((f) => ({ ...f, childAges: n > f.childAges.length ? [...f.childAges, DEFAULT_CHILD_AGE] : f.childAges.slice(0, n) }))}
        />
        {form.childAges.map((age, i) => (
          <View key={`c${i}`} style={styles.ageRow}>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.childAge(i + 1)}</Text>
            <ChoiceChips
              label={h.childAge(i + 1)}
              value={age}
              options={CHILD_AGES}
              format={(n) => String(n)}
              onChange={(v) => setForm((f) => ({ ...f, childAges: f.childAges.map((x, xi) => (xi === i ? v : x)) }))}
            />
          </View>
        ))}
        <Stepper
          testID="infants"
          label={h.infants}
          hint={h.infantsHint}
          value={form.infantAges.length}
          min={0}
          max={Math.min(4, form.adults, MAX_PASSENGERS - total + form.infantAges.length)}
          note={infants > 0 && infants >= form.adults && total < MAX_PASSENGERS ? h.infantPerAdult : null}
          onChange={(n) => setForm((f) => ({ ...f, infantAges: n > f.infantAges.length ? [...f.infantAges, DEFAULT_INFANT_AGE] : f.infantAges.slice(0, n) }))}
        />
        {form.infantAges.map((age, i) => (
          <View key={`i${i}`} style={styles.ageRow}>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.infantAge(i + 1)}</Text>
            <ChoiceChips
              label={h.infantAge(i + 1)}
              value={age}
              options={INFANT_AGES}
              format={(n) => (n === 0 ? h.infantUnder1 : h.infant1)}
              onChange={(v) => setForm((f) => ({ ...f, infantAges: f.infantAges.map((x, xi) => (xi === i ? v : x)) }))}
            />
          </View>
        ))}
        {total >= MAX_PASSENGERS ? (
          <View style={styles.ruleNote} testID="travellers-max-note">
            <Icon name="info" size={14} color={colors.textSecondary} />
            <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{h.maxTravellers(MAX_PASSENGERS)}</Text>
          </View>
        ) : null}
        <View style={styles.sheetDivider} />
        <Text style={[type.bodyStrong, { color: colors.text }]}>{h.cabin}</Text>
        <ChoiceChips label={h.cabin} value={form.cabinClass} options={CABINS} format={(v) => cabinLabel(v, i18n)} onChange={(cabinClass) => setForm((f) => ({ ...f, cabinClass }))} />
        <View style={styles.sheetDivider} />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{h.directOnly}</Text>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.directOnlyHint}</Text>
          </View>
          <Switch accessibilityLabel={h.directOnly} value={form.directOnly} onValueChange={(directOnly) => setForm((f) => ({ ...f, directOnly }))} trackColor={{ true: colors.blue, false: colors.lightBorder }} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  ageRow: { gap: space.sm, paddingBottom: space.sm },
  sheetDivider: { height: 1, backgroundColor: colors.lightBorder, marginVertical: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  ruleNote: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
});
