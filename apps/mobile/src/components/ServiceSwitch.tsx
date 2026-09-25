import { StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import { Icon, type IconName } from "./Icon";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

export type Service = "flights" | "hotels";

/**
 * Fly eller hotell. På forsiden (mørk grunn) som to like brede ruter med ikon over navnet, som de store
 * søketjenestene – den valgte har svak blå flate og blå kant; i hotellsøket som en rolig brikkerad der den valgte er
 * blå. Den andre tjenesten åpner sitt eget søk.
 */
export function ServiceSwitch({ active, onSelect, variant = "pills" }: { active: Service; onSelect: (s: Service) => void; variant?: "pills" | "tiles" }) {
  const { t } = useI18n();
  const lang = useA11yLanguage();
  const h = t.hotels;
  const items: { value: Service; label: string; icon: IconName; hint: string }[] = [
    { value: "flights", label: h.serviceFlights, icon: "plane", hint: h.serviceFlightsHint },
    { value: "hotels", label: h.serviceHotels, icon: "bed", hint: h.serviceHotelsHint },
  ];
  if (variant === "tiles") {
    return (
      <View style={styles.tiles} accessibilityLanguage={lang} accessibilityRole="tablist" accessibilityLabel={h.services} testID="service-switch">
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
              style={({ pressed }) => [styles.tile, selected ? styles.tileOn : styles.tileIdle, pressed && !selected && { opacity: 0.7 }]}
            >
              <Icon name={it.icon} size={24} color={selected ? colors.onDark : colors.onDarkMuted} rotate={it.icon === "plane" ? 45 : undefined} />
              <Text style={[type.footnoteStrong, { color: selected ? colors.onDark : colors.onDarkMuted }]}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
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
  tiles: { flexDirection: "row", gap: space.sm },
  // Like brede ruter over hele bredden; hele ruten er trykkflaten (mer enn 44 pt). Valgt har samme svake blå som den
  // valgte fanen nederst – helblått er forbeholdt «Søk fly».
  tile: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.input, borderWidth: 1 },
  tileOn: { backgroundColor: colors.blueOnDarkTint, borderColor: colors.blueOnDark },
  tileIdle: { backgroundColor: colors.bg, borderColor: colors.darkBorder },
});
