import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { StatusBarShield } from "../../components/StatusBarShield";
import { Icon, type IconName } from "../../components/Icon";
import { SignInSheet, type SignInMode } from "../../components/SignInSheet";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { CustomerProfile } from "@contracts/mobileAuth";
import { useApp } from "../../lib/appState";
import { ApiError } from "../../lib/api";
import { errorText } from "../../lib/errorText";
import { WEB_PAGES } from "../../lib/config";
import { Banner, BottomSheet, Field, PrimaryButton, SecondaryButton, Segmented } from "../../components/ui";
import { a11yLanguage, useA11yLanguage, useI18n } from "../../i18n";
import { LOCALES, LOCALE_NAMES, type Locale } from "../../i18n/types";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Nettsidene åpnes i Safari-visning, som tilbydernes sider. */
function openWeb(url: string) {
  WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined);
}

/**
 * En gruppe i innstillingslisten, som i iOS' innstillinger: overskrift på kull og et hvitt kort med rader.
 * `note` står under kortet (f.eks. at nettsidene er på norsk).
 */
function Group({ title, children, testID, note }: { title?: string; children: ReactNode; testID?: string; note?: string | null }) {
  return (
    <View style={styles.group} testID={testID}>
      {title ? (
        <Text style={[type.section, { color: colors.onDark }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
      {note ? <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{note}</Text> : null}
    </View>
  );
}

/**
 * Én rad i en gruppe: ikon, tittel (og ev. en linje under), verdi til høyre og pil. Uten `onPress` er raden bare
 * informasjon – ingen pil, og VoiceOver leser den som én tekst. En handling (`action`: logg ut, slett) har ingen pil,
 * for den åpner ingen side. Hele raden er trykkflaten (minst 52 pt).
 */
function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  external,
  danger,
  action,
  separated,
  testID,
  accessibilityHint,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
  action?: boolean;
  separated?: boolean;
  testID?: string;
  accessibilityHint?: string;
  /** VoiceOver-etiketten når den synlige rekkefølgen ikke er den beste å høre (f.eks. «Navn: Kari Nordmann»). */
  accessibilityLabel?: string;
}) {
  const lang = useA11yLanguage();
  const fg = danger ? colors.danger : colors.text;
  const muted = danger ? colors.danger : colors.textSecondary;
  const inner = (
    <>
      <Icon name={icon} size={20} color={muted} strokeWidth={1.75} />
      <View style={styles.rowText}>
        {/* Ingen linjegrense: lange titler og stor tekst bryter linjen. */}
        <Text style={[type.body, { color: fg }]}>{title}</Text>
        {subtitle ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={[type.callout, styles.rowValue]}>{value}</Text> : null}
      {onPress && !action ? <Icon name={external ? "external" : "chevronRight"} size={18} color={muted} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLanguage={lang} accessibilityLabel={accessibilityLabel ?? [title, value, subtitle].filter(Boolean).join(", ")} style={[styles.row, separated && styles.rowBorder]} testID={testID}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.row, separated && styles.rowBorder, pressed && { backgroundColor: colors.inset }]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * Innstillingene: språket (før og etter innlogging, gjelder med én gang og huskes på telefonen) og valutaen, som
 * alltid er NOK – en informasjonsrad, ikke et valg.
 */
function SettingsGroup() {
  const { t, locale, setLocale } = useI18n();
  const a = t.account;
  return (
    <Group title={a.settingsTitle} testID="settings-group">
      <View style={styles.block} testID="language-card">
        <View style={styles.blockHead}>
          <Icon name="globe" size={20} color={colors.textSecondary} strokeWidth={1.75} />
          <Text style={[type.body, { color: colors.text }]}>{a.language}</Text>
        </View>
        {/* Hvert språk står på sitt eget språk, og VoiceOver leser det med den stemmen. */}
        <Segmented<Locale> label={a.language} value={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: a11yLanguage(l) }))} onChange={setLocale} />
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{a.languageHint}</Text>
      </View>
      <Row icon="banknote" title={a.currency} subtitle={a.currencyNote} value={a.currencyValue} separated testID="currency-row" />
    </Group>
  );
}

/** HelloSkys egne sider for hjelp, kontakt, personvern og vilkår (åpnes i Safari-visning). */
function HelpGroup() {
  const { t, locale } = useI18n();
  const a = t.account;
  return (
    <Group title={a.helpTitle} testID="help-card" note={locale === "en" ? a.webNorwegian : null}>
      <Row icon="help" title={a.helpCentre} external onPress={() => openWeb(WEB_PAGES.help)} testID="link-help" accessibilityHint={a.webOpens} />
      <Row icon="lock" title={a.privacy} external separated onPress={() => openWeb(WEB_PAGES.privacy)} testID="link-privacy" accessibilityHint={a.webOpens} />
      <Row icon="info" title={a.terms} external separated onPress={() => openWeb(WEB_PAGES.terms)} testID="link-terms" accessibilityHint={a.webOpens} />
      <Row icon="plane" title={a.about} external separated onPress={() => openWeb(WEB_PAGES.about)} testID="link-about" accessibilityHint={a.webOpens} />
    </Group>
  );
}

/** Appens versjon nederst, som i andre innstillinger (til hjelp når kunden kontakter oss). */
function VersionLine() {
  const { t } = useI18n();
  const version = Constants.expoConfig?.version;
  if (!version) return null;
  return (
    <Text style={[type.footnote, styles.version]} testID="app-version">
      {t.account.version(version)}
    </Text>
  );
}

/**
 * Endre navn (samme regler og samme konto som nettet). Telefonnummeret er en
 * innloggingsnøkkel (engangskode på SMS) og kan ikke endres i appen før
 * serveren bekrefter det nye nummeret med en kode.
 */
function EditProfileSheet({ profile, visible, onClose, onSaved }: { profile: CustomerProfile; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { updateProfile } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null);

  const save = async () => {
    setError(null);
    if (!firstName.trim()) return setError({ field: "firstName", text: a.fieldErrors.firstName });
    if (!lastName.trim()) return setError({ field: "lastName", text: a.fieldErrors.lastName });
    setBusy(true);
    try {
      // Kontoens språk (e-post) endres bare når kunden faktisk har valgt språk i appen – ikke av standarden.
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), ...(i18n.chosen ? { locale: i18n.locale } : {}) });
      onSaved();
    } catch (e) {
      const field = e instanceof ApiError ? (e.field ?? null) : null;
      const specific = e instanceof ApiError && e.code === "VALIDATION" && (field === "firstName" || field === "lastName") ? a.fieldErrors[field] : errorText(e, i18n);
      setError({ field, text: specific });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={a.editTitle} onClose={onClose} testID="edit-profile">
      <View style={{ gap: space.md }}>
        <Field label={a.firstName} icon="user" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" error={error?.field === "firstName" ? error.text : null} testID="edit-first-name" />
        <Field label={a.lastName} icon="user" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" error={error?.field === "lastName" ? error.text : null} testID="edit-last-name" />
        {error && !["firstName", "lastName"].includes(error.field ?? "") ? (
          <Banner tone="error" testID="edit-error">
            {error.text}
          </Banner>
        ) : null}
        <PrimaryButton testID="edit-save" label={busy ? a.saving : i18n.t.common.save} onPress={save} loading={busy} />
      </View>
    </BottomSheet>
  );
}

