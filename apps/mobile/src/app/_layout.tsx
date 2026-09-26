import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Text } from "../components/a11y";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppProvider } from "../lib/appState";
import { API_BASE } from "../lib/config";
import { InformationCard, Wordmark } from "../components/ui";
import { WelcomeGate } from "../components/WelcomeGate";
import { I18nProvider, useI18n } from "../i18n";
import { colors, space, type } from "../lib/theme";

function ConfigError() {
  const { t } = useI18n();
  return (
    <SafeAreaView style={{ flex: 1, padding: space.xl, gap: space.xl, backgroundColor: colors.bg }}>
      <Wordmark />
      <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
        {t.common.configTitle}
      </Text>
      <InformationCard>
        <Text style={[type.body, { color: colors.text }]}>{t.common.configBody}</Text>
      </InformationCard>
    </SafeAreaView>
  );
}

/** Skjermene, med titler på brukerens språk. */
function AppStack() {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ title: t.common.tabs.home }} />
        <Stack.Screen name="resultater" options={{ title: t.results.screen.fallbackTitle }} />
        <Stack.Screen name="tilbud/[id]" options={{ title: t.details.title }} />
        <Stack.Screen name="hotell/index" options={{ title: t.hotels.title }} />
        <Stack.Screen name="hotell/resultater" options={{ title: t.hotels.resultsTitle }} />
        <Stack.Screen name="hotell/detaljer" options={{ title: t.hotels.detailTitle }} />
        <Stack.Screen name="flyplass" options={{ presentation: "modal", title: t.airport.title, contentStyle: { backgroundColor: colors.white } }} />
      </Stack>
    </View>
  );
}

/**
 * Roten: fanene (Hjem, Utforsk, Profil) nederst i stacken; resultater,
 * flydetaljer, flyplassøk og hotellsøket (hotell/…) legges oppå. Systemskriften (SF Pro) brukes
 * overalt, så ingen skrift skal lastes før appen vises. Ved første oppstart står velkomsten over
 * alt (WelcomeGate) til gjesten hopper over eller logger inn.
 */
export default function RootLayout() {
  if (!API_BASE.ok) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <I18nProvider>
          <ConfigError />
        </I18nProvider>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <AppStack />
        {/* Første oppstart: Apple, Google, e-post – eller «Hopp over» (søk krever aldri konto). */}
        <WelcomeGate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
