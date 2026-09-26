import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { useRouter } from "expo-router";
import { FocusStatusBar } from "../../components/FocusStatusBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { FEATURED, destinationChoice, type Destination } from "../../lib/destinations";
import { cabinLabel, formErrorText, passengerCount, passengerSummary } from "../../lib/searchForm";
import { recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../../lib/recent";
import { localizedChoice } from "../../lib/airportIndex";
import { greetingName } from "../../lib/customerName";
import { useI18n } from "../../i18n";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, IconButton, LinkButton } from "../../components/ui";
import { SearchPanel } from "../../components/SearchPanel";
import { ServiceSwitch } from "../../components/ServiceSwitch";
import { DestinationRailCard } from "../../components/DestinationCard";
import { StatusBarShield } from "../../components/StatusBarShield";
import { Icon } from "../../components/Icon";
import { useHotelsStatus } from "../../lib/useHotelsStatus";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Kundens initialer, eller ingenting (gjest). Aldri et oppdiktet navn eller bilde. */
function initialsOf(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().slice(0, 1)}${(last ?? "").trim().slice(0, 1)}`.toUpperCase();
}

/**
 * Andre nylige søk som én rad med små hvite brikker rett under søkeøya, i stedet for linjen om innlogging (den er
 * for nye kunder, som ikke har nylige søk). Et trykk søker igjen. Hele listen – også søk med passerte datoer – står
 * i Lagret. En liste med kort her presset reisemålene ut av første bilde (122 pt per søk); raden er 44 pt.
 */
function RecentSearchesRow({ items, onPick }: { items: RecentSearch[]; onPick: (r: RecentSearch) => void }) {
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const h = t.home;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll} contentContainerStyle={styles.recentRow} accessibilityLabel={h.recentTitle} testID="home-recent">
      {items.map((r) => {
        const route = `${localizedChoice(r.origin, locale).city} → ${localizedChoice(r.destination, locale).city}`;
        const back = r.tripType === "roundtrip" ? r.returnDate : null;
        // VoiceOver: hele datoer med ukedag, som i Lagret, og alt som skiller søket; synlig: det korte spennet.
        const dates = back ? `${f.day(r.departDate)} – ${f.day(back)}` : `${h.oneway} · ${f.day(r.departDate)}`;
        const detail = [dates, passengerSummary(r, i18n), cabinLabel(r.cabinClass, i18n), ...(r.directOnly ? [h.directOnly] : [])].join(" · ");
        // Synlig bare det som avviker fra et vanlig søk (én voksen, økonomi, alle ruter), så to brikker aldri ser like ut.
        const travellers = passengerCount(r);
        const extra = [travellers > 1 ? h.travellersCount(travellers) : null, r.cabinClass !== "economy" ? cabinLabel(r.cabinClass, i18n) : null, r.directOnly ? t.results.screen.chips.direct : null].filter(Boolean).join(" · ");
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
            {extra ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{`· ${extra}`}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Forsiden i «Cloud + Graphite»: lys grunn med spørsmålet (eller hilsenen) og profilknappen øverst, og søket i en
 * grafittøy – fly eller hotell (bare når hotellsøket er slått på), turtype, fra og til, datoer, reisende og «Søk
 * fly». Under øya: nylige søk eller linjen om at søk ikke krever konto, og reisemål som hvite kort (uten priser –
 * dem har vi ikke før det er søkt).
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, runSearch, recent, form, setForm } = useApp();
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const [cardProblem, setCardProblem] = useState<FormErrorCode | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Hotell vises bare når serveren sier at hotellsøket er på – ingen stor knapp til en tjeneste som ikke virker.
  const { state: hotels } = useHotelsStatus();
  const hotelsOn = hotels.kind === "ok" && hotels.status.enabled;

  const profile = auth.status === "signedIn" ? auth.profile : null;
  // Uten et ekte fornavn (tomt, eller serverens plassholder for Google/Apple uten navn): spørsmålet, ingen hilsen.
  const name = greetingName(profile);
  const initials = initialsOf(name, profile?.lastName);

  const searchTo = (d: Destination) => {
    const err = runSearch({ destination: destinationChoice(d, locale) });
    setCardProblem(err);
    if (!err) router.push("/resultater");
  };
  // Andre søk enn det som står i skjemaet, med datoer som ikke har passert.
  const current = recentKey(form);
  const again = recent.filter((r) => recentKey(r) !== current && !recentIsPast(r)).slice(0, 4);
  const searchAgain = (r: RecentSearch) => {
    // Datoene kan ha passert siden raden ble tegnet (appen lå i bakgrunnen over midnatt): da får skjemaet ruten med
    // nye datoer å se på – som «Velg nye datoer» i Lagret – og kundens skjema byttes aldri ut med et søk som ikke går.
    if (recentIsPast(r)) {
      setForm(() => withFreshDates(r));
      setCardProblem(null);
      return;
    }
    const err = runSearch(r);
    setCardProblem(err);
    if (!err) router.push("/resultater");
  };

  return (
    <View style={styles.screen}>
      <FocusStatusBar style="dark" />
      <ScrollView
        testID="home-scroll"
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: space.xxxl }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 24)}
      >
        <View style={styles.headRow}>
          {/* Innlogget: hilsen med navn. Gjest: spørsmålet søket svarer på. */}
          <Text style={[type.hero, styles.title]} accessibilityRole="header" testID="home-title">
            {name ? t.home.greetingName(f.greeting(), name) : t.home.title}
          </Text>
          {auth.status === "signedIn" ? (
            <Pressable onPress={() => router.push("/profil")} accessibilityRole="button" accessibilityLabel={t.home.profileButton} testID="account-button" style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}>
              {initials ? <Text style={styles.avatarText}>{initials}</Text> : <Icon name="user" size={20} color={colors.white} />}
            </Pressable>
          ) : (
            // Gjest: knappen går til Min side (innloggingen står øverst der), så den heter det den åpner.
            <IconButton icon="user" label={t.home.profileButton} variant="light" size={TOUCH} onPress={() => router.push("/profil")} testID="account-button" />
          )}
        </View>

        {/* Søkeøya: grafitt på lys grunn, med de hvite feltene og den blå knappen inni. */}
        <View style={styles.island} testID="home-sheet">
          {hotelsOn ? <ServiceSwitch variant="island" active="flights" onSelect={() => router.push("/hotell")} /> : null}
          <SearchPanel />
        </View>

        <View style={styles.afterIsland}>
          {again.length ? (
            <RecentSearchesRow items={again} onPick={searchAgain} />
          ) : (
            <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{t.home.noLoginNeeded}</Text>
          )}
        </View>

        <View style={styles.sectionHead}>
          <Text style={[type.title, { color: colors.text, flex: 1 }]} accessibilityRole="header">
            {t.home.exploreTitle}
          </Text>
          <LinkButton label={t.home.seeAll} accessibilityLabel={t.home.seeAllLabel} onPress={() => router.push("/utforsk")} />
        </View>
        {cardProblem ? (
          <View style={styles.cardError}>
            <Banner tone="error" testID="card-error">
              {formErrorText(cardProblem, i18n)}
            </Banner>
          </View>
        ) : null}
        {/* Luft under kortene, så skyggen ikke klippes av den vannrette listen. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {FEATURED.map((d) => (
            <DestinationRailCard key={d.id} destination={d} onPress={() => searchTo(d)} testID={`destination-${d.id}`} />
          ))}
        </ScrollView>
        {/* Hvordan HelloSky virker: under reisemålene, så søket og reisemålene står i første bilde. */}
        <Text style={[type.footnote, styles.howItWorks]} testID="how-it-works-home">
          {t.home.howItWorks}
        </Text>
      </ScrollView>
      <StatusBarShield visible={scrolled} tone="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH, paddingHorizontal: space.lg, marginBottom: space.md },
  title: { color: colors.text, flex: 1 },
  avatar: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.white },
  // Grafittøya med søket: marg til kantene, runde hjørner og en myk skygge, så den ligger på den lyse grunnen.
  island: { marginHorizontal: space.md, padding: space.lg, gap: space.md, borderRadius: radius.sheet, backgroundColor: colors.raised, boxShadow: "0px 10px 30px rgba(16, 17, 20, 0.18)" },
  afterIsland: { paddingTop: space.md, minHeight: TOUCH, justifyContent: "center" },
  // Raden går helt ut til skjermkanten, så brikkene kan rulles uten å klippes ved margen. Luft over og under
  // brikkene, så hitSlop (4 pt) når 44 pt – en ScrollView klipper det som stikker utenfor.
  recentScroll: {},
  recentRow: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: 4 },
  recentPill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  cardError: { paddingHorizontal: space.lg, paddingBottom: space.md },
  rail: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },
  howItWorks: { color: colors.textSecondary, paddingHorizontal: space.lg, marginTop: space.md },
});
