import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StatusBarShield } from "../../components/StatusBarShield";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { destinationChoice, type Destination } from "../../lib/destinations";
import { savedDestinations } from "../../lib/saved";
import { recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../../lib/recent";
import { cabinLabel, formErrorText, passengerSummary } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, IconButton, LinkButton } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/**
 * Lagret: reisemål kunden har lagret fra Utforsk, og nylige søk – bare på denne
 * telefonen. Ingen priser, bestillinger, holdte priser, varsler eller konto-
 * synkronisering (én kort setning øverst; hele forklaringen bak «Om Lagret»).
 *
 * Tette lister i det mørke skallet: hver rad er én knapp (bruk i søket / søk
 * igjen / velg nye datoer) med en egen 44 pt «Fjern» ved siden av – aldri en
 * knapp inni en knapp. Et lagret reisemål fyller bare inn søket; et nylig søk
 * med passerte datoer sier det og får nye datoer før noe søkes.
 */
export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggleSaved, recent, removeRecent, clearRecent, setForm, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const s = t.saved;
  const [problem, setProblem] = useState<FormErrorCode | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
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
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space.xxxl, paddingHorizontal: space.lg, gap: space.md }} testID="saved-screen">
      <View style={{ gap: 2 }}>
        <View style={styles.titleRow}>
          <Text style={[type.title, { color: colors.onDark, flex: 1 }]} accessibilityRole="header" testID="saved-title">
            {s.title}
          </Text>
          <Pressable
            onPress={() => setInfoOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={s.infoLabel}
            accessibilityState={{ expanded: infoOpen }}
            testID="saved-info"
            style={({ pressed }) => [styles.info, infoOpen && styles.infoOn, pressed && { opacity: 0.7 }]}
          >
            <Icon name="info" size={20} color={infoOpen ? colors.blueOnDark : colors.onDarkMuted} />
          </Pressable>
        </View>
        <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID="saved-note">
          {s.shortNote}
        </Text>
        {infoOpen ? (
          <Text style={[type.footnote, styles.detail]} testID="saved-note-detail">
            {s.deviceNote}
          </Text>
        ) : null}
      </View>

      {problem ? (
        <Banner tone="error" dark testID="saved-error">
          {formErrorText(problem, i18n)}
        </Banner>
      ) : null}

      <View style={{ gap: space.xs }} testID="saved-destinations">
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel={s.sectionCount(s.destinationsTitle, destinations.length)} testID="saved-destinations-title">
            {destinations.length ? `${s.destinationsTitle} · ${destinations.length}` : s.destinationsTitle}
          </Text>
        </View>
        {destinations.length ? (
          <View style={styles.list}>
            {destinations.map((d, i) => {
              const n = d.names[locale];
              const airport = `${n.airport} (${d.iata})`;
              return (
                <View key={d.id} style={[styles.row, i > 0 && styles.divider]} testID={`saved-${d.id}`}>
                  <Pressable
                    onPress={() => applyToSearch(d)}
                    accessibilityRole="button"
                    accessibilityLabel={s.useInSearchLabel(n.city, airport)}
                    accessibilityHint={s.useInSearchHint}
                    testID={`saved-use-${d.id}`}
                    style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                  >
                    <Image source={d.photo.image} style={styles.thumb} contentFit="cover" accessible={false} />
                    <View style={styles.rowText}>
                      <Text style={[type.calloutStrong, { color: colors.onDark }]}>{`${n.city}, ${n.country}`}</Text>
                      <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID={`saved-airport-${d.id}`}>
                        {airport}
                      </Text>
                      <Text style={[type.footnoteStrong, { color: colors.blueOnDark }]}>{s.useInSearch}</Text>
                    </View>
                    <Icon name="chevronRight" size={18} color={colors.onDarkMuted} />
                  </Pressable>
                  <IconButton icon="close" label={s.removeLabel(`${n.city} (${d.iata})`)} variant="plain" size={TOUCH} onPress={() => toggleSaved(d)} testID={`saved-remove-${d.id}`} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty} testID="saved-destinations-empty">
            <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{s.destinationsEmpty}</Text>
            <LinkButton dark label={s.toExplore} onPress={() => router.navigate("/utforsk")} testID="saved-to-explore" />
          </View>
        )}
      </View>

      <View style={{ gap: space.xs }} testID="recent-searches">
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel={s.sectionCount(s.recentTitle, recent.length)} testID="recent-title">
            {recent.length ? `${s.recentTitle} · ${recent.length}` : s.recentTitle}
          </Text>
          {recent.length ? <LinkButton dark label={s.clearRecent} onPress={clearRecent} testID="recent-clear" /> : null}
        </View>
        {recent.length ? (
          <View style={styles.list}>
            {recent.map((r, i) => {
              const key = recentKey(r);
              const id = `${r.origin.iata}-${r.destination.iata}-${r.departDate}`;
              const route = `${r.origin.city} → ${r.destination.city}`;
              // Hver dato holdes samlet («tor. 15. okt.» brytes aldri inni); linjen kan bare brytes mellom datoene.
              const day = (iso: string) => f.day(iso).replace(/ /g, "\u00A0");
              const dates = r.tripType === "roundtrip" ? `${day(r.departDate)} – ${day(r.returnDate)}` : day(r.departDate);
              const people = `${passengerSummary(r, i18n)} · ${cabinLabel(r.cabinClass, i18n)}`;
              const detail = `${dates} · ${people}`;
              const past = recentIsPast(r, today);
              return (
                <View key={key} style={[styles.row, i > 0 && styles.divider]} testID={`recent-${id}`}>
                  <Pressable
                    onPress={() => (past ? chooseNewDates(r) : searchAgain(r))}
                    accessibilityRole="button"
                    accessibilityLabel={past ? `${s.chooseNewDatesLabel(route)}. ${s.datesPassed}: ${dates}` : s.searchAgainLabel(route, detail)}
                    accessibilityHint={past ? s.chooseNewDatesHint : undefined}
                    testID={past ? `recent-newdates-${id}` : `recent-again-${id}`}
                    style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                  >
                    <View style={styles.rowIcon}>
                      <Icon name="clock" size={18} color={colors.onDarkMuted} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[type.calloutStrong, { color: colors.onDark }]}>{route}</Text>
                      {/* Nøyaktige flyplasskoder med ikke-brytende bindestrek (aldri «OSL–» / «BCN»), så de fulle datoene. */}
                      <Text style={[type.footnote, { color: past ? colors.onDarkMuted : colors.onDark }]}>{`${r.origin.iata}\u2011${r.destination.iata} · ${dates}`}</Text>
                      <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{people}</Text>
                      {past ? (
                        <View style={styles.past} testID={`recent-past-${id}`}>
                          <Icon name="alert" size={14} color={colors.warningOnDark} />
                          <Text style={[type.footnoteStrong, { color: colors.warningOnDark }]}>{s.datesPassed}</Text>
                        </View>
                      ) : null}
                      <Text style={[type.footnoteStrong, { color: colors.blueOnDark }]}>{past ? s.chooseNewDates : s.searchAgain}</Text>
                    </View>
                    <Icon name="chevronRight" size={18} color={colors.onDarkMuted} />
                  </Pressable>
                  <IconButton icon="close" label={s.removeLabel(route)} variant="plain" size={TOUCH} onPress={() => removeRecent(key)} testID={`recent-remove-${id}`} />
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID="recent-empty">
            {s.recentEmpty}
          </Text>
        )}
      </View>
      </ScrollView>
      <StatusBarShield />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  info: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
  infoOn: { backgroundColor: colors.blueOnDarkTint },
  detail: { color: colors.onDarkMuted, marginTop: space.xs, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: colors.darkBorder },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH },
  sectionTitle: { ...type.footnoteStrong, color: colors.onDarkMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  // Én gruppert liste med tynne skiller – ikke et stort kort per rad.
  list: { borderRadius: radius.input, backgroundColor: colors.raised, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.darkBorder },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingLeft: space.md, paddingRight: space.xs },
  pressed: { backgroundColor: colors.darkBorder },
  rowText: { flex: 1, gap: 1 },
  rowIcon: { width: 40, alignItems: "center" },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.inset },
  past: { flexDirection: "row", alignItems: "center", gap: 4 },
  empty: { gap: space.xs, alignItems: "flex-start" },
});
