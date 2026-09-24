import { StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import { Icon, type IconName } from "./Icon";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

export type Service = "flights" | "hotels";

/**
 * Fly eller hotell: samme rolige brikkerad på forsiden og i hotellsøket. Den
 * valgte tjenesten er blå; den andre åpner sitt eget søk.
 */
export function ServiceSwitch({ active, onSelect }: { active: Service; onSelect: (s: Service) => void }) {
  const { t } = useI18n();
  const lang = useA11yLanguage();
  const h = t.hotels;
  const items: { value: Service; label: string; icon: IconName; hint: string }[] = [
    { value: "flights", label: h.serviceFlights, icon: "plane", hint: h.serviceFlightsHint },
    { value: "hotels", label: h.serviceHotels, icon: "bed", hint: h.serviceHotelsHint },
  ];
  return (
    <View style={styles.row} accessibilityLanguage={lang} accessibilityRole="tablist" accessibilityLabel={h.services} testID="service-switch">
      {items.map((it) => {
        const selected = it.value === active;
        return (
          <Pressable
            key={it.value}
            onPress={() => {
              if (!selected) onSelect(it.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={it.label}
            accessibilityHint={selected ? undefined : it.hint}
            testID={`service-${it.value}`}
            style={({ pressed }) => [styles.item, selected ? styles.selected : styles.idle, pressed && !selected && { opacity: 0.7 }]}
          >
            <Icon name={it.icon} size={16} color={selected ? colors.white : colors.text} rotate={it.icon === "plane" ? 45 : undefined} />
            <Text style={[type.footnoteStrong, { color: selected ? colors.white : colors.text }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // Hele 44 pt synlig, ikke bare med hitSlop.
  item: { minHeight: TOUCH, minWidth: TOUCH, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  selected: { backgroundColor: colors.blue, borderColor: colors.blue },
  idle: { backgroundColor: colors.inset, borderColor: colors.lightBorder },
});
