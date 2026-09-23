import { Tabs } from "expo-router";
import { BottomNavigation } from "../../components/BottomNavigation";
import { colors } from "../../lib/theme";

/** Fanene. Resultater, flydetaljer og flyplassøk legges oppå (rotens stack). */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <BottomNavigation state={props.state} navigation={props.navigation as unknown as Parameters<typeof BottomNavigation>[0]["navigation"]} />}
    >
      <Tabs.Screen name="index" options={{ title: "Hjem" }} />
      <Tabs.Screen name="utforsk" options={{ title: "Utforsk" }} />
      <Tabs.Screen name="profil" options={{ title: "Profil" }} />
    </Tabs>
  );
}
