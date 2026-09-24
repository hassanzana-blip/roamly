import { StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import type { MapPoint } from "../lib/destinationMap";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { colors, radius, space, type } from "../lib/theme";

export type DestinationMapProps = {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Luft rundt nålene når kartet tilpasses (f.eks. over kortet nederst). */
  bottomInset: number;
};

/**
 * Reserve der Apple Maps ikke finnes (nettleser-forhåndsvisning). Ingen
 * kartbibliotek og ingen kartfliser lastes her: den sier rett ut at kartet
 * vises i iPhone-appen, og lar kunden velge det samme reisemålet fra en
 * liste. iOS bruker DestinationMap.ios.tsx.
 */
export function DestinationMap({ points, selectedId, onSelect }: DestinationMapProps) {
  const { t, locale } = useI18n();
  return (
    <View style={styles.root} testID="destination-map-fallback">
      <View style={styles.note}>
        <Icon name="info" size={16} color={colors.onDarkMuted} />
        <Text style={[type.footnote, { color: colors.onDarkMuted, flex: 1 }]}>{t.explore.webOnly}</Text>
      </View>
      {points.map((p) => {
        const n = p.destination.names[locale];
        const selected = p.destination.id === selectedId;
        return (
          <Pressable
            key={p.destination.id}
            onPress={() => onSelect(p.destination.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t.explore.pinLabel(n.city, p.destination.iata)}
            accessibilityHint={t.explore.pinHint}
            testID={`map-pin-${p.destination.id}`}
            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.code, selected && styles.codeSelected]}>
              <Text style={[type.footnoteStrong, { color: selected ? colors.white : colors.text }]}>{p.destination.iata}</Text>
            </View>
            <Text style={[type.callout, { color: colors.onDark, flex: 1 }]}>{`${n.city}, ${n.country}`}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", paddingVertical: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44, paddingHorizontal: space.sm, borderRadius: radius.input },
  rowSelected: { backgroundColor: colors.raised },
  code: { minWidth: 48, alignItems: "center", paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.white },
  codeSelected: { backgroundColor: colors.blue },
});
