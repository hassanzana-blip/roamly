import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { MobileSocialProvider } from "@contracts/mobileAuth";
import type * as AppleAuthentication from "expo-apple-authentication";
import { Pressable, Text } from "./a11y";
import { ApiError } from "../lib/api";
import { appleBuildReady } from "../lib/appleSupport";
import { errorText } from "../lib/errorText";
import { useI18n, type I18n } from "../i18n";
import { colors, radius, space, type } from "../lib/theme";

/** Leverandørens navn på knappen og i meldingene (likt på begge språk). */
const PROVIDER_NAME: Record<MobileSocialProvider, string> = { google: "Google", apple: "Apple" };

/**
 * Høyden på knappene, som hovedknappen (52 pt): over Apples minstemål (30 pt) og vårt (44 pt). Apples systemknapp
 * tegner teksten etter høyden og følger ikke tekststørrelsen, så den har fast høyde; våre egne knapper vokser.
 */
const SOCIAL_BUTTON_HEIGHT = 52;

/** Apple først, som i andre iPhone-apper: Sign in with Apple skal ikke stå svakere enn andre måter å logge inn på. */
const ORDER: readonly MobileSocialProvider[] = ["apple", "google"];

/** Apples svarte knapp har ren svart flate; vår erstatning bruker samme farge. */
const APPLE_BLACK = "#000000";

/**
 * Google og Apple, bare for leverandørene i `providers` – det Profil og velkomsten får fra `useApp().socialProviders`
 * (serveren sier klar OG builden har en native flyt). En knapp som ikke kan virke, vises aldri.
 *
 * Apple: Apples egen systemknapp når builden kan kjøre Sign in with Apple (`appleBuildReady`). Bare der modulen ikke
 * finnes (tester, nettleser-forhåndsvisning) står vår svarte pille med «Fortsett med Apple». Google: hvit pille med
 * tynn kant og mørk tekst. Ingen logoer tegnes av oss.
 *
 * `busy`: leverandøren som logger inn nå. Knappen sier det («Logger inn med Google …»); Apples systemknapp har Apples
 * egen tekst, så der står det i en linje under knappene. Nye trykk stoppes av den som eier innloggingen (`onPress`).
 */
export function SocialButtons({ providers, busy, onPress, testID }: { providers: readonly MobileSocialProvider[]; busy: MobileSocialProvider | null; onPress: (provider: MobileSocialProvider) => void; testID?: string }) {
  const { t } = useI18n();
  // Builden endrer seg ikke mens appen kjører: ett svar per knapperad.
  const [systemApple] = useState(() => appleBuildReady());
  const shown = ORDER.filter((p) => providers.includes(p));
  if (!shown.length) return null;
  return (
    <View style={styles.stack} testID={testID}>
      {shown.map((p) =>
        p === "apple" && systemApple ? (
          <AppleSystemButton key={p} onPress={() => onPress(p)} />
        ) : (
          <ProviderButton key={p} provider={p} busy={busy === p} onPress={() => onPress(p)} />
        ),
      )}
      {busy === "apple" && systemApple ? (
        <View style={styles.busyLine} testID="social-busy">
          <ActivityIndicator color={colors.textSecondary} />
          <Text style={[type.footnote, { color: colors.textSecondary, flexShrink: 1 }]}>{t.account.socialBusy(PROVIDER_NAME.apple)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Apples egen knapp (ASAuthorizationAppleIDButton, typen «Fortsett med Apple», svart): Apple tegner logoen og teksten
 * og gir VoiceOver etiketten. Teksten følger telefonens språk (appen har nb og en), ikke språkvalget i Profil.
 * Vi velger bare type, farge, hjørner (pille, som våre knapper) og høyde – bakgrunn og hjørner settes aldri i `style`.
 */
function AppleSystemButton({ onPress }: { onPress: () => void }) {
  // Modulen lastes først her, når builden faktisk har den (lib/appleSupport.ts); ellers kjøres den aldri.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Apple = require("expo-apple-authentication") as typeof AppleAuthentication;
  return (
    <Apple.AppleAuthenticationButton
      buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={SOCIAL_BUTTON_HEIGHT / 2}
      style={styles.appleSystem}
      onPress={onPress}
      testID="social-apple"
    />
  );
}

/** Vår egen pille: Google alltid, Apple bare uten Apples systemknapp. Etikett, hint og «logger inn»-tekst på appens språk. */
function ProviderButton({ provider, busy, onPress }: { provider: MobileSocialProvider; busy: boolean; onPress: () => void }) {
  const { t } = useI18n();
  const a = t.account;
  const name = PROVIDER_NAME[provider];
  const label = busy ? a.socialBusy(name) : a.socialContinue(name);
  const apple = provider === "apple";
  const fg = apple ? colors.white : colors.text;
  return (
    <Pressable
      testID={`social-${provider}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={a.socialHint}
      accessibilityState={{ busy }}
      style={({ pressed }) => [styles.button, apple ? styles.apple : styles.google, pressed && (apple ? styles.applePressed : styles.googlePressed)]}
    >
      {/* LOGO: Googles offisielle «G» (lys variant, fra Googles egne merkevareretningslinjer for «Sign in with Google»)
          skal stå her, til venstre for teksten, når eieren har lagt filen inn i assets/. Vi tegner eller kopierer aldri
          Googles eller Apples logo selv. Apple trenger ingen: på iPhone tegner Apples systemknapp sin egen. */}
      {busy ? <ActivityIndicator color={fg} /> : null}
      {/* Ingen linjegrense: med stor tekst brytes etiketten og knappen blir høyere. */}
      <Text style={[type.headline, styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Feil fra Google/Apple-innloggingen: serverens egne svar (ansatts adresse, lookalike) på kundens språk, ellers en ærlig, generell feil. */
export function socialErrorText(e: unknown, i18n: Pick<I18n, "locale" | "t">): string {
  const a = i18n.t.account;
  const reason = e instanceof ApiError ? e.reason : undefined;
  if (e instanceof ApiError && e.code === "FORBIDDEN") return a.socialBlocked;
  if (e instanceof ApiError && e.code === "CONFLICT" && reason === "email_lookalike") return a.socialLookalike;
  if (e instanceof ApiError && ["NETWORK", "TIMEOUT", "RATE_LIMITED"].includes(e.code)) return errorText(e, i18n);
  return a.socialFailed;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  button: { minHeight: SOCIAL_BUTTON_HEIGHT, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.sm },
  apple: { backgroundColor: APPLE_BLACK },
  applePressed: { opacity: 0.8 },
  // Hvit pille med tynn, lys kant: synlig både på den lyse grunnen (velkomsten) og på hvitt (innloggingsarket).
  google: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  googlePressed: { backgroundColor: colors.inset },
  label: { textAlign: "center", flexShrink: 1 },
  appleSystem: { height: SOCIAL_BUTTON_HEIGHT, alignSelf: "stretch" },
  busyLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, minHeight: 24 },
});
