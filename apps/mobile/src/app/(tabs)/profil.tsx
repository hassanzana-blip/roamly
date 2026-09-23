import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/a11y";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { CustomerProfile } from "@contracts/mobileAuth";
import { useApp } from "../../lib/appState";
import { ApiError } from "../../lib/api";
import { errorText } from "../../lib/errorText";
import { ALL_PHOTOS } from "../../lib/destinations";
import { WEB_PAGES } from "../../lib/config";
import { Banner, BottomSheet, Field, InfoRow, InformationCard, LinkButton, NavRow, PrimaryButton, SecondaryButton, Segmented } from "../../components/ui";
import { a11yLanguage, useI18n } from "../../i18n";
import { LOCALES, LOCALE_NAMES, type Locale } from "../../i18n/types";
import { colors, space, type } from "../../lib/theme";

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
    <InformationCard title={t.account.language} testID="language-card">
      {/* Hvert språk står på sitt eget språk, og VoiceOver leser det med den stemmen. */}
      <Segmented<Locale> label={t.account.language} value={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: a11yLanguage(l) }))} onChange={setLocale} />
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.account.languageHint}</Text>
    </InformationCard>
  );
}

/** Hva HelloSky er, og HelloSkys egne sider for hjelp, kontakt, personvern og vilkår. */
function HelpCard() {
  const { t, locale } = useI18n();
  const a = t.account;
  const note = locale === "en" ? a.webNorwegian : a.webOpens;
  return (
    <InformationCard title={a.helpTitle} testID="help-card">
      <View style={{ gap: space.xs }}>
        <Text style={[type.calloutStrong, { color: colors.text }]}>{a.howItWorks}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]} testID="how-it-works">
          {a.howItWorksBody}
        </Text>
      </View>
      <NavRow icon="help" title={a.helpCentre} subtitle={note} external onPress={() => openWeb(WEB_PAGES.help)} testID="link-help" />
      <NavRow icon="lock" title={a.privacy} subtitle={note} external onPress={() => openWeb(WEB_PAGES.privacy)} testID="link-privacy" />
      <NavRow icon="info" title={a.terms} subtitle={note} external onPress={() => openWeb(WEB_PAGES.terms)} testID="link-terms" />
      <NavRow icon="plane" title={a.about} subtitle={note} external onPress={() => openWeb(WEB_PAGES.about)} testID="link-about" />
    </InformationCard>
  );
}

/** Kreditering for bildene appen har med seg. Nederst, og sammenslått til den åpnes. */
function PhotoCredits() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <InformationCard title={t.account.creditsTitle} testID="photo-credits">
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.account.creditsIntro}</Text>
      {open
        ? ALL_PHOTOS.map((p) => (
            <Text key={p.id} style={[type.footnote, { color: colors.text }]}>
              {t.account.creditLine(p.credit.caption[locale], p.credit.photographer ?? null, p.credit.source)}
            </Text>
          ))
        : null}
      <LinkButton label={open ? t.account.hideCredits : t.account.showCredits(ALL_PHOTOS.length)} onPress={() => setOpen((o) => !o)} testID="toggle-credits" />
    </InformationCard>
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
  const { auth, login, register, logout } = useApp();
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
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, top]} testID="account-signed-in">
        <StatusBar style="light" />
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
          <InformationCard title={a.accountSection} testID="account-card">
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
          <InformationCard>
            <NavRow icon="close" title={a.deleteRow} danger onPress={() => setSheet("delete")} testID="open-delete-account" />
          </InformationCard>
        ) : null}
        <PhotoCredits />
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
    );
  }

  const submit = async () => {
    setError(null);
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
        <PhotoCredits />
        <ForgotPasswordSheet key={`forgot-${sheet === "forgot"}`} visible={sheet === "forgot"} onClose={() => setSheet(null)} initialEmail={email} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  hello: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.white },
});