/** Slett konto: bekreftes med passord (eller et ord for kontoer uten passord). */
function DeleteAccountSheet({ profile, visible, onClose }: { profile: CustomerProfile; visible: boolean; onClose: () => void }) {
  const { deleteAccount } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    if (profile.hasPassword && !password) return setError(a.passwordRequired);
    if (!profile.hasPassword && word.trim().toUpperCase() !== a.deleteWord) return setError(a.deleteWordMismatch(a.deleteWord));
    setBusy(true);
    try {
      await deleteAccount(profile.hasPassword ? { password } : { confirmation: a.deleteWord === "SLETT" ? "SLETT" : "DELETE" });
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "UNAUTHORIZED" && e.field === "password"
          ? a.deleteWrongPassword
          : e instanceof ApiError && e.code === "FORBIDDEN" && e.reason === "reauth_required"
            ? a.deleteReauth
            : errorText(e, i18n),
      );
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={a.deleteTitle} onClose={onClose} testID="delete-account">
      <View style={{ gap: space.md }}>
        <Text style={[type.callout, { color: colors.text }]}>{a.deleteBody}</Text>
        {profile.hasPassword ? (
          <Field label={a.deletePassword} icon="lock" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" testID="delete-password" />
        ) : (
          <Field label={a.deleteTypeWord(a.deleteWord)} icon="alert" value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} testID="delete-word" />
        )}
        {error ? (
          <Banner tone="error" testID="delete-error">
            {error}
          </Banner>
        ) : null}
        <PrimaryButton testID="delete-confirm" label={busy ? a.deleting : a.deleteConfirm} onPress={confirm} loading={busy} />
        <SecondaryButton label={i18n.t.common.cancel} onPress={onClose} testID="delete-cancel" />
      </View>
    </BottomSheet>
  );
}

