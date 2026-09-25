import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "./a11y";
import type { SortKey } from "../lib/resultsView";
import { useA11yLanguage } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

export type SortTab = {
  key: SortKey;
  label: string;
  /** Prisen på reisen som står øverst med denne sorteringen («1 570 kr», «ca. 1 930 kr»), eller null. */
  price: string | null;
  /** Reisetiden per vei til samme reise («3 t 16 min»), eller null når den ikke er kjent. */
  detail: string | null;
  /** Hele fanen for VoiceOver. */
  spoken: string;
};

/** Så stor tekst at tre faner aldri får plass side om side (iOS' tilgjengelighetsstørrelser). */
const ALWAYS_STACK_FROM = 1.6;
const PRICE_LINE = 21;

/**
 * Best / Billigst / Raskest over resultatlisten. Hver fane viser hva toppen av listen blir med den sorteringen –
 * ekte pris og reisetid fra svaret – så avveiningen står åpent før kunden velger. Valgt fane er hvit på kull,
 * som fanene i flydetaljene.
 *
 * Stor tekst: fanene står side om side så lenge prisen og reisetiden får plass på én linje. Brytes en av dem, står
 * fanene under hverandre (én rad hver) for denne tekststørrelsen – et beløp deles aldri over to linjer.
 */
export function SortTabs({ tabs, value, onChange, label, note }: { tabs: SortTab[]; value: SortKey; onChange: (k: SortKey) => void; label: string; /** Hva tallene gjelder («Reisetid per vei, i snitt»), under fanene. */ note?: string | null }) {
  const lang = useA11yLanguage();
  const { fontScale } = useWindowDimensions();
  const [wrappedAt, setWrappedAt] = useState<number | null>(null);
  const stacked = fontScale >= ALWAYS_STACK_FROM || wrappedAt === fontScale;
  const watch = (lineHeight: number) => (e: { nativeEvent: { layout: { height: number } } }) => {
    if (!stacked && e.nativeEvent.layout.height > lineHeight * fontScale * 1.5) setWrappedAt(fontScale);
  };
  return (
    <View style={{ gap: space.xs }}>
      <View accessibilityLanguage={lang} style={[styles.row, stacked && styles.column]} accessibilityRole="tablist" accessibilityLabel={label} testID="sort-tabs">
        {tabs.map((tab) => {
          const selected = tab.key === value;
          const fg = selected ? colors.text : colors.onDark;
          const sub = selected ? colors.textSecondary : colors.onDarkMuted;
          return (
            <Pressable
              // Ny node når tekststørrelsen endres: da måles det på nytt med riktig skala.
              key={`${tab.key}:${fontScale}`}
              testID={`sort-tab-${tab.key}`}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.spoken}
              style={({ pressed }) => [styles.tab, stacked ? styles.tabStacked : styles.tabRow, selected && styles.tabSelected, pressed && !selected && { opacity: 0.7 }]}
            >
              <Text style={[type.footnoteStrong, { color: sub }]}>{tab.label}</Text>
              <View style={stacked ? styles.valuesStacked : undefined}>
                {tab.price ? (
                  <Text style={[styles.price, { color: fg }]} onLayout={watch(PRICE_LINE)} testID={`sort-tab-${tab.key}-price`}>
                    {tab.price}
                  </Text>
                ) : null}
                {tab.detail ? (
                  <Text style={[type.caption, type.tabular, { color: sub }]} onLayout={watch(type.caption.lineHeight)}>
                    {tab.detail}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {note ? (
        <Text style={[type.caption, styles.note]} testID="sort-tabs-note">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg },
  column: { flexDirection: "column" },
  tab: { borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, backgroundColor: colors.raised, paddingHorizontal: space.md - 2, paddingVertical: space.sm },
  tabRow: { flex: 1, minHeight: TOUCH + 18, gap: 1, justifyContent: "center" },
  tabStacked: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: TOUCH },
  tabSelected: { backgroundColor: colors.white, borderColor: colors.white },
  valuesStacked: { alignItems: "flex-end", flexShrink: 1 },
  price: { fontSize: 16, lineHeight: PRICE_LINE, fontWeight: "700", letterSpacing: -0.2, fontVariant: ["tabular-nums"] },
  note: { color: colors.onDarkMuted, paddingHorizontal: space.lg },
});
