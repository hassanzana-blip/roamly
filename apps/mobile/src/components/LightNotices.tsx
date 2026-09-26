import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable, Text } from "./a11y";
import { Icon } from "./Icon";
import type { NoticeItem } from "./ui";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/**
 * Korte meldinger på den lyse grunnen («Cloud + Graphite»), med samme innhold og oppførsel som `Notices` i ui.tsx
 * (som er for grafitt): samlet i én hvit flate, så de ikke skyver innholdet ned. Advarsler står i advarselsfarge med
 * ikon, opplysninger dempet. En melding med `detail` kan åpnes for hele teksten; en med `label` vises lukket som en
 * kort, tydelig knapp («Om «ca.»-priser»). Hele raden er da trykkflaten – minst 44 pt, uten hitSlop over naboene.
 * Alle fargepar er sjekket på hvitt: advarsel 6,5:1, sekundær 5,8:1, tekst 18,7:1.
 */
export function LightNotices({ items, testID }: { items: NoticeItem[]; testID?: string }) {
  if (!items.length) return null;
  // En åpnebar linje er en ekte trykkflate på 44 pt; står den sist, er den sin egen luft i bunnen.
  const last = items[items.length - 1]!;
  const endsWithButton = Boolean(last.detail || last.label);
  return (
    <View style={[styles.notices, endsWithButton && { paddingBottom: 0 }]} testID={testID}>
      {items.map(({ key, ...n }) => (
        <NoticeLine key={key} {...n} />
      ))}
    </View>
  );
}

function NoticeLine({ tone, text, detail, label, testID }: Omit<NoticeItem, "key">) {
  const lang = useA11yLanguage();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fg = tone === "warning" ? colors.warning : colors.textSecondary;
  const expandable = Boolean(detail || label);
  const shown = open ? (detail ?? text) : (label ?? text);
  const body = (
    <>
      <View style={styles.icon}>
        <Icon name={tone === "warning" ? "alert" : "info"} size={15} color={fg} />
      </View>
      <Text style={[type.footnote, { color: fg, flex: 1 }, label && !open ? { color: colors.text, fontWeight: "600" } : null]}>{shown}</Text>
      {expandable ? (
        <View style={styles.icon}>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} color={colors.text} />
        </View>
      ) : null}
    </>
  );
  if (!expandable) {
    return (
      <View accessibilityLanguage={lang} testID={testID} style={styles.line} accessibilityRole={tone === "warning" ? "alert" : "summary"}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityHint={open ? t.common.showShort : t.common.showFull}
      style={({ pressed }) => [styles.line, styles.button, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Hvit flate på grunnen, som kortene under: ingen kant, samme hjørner som meldingene på grafitt.
  notices: { backgroundColor: colors.white, borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  icon: { paddingTop: 2 },
  // Hele raden er trykkflaten: minst 44 pt høy, uten hitSlop over naboene.
  button: { minHeight: TOUCH, alignItems: "center" },
});
