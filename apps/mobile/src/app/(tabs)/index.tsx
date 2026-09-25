import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { FEATURED, HEADER_PHOTO, destinationChoice, type Destination } from "../../lib/destinations";
import { cabinLabel, formErrorText, passengerSummary } from "../../lib/searchForm";
import { recentIsPast, recentKey, type RecentSearch } from "../../lib/recent";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, IconButton, LinkButton, Wordmark } from "../../components/ui";
import { PhotoBackdrop } from "../../components/Photo";
import { SearchPanel } from "../../components/SearchPanel";
import { ServiceSwitch } from "../../components/ServiceSwitch";
import { DestinationCard } from "../../components/DestinationCard";
import { StatusBarShield } from "../../components/StatusBarShield";
import { Icon } from "../../components/Icon";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Kundens initialer, eller ingenting (gjest). Aldri et oppdiktet navn eller bilde. */
function initialsOf(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().slice(0, 1)}${(last ?? "").trim().slice(0, 1)}`.toUpperCase();
}

/**
 * Andre nylige søk som én rad med små brikker under «Søk fly», i stedet for linjen om innlogging (den er for
 * nye kunder, som ikke har nylige søk). Et trykk søker igjen. Hele listen – også søk med passerte datoer – står i
 * Lagret. En liste med kort her presset reisemålene ut av første bilde (122 pt per søk); raden er 44 pt.
 */
function RecentSearchesRow({ items, onPick }: { items: RecentSearch[]; onPick: (r: RecentSearch) => void }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll} contentContainerStyle={styles.recentRow} accessibilityLabel={t.home.recentTitle} testID="home-recent">
      {items.map((r) => {
        const route = `${r.origin.city} → ${r.destination.city}`;
        const back = r.tripType === "roundtrip" ? r.returnDate : null;
        // VoiceOver: hele datoer med ukedag, som i Lagret; synlig: det korte spennet.
        const dates = back ? `${f.day(r.departDate)} – ${f.day(back)}` : f.day(r.departDate);
        const detail = `${dates} · ${passengerSummary(r, i18n)} · ${cabinLabel(r.cabinClass, i18n)}`;
        return (
          <Pressable
            key={recentKey(r)}
            onPress={() => onPick(r)}
            accessibilityRole="button"
            accessibilityLabel={t.saved.searchAgainLabel(route, detail)}
            accessibilityHint={t.home.recentHint}
            hitSlop={4}
            testID={`home-recent-${r.origin.iata}-${r.destination.iata}-${r.departDate}`}
            style={({ pressed }) => [styles.recentPill, pressed && { opacity: 0.7 }]}
          >
            <Icon name="clock" size={14} color={colors.textSecondary} />
            <Text style={[type.footnoteStrong, { color: colors.text }]}>{`${r.origin.iata}\u2011${r.destination.iata}`}</Text>
            <Text style={[type.footnote, { color: colors.textSecondary }]}>{f.dateSpan(r.departDate, back)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Forsiden: et lavt fotohode, hvitt søkeark og reisemål. Første bilde
 * (390×844) skal vise rute, datoer, reisende/klasse og «Søk fly» – og begynnelsen
 * på reisemålene; forklaringen om hvordan HelloSky virker står under dem.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, runSearch, recent, form } = useApp();
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
  // Andre søk enn det som står i skjemaet, med datoer som ikke har passert.
  const current = recentKey(form);
  const again = recent.filter((r) => recentKey(r) !== current && !recentIsPast(r)).slice(0, 4);
  const searchAgain = (r: RecentSearch) => {
    const err = runSearch(r);
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
          <SearchPanel
            footer={
              again.length ? (
                <RecentSearchesRow items={again} onPick={searchAgain} />
              ) : (
                <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{t.home.noLoginNeeded}</Text>
              )
            }
          />

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
  // Raden går helt ut til kanten (under arkets marg), så brikkene kan rulles uten å klippes ved margen. Luft over og
  // under brikkene, så hitSlop (4 pt) når 44 pt – en ScrollView klipper det som stikker utenfor.
  recentScroll: { marginHorizontal: -space.lg },
  recentRow: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: 4 },
  recentPill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.lightBorder },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  railWrap: { backgroundColor: colors.white },
  rail: { paddingHorizontal: space.lg, gap: space.md },
  howItWorks: { color: colors.textSecondary, paddingHorizontal: space.lg, marginTop: space.lg },
});
