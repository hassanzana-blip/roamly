import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Bare vektene appen bruker – indeksen til pakken ville tatt med alle.
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { AppProvider } from "../lib/appState";
import { API_BASE } from "../lib/config";
import { Body, Card, Title, WorldTexture, Wordmark } from "../components/ui";
import { colors, space } from "../lib/theme";

function ConfigError({ message }: { message: string }) {
  return (
    <SafeAreaView style={{ flex: 1, padding: space.xl, gap: space.xl, backgroundColor: colors.navy }}>
      <WorldTexture top={80} />
      <Wordmark />
      <Title onDark>Appen er ikke satt opp</Title>
      <Card>
        <Body>{message}</Body>
      </Card>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.navy }} />;
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
        {/* Hver skjerm tegner sitt eget mørke toppfelt (ScreenHeader), med tittel og rund tilbakeknapp. */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.navy } }}>
          <Stack.Screen name="index" options={{ title: "Søk" }} />
          <Stack.Screen name="flyplass" options={{ presentation: "modal", title: "Velg flyplass" }} />
          <Stack.Screen name="resultater" options={{ title: "Flyreiser" }} />
          <Stack.Screen name="filter" options={{ presentation: "modal", title: "Filtrer" }} />
          <Stack.Screen name="tilbud/[id]" options={{ title: "Tilbud" }} />
          <Stack.Screen name="konto" options={{ presentation: "modal", title: "Konto" }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
