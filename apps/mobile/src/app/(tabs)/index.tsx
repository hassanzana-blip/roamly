import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { FEATURED, HEADER_PHOTO, destinationChoice, type Destination } from "../../lib/destinations";
import { formErrorText } from "../../lib/searchForm";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, IconButton, LinkButton, Wordmark } from "../../components/ui";
import { PhotoBackdrop } from "../../components/Photo";
import { SearchPanel } from "../../components/SearchPanel";
import { ServiceSwitch } from "../../components/ServiceSwitch";
import { DestinationCard } from "../../components/DestinationCard";
import { StatusBarShield } from "../../components/StatusBarShield";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Kundens initialer, eller ingenting (gjest). Aldri et oppdiktet navn eller bilde. */
function initialsOf(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().slice(0, 1)}${(last ?? "").trim().slice(0, 1)}`.toUpperCase();
}

/**
 * Nylige søk står i Lagret-fanen, ikke her: målt i forhåndsvisningen presset ett
 * eneste nylig søk (122 pt) reisemålene nesten ut av første bilde (127 → 7 pt ved 390×844).
 *
 * Forsiden: et lavt fotohode, hvitt søkeark og reisemål. Første bilde
 * (390×844) skal vise rute, datoer, reisende/klasse og «Søk fly» – og begynnelsen
 * på reisemålene; forklaringen om hvordan HelloSky virker står under dem.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, runSearch } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const [cardProblem, setCardProblem] = useState<FormErrorCode | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const profile = auth.status === "signedIn" ? auth.profile : null;
  const name = profile?.firstName?.trim();
  const initials = initialsOf(profile?.firstName, profile?.lastName);

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setCardProblem(err);
    if (!err) router.push("/resultater");
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        testID="home-scroll"
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 24)}
      >
        <PhotoBackdrop photo={HEADER_PHOTO} scrim="medium" style={[styles.hero, { paddingTop: insets.top + space.xs }]} testID="home-hero">
          <View style={styles.heroTop}>
            <Wordmark />
            {auth.status === "signedIn" ? (
              <Pressable onPress={() => router.push("/profil")} accessibilityRole="button" accessibilityLabel={t.home.profileButton} testID="account-button" style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}>
                {initials ? <Text style={styles.avatarText}>{initials}</Text> : null}
              </Pressable>
            ) : (
              <IconButton icon="user" label={t.home.loginButton} variant="glass" size={TOUCH} onPress={() => router.push("/profil")} testID="account-button" />
            )}
          </View>
          <View style={styles.heroText}>
            {/* Hilsen bare med navn (innlogget); en generell «God ettermiddag» tar bare plass fra søket. */}
            {name ? (
              <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID="home-greeting">
                {t.home.greetingName(f.greeting(), name)}
              </Text>
            ) : null}
            <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header" testID="home-title">
              {t.home.heroTitle}
            </Text>
          </View>
        </PhotoBackdrop>

        <View style={styles.sheet} testID="home-sheet">
          <ServiceSwitch active="flights" onSelect={() => router.push("/hotell")} />
          <SearchPanel footer={<Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{t.home.noLoginNeeded}</Text>} />

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
      <StatusBarShield visible={scrolled} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  // Lavt fotohode: logo og konto på én linje, tittelen under. Arket overlapper bunnen med 28 pt.
  hero: { paddingHorizontal: space.xl, paddingBottom: 36, gap: space.sm },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  heroText: { gap: 2 },
  avatar: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.85)" },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.white },
  sheet: { marginTop: -28, backgroundColor: colors.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  recentRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  recentMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44, paddingVertical: space.xs },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  railWrap: { backgroundColor: colors.white },
  rail: { paddingHorizontal: space.lg, gap: space.md },
  howItWorks: { color: colors.textSecondary, paddingHorizontal: space.lg, marginTop: space.lg },
});
