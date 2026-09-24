import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { FEATURED, HEADER_PHOTO, destinationChoice, type Destination } from "../../lib/destinations";
import { formErrorText, passengerSummary } from "../../lib/searchForm";
import { recentKey, type RecentSearch } from "../../lib/recent";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, IconButton, LinkButton, Wordmark } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { PhotoBackdrop } from "../../components/Photo";
import { SearchPanel } from "../../components/SearchPanel";
import { ServiceSwitch } from "../../components/ServiceSwitch";
import { DestinationCard } from "../../components/DestinationCard";
import { colors, radius, space, type } from "../../lib/theme";

/** Kundens initialer, eller ingenting (gjest). Aldri et oppdiktet navn eller bilde. */
function initialsOf(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().slice(0, 1)}${(last ?? "").trim().slice(0, 1)}`.toUpperCase();
}

/** Nylige søk på denne telefonen: ett trykk søker på nytt; hvert kan fjernes, eller alle. */
function RecentSearches({ onSearch }: { onSearch: (r: RecentSearch) => void }) {
  const { recent, removeRecent, clearRecent } = useApp();
  const i18n = useI18n();
  const { t, f } = i18n;
  if (!recent.length) return null;
  return (
    <View style={{ gap: space.sm }} testID="recent-searches">
      <View style={styles.sectionHead}>
        <Text style={[type.section, { color: colors.text }]} accessibilityRole="header">
          {t.home.recentTitle}
        </Text>
        <LinkButton label={t.home.recentClear} onPress={clearRecent} testID="recent-clear" />
      </View>
      {recent.map((r) => {
        const key = recentKey(r);
        const route = `${r.origin.city} → ${r.destination.city}`;
        const dates = r.tripType === "roundtrip" ? `${f.shortDay(r.departDate)} – ${f.shortDay(r.returnDate)}` : f.shortDay(r.departDate);
        const detail = `${dates} · ${passengerSummary(r, i18n)}`;
        return (
          <View key={key} style={styles.recentRow}>
            <Pressable
              onPress={() => onSearch(r)}
              accessibilityRole="button"
              accessibilityLabel={`${route}, ${detail}`}
              accessibilityHint={t.home.recentHint}
              style={({ pressed }) => [styles.recentMain, pressed && { opacity: 0.7 }]}
              testID={`recent-${r.origin.iata}-${r.destination.iata}`}
            >
              <Icon name="clock" size={16} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[type.calloutStrong, { color: colors.text }]}>{route}</Text>
                <Text style={[type.footnote, { color: colors.textSecondary }]}>{detail}</Text>
              </View>
            </Pressable>
            <IconButton icon="close" label={t.home.recentRemove(route)} variant="light" onPress={() => removeRecent(key)} testID={`recent-remove-${r.origin.iata}-${r.destination.iata}`} />
          </View>
        );
      })}
      <Text style={[type.caption, { color: colors.textSecondary }]}>{t.home.recentNote}</Text>
    </View>
  );
}

/** Forsiden: fotohode, hvitt søkeark, nylige søk, reisemål. */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const [cardProblem, setCardProblem] = useState<FormErrorCode | null>(null);

  const profile = auth.status === "signedIn" ? auth.profile : null;
  const name = profile?.firstName?.trim();
  const initials = initialsOf(profile?.firstName, profile?.lastName);

  const searchAgain = (r: RecentSearch) => {
    const err = runSearch(r);
    setCardProblem(err);
    if (!err) router.push("/resultater");
  };

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setCardProblem(err);
    if (!err) router.push("/resultater");
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <PhotoBackdrop photo={HEADER_PHOTO} scrim="medium" style={[styles.hero, { paddingTop: insets.top + space.sm }]} testID="home-hero">
          <View style={styles.heroTop}>
            <Wordmark />
            {auth.status === "signedIn" ? (
              <Pressable onPress={() => router.push("/profil")} accessibilityRole="button" accessibilityLabel={t.home.profileButton} testID="account-button" style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}>
                {initials ? <Text style={styles.avatarText}>{initials}</Text> : null}
              </Pressable>
            ) : (
              <IconButton icon="user" label={t.home.loginButton} variant="glass" onPress={() => router.push("/profil")} testID="account-button" />
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{name ? t.home.greetingName(f.greeting(), name) : f.greeting()}</Text>
            <Text style={[type.hero, { color: colors.onDark }]} accessibilityRole="header">
              {t.home.heroTitle}
            </Text>
          </View>
        </PhotoBackdrop>

        <View style={styles.sheet}>
          <ServiceSwitch active="flights" onSelect={() => router.push("/hotell")} />
          <SearchPanel footer={<Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{t.home.noLoginNeeded}</Text>} />

          <RecentSearches onSearch={searchAgain} />

          <View style={styles.sectionHead}>
            <Text style={[type.section, { color: colors.text }]} accessibilityRole="header">
              {t.home.exploreTitle}
            </Text>
            <LinkButton label={t.home.seeAll} accessibilityLabel={t.home.seeAllLabel} onPress={() => router.push("/utforsk")} />
          </View>
          {cardProblem ? (
            <Banner tone="error" testID="card-error">
              {formErrorText(cardProblem, i18n)}
            </Banner>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={styles.railWrap}>
          {FEATURED.map((d) => (
            <DestinationCard key={d.id} destination={d} onPress={() => searchTo(d)} testID={`destination-${d.id}`} />
          ))}
        </ScrollView>
        {/* Hvordan HelloSky virker: under reisemålene, så søket og reisemålene står i første bilde. */}
        <Text style={[type.footnote, styles.howItWorks]} testID="how-it-works-home">
          {t.home.howItWorks}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  hero: { paddingHorizontal: space.xl, paddingBottom: 44, gap: space.lg },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  heroText: { gap: space.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.85)" },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.white },
  sheet: { marginTop: -28, backgroundColor: colors.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  recentRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  recentMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44, paddingVertical: space.xs },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  railWrap: { backgroundColor: colors.white },
  rail: { paddingHorizontal: space.lg, gap: space.md },
  howItWorks: { color: colors.textSecondary, paddingHorizontal: space.lg, marginTop: space.lg },
});
