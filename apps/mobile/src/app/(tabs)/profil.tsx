import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { StatusBarShield } from "../../components/StatusBarShield";
import { Icon, type IconName } from "../../components/Icon";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { CustomerProfile, MobileSocialProvider } from "@contracts/mobileAuth";
import { useApp } from "../../lib/appState";
import { ApiError } from "../../lib/api";
import { errorText } from "../../lib/errorText";
import { WEB_PAGES } from "../../lib/config";
import { Banner, BottomSheet, Field, InfoRow, InformationCard, LinkButton, NavRow, PrimaryButton, SecondaryButton, Segmented } from "../../components/ui";
import { a11yLanguage, useI18n } from "../../i18n";
import { LOCALES, LOCALE_NAMES, type Locale } from "../../i18n/types";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Nettsidene åpnes i Safari-visning, som tilbydernes sider. */
function openWeb(url: string) {
  WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined);
}

/**
 * Språkvalget: før og etter innlogging, gjelder med én gang og huskes på
 * telefonen. Valuta, leverandører og søk er uendret – prisene er alltid i NOK.
 */
function LanguageCard() {
  const { t, locale, setLocale } = useI18n();
  return (
    <InformationCard title={t.account.language} testID="language-card" style={styles.compactCard}>
      {/* Hvert språk står på sitt eget språk, og VoiceOver leser det med den stemmen. */}
      <Segmented<Locale> label={t.account.language} value={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: a11yLanguage(l) }))} onChange={setLocale} />
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.account.languageHint}</Text>
    </InformationCard>
  );
}

/** Tett innstillingsrad på mørk flate; hele raden er én stor trykkflate. */
function DarkLinkRow({ icon, title, onPress, external, danger, testID, accessibilityHint, separated }: { icon: IconName; title: string; onPress: () => void; external?: boolean; danger?: boolean; testID: string; accessibilityHint?: string; separated?: boolean }) {
  const fg = danger ? "#FFB4AB" : colors.onDark;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.darkLink, separated && styles.darkLinkBorder, pressed && { backgroundColor: colors.darkBorder }]}
    >
      <Icon name={icon} size={20} color={danger ? fg : colors.onDarkMuted} strokeWidth={1.75} />
      <Text style={[type.callout, { color: fg, flex: 1 }]}>{title}</Text>
      <Icon name={external ? "external" : "chevronRight"} size={18} color={danger ? fg : colors.onDarkMuted} />
    </Pressable>
  );
}

