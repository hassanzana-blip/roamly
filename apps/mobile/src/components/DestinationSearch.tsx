import { StyleSheet, TextInput, View } from "react-native";
import { useA11yLanguage, useI18n } from "../i18n";
import { Icon } from "./Icon";
import { IconButton } from "./ui";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/**
 * Søkefeltet i Utforsk: mørkt, hevet felt med søkeikon og en egen 44 pt
 * «Tøm søket» når det står noe i det. Stor tekst er på (ingen tak).
 */
export function DestinationSearch({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { t } = useI18n();
  const lang = useA11yLanguage();
  const e = t.explore;
  return (
    <View style={styles.wrap}>
      <Icon name="search" size={18} color={colors.onDarkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={e.searchPlaceholder}
        placeholderTextColor={colors.onDarkMuted}
        accessibilityLabel={e.searchLabel}
        accessibilityHint={e.searchHint}
        accessibilityLanguage={lang}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        style={styles.input}
        testID="explore-search"
      />
      {value ? <IconButton icon="close" label={e.searchClear} variant="plain" size={TOUCH} onPress={() => onChange("")} testID="explore-search-clear" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: TOUCH + 4, paddingLeft: space.md, borderRadius: radius.input, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  input: { fontSize: type.body.fontSize, flex: 1, color: colors.onDark, minHeight: TOUCH, paddingVertical: space.sm },
});
