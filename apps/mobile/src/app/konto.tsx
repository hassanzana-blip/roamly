import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { useApp } from "../lib/appState";
import { ApiError } from "../lib/api";
import { Banner, Body, Button, Card, Field, Segmented, Title } from "../components/ui";
import { colors, space } from "../lib/theme";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Vanlig kundeinnlogging med e-post og passord. Ingen andre roller finnes i appen. */
export default function AccountScreen() {
  const { auth, login, register, logout } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.azure} />
      </View>
    );
  }

  if (auth.status === "signedIn") {
    return (
      <ScrollView contentContainerStyle={styles.content} testID="account-signed-in">
        <Title>{auth.profile ? `Hei, ${auth.profile.firstName}` : "Du er logget inn"}</Title>
        {auth.profile ? (
          <Card>
            <Body>{`${auth.profile.firstName} ${auth.profile.lastName}`.trim()}</Body>
            {auth.profile.email ? <Body muted>{auth.profile.email}</Body> : null}
          </Card>
        ) : (
          <Banner tone="warning">Vi fikk ikke hentet kontoen din akkurat nå. Sjekk nettforbindelsen.</Banner>
        )}
        <Button
          testID="logout-button"
          label="Logg ut"
          variant="secondary"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await logout();
            setBusy(false);
          }}
        />
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
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="account-signed-out">
        <Title>{mode === "login" ? "Logg inn" : "Opprett konto"}</Title>
        <Body muted>Du kan søke etter fly uten å logge inn.</Body>
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
            <Field label="Fornavn" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" testID="first-name" />
            <Field label="Etternavn" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" testID="last-name" />
          </>
        ) : null}
        <Field
          label="E-post"
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
