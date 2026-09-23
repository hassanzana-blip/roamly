import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { colors, space } from "../lib/theme";

type TabRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

/** Bare fanene som faktisk virker. «Lagret» kommer når lagring finnes. */
const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Hjem", icon: "home" },
  utforsk: { label: "Utforsk", icon: "compass" },
  profil: { label: "Profil", icon: "user" },
};

/** Mørk fanelinje med blått aktivt valg, som i referansen. */
export function BottomNavigation({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? colors.blueOnDark : colors.onDarkMuted;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            <Icon name={tab.icon} size={24} color={color} strokeWidth={focused ? 2 : 1.75} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.darkBorder, paddingTop: space.sm },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 48 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: "500" },
});
