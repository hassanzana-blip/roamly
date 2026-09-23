import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../lib/appState";
import { ApiError } from "../lib/api";
import { Banner, Body, Button, Card, Field, ScreenHeader, Segmented, Title } from "../components/ui";
import { Icon } from "../components/Icon";
import { colors, fonts, space } from "../lib/theme";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Vanlig kundeinnlogging med e-post og passord. Ingen andre roller finnes i appen. */
export default function AccountScreen() {
  const router = useRouter();
  const { auth, login, register, logout } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => router.back();

  if (auth.status === "loading") {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Konto" onBack={close} backIcon="close" backLabel="Lukk" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      </View>
    );
  }

  if (auth.status === "signedIn") {
    const p = auth.profile;
    const initials = p ? `${p.firstName.slice(0, 1)}${p.lastName.slice(0, 1)}`.toUpperCase() : "";
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Konto" onBack={close} backIcon="close" backLabel="Lukk">
          <View style={styles.hello}>
            <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {initials ? <Text style={styles.avatarText}>{initials}</Text> : <Icon name="user" size={26} color={colors.white} />}
            </View>
            <Title onDark>{p ? `Hei, ${p.firstName}` : "Du er logget inn"}</Title>
          </View>
        </ScreenHeader>
        <ScrollView contentContainerStyle={styles.content} testID="account-signed-in">
          {p ? (
            <Card floating>
              <View style={styles.infoRow}>
                <Icon name="user" size={20} color={colors.indigo} />
                <Body>{`${p.firstName} ${p.lastName}`.trim()}</Body>
              </View>
              {p.email ? (
                <View style={styles.infoRow}>
                  <Icon name="mail" size={20} color={colors.indigo} />
                  <Body muted>{p.email}</Body>
                </View>
              ) : null}
            </Card>
          ) : (
            <Banner tone="warning">Vi fikk ikke hentet kontoen din akkurat nå. Sjekk nettforbindelsen.</Banner>
          )}
          <Button
            testID="logout-button"
            label="Logg ut"
            icon="logout"
            variant="onDark"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await logout();
              setBusy(false);
            }}
          />
        </ScrollView>
      </View>
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
      <ScreenHeader title="Konto" onBack={close} backIcon="close" backLabel="Lukk">
        <View style={{ gap: space.xs }}>
          <Title onDark>{mode === "login" ? "Logg inn" : "Opprett konto"}</Title>
          <Text style={styles.sub}>Du kan søke etter fly uten å logge inn.</Text>
        </View>
      </ScreenHeader>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="account-signed-out">
        <Card floating style={{ gap: space.lg }}>
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
          <Button testID="auth-submit" label={mode === "login" ? "Logg inn" : "Opprett konto"} onPress={submit} loading={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.onDarkMuted },
  hello: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.navyLine },
  avatarText: { fontFamily: fonts.heavy, fontSize: 20, color: colors.white },
  infoRow: { flexDirection: "row", alignItems: "center", gap: space.md },
});
