import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppProvider } from "../lib/appState";
import { API_BASE } from "../lib/config";
import { InformationCard, Wordmark } from "../components/ui";
import { colors, space, type } from "../lib/theme";

function ConfigError({ message }: { message: string }) {
  return (
    <SafeAreaView style={{ flex: 1, padding: space.xl, gap: space.xl, backgroundColor: colors.bg }}>
      <Wordmark />
      <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
        Appen er ikke satt opp
      </Text>
      <InformationCard>
        <Text style={[type.body, { color: colors.text }]}>{message}</Text>
      </InformationCard>
    </SafeAreaView>
  );
}

/**
 * Roten: fanene (Hjem, Utforsk, Profil) nederst i stacken; resultater,
 * flydetaljer og flyplassøk legges oppå. Systemskriften (SF Pro) brukes
 * overalt, så ingen skrift skal lastes før appen vises.
 */
export default function RootLayout() {
  if (!API_BASE.ok) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ConfigError message={API_BASE.message} />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" options={{ title: "Hjem" }} />
            <Stack.Screen name="resultater" options={{ title: "Flyreiser" }} />
            <Stack.Screen name="tilbud/[id]" options={{ title: "Flydetaljer" }} />
            <Stack.Screen name="flyplass" options={{ presentation: "modal", title: "Velg flyplass", contentStyle: { backgroundColor: colors.white } }} />
          </Stack>
        </View>
      </AppProvider>
    </SafeAreaProvider>
  );
}
