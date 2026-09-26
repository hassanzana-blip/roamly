import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Animated, Easing, Text as RNText, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileSocialProvider } from "@contracts/mobileAuth";
import { Pressable, Text } from "./a11y";
import { BottomFade, PhotoBackdrop } from "./Photo";
import { SignInSheet, type SignInMode } from "./SignInSheet";
import { SocialButtons, socialErrorText } from "./SocialButtons";
import { StatusBarShield } from "./StatusBarShield";
import { Banner, PrimaryButton, Wordmark } from "./ui";
import { useApp } from "../lib/appState";
import { DESTINATIONS } from "../lib/destinations";
import { readPref, writePref } from "../lib/localStore";
import { useReducedMotion } from "../lib/motion";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/** Flagget i innstillingsfilen på telefonen: bare «velkomsten er sett» – aldri noe om kunden. */
export const WELCOME_SEEN_KEY = "welcomeSeen";

/** Paris i kveldslys (fra reisemålsregisteret): rolig himmel øverst under «Hopp over», mørk elv nederst under teksten. */
const PHOTO = DESTINATIONS.find((d) => d.id === "paris")?.photo ?? null;

function seenBefore(): boolean {
  return readPref(WELCOME_SEEN_KEY, (v) => (v === true ? true : null)) === true;
}

/**
 * Velkomsten ved første oppstart, som hos de store reisetjenestene: en grafittøy med et ekte reisemålsfoto, HelloSky og
 * hva appen gjør; under den Google og Apple (bare de som kan virke), «Fortsett med e-post», «Opprett konto» og at søk
 * ikke krever konto. «Hopp over» står alltid øverst til høyre – en gjest kommer alltid videre.
 *
 * Vises én gang, for en gjest (auth «signedOut») uten flagget `welcomeSeen`. «Hopp over» og en innlogging herfra
 * (e-post i arket, Google eller Apple) setter flagget og lukker velkomsten. Er kunden logget inn ved oppstart, settes
 * flagget uten at velkomsten vises. Flagget er det eneste som lagres.
 *
 * Et lag over hele appen, ikke en Modal: da er innloggingsarket det eneste sidekortet (iOS legger det over roten), og
 * det lukkes rent når kunden logger inn – et ark oppå en Modal som lukkes samtidig, kan bli stående. For VoiceOver er
 * laget modalt (appen under leses ikke), på appens språk. Laget tones inn; når det lukkes, skyves det ned – eller tones
 * ut når «Reduser bevegelse» er på.
 */
