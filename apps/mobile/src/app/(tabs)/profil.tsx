import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../lib/appState";
import { ApiError } from "../../lib/api";
import { ALL_PHOTOS } from "../../lib/destinations";
import { Banner, Field, InfoRow, InformationCard, PrimaryButton, SecondaryButton, Segmented } from "../../components/ui";
import { colors, space, type } from "../../lib/theme";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Kreditering for bildene appen har med seg (samme opphav som nettets /fotokreditering). */
function PhotoCredits() {
  return (
    <InformationCard title="Fotokreditering" testID="photo-credits">
      <Text style={[type.footnote, { color: colors.textSecondary }]}>
        Bildene er ekte fotografier fra Unsplash, brukt under Unsplash-lisensen. Fotografens navn vises når det er registrert.
      </Text>
      {ALL_PHOTOS.map((p) => (
        <Text key={p.id} style={[type.footnote, { color: colors.text }]}>{`${p.credit.caption} – ${p.credit.photographer ? `${p.credit.photographer}, ` : ""}${p.credit.source}`}</Text>
      ))}
    </InformationCard>
  );
}

/** Vanlig kundeinnlogging med e-post og passord. Ingen andre roller finnes i appen. */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { auth, login, register, logout } = useApp();
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
            {p ? `Hei, ${p.firstName}` : "Du er logget inn"}
          </Text>
        </View>
        {p ? (
          <InformationCard title="Konto">
            <InfoRow icon="user" title={`${p.firstName} ${p.lastName}`.trim()} subtitle="Navn" />
            {p.email ? <InfoRow icon="mail" title={p.email} subtitle="E-post" /> : null}
          </InformationCard>
        ) : (
          <Banner tone="warning" dark>
            Vi fikk ikke hentet kontoen din akkurat nå. Sjekk nettforbindelsen.
          </Banner>
        )}
        <SecondaryButton
          dark
          testID="logout-button"
          label={busy ? "Logger ut …" : "Logg ut"}
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
    if (!EMAIL.test(email.trim())) return setError("Skriv inn en gyldig e-postadresse.");
    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim()) return setError("Skriv inn fornavn og etternavn.");
      if (password.length < 10) return setError("Passordet må være minst 10 tegn.");
    } else if (!password) {
      return setError("Skriv inn passordet ditt.");
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register({ email, password, firstName, lastName });
      setPassword("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Noe gikk galt. Prøv igjen.");
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
            {mode === "login" ? "Logg inn" : "Opprett konto"}
          </Text>
          <Text style={[type.footnote, { color: colors.onDarkMuted }]}>Du kan søke etter fly uten å logge inn.</Text>
        </View>
        <InformationCard>
          <Segmented
            label="Innlogging"
            value={mode}
            options={[
              { value: "login", label: "Logg inn" },
              { value: "register", label: "Ny konto" },
            ]}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
          />
          {mode === "register" ? (
            <>
              <Field label="Fornavn" icon="user" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" testID="first-name" />
              <Field label="Etternavn" icon="user" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" testID="last-name" />
            </>
          ) : null}
          <Field
            label="E-post"
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
            label="Passord"
            icon="lock"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === "login" ? "password" : "newPassword"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "register" ? "Minst 10 tegn" : undefined}
            testID="password"
          />
          {error ? (
            <Banner tone="error" testID="auth-error">
              {error}
            </Banner>
          ) : null}
          <PrimaryButton testID="auth-submit" label={mode === "login" ? "Logg inn" : "Opprett konto"} onPress={submit} loading={busy} />
        </InformationCard>
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
