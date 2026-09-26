import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FocusStatusBar } from "../../components/FocusStatusBar";
import { StatusBarShield } from "../../components/StatusBarShield";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { destinationChoice, type Destination } from "../../lib/destinations";
import { savedDestinations } from "../../lib/saved";
import { recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../../lib/recent";
import { keepDatesTogether } from "../../lib/format";
import { cabinLabel, formErrorText, passengerSummary } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, LinkButton } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/**
 * «Fjern» ved siden av en rad: selv 44 pt, uten hitSlop inn over radens knapp, med et dempet kryss på den hvite
 * raden (ikonknappens «plain» er laget for grafitt og ville vært hvit på hvitt).
 */
function RemoveButton({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
      <Icon name="close" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * Lagret: reisemål kunden har lagret fra Utforsk, og nylige søk – bare på denne
 * telefonen. Ingen priser, bestillinger, holdte priser, varsler eller konto-
 * synkronisering (én kort setning øverst; hele forklaringen bak «Om Lagret»).
 *
 * «Cloud + Graphite»: lys grunn, og hver seksjon er én hvit gruppe med tynne
 * skiller. Hver rad er én knapp (bruk i søket / søk igjen / velg nye datoer) med
 * en egen 44 pt «Fjern» ved siden av – aldri en knapp inni en knapp. Et lagret
 * reisemål fyller bare inn søket; et nylig søk med passerte datoer sier det og
 * får nye datoer før noe søkes.
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
      <FocusStatusBar style="dark" />
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space.xxxl, paddingHorizontal: space.lg, gap: space.md }} testID="saved-screen">
      <View style={{ gap: 2 }}>
        <View style={styles.titleRow}>
          <Text style={[type.title, { color: colors.text, flex: 1 }]} accessibilityRole="header" testID="saved-title">
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
            <Icon name="info" size={20} color={infoOpen ? colors.blue : colors.text} />
          </Pressable>
        </View>
        <Text style={[type.footnote, { color: colors.textSecondary }]} testID="saved-note">
          {s.shortNote}
        </Text>
        {infoOpen ? (
          <View style={styles.detail} testID="saved-note-detail">
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{s.deviceNote}</Text>
          </View>
        ) : null}
      </View>

      {problem ? (
        <Banner tone="error" testID="saved-error">
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
          <View style={styles.list} testID="saved-destinations-list">
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
                      <Text style={[type.calloutStrong, { color: colors.text }]}>{`${n.city}, ${n.country}`}</Text>
                      <Text style={[type.footnote, { color: colors.textSecondary }]} testID={`saved-airport-${d.id}`}>
                        {airport}
                      </Text>
                      <Text style={[type.footnoteStrong, { color: colors.blue }]}>{s.useInSearch}</Text>
                    </View>
                    <Icon name="chevronRight" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <RemoveButton label={s.removeLabel(`${n.city} (${d.iata})`)} onPress={() => toggleSaved(d)} testID={`saved-remove-${d.id}`} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.empty, styles.emptyWithLink]} testID="saved-destinations-empty">
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{s.destinationsEmpty}</Text>
            <LinkButton label={s.toExplore} onPress={() => router.navigate("/utforsk")} testID="saved-to-explore" />
          </View>
        )}
      </View>

      <View style={{ gap: space.xs }} testID="recent-searches">
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header" accessibilityLabel={s.sectionCount(s.recentTitle, recent.length)} testID="recent-title">
            {recent.length ? `${s.recentTitle} · ${recent.length}` : s.recentTitle}
          </Text>
          {recent.length ? <LinkButton label={s.clearRecent} onPress={clearRecent} testID="recent-clear" /> : null}
        </View>
        {recent.length ? (
          <View style={styles.list} testID="recent-list">
            {recent.map((r, i) => {
              const key = recentKey(r);
              const id = `${r.origin.iata}-${r.destination.iata}-${r.departDate}`;
              const route = `${r.origin.city} → ${r.destination.city}`;
              // VoiceOver: hele datoer med ukedag. Hver dato holdes samlet («tor. 15. okt.» brytes aldri inni).
              const day = (iso: string) => f.day(iso).replace(/ /g, "\u00A0");
              const dates = r.tripType === "roundtrip" ? `${day(r.departDate)} – ${day(r.returnDate)}` : day(r.departDate);
              // Synlig: kort datospenn som på forsiden («9.–16. okt.»), så raden holder seg på få linjer; én vei sies, så
              // den ikke ser ut som en tur-retur samme dag. Linjen kan bare brytes mellom datoene.
              const span = keepDatesTogether(f.dateSpan(r.departDate, r.tripType === "roundtrip" ? r.returnDate : null));
              const when = r.tripType === "roundtrip" ? span : `${t.home.oneway} · ${span}`;
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
                      <Icon name="clock" size={18} color={colors.textSecondary} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[type.calloutStrong, { color: colors.text }]}>{route}</Text>
                      {/* Nøyaktige flyplasskoder med ikke-brytende bindestrek (aldri «OSL–» / «BCN»), så datoene. */}
                      <Text style={[type.footnote, { color: past ? colors.textSecondary : colors.text }]}>{`${r.origin.iata}\u2011${r.destination.iata} · ${when}`}</Text>
                      <Text style={[type.footnote, { color: colors.textSecondary }]}>{people}</Text>
                      {past ? (
                        <View style={styles.past} testID={`recent-past-${id}`}>
                          <Icon name="alert" size={14} color={colors.warning} />
                          <Text style={[type.footnoteStrong, { color: colors.warning }]}>{s.datesPassed}</Text>
                        </View>
                      ) : null}
                      <Text style={[type.footnoteStrong, { color: colors.blue }]}>{past ? s.chooseNewDates : s.searchAgain}</Text>
                    </View>
                    <Icon name="chevronRight" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <RemoveButton label={s.removeLabel(route)} onPress={() => removeRecent(key)} testID={`recent-remove-${id}`} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty} testID="recent-empty">
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{s.recentEmpty}</Text>
          </View>
        )}
      </View>
      </ScrollView>
      <StatusBarShield tone="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  // «Cloud + Graphite»: lys grunn; overskrifter i `text`, hjelpetekst i `textSecondary` (5,3:1 på grunnen).
  screen: { flex: 1, backgroundColor: colors.canvas },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  // «Om Lagret»: lys ikonknapp (hvit med lys kant); åpen er den svakt blå med blå kant, som et valgt lagre-merke.
  info: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  infoOn: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  // Hele forklaringen i et hvitt kort på grunnen (sekundærtekst 5,8:1 på hvitt).
  detail: { marginTop: space.xs, padding: space.md, borderRadius: radius.input, backgroundColor: colors.white },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH },
  sectionTitle: { ...type.footnoteStrong, color: colors.text, textTransform: "uppercase", letterSpacing: 0.6 },
  // Én hvit gruppe med tynne skiller – ikke et stort kort per rad.
  list: { borderRadius: radius.input, backgroundColor: colors.white, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingLeft: space.md, paddingRight: space.xs },
  pressed: { backgroundColor: colors.inset },
  rowText: { flex: 1, gap: 1 },
  rowIcon: { width: 40, alignItems: "center" },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.inset },
  past: { flexDirection: "row", alignItems: "center", gap: 4 },
  remove: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
  // Tom seksjon: samme hvite gruppe, med teksten (og lenken) inni.
  empty: { gap: space.xs, alignItems: "flex-start", paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.input, backgroundColor: colors.white },
  // Lenken er selv 44 pt høy og står nederst; den trenger ingen ekstra luft under seg.
  emptyWithLink: { paddingBottom: space.xs, gap: 0 },
});
