import { useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { colors, radius, SKY_MARK_PATH, space, TOUCH, type } from "../lib/theme";

// ─── Merke ──────────────────────────────────────────────────────────────────

/** HelloSkys «H» – samme sti som nettets SkyMark. */
export function SkyMark({ size = 24, color = colors.blue }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={SKY_MARK_PATH} fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </Svg>
  );
}

/** Det godkjente merket: blå «H» og ordmerket. Likt på alle skjermer. */
export function Wordmark({ size = 22, dark = true }: { size?: number; dark?: boolean }) {
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="HelloSky">
      <SkyMark size={size + 2} />
      <Text style={[styles.wordmarkText, { fontSize: size, color: dark ? colors.onDark : colors.text }]}>hellosky</Text>
    </View>
  );
}

// ─── Knapper ────────────────────────────────────────────────────────────────

/** Hovedknappen: flat blå pille. Én per skjerm. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  accessibilityHint,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [styles.primary, pressed && { backgroundColor: colors.bluePressed }, inactive && styles.primaryInactive, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={styles.row8}>
          <Text style={[styles.primaryText, disabled && { color: colors.onDarkDim }]} numberOfLines={1}>
            {label}
          </Text>
          {icon ? <Icon name={icon} size={20} color={disabled ? colors.onDarkDim : colors.white} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Sekundær knapp: lys pille med kant (lyse flater) eller hevet mørk (mørke flater). */
