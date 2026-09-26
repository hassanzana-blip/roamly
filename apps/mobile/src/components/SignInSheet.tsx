import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileSocialProvider } from "@contracts/mobileAuth";
import { Text } from "./a11y";
import { SocialButtons, socialErrorText } from "./SocialButtons";
import { Banner, BottomSheet, Field, IconButton, LinkButton, PrimaryButton, Segmented } from "./ui";
import { useApp } from "../lib/appState";
import { errorText } from "../lib/errorText";
import { useReducedMotion } from "../lib/motion";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, space, type } from "../lib/theme";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignInMode = "login" | "register";

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

/**
 * Innlogging og ny konto i iOS' sidekort (dras ned for å lukke), brukt fra Min side og fra velkomsten. Tastaturet:
 * listen slutter der det begynner.
 *
 * Arket eier skjemaet og reglene: det åpnes i `initialMode` uten gamle meldinger, og e-postadressen står til neste
 * gang. Passordet blir aldri liggende – ikke når arket lukkes, og ikke etter en endring i innloggingen (også Google/
 * Apple, som ikke går via skjemaet). Mens en innlogging pågår, gjør bytte mellom innlogging og ny konto og «Glemt
 * passordet?» ingenting, og skjemaet og Google/Apple starter ikke en til. Arket vises bare for gjester; den som
 * bruker det, lukker det når kunden er logget inn.
 */
export function SignInSheet({ visible, initialMode, onClose }: { visible: boolean; initialMode: SignInMode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const lang = useA11yLanguage();
  const reduced = useReducedMotion();
  const { auth, login, register, socialProviders, requestSocialProviders, socialLogin } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  const open = visible && auth.status === "signedOut";
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [socialBusy, setSocialBusy] = useState<MobileSocialProvider | null>(null);
  const [socialNote, setSocialNote] = useState<string | null>(null);

  // Hver gang arket åpnes: i modusen det ble åpnet for, uten gamle meldinger.
  const [shownOpen, setShownOpen] = useState(open);
  if (shownOpen !== open) {
    setShownOpen(open);
    if (open) {
      setMode(initialMode);
      setError(null);
      setSocialNote(null);
    }
  }

  // Et skjema hører til innloggingen som gjaldt da: etter innlogging, utlogging, sletting eller utløpt økt står
  // ingenting igjen. Også etter Google/Apple (som ikke går via skjemaet): et passord som ble skrevet, blir ikke liggende.
  const [shownFor, setShownFor] = useState(auth.status);
  if (shownFor !== auth.status) {
    setShownFor(auth.status);
    setForgotOpen(false);
    setPassword("");
    setError(null);
    setSocialNote(null);
  }

  // Innloggingsmåtene (Google/Apple) hentes senest når arket vises.
  useEffect(() => {
    if (open) requestSocialProviders();
  }, [open, requestSocialProviders]);

  // Passordet blir ikke liggende når arket lukkes; e-postadressen står til neste gang.
  const close = () => {
    setPassword("");
    setError(null);
    setForgotOpen(false);
    onClose();
  };

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

  const social = async (provider: MobileSocialProvider) => {
    if (socialBusy || busy) return;
    setError(null);
    setSocialNote(null);
    setSocialBusy(provider);
    try {
      const outcome = await socialLogin(provider, i18n.locale);
      if (outcome === "cancelled") setSocialNote(a.socialCancelled);
    } catch (e) {
      setError(socialErrorText(e, i18n));
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <Modal visible={open} animationType={reduced ? "fade" : "slide"} presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={close}>
      <View style={styles.modal} accessibilityLanguage={lang} onAccessibilityEscape={close} testID="auth-modal">
        <View style={styles.modalHead}>
          <IconButton icon="close" label={i18n.t.common.close} variant="light" onPress={close} testID="auth-close" />
          <Text style={[type.headline, styles.modalTitle]} accessibilityRole="header">
            {mode === "login" ? a.loginTitle : a.registerTitle}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets testID="auth-form">
          <Segmented
            label={a.modeLabel}
            value={mode}
            options={[
              { value: "login", label: a.modeLogin },
              { value: "register", label: a.modeRegister },
            ]}
            onChange={(m) => {
              if (busy || socialBusy) return;
              setMode(m);
              setError(null);
            }}
          />
          {socialProviders.length ? (
            <View style={{ gap: space.sm }} testID="social-sign-in">
              <SocialButtons providers={socialProviders} busy={socialBusy} onPress={(p) => void social(p)} />
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
          {mode === "login" ? (
            <LinkButton
              label={a.forgot}
              onPress={() => {
                if (!busy && !socialBusy) setForgotOpen(true);
              }}
              testID="open-forgot"
            />
          ) : null}
          <Text style={[type.footnote, { color: colors.textSecondary, textAlign: "center" }]}>{a.searchWithoutLogin}</Text>
        </ScrollView>
        {/* «Glemt passordet?» legges over skjemaet, i samme sidekort. */}
        <ForgotPasswordSheet key={`forgot-${forgotOpen}`} visible={forgotOpen} onClose={() => setForgotOpen(false)} initialEmail={email} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.white, paddingTop: space.lg },
  modalHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.md },
  modalTitle: { flex: 1, textAlign: "center", color: colors.text },
  modalBody: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md },
});