/** HelloSkys egne sider for hjelp, kontakt, personvern og vilkår. */
function HelpCard() {
  const { t, locale } = useI18n();
  const a = t.account;
  const note = locale === "en" ? a.webNorwegian : null;
  return (
    <View style={styles.darkSection} testID="help-card">
      <Text style={[type.section, { color: colors.onDark }]} accessibilityRole="header">{a.helpTitle}</Text>
      <View style={styles.darkList}>
        <DarkLinkRow icon="help" title={a.helpCentre} external onPress={() => openWeb(WEB_PAGES.help)} testID="link-help" accessibilityHint={a.webOpens} />
        <DarkLinkRow icon="lock" title={a.privacy} external separated onPress={() => openWeb(WEB_PAGES.privacy)} testID="link-privacy" accessibilityHint={a.webOpens} />
        <DarkLinkRow icon="info" title={a.terms} external separated onPress={() => openWeb(WEB_PAGES.terms)} testID="link-terms" accessibilityHint={a.webOpens} />
        <DarkLinkRow icon="plane" title={a.about} external separated onPress={() => openWeb(WEB_PAGES.about)} testID="link-about" accessibilityHint={a.webOpens} />
      </View>
      {note ? <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{note}</Text> : null}
    </View>
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

/** «Glemt passordet?»: nettets egen tilbakestilling. Svaret er alltid det samme. */
function ForgotPasswordSheet({ visible, onClose, initialEmail }: { visible: boolean; onClose: () => void; initialEmail: string }) {
  const { api } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    if (!EMAIL.test(email.trim())) return setError(a.invalidEmail);
    setBusy(true);
    try {
      await api.requestPasswordReset(email, i18n.locale);
      setSent(true);
    } catch (e) {
      setError(errorText(e, i18n));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={a.forgotTitle} onClose={onClose} testID="forgot-password">
      <View style={{ gap: space.md }}>
        {sent ? (
          <Banner tone="info" testID="forgot-sent">
            {a.forgotSent}
          </Banner>
        ) : (
          <>
            <Text style={[type.callout, { color: colors.text }]}>{a.forgotBody}</Text>
            <Field label={a.email} icon="mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" testID="forgot-email" />
            {error ? (
              <Banner tone="error" testID="forgot-error">
                {error}
              </Banner>
            ) : null}
            <PrimaryButton testID="forgot-send" label={a.forgotSend} onPress={send} loading={busy} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

/** Profil og innstillinger. Vanlig kundeinnlogging; ingen andre roller finnes i appen. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { auth, login, register, logout, socialProviders, requestSocialProviders, socialLogin } = useApp();
  const [socialBusy, setSocialBusy] = useState<MobileSocialProvider | null>(null);
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const i18n = useI18n();
  const a = i18n.t.account;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "edit" | "delete" | "forgot">(null);
  const [saved, setSaved] = useState(false);

  // Et ark eller en «lagret»-melding hører til kontoen som var logget inn da:
  // etter utlogging, sletting eller utløpt økt skal ingenting dukke opp igjen.
  const [shownFor, setShownFor] = useState(auth.status);
  if (shownFor !== auth.status) {
    setShownFor(auth.status);
    setSheet(null);
    setSaved(false);
  }

  // Innloggingsmåtene (Google/Apple) hentes bare når innloggingen faktisk vises.
  const signedOut = auth.status === "signedOut";
  useEffect(() => {
    if (signedOut) requestSocialProviders();
  }, [signedOut, requestSocialProviders]);

  const top = { paddingTop: insets.top + space.lg };

  if (auth.status === "loading") {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.onDark} />
      </View>
    );
  }

  if (auth.status === "signedIn") {
    const p = auth.profile;
    const initials = p ? `${p.firstName.slice(0, 1)}${p.lastName.slice(0, 1)}`.toUpperCase() : "";
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView style={styles.screen} contentContainerStyle={[styles.content, top]} testID="account-signed-in">
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
          <InformationCard title={a.accountSection} testID="account-card" style={styles.compactCard}>
            <InfoRow icon="user" title={`${p.firstName} ${p.lastName}`.trim()} subtitle={a.nameLabel} />
            {p.email ? <InfoRow icon="mail" title={p.email} subtitle={a.emailLabel} /> : null}
            {p.phone ? <InfoRow icon="user" title={p.phone} subtitle={a.phoneLabel} /> : null}
            <NavRow
              icon="user"
              title={a.editProfile}
              onPress={() => {
                setSaved(false);
                setSheet("edit");
              }}
              testID="open-edit-profile"
            />
          </InformationCard>
        ) : (
          <Banner tone="warning" dark>
            {a.profileUnavailable}
          </Banner>
        )}
        <LanguageCard />
        <HelpCard />
        <SecondaryButton
          dark
          testID="logout-button"
          label={busy ? a.loggingOut : a.logout}
          icon="logout"
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            await logout();
            setBusy(false);
          }}
        />
        {p ? (
          <View style={styles.darkList}>
            <DarkLinkRow icon="close" title={a.deleteRow} danger onPress={() => setSheet("delete")} testID="open-delete-account" />
          </View>
        ) : null}
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
      </View>
    );
  }

  const submit = async () => {
    if (socialBusy) return;
    setError(null);
    setSocialNote(null);
    if (!EMAIL.test(email.trim())) return setError(a.invalidEmail);
    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim()) return setError(a.namesRequired);
      if (password.length < 10) return setError(a.passwordTooShort);
    } else if (!password) {
      return setError(a.passwordRequired);
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register({ email, password, firstName, lastName, locale: i18n.locale });
      setPassword("");
    } catch (e) {
      setError(errorText(e, i18n, mode === "login" ? { UNAUTHORIZED: a.wrongCredentials } : undefined));
    } finally {
      setBusy(false);
    }
  };

  const PROVIDER_NAME: Record<MobileSocialProvider, string> = { google: "Google", apple: "Apple" };
  const social = async (provider: MobileSocialProvider) => {
    if (socialBusy || busy) return;
    setError(null);
    setSocialNote(null);
    setSocialBusy(provider);
    try {
      const outcome = await socialLogin(provider, i18n.locale);
      if (outcome === "cancelled") setSocialNote(a.socialCancelled);
    } catch (e) {
      // Serverens egne svar (ansatts adresse, lookalike) på kundens språk; alt annet er en ærlig, generell feil.
      const reason = e instanceof ApiError ? e.reason : undefined;
      if (e instanceof ApiError && e.code === "FORBIDDEN") setError(a.socialBlocked);
      else if (e instanceof ApiError && e.code === "CONFLICT" && reason === "email_lookalike") setError(a.socialLookalike);
      else if (e instanceof ApiError && ["NETWORK", "TIMEOUT", "RATE_LIMITED"].includes(e.code)) setError(errorText(e, i18n));
      else setError(a.socialFailed);
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, top]} keyboardShouldPersistTaps="handled" testID="account-signed-out">
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
            {mode === "login" ? a.loginTitle : a.registerTitle}
          </Text>
          <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{a.searchWithoutLogin}</Text>
        </View>
        {auth.notice ? (
          <Banner tone={auth.notice === "expired" ? "warning" : "info"} dark testID={`auth-notice-${auth.notice}`}>
            {auth.notice === "expired" ? a.sessionExpired : a.deleted}
          </Banner>
        ) : null}
        <InformationCard>
          <Segmented
            label={a.modeLabel}
            value={mode}
            options={[
              { value: "login", label: a.modeLogin },
              { value: "register", label: a.modeRegister },
            ]}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
          />
          {socialProviders.length ? (
            <View style={{ gap: space.sm }} testID="social-sign-in">
              {socialProviders.map((p) => (
                <SecondaryButton
                  key={p}
                  label={socialBusy === p ? a.socialBusy(PROVIDER_NAME[p]) : a.socialContinue(PROVIDER_NAME[p])}
                  icon={socialBusy === p ? "refresh" : "user"}
                  onPress={() => void social(p)}
                  accessibilityHint={a.socialHint}
                  testID={`social-${p}`}
                />
              ))}
              {socialNote ? (
                <Banner tone="info" testID="social-note">
                  {socialNote}
                </Banner>
              ) : null}
              <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{a.orEmail}</Text>
            </View>
          ) : null}
          {mode === "register" ? (
            <>
              <Field label={a.firstName} icon="user" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" testID="first-name" />
              <Field label={a.lastName} icon="user" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" testID="last-name" />
            </>
          ) : null}
          <Field
            label={a.email}
            icon="mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            testID="email"
          />
          <Field
            label={a.password}
            icon="lock"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === "login" ? "password" : "newPassword"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "register" ? a.passwordMin : undefined}
            testID="password"
          />
          {error ? (
            <Banner tone="error" testID="auth-error">
              {error}
            </Banner>
          ) : null}
          <PrimaryButton testID="auth-submit" label={mode === "login" ? a.submitLogin : a.submitRegister} onPress={submit} loading={busy} />
          {mode === "login" ? <LinkButton label={a.forgot} onPress={() => setSheet("forgot")} testID="open-forgot" /> : null}
        </InformationCard>
        <LanguageCard />
        <HelpCard />
        <ForgotPasswordSheet key={`forgot-${sheet === "forgot"}`} visible={sheet === "forgot"} onClose={() => setSheet(null)} initialEmail={email} />
      </ScrollView>
      <StatusBarShield />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  compactCard: { padding: space.lg, gap: space.md },
  darkSection: { gap: space.md },
  darkList: { backgroundColor: colors.raised, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, paddingHorizontal: space.lg, overflow: "hidden" },
  darkLink: { minHeight: TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md },
  darkLinkBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.darkBorder },
  hello: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.white },
});
