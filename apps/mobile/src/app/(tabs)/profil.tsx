import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { errorText } from "../../lib/errorText";
import { ALL_PHOTOS } from "../../lib/destinations";
import { Banner, Field, InfoRow, InformationCard, PrimaryButton, SecondaryButton, Segmented } from "../../components/ui";
import { useI18n } from "../../i18n";
import { LOCALES, LOCALE_NAMES, type Locale } from "../../i18n/types";
import { colors, space, type } from "../../lib/theme";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Språkvalget: før og etter innlogging, gjelder med én gang og huskes på
 * telefonen. Valuta, leverandører og søk er uendret – prisene er alltid i NOK.
 */
function LanguageCard() {
  const { t, locale, setLocale } = useI18n();
  return (
    <InformationCard title={t.account.language} testID="language-card">
      <Segmented<Locale> label={t.account.language} value={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} onChange={setLocale} />
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.account.languageHint}</Text>
    </InformationCard>
  );
}

/** Kreditering for bildene appen har med seg (samme opphav som nettets /fotokreditering). Står nederst. */
function PhotoCredits() {
  const { t, locale } = useI18n();
  return (
    <InformationCard title={t.account.creditsTitle} testID="photo-credits">
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{t.account.creditsIntro}</Text>
      {ALL_PHOTOS.map((p) => (
        <Text key={p.id} style={[type.footnote, { color: colors.text }]}>
          {t.account.creditLine(p.credit.caption[locale], p.credit.photographer ?? null, p.credit.source)}
        </Text>
      ))}
    </InformationCard>
  );
}

/** Vanlig kundeinnlogging med e-post og passord. Ingen andre roller finnes i appen. */
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
        {p ? (
          <InformationCard title={a.accountSection}>
            <InfoRow icon="user" title={`${p.firstName} ${p.lastName}`.trim()} subtitle={a.nameLabel} />
            {p.email ? <InfoRow icon="mail" title={p.email} subtitle={a.emailLabel} /> : null}
          </InformationCard>
        ) : (
          <Banner tone="warning" dark>
            {a.profileUnavailable}
          </Banner>
        )}
        <LanguageCard />
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
        <PhotoCredits />
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
        </InformationCard>
        <LanguageCard />
        <PhotoCredits />
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