/**
 * Innloggingskortet øverst i Profil for gjester, som hos de store søketjenestene: hva en konto er (samme konto som på
 * hellosky.no) og at søket ikke krever den. Skjemaet åpnes i et eget ark.
 */
function SignInCard({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { t } = useI18n();
  const a = t.account;
  return (
    <View style={styles.signInCard} testID="sign-in-card">
      <View style={styles.signInIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="user" size={22} color={colors.blue} />
      </View>
      <Text style={[type.section, { color: colors.text }]} accessibilityRole="header">
        {a.signInTitle}
      </Text>
      <Text style={[type.callout, { color: colors.textSecondary }]}>{a.signInBody}</Text>
      <View style={styles.signInActions}>
        <PrimaryButton testID="open-login" label={a.loginTitle} onPress={onLogin} accessibilityHint={a.signInHint} />
        <SecondaryButton testID="open-register" label={a.registerTitle} onPress={onRegister} accessibilityHint={a.registerHint} />
      </View>
    </View>
  );
}

/** Profil og innstillinger. Vanlig kundeinnlogging; ingen andre roller finnes i appen. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { auth, logout, requestSocialProviders } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  // Innloggingsskjemaet står i et eget ark (iOS' sidekort) som åpnes fra kortet øverst, i innlogging eller ny konto.
  const [authOpen, setAuthOpen] = useState<SignInMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "edit" | "delete">(null);
  const [saved, setSaved] = useState(false);

  // Et ark eller en «lagret»-melding hører til kontoen som var logget inn da:
  // etter utlogging, sletting eller utløpt økt skal ingenting dukke opp igjen.
  // (Innloggingsarket rydder sitt eget skjema, også passordet – se components/SignInSheet.tsx.)
  const [shownFor, setShownFor] = useState(auth.status);
  if (shownFor !== auth.status) {
    setShownFor(auth.status);
    setSheet(null);
    setSaved(false);
    setAuthOpen(null);
  }

  // Innloggingsmåtene (Google/Apple) hentes bare når innloggingen faktisk kan vises.
  const signedOut = auth.status === "signedOut";
  useEffect(() => {
    if (signedOut) requestSocialProviders();
  }, [signedOut, requestSocialProviders]);

  const top = { paddingTop: insets.top + space.lg };

  // Innloggingsarket står i alle tilstander med samme nøkkel, så det beholder skjemaet (e-postadressen står til neste
  // gang, også etter innlogging og utlogging). Det vises bare for gjester.
  const signIn = <SignInSheet key="sign-in-sheet" visible={authOpen !== null} initialMode={authOpen ?? "login"} onClose={() => setAuthOpen(null)} />;

  if (auth.status === "loading") {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.onDark} />
        {signIn}
      </View>
    );
  }

  if (auth.status === "signedIn") {
    const p = auth.profile;
    const initials = p ? `${p.firstName.slice(0, 1)}${p.lastName.slice(0, 1)}`.toUpperCase() : "";
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        {/* Egen nøkkel: etter innlogging starter listen øverst, ikke der gjestelisten var rullet. */}
        <ScrollView key="signed-in" style={styles.screen} contentContainerStyle={[styles.content, top]} testID="account-signed-in">
          <View style={styles.hello}>
            <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={[type.title, { color: colors.onDark, flex: 1 }]} accessibilityRole="header">
              {p ? a.hello(p.firstName) : a.signedIn}
            </Text>
          </View>
          {saved ? (
            <Banner tone="info" dark testID="profile-saved">
              {a.saved}
            </Banner>
          ) : null}
          {p ? (
            <Group title={a.accountSection} testID="account-card">
              {/* Verdien øverst og hva den er under, så lange navn og e-poster får hele bredden. */}
              <Row icon="user" title={`${p.firstName} ${p.lastName}`.trim()} subtitle={a.nameLabel} accessibilityLabel={`${a.nameLabel}: ${`${p.firstName} ${p.lastName}`.trim()}`} />
              {p.email ? <Row icon="mail" title={p.email} subtitle={a.emailLabel} accessibilityLabel={`${a.emailLabel}: ${p.email}`} separated /> : null}
              {p.phone ? <Row icon="phone" title={p.phone} subtitle={a.phoneLabel} accessibilityLabel={`${a.phoneLabel}: ${p.phone}`} separated /> : null}
              <Row
                icon="pencil"
                title={a.editProfile}
                separated
                onPress={() => {
                  setSaved(false);
                  setSheet("edit");
                }}
                testID="open-edit-profile"
              />
            </Group>
          ) : (
            <Banner tone="warning" dark>
              {a.profileUnavailable}
            </Banner>
          )}
          <SettingsGroup />
          <HelpGroup />
          <Group>
            <Row
              icon="logout"
              title={busy ? a.loggingOut : a.logout}
              action
              testID="logout-button"
              onPress={async () => {
                if (busy) return;
                setBusy(true);
                await logout();
                setBusy(false);
              }}
            />
            {p ? <Row icon="close" title={a.deleteRow} danger action separated onPress={() => setSheet("delete")} testID="open-delete-account" /> : null}
          </Group>
          <VersionLine />
          {p ? (
            <>
              <EditProfileSheet
                key={`edit-${sheet === "edit"}`}
                profile={p}
                visible={sheet === "edit"}
                onClose={() => setSheet(null)}
                onSaved={() => {
                  setSheet(null);
                  setSaved(true);
                }}
              />
              <DeleteAccountSheet key={`delete-${sheet === "delete"}`} profile={p} visible={sheet === "delete"} onClose={() => setSheet(null)} />
            </>
          ) : null}
        </ScrollView>
        <StatusBarShield />
        {signIn}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* Egen nøkkel: etter utlogging, sletting eller utløpt økt starter listen øverst, så meldingen og kortet synes. */}
      <ScrollView key="signed-out" style={styles.screen} contentContainerStyle={[styles.content, top]} testID="account-signed-out">
        <Text style={[type.hero, { color: colors.onDark }]} accessibilityRole="header">
          {a.profileTitle}
        </Text>
        {auth.notice ? (
          <Banner tone={auth.notice === "expired" ? "warning" : "info"} dark testID={`auth-notice-${auth.notice}`}>
            {auth.notice === "expired" ? a.sessionExpired : a.deleted}
          </Banner>
        ) : null}
        <SignInCard onLogin={() => setAuthOpen("login")} onRegister={() => setAuthOpen("register")} />
        <SettingsGroup />
        <HelpGroup />
        <VersionLine />
      </ScrollView>
      <StatusBarShield />
      {signIn}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  // Innstillingslisten: overskrift på kull, hvitt kort med rader og hårfine streker mellom dem.
  group: { gap: space.sm },
  groupCard: { backgroundColor: colors.white, borderRadius: radius.input, overflow: "hidden" },
  row: { minHeight: TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  rowText: { flex: 1, gap: 2 },
  // Verdien tar aldri mer enn litt over halve raden, så etiketten ikke presses til ingenting (lange verdier bryter).
  rowValue: { color: colors.textSecondary, flexShrink: 1, maxWidth: "55%", textAlign: "right" },
  block: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  blockHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  version: { color: colors.onDarkDim, textAlign: "center" },
  signInCard: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.xl, gap: space.sm },
  signInIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  signInActions: { gap: space.sm, marginTop: space.md },
  hello: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.white },
});
