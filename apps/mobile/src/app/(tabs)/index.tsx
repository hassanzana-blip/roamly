import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { greeting } from "../../lib/format";
import { FEATURED, HEADER_PHOTO, type Destination } from "../../lib/destinations";
import { Banner, IconButton, LinkButton, Wordmark } from "../../components/ui";
import { PhotoBackdrop } from "../../components/Photo";
import { SearchPanel } from "../../components/SearchPanel";
import { DestinationCard } from "../../components/DestinationCard";
import { colors, radius, space, type } from "../../lib/theme";

/** Kundens initialer, eller ingenting (gjest). Aldri et oppdiktet navn eller bilde. */
function initialsOf(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().slice(0, 1)}${(last ?? "").trim().slice(0, 1)}`.toUpperCase();
}

/** Forsiden: fotohode, hvitt søkeark, reisemål. */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, runSearch } = useApp();
  const [cardProblem, setCardProblem] = useState<string | null>(null);

  const profile = auth.status === "signedIn" ? auth.profile : null;
  const name = profile?.firstName?.trim();
  const initials = initialsOf(profile?.firstName, profile?.lastName);

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: { iata: d.iata, name: d.airportName, city: d.city, country: d.country } });
    setCardProblem(err);
    if (!err) router.push("/resultater");
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <PhotoBackdrop photo={HEADER_PHOTO} scrim="medium" style={[styles.hero, { paddingTop: insets.top + space.md }]} testID="home-hero">
          <View style={styles.heroTop}>
            <Wordmark />
            {auth.status === "signedIn" ? (
              <Pressable onPress={() => router.push("/profil")} accessibilityRole="button" accessibilityLabel="Din profil" testID="account-button" style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}>
                {initials ? <Text style={styles.avatarText}>{initials}</Text> : null}
              </Pressable>
            ) : (
              <IconButton icon="user" label="Logg inn" variant="glass" onPress={() => router.push("/profil")} testID="account-button" />
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{name ? `${greeting()}, ${name}` : greeting()}</Text>
            <Text style={[type.hero, { color: colors.onDark }]} accessibilityRole="header">
              {"Nye opplevelser\ner bare en reise unna."}
            </Text>
          </View>
        </PhotoBackdrop>

        <View style={styles.sheet}>
          <SearchPanel />
          <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>Du trenger ikke logge inn for å søke.</Text>

          <View style={styles.sectionHead}>
            <Text style={[type.section, { color: colors.text }]} accessibilityRole="header">
              Utforsk reisemål
            </Text>
            <LinkButton label="Se alle" accessibilityLabel="Se alle reisemål" onPress={() => router.push("/utforsk")} />
          </View>
          {cardProblem ? (
            <Banner tone="error" testID="card-error">
              {cardProblem}
            </Banner>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={styles.railWrap}>
          {FEATURED.map((d) => (
            <DestinationCard key={d.id} destination={d} onPress={() => searchTo(d)} testID={`destination-${d.id}`} />
          ))}
        </ScrollView>
        <Text style={[type.caption, styles.credit]}>Foto: Unsplash. Se Profil for kreditering.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  hero: { paddingHorizontal: space.xl, paddingBottom: 56, gap: space.xxl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  heroText: { gap: space.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.85)" },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.white },
  sheet: { marginTop: -28, backgroundColor: colors.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.lg },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm },
  railWrap: { backgroundColor: colors.white },
  rail: { paddingHorizontal: space.lg, gap: space.md },
  credit: { color: colors.textSecondary, paddingHorizontal: space.lg, marginTop: space.sm },
});
