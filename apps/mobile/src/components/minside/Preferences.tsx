import { useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import type { CabinClass } from "@contracts/types";
import { Pressable, Text } from "../a11y";
import { Icon } from "../Icon";
import { Group, Row } from "../SettingsList";
import { BottomSheet, Chip, ChoiceChips, LinkButton, SecondaryButton } from "../ui";
import { useApp } from "../../lib/appState";
import { localizedChoice } from "../../lib/airportIndex";
import { BANDS, MAX_ALT_AIRPORTS, PREF_AIRLINES, STOP_CHOICES, cycleAirline, toggleIn, type TravelPrefs } from "../../lib/preferences";
import type { StopsFilter, TimeBand } from "../../lib/resultsView";
import { CABINS } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Flyplassøket i «vanlig avreiseflyplass»-modus (se app/flyplass.tsx): valget huskes og blir «Fra» i skjemaet. */
export const HOME_AIRPORT_PICKER = { pathname: "/flyplass", params: { felt: "fra", hjem: "1" } } as const;
/** Flyplassøket i «annen flyplass»-modus: valget lagres bare i preferansene. */
const ALT_AIRPORT_PICKER = { pathname: "/flyplass", params: { felt: "fra", ekstra: "1" } } as const;

type Sheet = "alt" | "stops" | "cabin" | "bags" | "depart" | "arrive" | "airlines";

/** Den vanlige avreiseflyplassen som «Oslo (OSL)», med byen på appens språk – eller null når kunden ikke har valgt en. */
export function useHomeAirportText(): { iata: string; text: string } | null {
  const { homeAirport } = useApp();
  const { locale } = useI18n();
  if (!homeAirport) return null;
  const a = localizedChoice(homeAirport, locale);
  return { iata: a.iata, text: `${a.city} (${a.iata})` };
}

/**
 * Reisepreferansene på Min side: vanlig og andre avreiseflyplasser, bytter, reiseklasse, bagasje, tider og
 * flyselskaper. Hver rad viser valget og åpner et lite ark. Alt lagres bare på telefonen (lib/preferences.ts), og
 * ingenting blir et filter av seg selv – det står i notatet under.
 */
export function PreferencesSection() {
  const router = useRouter();
  const { prefs } = useApp();
  const i18n = useI18n();
  const { t, locale } = i18n;
  const h = t.hub;
  const home = useHomeAirportText();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const bands = (list: TimeBand[]) => (list.length ? list.map((b) => t.results.bands[b]).join(", ") : h.timeAny);
  const alt = prefs.altAirports.map((a) => localizedChoice(a, locale));
  const airlines = prefs.airlines.length || prefs.avoidAirlines.length ? h.airlinesValue(prefs.airlines.length, prefs.avoidAirlines.length) : h.airlinesNone;

  return (
    <>
      <Group title={h.prefsTitle} testID="preferences-group" note={`${h.prefsNote} ${h.prefsDevice}`}>
        <Row
          icon="takeoff"
          title={t.account.homeAirport}
          value={home?.text ?? t.account.notChosen}
          accessibilityLabel={t.account.homeAirportLabel(home?.text ?? null)}
          accessibilityHint={t.account.homeAirportHint}
          onPress={() => router.push(HOME_AIRPORT_PICKER)}
          testID="home-airport-row"
        />
        <Row icon="mapPin" title={h.altAirports} value={alt.length ? alt.map((a) => a.iata).join(", ") : h.altAirportsNone} accessibilityLabel={`${h.altAirports}: ${alt.length ? alt.map((a) => `${a.city} (${a.iata})`).join(", ") : h.altAirportsNone}`} separated onPress={() => setSheet("alt")} testID="pref-alt" />
        <Row icon="route" title={h.stops} value={h.stopsChoices[prefs.stops]} accessibilityLabel={`${h.stops}: ${h.stopsChoices[prefs.stops]}`} separated onPress={() => setSheet("stops")} testID="pref-stops" />
        <Row icon="seat" title={h.cabin} value={prefs.cabin ? t.search.cabins[prefs.cabin] : h.cabinDefault} accessibilityLabel={`${h.cabin}: ${prefs.cabin ? t.search.cabins[prefs.cabin] : h.cabinDefault}`} separated onPress={() => setSheet("cabin")} testID="pref-cabin" />
        <Row icon="luggage" title={h.bags} value={prefs.checkedBag ? h.bagsChecked : h.bagsAny} accessibilityLabel={`${h.bags}: ${prefs.checkedBag ? h.bagsChecked : h.bagsAny}`} separated onPress={() => setSheet("bags")} testID="pref-bags" />
        <Row icon="sunrise" title={h.departTime} value={bands(prefs.departBands)} accessibilityLabel={`${h.departTime}: ${bands(prefs.departBands)}`} separated onPress={() => setSheet("depart")} testID="pref-depart" />
        <Row icon="landing" title={h.arriveTime} value={bands(prefs.arriveBands)} accessibilityLabel={`${h.arriveTime}: ${bands(prefs.arriveBands)}`} separated onPress={() => setSheet("arrive")} testID="pref-arrive" />
        <Row icon="plane" title={h.airlines} value={airlines} accessibilityLabel={`${h.airlines}: ${airlines}`} separated onPress={() => setSheet("airlines")} testID="pref-airlines" />
      </Group>
      <PrefSheet which={sheet} onClose={() => setSheet(null)} onAddAirport={() => {
        setSheet(null);
        router.push(ALT_AIRPORT_PICKER);
      }} />
    </>
  );
}

function PrefSheet({ which, onClose, onAddAirport }: { which: Sheet | null; onClose: () => void; onAddAirport: () => void }) {
  const { prefs, setPrefs } = useApp();
  const { t, locale } = useI18n();
  const h = t.hub;
  const { height } = useWindowDimensions();
  const set = (patch: Partial<TravelPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const title: Record<Sheet, string> = { alt: h.altAirports, stops: h.stops, cabin: h.cabin, bags: h.bags, depart: h.departTime, arrive: h.arriveTime, airlines: h.airlines };

  const bandPicker = (key: "departBands" | "arriveBands", label: string) => (
    <View style={{ gap: space.md }}>
      <View style={styles.wrap} accessibilityLabel={label}>
        {BANDS.map((b) => (
          <Chip key={b} dark={false} label={h.bands[b]} selected={prefs[key].includes(b)} onPress={() => set({ [key]: toggleIn(prefs[key], b) })} testID={`pref-band-${b}`} />
        ))}
      </View>
      {prefs[key].length ? <LinkButton label={h.clear} onPress={() => set({ [key]: [] })} testID="pref-band-clear" /> : null}
    </View>
  );

  return (
    <BottomSheet visible={which !== null} title={which ? title[which] : ""} onClose={onClose} testID="pref-sheet">
      {which === "alt" ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.altAirportsHint}</Text>
          {prefs.altAirports.length ? (
            <View style={styles.list}>
              {prefs.altAirports.map((raw, i) => {
                const a = localizedChoice(raw, locale);
                return (
                  <View key={a.iata} style={[styles.altRow, i > 0 && styles.divider]} testID={`pref-alt-${a.iata}`}>
                    <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{`${a.city} (${a.iata})`}</Text>
                    <Pressable onPress={() => set({ altAirports: prefs.altAirports.filter((x) => x.iata !== a.iata) })} accessibilityRole="button" accessibilityLabel={t.saved.removeLabel(`${a.city} (${a.iata})`)} testID={`pref-alt-remove-${a.iata}`} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}>
                      <Icon name="close" size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
          {prefs.altAirports.length < MAX_ALT_AIRPORTS ? <SecondaryButton label={h.altAirportsAdd} icon="plus" onPress={onAddAirport} testID="pref-alt-add" /> : null}
        </View>
      ) : which === "stops" ? (
        <ChoiceChips<StopsFilter> label={h.stops} value={prefs.stops} options={STOP_CHOICES} onChange={(stops) => set({ stops })} format={(s) => h.stopsChoices[s]} testIDPrefix="pref-stops-" />
      ) : which === "cabin" ? (
        <View style={{ gap: space.md }}>
          <ChoiceChips<CabinClass | "none"> label={h.cabin} value={prefs.cabin ?? "none"} options={["none", ...CABINS]} onChange={(c) => set({ cabin: c === "none" ? null : c })} format={(c) => (c === "none" ? h.cabinDefault : t.search.cabins[c])} testIDPrefix="pref-cabin-" />
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.cabinNote}</Text>
        </View>
      ) : which === "bags" ? (
        <View style={{ gap: space.md }}>
          <ChoiceChips<"any" | "checked"> label={h.bags} value={prefs.checkedBag ? "checked" : "any"} options={["any", "checked"]} onChange={(v) => set({ checkedBag: v === "checked" })} format={(v) => (v === "checked" ? h.bagsChecked : h.bagsAny)} testIDPrefix="pref-bags-" />
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.bagsNote}</Text>
        </View>
      ) : which === "depart" ? (
        bandPicker("departBands", h.departTime)
      ) : which === "arrive" ? (
        bandPicker("arriveBands", h.arriveTime)
      ) : which === "airlines" ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.airlinesNote}</Text>
          <ScrollView style={{ maxHeight: height * 0.5 }} testID="pref-airline-list">
            <View style={styles.list}>
              {PREF_AIRLINES.map((a, i) => {
                const state = prefs.airlines.includes(a.iata) ? "preferred" : prefs.avoidAirlines.includes(a.iata) ? "avoided" : "none";
                return (
                  <Pressable
                    key={a.iata}
                    onPress={() => setPrefs((p) => cycleAirline(p, a.iata))}
                    accessibilityRole="button"
                    accessibilityLabel={h.airlineLabel(a.name, state)}
                    accessibilityHint={h.airlineHint}
                    testID={`pref-airline-${a.iata}`}
                    style={({ pressed }) => [styles.altRow, i > 0 && styles.divider, pressed && { backgroundColor: colors.inset }]}
                  >
                    <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{a.name}</Text>
                    {state === "preferred" ? (
                      <View style={[styles.badge, styles.badgeOn]}>
                        <Icon name="check" size={14} color={colors.blue} />
                        <Text style={[type.footnoteStrong, { color: colors.blue }]}>{h.airlinePreferred}</Text>
                      </View>
                    ) : state === "avoided" ? (
                      <View style={[styles.badge, styles.badgeAvoid]}>
                        <Icon name="minus" size={14} color={colors.warning} />
                        <Text style={[type.footnoteStrong, { color: colors.warning }]}>{h.airlineAvoided}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  list: { borderRadius: radius.input, backgroundColor: colors.inset, overflow: "hidden" },
  altRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH + 4, paddingLeft: space.md, paddingRight: space.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  remove: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, marginRight: space.sm },
  badgeOn: { backgroundColor: colors.blueSoft },
  badgeAvoid: { backgroundColor: colors.warningSoft },
});
