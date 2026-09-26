import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "./a11y";
import { Icon, type IconName } from "./Icon";
import { useA11yLanguage } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

/** Fra denne tekststørrelsen (iOS' «xxxLarge» er 1,35) står en rads verdi under tittelen i stedet for til høyre. */
export const STACK_VALUE_AT = 1.3;

/**
 * En gruppe i listen, som i iOS' innstillinger: overskrift på den lyse grunnen og et hvitt kort med rader.
 * `note` står under kortet (f.eks. at nettsidene er på norsk). Overskriften har samme stil som modulene over
 * («Fortsett søket», «Lagrede reisemål») og seksjonene i Lagret – små versaler – så siden leses som én liste.
 */
export function Group({ title, children, testID, note }: { title?: string; children: ReactNode; testID?: string; note?: string | null }) {
  return (
    <View style={styles.group} testID={testID}>
      {title ? (
        <Text style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
      {note ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{note}</Text> : null}
    </View>
  );
}

/**
 * Én rad i en gruppe: ikon, tittel (og ev. en linje under), verdi til høyre og pil. Uten `onPress` er raden bare
 * informasjon – ingen pil, og VoiceOver leser den som én tekst. En handling (`action`: logg ut, slett) har ingen pil,
 * for den åpner ingen side. Hele raden er trykkflaten (minst 52 pt); VoiceOver hører tittelen og linjen under.
 */
export function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  external,
  danger,
  action,
  separated,
  testID,
  accessibilityHint,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
  action?: boolean;
  separated?: boolean;
  testID?: string;
  accessibilityHint?: string;
  /** VoiceOver-etiketten når den synlige rekkefølgen ikke er den beste å høre (f.eks. «Navn: Kari Nordmann»). */
  accessibilityLabel?: string;
}) {
  const lang = useA11yLanguage();
  const { fontScale } = useWindowDimensions();
  const fg = danger ? colors.danger : colors.text;
  const muted = danger ? colors.danger : colors.textSecondary;
  // Med stor tekst står verdien under tittelen, som i iOS' innstillinger: ved siden av fikk et langt ord i tittelen
  // («avreiseflyplass») ikke plass og ble delt midt i ordet.
  const stacked = !!value && fontScale >= STACK_VALUE_AT;
  const inner = (
    <>
      <Icon name={icon} size={20} color={muted} strokeWidth={1.75} />
      <View style={styles.rowText}>
        {/* Ingen linjegrense: lange titler og stor tekst bryter linjen. */}
        <Text style={[type.body, { color: fg }]}>{title}</Text>
        {subtitle ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        {stacked ? <Text style={[type.callout, { color: colors.textSecondary }]}>{value}</Text> : null}
      </View>
      {value && !stacked ? <Text style={[type.callout, styles.rowValue]}>{value}</Text> : null}
      {onPress && !action ? <Icon name={external ? "external" : "chevronRight"} size={18} color={muted} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLanguage={lang} accessibilityLabel={accessibilityLabel ?? [title, value, subtitle].filter(Boolean).join(", ")} style={[styles.row, separated && styles.rowBorder]} testID={testID}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.row, separated && styles.rowBorder, pressed && { backgroundColor: colors.inset }]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Innstillingslisten: overskrift på grunnen, hvitt kort med rader og hårfine streker mellom dem.
  group: { gap: space.sm },
  // Like langt fra overskriften til kortet som i modulene (der «Se alle» gjør overskriftsraden 44 pt høy).
  groupTitle: { ...type.footnoteStrong, color: colors.text, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: space.xs },
  groupCard: { backgroundColor: colors.white, borderRadius: radius.input, overflow: "hidden" },
  row: { minHeight: TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  rowText: { flex: 1, gap: 2 },
  // Verdien tar aldri mer enn litt over halve raden, så etiketten ikke presses til ingenting (lange verdier bryter).
  rowValue: { color: colors.textSecondary, flexShrink: 1, maxWidth: "55%", textAlign: "right" },
});
