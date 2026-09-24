import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../lib/theme";

/** Keeps scrolled content from passing behind the iPhone's status-bar text. */
export function StatusBarShield({ visible = true }: { visible?: boolean }) {
  const { top } = useSafeAreaInsets();
  if (!visible || top <= 0) return null;
  return <View pointerEvents="none" testID="status-bar-shield" style={[styles.shield, { height: top }]} />;
}

const styles = StyleSheet.create({
  shield: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, backgroundColor: colors.bg },
});
