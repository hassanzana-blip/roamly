import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/a11y";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { destinationChoice, type Destination } from "../../lib/destinations";
import { savedDestinations } from "../../lib/saved";
import { recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../../lib/recent";
import { cabinLabel, formErrorText, passengerSummary } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, IconButton, LinkButton, SecondaryButton } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { colors, radius, space, type } from "../../lib/theme";

/**
 * Lagret: reisemål kunden har lagret fra Utforsk, og nylige søk – bare på denne
 * telefonen. Ingen priser, bestillinger, holdte priser, varsler eller konto-
 * synkronisering. Et lagret reisemål fyller bare inn søket (søker ikke); et
 * nylig søk med passerte datoer sier det og får nye datoer før noe søkes.
 */
export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggleSaved, recent, removeRecent, clearRecent, setForm, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const s = t.saved;
  const [problem, setProblem] = useState<FormErrorCode | null>(null);
  const destinations = savedDestinations(saved);
  const today = new Date();

  const applyToSearch = (d: Destination) => {
    setForm((form) => ({ ...form, destination: destinationChoice(d, locale) }));
    setProblem(null);
    router.navigate("/");
  };
  const searchAgain = (r: RecentSearch) => {
    const err = runSearch(r);
    setProblem(err);
    if (!err) router.push("/resultater");
  };
  const chooseNewDates = (r: RecentSearch) => {
    setForm(() => withFreshDates(r));
    setProblem(null);
    router.navigate("/");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxxl, paddingHorizontal: space.lg, gap: space.lg }} testID="saved-screen">
      <StatusBar style="light" />
      <View style={{ gap: space.sm }}>
        <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
          {s.title}
        </Text>
        <View style={styles.note} testID="saved-note">
          <Icon name="info" size={16} color={colors.onDarkMuted} />
          <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]}>{s.deviceNote}</Text>
        </View>
      </View>

      {problem ? (
        <Banner tone="error" dark testID="saved-error">
          {formErrorText(problem, i18n)}
        </Banner>
      ) : null}

      <View style={{ gap: space.sm }} testID="saved-destinations">
        <Text style={[type.section, { color: colors.onDark }]} accessibilityRole="header">
          {s.destinationsTitle}
        </Text>
        {destinations.length ? (
          destinations.map((d) => {
            const n = d.names[locale];
            const airport = `${n.airport} (${d.iata})`;
            return (
              <View key={d.id} style={styles.row} testID={`saved-${d.id}`}>
                <View style={styles.rowTop}>
                  <Image source={d.photo.image} style={styles.thumb} contentFit="cover" accessible={false} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.calloutStrong, { color: colors.onDark }]}>{`${n.city}, ${n.country}`}</Text>
                    <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID={`saved-airport-${d.id}`}>
                      {airport}
                    </Text>
                  </View>
                  <IconButton icon="close" label={s.removeLabel(`${n.city} (${d.iata})`)} variant="dark" size={44} onPress={() => toggleSaved(d)} testID={`saved-remove-${d.id}`} />
                </View>
                <SecondaryButton dark label={s.useInSearch} icon="search" accessibilityHint={s.useInSearchHint} onPress={() => applyToSearch(d)} testID={`saved-use-${d.id}`} />
              </View>
            );
          })
        ) : (
          <View style={styles.empty} testID="saved-destinations-empty">
            <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{s.destinationsEmpty}</Text>
            <LinkButton dark label={s.toExplore} onPress={() => router.navigate("/utforsk")} testID="saved-to-explore" />
          </View>
        )}
      </View>

      <View style={{ gap: space.sm }} testID="recent-searches">
        <View style={styles.sectionHead}>
          <Text style={[type.section, { color: colors.onDark }]} accessibilityRole="header">
            {s.recentTitle}
          </Text>
          {recent.length ? <LinkButton dark label={s.clearRecent} onPress={clearRecent} testID="recent-clear" /> : null}
        </View>
        {recent.length ? (
          recent.map((r) => {
            const key = recentKey(r);
            const id = `${r.origin.iata}-${r.destination.iata}-${r.departDate}`;
            const route = `${r.origin.city} → ${r.destination.city}`;
            const dates = r.tripType === "roundtrip" ? `${f.shortDay(r.departDate)} – ${f.shortDay(r.returnDate)}` : f.shortDay(r.departDate);
            const detail = `${dates} · ${passengerSummary(r, i18n)} · ${cabinLabel(r.cabinClass, i18n)}`;
            const past = recentIsPast(r, today);
            return (
              <View key={key} style={styles.row} testID={`recent-${id}`}>
                <View style={styles.rowTop}>
                  <Icon name="clock" size={18} color={colors.onDarkMuted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.calloutStrong, { color: colors.onDark }]}>{route}</Text>
                    <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{`${r.origin.iata} → ${r.destination.iata} · ${detail}`}</Text>
                    {past ? (
                      <View style={styles.past} testID={`recent-past-${id}`}>
                        <Icon name="alert" size={14} color={colors.warningOnDark} />
                        <Text style={[type.footnoteStrong, { color: colors.warningOnDark }]}>{s.datesPassed}</Text>
                      </View>
                    ) : null}
                  </View>
                  <IconButton icon="close" label={s.removeLabel(route)} variant="dark" size={44} onPress={() => removeRecent(key)} testID={`recent-remove-${id}`} />
                </View>
                {past ? (
                  <SecondaryButton dark label={s.chooseNewDates} icon="calendar" accessibilityHint={s.chooseNewDatesHint} onPress={() => chooseNewDates(r)} testID={`recent-newdates-${id}`} />
                ) : (
                  <SecondaryButton dark label={s.searchAgain} icon="refresh" accessibilityHint={s.searchAgainLabel(route, detail)} onPress={() => searchAgain(r)} testID={`recent-again-${id}`} />
                )}
              </View>
            );
          })
        ) : (
          <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID="recent-empty">
            {s.recentEmpty}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.input, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  row: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.raised },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.inset },
  past: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  empty: { gap: space.xs, alignItems: "flex-start" },
});