export function SecondaryButton({ label, onPress, icon, dark, testID, accessibilityHint }: { label: string; onPress: () => void; icon?: IconName; dark?: boolean; testID?: string; accessibilityHint?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.secondary, dark ? styles.secondaryDark : styles.secondaryLight, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.row8}>
        {icon ? <Icon name={icon} size={18} color={dark ? colors.onDark : colors.text} /> : null}
        <Text style={[type.calloutStrong, { color: dark ? colors.onDark : colors.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Tekstlenke med full trykkflate («Se alle», «Ferdig», «Nullstill»). */
export function LinkButton({ label, onPress, testID, accessibilityLabel, dark }: { label: string; onPress: () => void; testID?: string; accessibilityLabel?: string; dark?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} hitSlop={10} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text style={[type.calloutStrong, { color: dark ? colors.blueOnDark : colors.blue }]}>{label}</Text>
    </Pressable>
  );
}

/** Rund ikonknapp. «glass» ligger over foto, «dark» på kull, «light» på hvitt. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = "dark",
  badge,
  testID,
  size = 40,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: "dark" | "glass" | "light" | "plain";
  badge?: number;
  testID?: string;
  size?: number;
}) {
  const fg = variant === "light" ? colors.text : colors.onDark;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} aktive` : label}
      hitSlop={(TOUCH - size) / 2 + 2}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" },
        variant === "dark" && styles.iconDark,
        variant === "glass" && styles.iconGlass,
        variant === "light" && styles.iconLight,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={20} color={fg} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Valg ───────────────────────────────────────────────────────────────────

/** Filterbrikke. Valgt = blå; ellers hevet mørk (dark) eller innfelt lys. */
export function Chip({ label, selected, onPress, dark = true, disabled, testID, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; dark?: boolean; disabled?: boolean; testID?: string; accessibilityLabel?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        dark ? styles.chipDark : styles.chipLight,
        selected && styles.chipSelected,
        disabled && { opacity: 0.4 },
        pressed && !selected && { opacity: 0.7 },
      ]}
    >
      <Text style={[type.footnoteStrong, { color: selected ? colors.white : dark ? colors.onDark : colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Enkeltvalg som brikker (alder, reiseklasse) på lys flate. */
export function ChoiceChips<T extends string | number>({ value, options, onChange, label, format, testIDPrefix }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; format: (v: T) => string; testIDPrefix?: string }) {
  return (
    <View style={styles.wrap8} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={String(o)}
            testID={testIDPrefix ? `${testIDPrefix}${String(o)}` : undefined}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}: ${format(o)}`}
            hitSlop={4}
            style={({ pressed }) => [styles.chip, styles.chipLight, selected && styles.chipSelected, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[type.footnoteStrong, { color: selected ? colors.white : colors.text }]}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Lyst spor med blå valgt pille – reisetype (Tur-retur / Én vei). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void; label: string }) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && !selected && { opacity: 0.6 }]}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={selected ? colors.white : colors.textSecondary} /> : null}
            <Text style={[type.calloutStrong, { color: selected ? colors.white : colors.text }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Faner på mørk flate (Oversikt / Bagasje / Vilkår / Reiseplan). */
export function DarkTabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <Pressable
            key={t.value}
            testID={`tab-${t.value}`}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t.label}
            style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[type.footnoteStrong, { color: selected ? colors.text : colors.onDark }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Flater og innhold ──────────────────────────────────────────────────────

/** Hvitt kort med tittel og valgfri handling til høyre (Reiseinformasjon, Bagasje …). */
export function InformationCard({ title, right, children, testID, style }: { title?: string; right?: ReactNode; children: ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={[type.section, { color: colors.text, flex: 1 }]} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Rad med ikon, tittel, undertekst og valgfri verdi til høyre. */
export function InfoRow({ icon, title, subtitle, value, valueTone = "neutral", testID }: { icon: IconName; title: string; subtitle?: string | null; value?: string; valueTone?: "neutral" | "good" | "blue" | "muted"; testID?: string }) {
  const tone = valueTone === "good" ? colors.success : valueTone === "blue" ? colors.blue : valueTone === "muted" ? colors.textSecondary : colors.text;
  return (
    <View style={styles.infoRow} testID={testID}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={20} color={colors.text} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.callout, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={[type.calloutStrong, { color: tone, textAlign: "right", maxWidth: "46%" }]}>{value}</Text> : null}
    </View>
  );
}

export function Banner({ tone, children, testID, dark }: { tone: "info" | "warning" | "error"; children: ReactNode; testID?: string; dark?: boolean }) {
  const light = { info: [colors.blueSoft, colors.blue], warning: [colors.warningSoft, colors.warning], error: [colors.dangerSoft, colors.danger] } as const;
  const onDark = { info: colors.onDarkMuted, warning: colors.warningOnDark, error: "#FFB4AB" } as const;
  const [bg, fg] = dark ? [colors.raised, onDark[tone]] : light[tone];
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: bg }, dark && { borderWidth: 1, borderColor: colors.darkBorder }]} accessibilityRole={tone === "info" ? "summary" : "alert"}>
      <Icon name={tone === "info" ? "info" : "alert"} size={16} color={fg} />
      <Text style={[type.footnote, { color: fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export type NoticeItem = { key: string; tone: "info" | "warning"; text: string; detail?: string; testID?: string };

/**
 * Korte meldinger over innhold på mørk bakgrunn, samlet i én rolig flate så de
 * ikke skyver innholdet ned. En melding med `detail` kan åpnes for hele teksten.
 */
export function Notices({ items }: { items: NoticeItem[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.notices}>
      {items.map(({ key, ...n }) => (
        <NoticeLine key={key} {...n} />
      ))}
    </View>
  );
}

function NoticeLine({ tone, text, detail, testID }: Omit<NoticeItem, "key">) {
  const [open, setOpen] = useState(false);
  const fg = tone === "warning" ? colors.warningOnDark : colors.onDarkMuted;
  const body = (
    <>
      <View style={styles.noticeIcon}>
        <Icon name={tone === "warning" ? "alert" : "info"} size={15} color={fg} />
      </View>
      <Text style={[type.footnote, { color: fg, flex: 1 }]}>{open && detail ? detail : text}</Text>
      {detail ? (
        <View style={styles.noticeIcon}>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} color={colors.onDark} />
        </View>
      ) : null}
    </>
  );
  if (!detail) {
    return (
      <View testID={testID} style={styles.noticeLine} accessibilityRole={tone === "warning" ? "alert" : "summary"}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={() => setOpen((o) => !o)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityHint={open ? "Viser kortversjonen" : "Viser hele forklaringen"}
      style={({ pressed }) => [styles.noticeLine, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

/** «Demo»-merke: testdata skal aldri kunne forveksles med ekte priser. */
export function DemoBadge({ testID }: { testID?: string }) {
  return (
    <View style={styles.demo} testID={testID} accessible accessibilityLabel="Demo: prisene er ikke ekte">
      <Text style={styles.demoText}>DEMO</Text>
    </View>
  );
}

export function Field({ label, error, icon, ...props }: TextInputProps & { label: string; error?: string | null; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.footnoteStrong, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, focused && { borderColor: colors.blue }, error ? { borderColor: colors.danger } : null]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.blue : colors.textSecondary} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
      {error ? <Text style={[type.footnote, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      <View style={styles.row12} accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value}`}>
        <Pressable onPress={() => onChange(value - 1)} disabled={value <= min} accessibilityRole="button" accessibilityLabel={`Færre ${label.toLowerCase()}`} style={[styles.stepButton, value <= min && { opacity: 0.35 }]}>
          <Icon name="minus" size={18} color={colors.text} />
        </Pressable>
        <Text style={[type.bodyStrong, type.tabular, { color: colors.text, minWidth: 20, textAlign: "center" }]}>{value}</Text>
        <Pressable onPress={() => onChange(value + 1)} disabled={value >= max} accessibilityRole="button" accessibilityLabel={`Flere ${label.toLowerCase()}`} style={[styles.stepButton, value >= max && { opacity: 0.35 }]}>
          <Icon name="plus" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/** Ark fra bunnen (hvitt) med tittel og «Ferdig». */
export function BottomSheet({ visible, title, onClose, children, testID, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; testID?: string; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Lukk" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} testID={testID}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            <LinkButton label="Ferdig" onPress={onClose} testID={testID ? `${testID}-done` : undefined} />
          </View>
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
}

/** Tom tilstand, lasting og feil: ikon i ring, tittel, forklaring og handlinger. */
export function StateView({ icon, title, body, children, testID, busy, dark = true }: { icon: IconName; title: string; body?: string; children?: ReactNode; testID?: string; busy?: boolean; dark?: boolean }) {
  return (
    <View style={styles.state} testID={testID}>
      <View style={[styles.stateIcon, { backgroundColor: dark ? colors.raised : colors.inset, borderColor: dark ? colors.darkBorder : colors.lightBorder }]}>
        {busy ? <ActivityIndicator color={dark ? colors.onDark : colors.text} /> : <Icon name={icon} size={26} color={dark ? colors.onDark : colors.text} />}
      </View>
      <Text style={[type.section, { color: dark ? colors.onDark : colors.text, textAlign: "center" }]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[type.callout, { color: dark ? colors.onDarkMuted : colors.textSecondary, textAlign: "center", maxWidth: 320 }]}>{body}</Text> : null}
      {children ? <View style={styles.stateActions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center", gap: 6 },
  wordmarkText: { fontWeight: "700", letterSpacing: -0.6 },
  row8: { flexDirection: "row", alignItems: "center", gap: space.sm },
  row12: { flexDirection: "row", alignItems: "center", gap: space.md },
  wrap8: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },

  primary: { minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  primaryInactive: { backgroundColor: colors.darkBorder },
  primaryText: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: colors.white },
  secondary: { minHeight: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  secondaryLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  secondaryDark: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  link: { minHeight: TOUCH, justifyContent: "center" },

  iconDark: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  iconGlass: { backgroundColor: "rgba(12, 13, 15, 0.45)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.18)" },
  iconLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.white, fontVariant: ["tabular-nums"] },

  chip: { minHeight: 36, minWidth: TOUCH, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  chipDark: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  chipLight: { backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.lightBorder },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },

  segmented: { flexDirection: "row", backgroundColor: colors.inset, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, minHeight: 40, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingHorizontal: space.md },
  segmentSelected: { backgroundColor: colors.blue },

  tabs: { flexDirection: "row", gap: space.sm },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.input, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  tabSelected: { backgroundColor: colors.white, borderColor: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.xl, gap: space.lg },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  infoRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 40 },
  infoIcon: { width: 28, alignItems: "center" },

  banner: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: 10 },
  notices: { backgroundColor: colors.raised, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, paddingHorizontal: space.md, paddingVertical: 10, gap: space.sm },
  noticeLine: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  noticeIcon: { paddingTop: 2 },
  demo: { alignSelf: "flex-start", backgroundColor: colors.warningSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  demoText: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.6, color: colors.warning },

  inputWrap: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, paddingHorizontal: space.md },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text },

  stepperRow: { flexDirection: "row", alignItems: "center", minHeight: 56 },
  stepButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },

  sheetRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md, maxHeight: "90%" },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lightBorder, marginBottom: space.xs },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  state: { alignItems: "center", gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  stateIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  stateActions: { alignSelf: "stretch", gap: space.sm, marginTop: space.sm },
});
