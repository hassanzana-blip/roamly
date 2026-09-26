import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../lib/theme";

/**
 * Keeps scrolled content from passing behind the iPhone's status-bar text. `tone` is the colour behind the status
 * bar: «light» (the light canvas, with dark status-bar text) or «dark» (graphite, with light text).
 */
export function StatusBarShield({ visible = true, tone = "dark" }: { visible?: boolean; tone?: "light" | "dark" }) {
  const { top } = useSafeAreaInsets();
  if (!visible || top <= 0) return null;
  return <View pointerEvents="none" testID="status-bar-shield" style={[styles.shield, { height: top, backgroundColor: tone === "light" ? colors.canvas : colors.bg }]} />;
}

const styles = StyleSheet.create({
  shield: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
});