export function WelcomeGate() {
  const { auth, requestSocialProviders, socialProviders, socialLogin } = useApp();
  const i18n = useI18n();
  const w = i18n.t.welcome;
  const a = i18n.t.account;
  const lang = useA11yLanguage();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [seen, setSeen] = useState(seenBefore);
  const [sheet, setSheet] = useState<SignInMode | null>(null);
  const [socialBusy, setSocialBusy] = useState<MobileSocialProvider | null>(null);
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Statuslinjen følger det som står under den, som i resultatene: lys tekst over fotoet. Med stor tekst ruller
  // velkomsten; når øya har rullet ut under statuslinjen, mørk tekst og en lys skjerm over grunnen.
  const islandHeight = useRef(0);
  const [pastIsland, setPastIsland] = useState(false);

  // Logget inn – ved oppstart, eller nettopp her (e-post, Google eller Apple): velkomsten er sett, og den lukkes.
  // Også etter en senere utlogging i samme økt kommer den ikke tilbake.
  if (auth.status === "signedIn" && !seen) setSeen(true);

  // Flagget lagres på telefonen så snart velkomsten er sett. Et bevisst valg, som språket: det får også skrives inn
  // i en innstillingsfil fra en nyere appversjon (lib/localStore.ts).
  useEffect(() => {
    if (seen && !seenBefore()) writePref(WELCOME_SEEN_KEY, true, { userChoice: true });
  }, [seen]);

  const open = !seen && auth.status === "signedOut";

  // Innloggingsmåtene hentes når velkomsten vises – knappene står her.
  useEffect(() => {
    if (open) requestSocialProviders();
  }, [open, requestSocialProviders]);

  // På skjermen mens velkomsten er åpen, og mens den forsvinner.
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const [shown] = useState(() => new Animated.Value(0));
  const title = useRef<ComponentRef<typeof RNText>>(null);
  const focused = useRef(false);
  useEffect(() => {
    if (!present) return;
    const anim = Animated.timing(shown, {
      toValue: open ? 1 : 0,
      duration: open ? 220 : reduced ? 200 : 320,
      easing: open ? Easing.out(Easing.quad) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (!open) {
        setPresent(false);
        return;
      }
      // Inne: VoiceOver går til overskriften, én gang (appen under er skjult for den så lenge velkomsten står). Først nå,
      // for iOS hopper over en helt gjennomsiktig flate. Nettleser-forhåndsvisningen har ikke denne funksjonen.
      const node = title.current;
      if (node && !focused.current) {
        focused.current = true;
        AccessibilityInfo.sendAccessibilityEvent?.(node, "focus");
      }
    });
    return () => anim.stop();
  }, [open, present, reduced, shown]);

  const skip = () => setSeen(true);

  // Mens Google/Apple logger inn, starter ikke e-postskjemaet en innlogging til.
  const openSheet = (m: SignInMode) => {
    if (socialBusy) return;
    setError(null);
    setSocialNote(null);
    setSheet(m);
  };

  const social = async (provider: MobileSocialProvider) => {
    if (socialBusy) return;
    setError(null);
    setSocialNote(null);
    setSocialBusy(provider);
    try {
      const outcome = await socialLogin(provider, i18n.locale);
      if (outcome === "cancelled") setSocialNote(a.socialCancelled);
      // «signedIn»: innloggingen selv lukker velkomsten (se over).
    } catch (e) {
      setError(socialErrorText(e, i18n));
    } finally {
      setSocialBusy(null);
    }
  };

  if (!present) return null;

  // Inn: toning. Ut: ned over kanten – eller toning med «Reduser bevegelse». Begge egenskapene står alltid i stilen.
  const fade = open || reduced;
  const motion = { opacity: fade ? shown : 1, transform: [{ translateY: fade ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, motion]}
      pointerEvents={open ? "auto" : "none"}
      accessibilityViewIsModal={open}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      accessibilityLanguage={lang}
      onAccessibilityEscape={open ? skip : undefined}
      testID="welcome"
    >
      {open ? <StatusBar style={pastIsland ? "dark" : "light"} animated /> : null}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={(e) => setPastIsland(islandHeight.current > 0 && e.nativeEvent.contentOffset.y > islandHeight.current - insets.top)}
        testID="welcome-scroll"
      >
        {/* Grafittøya: fotoet helt ut til kantene og under statuslinjen, med runde hjørner nederst. */}
        <View
          style={[styles.island, { paddingTop: insets.top + space.xs, minHeight: Math.max(300, Math.round(height * 0.42)) }]}
          onLayout={(e) => {
            islandHeight.current = e.nativeEvent.layout.height;
          }}
          testID="welcome-island"
        >
          {/* Fotoet er pynt: VoiceOver hopper over det. */}
          <View style={styles.photo} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <PhotoBackdrop photo={PHOTO} scrim="light" style={StyleSheet.absoluteFill}>
              <BottomFade height="70%" strength={0.9} />
            </PhotoBackdrop>
          </View>
          <View style={styles.top}>
            <Pressable onPress={skip} accessibilityRole="button" accessibilityLabel={w.skip} accessibilityHint={w.skipHint} testID="welcome-skip" style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
              {/* Mørk glasspille bak teksten, så den kan leses på ethvert foto. */}
              <View style={styles.skipPill}>
                <Text style={[type.calloutStrong, { color: colors.onDark, textAlign: "center" }]}>{w.skip}</Text>
              </View>
            </Pressable>
          </View>
          <View style={styles.brand}>
            <Wordmark size={26} />
            <RNText ref={title} style={[type.title, { color: colors.onDark }]} accessibilityRole="header" accessibilityLanguage={lang} testID="welcome-title">
              {w.title}
            </RNText>
          </View>
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + space.lg }]} testID="welcome-actions">
          <SocialButtons providers={socialProviders} busy={socialBusy} onPress={(p) => void social(p)} testID="welcome-social" />
          {socialNote ? (
            <Banner tone="info" testID="welcome-social-note">
              {socialNote}
            </Banner>
          ) : null}
          {error ? (
            <Banner tone="error" testID="welcome-error">
              {error}
            </Banner>
          ) : null}
          <PrimaryButton testID="welcome-email" label={w.email} onPress={() => openSheet("login")} accessibilityHint={a.signInHint} />
          <Pressable
            onPress={() => openSheet("register")}
            accessibilityRole="button"
            accessibilityLabel={a.registerTitle}
            accessibilityHint={a.registerHint}
            testID="welcome-register"
            style={({ pressed }) => [styles.register, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.calloutStrong, { color: colors.blue, textAlign: "center" }]}>{a.registerTitle}</Text>
          </Pressable>
          <Text style={[type.footnote, styles.note]} testID="welcome-no-account">
            {w.noAccountNeeded}
          </Text>
        </View>
      </ScrollView>
      <StatusBarShield visible={pastIsland} tone="light" />
      {/* E-post: samme ark som på Min side. Logger kunden inn der, lukkes arket og velkomsten sammen. */}
      {open ? <SignInSheet visible={sheet !== null} initialMode={sheet ?? "login"} onClose={() => setSheet(null)} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.canvas, zIndex: 100 },
  fill: { flex: 1 },
  // Innholdet fyller skjermen (øya tar resten); med stor tekst ruller alt i stedet for å kuttes.
  scroll: { flexGrow: 1 },
  island: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: space.xl,
    backgroundColor: colors.raised,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    boxShadow: "0px 10px 30px rgba(16, 17, 20, 0.18)",
  },
  photo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, overflow: "hidden" },
  top: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space.sm },
  // Hele trykkflaten er minst 44 × 44 pt; pillen inni er det som synes.
  skip: { minHeight: TOUCH, minWidth: TOUCH, justifyContent: "center", paddingHorizontal: space.sm },
  skipPill: { minHeight: 34, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(12, 13, 15, 0.45)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.18)" },
  // Samme sidemarg (16) som knappene under, så tekst og knapper står på én linje.
  brand: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  actions: { paddingHorizontal: space.lg, paddingTop: space.xxl, gap: space.md },
  register: { alignSelf: "center", minHeight: TOUCH, minWidth: TOUCH, justifyContent: "center", paddingHorizontal: space.md },
  note: { color: colors.textSecondary, textAlign: "center" },
});
