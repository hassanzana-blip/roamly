import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Bare vektene appen bruker – indeksen til pakkene ville tatt med alle.
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader/500Medium";
import { AppProvider } from "../lib/appState";
import { API_BASE } from "../lib/config";
import { Body, Title, Wordmark } from "../components/ui";
import { colors, fonts } from "../lib/theme";

function ConfigError({ message }: { message: string }) {
  return (
    <SafeAreaView style={{ flex: 1, padding: 24, gap: 16, backgroundColor: colors.white }}>
      <Wordmark />
      <Title>Appen er ikke satt opp</Title>
      <Body>{message}</Body>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Newsreader_500Medium });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.white }} />;
  if (!API_BASE.ok) {
    return (
      <SafeAreaProvider>
        <ConfigError message={API_BASE.message} />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.azureInk,
            headerTitleStyle: { fontFamily: fonts.bold, color: colors.petrol },
            headerBackTitle: "Tilbake",
            contentStyle: { backgroundColor: colors.sand },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, title: "Søk" }} />
          <Stack.Screen name="flyplass" options={{ presentation: "modal", title: "Velg flyplass" }} />
          <Stack.Screen name="resultater" options={{ title: "Flyreiser" }} />
          <Stack.Screen name="tilbud/[id]" options={{ title: "Tilbud" }} />
          <Stack.Screen name="konto" options={{ presentation: "modal", title: "Konto" }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
