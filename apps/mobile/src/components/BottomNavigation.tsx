import { StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { colors, space } from "../lib/theme";
import { useA11yLanguage, useI18n } from "../i18n";

type TabRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

/** Bare fanene som faktisk virker. «Lagret» er reisemål og nylige søk på denne telefonen. */
const TABS: Record<string, { key: "home" | "explore" | "saved" | "profile"; icon: IconName }> = {
  index: { key: "home", icon: "home" },
  utforsk: { key: "explore", icon: "compass" },
  lagret: { key: "saved", icon: "bookmark" },
  profil: { key: "profile", icon: "user" },
};

/**
 * Mørk fanelinje med fire faner. Valgt fane: en kompakt blå pille bak ikonet og
 * blå, halvfet etikett (prinsippet fra navigasjonsskissen – ingen kode derfra).
 * Hele fanen er trykkflaten (minst 48 pt høy), og etiketten vokser med stor tekst
 * opptil 1,3× så fire faner alltid får plass.
 */
export function BottomNavigation({ state, navigation }: TabBarProps) {
  const lang = useA11yLanguage();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <View accessibilityLanguage={lang} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]} accessibilityRole="tablist" testID="bottom-navigation">
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const label = t.common.tabs[tab.key];
        const focused = state.index === i;
        const color = focused ? colors.blueOnDark : colors.onDarkMuted;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.pill, focused && styles.pillOn]} testID={focused ? `tab-${route.name}-selected` : undefined}>
              <Icon name={tab.icon} size={22} color={color} strokeWidth={focused ? 2 : 1.75} />
            </View>
            <Text style={[styles.label, { color }, focused && styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.darkBorder, paddingTop: space.sm },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 48, paddingHorizontal: 2 },
  pill: { width: 52, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: colors.blueOnDarkTint },
  label: { fontSize: 11, lineHeight: 13, fontWeight: "500" },
  labelOn: { fontWeight: "600" },
});
