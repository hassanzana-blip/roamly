import { StyleSheet, TextInput, View } from "react-native";
import { Pressable } from "./a11y";
import { useA11yLanguage, useI18n } from "../i18n";
import { Icon } from "./Icon";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/**
 * Søkefeltet i Utforsk: hvitt felt med lys kant på den lyse grunnen, mørk tekst og sekundærfarget plassholder
 * (5,8:1 på hvitt), søkeikon og en egen 44 pt «Tøm søket» når det står noe i det. Stor tekst er på (ingen tak).
 */
export function DestinationSearch({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { t } = useI18n();
  const lang = useA11yLanguage();
  const e = t.explore;
  return (
    <View style={styles.wrap} testID="explore-search-field">
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={e.searchPlaceholder}
        placeholderTextColor={colors.textSecondary}
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
      {/* Selv 44 pt, uten hitSlop inn over feltet; dempet kryss på hvitt (ikonknappens «plain» er for grafitt). */}
      {value ? (
        <Pressable onPress={() => onChange("")} accessibilityRole="button" accessibilityLabel={e.searchClear} testID="explore-search-clear" style={({ pressed }) => [styles.clear, pressed && { opacity: 0.7 }]}>
          <Icon name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: TOUCH + 4, paddingLeft: space.md, borderRadius: radius.input, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  input: { fontSize: type.body.fontSize, flex: 1, color: colors.text, minHeight: TOUCH, paddingVertical: space.sm },
  clear: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: "center", justifyContent: "center" },
});
