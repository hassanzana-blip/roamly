import { useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Pressable, Text } from "./a11y";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { colors, radius, SKY_MARK_PATH, space, TOUCH, type } from "../lib/theme";
import { useA11yLanguage, useI18n } from "../i18n";
import { useReducedMotion } from "../lib/motion";

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
  const lang = useA11yLanguage();
  return (
    <View accessibilityLanguage={lang} style={styles.wordmark} accessible accessibilityRole="image" accessibilityLabel="HelloSky">
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
  accessibilityLabel,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  /** Fullt navn når den synlige teksten er kort (f.eks. «Gå til tilbud» → «… hos Norwegian»). */
  accessibilityLabel?: string;
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
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [styles.primary, pressed && { backgroundColor: colors.bluePressed }, inactive && styles.primaryInactive, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={styles.row8}>
          {/* Ingen linjegrense: med stor tekst brytes etiketten og knappen blir høyere, i stedet for «…». */}
          <Text style={[styles.primaryText, { textAlign: "center", flexShrink: 1 }, disabled && { color: colors.onDarkDim }]}>
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
  const { t } = useI18n();
  const fg = variant === "light" ? colors.text : colors.onDark;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? t.common.activeCount(label, badge) : label}
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

/**
 * Filterbrikke. Valgt = blå; ellers hevet mørk (dark) eller innfelt lys. `removable`: et aktivt filter med «×» –
 * et trykk fjerner det (etiketten til VoiceOver sier det).
 */
export function Chip({ label, selected, onPress, dark = true, disabled, testID, accessibilityLabel, removable }: { label: string; selected: boolean; onPress: () => void; dark?: boolean; disabled?: boolean; testID?: string; accessibilityLabel?: string; removable?: boolean }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // Et aktivt filter med «×» er en fjern-knapp, ikke et valg: VoiceOver skal ikke si «valgt».
      accessibilityState={removable ? { disabled: !!disabled } : { selected, disabled: !!disabled }}
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
      {removable ? <Icon name="close" size={14} color={selected ? colors.white : dark ? colors.onDark : colors.text} strokeWidth={2.25} /> : null}
    </Pressable>
  );
}

/** Enkeltvalg som brikker (alder, reiseklasse) på lys flate. */
export function ChoiceChips<T extends string | number>({ value, options, onChange, label, format, testIDPrefix }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; format: (v: T) => string; testIDPrefix?: string }) {
  const lang = useA11yLanguage();
  return (
    <View accessibilityLanguage={lang} style={styles.wrap8} accessibilityRole="radiogroup" accessibilityLabel={label}>
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
/** `lang` på et valg: valget står på sitt eget språk (f.eks. «Norsk (bokmål)» i språkvelgeren) og leses med den stemmen. */
/** `dot`: et lite merke etter teksten (f.eks. et filter som er på i det andre valget); `spoken` sier det samme til VoiceOver. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  testIDPrefix = "segment-",
}: {
  value: T;
  options: { value: T; label: string; icon?: IconName; lang?: string; dot?: boolean; spoken?: string }[];
  onChange: (v: T) => void;
  label: string;
  testIDPrefix?: string;
}) {
  const lang = useA11yLanguage();
  return (
    <View accessibilityLanguage={lang} style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testIDPrefix}${o.value}`}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.spoken ?? o.label}
            accessibilityLanguage={o.lang ?? lang}
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && !selected && { opacity: 0.6 }]}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={selected ? colors.white : colors.textSecondary} /> : null}
            {/* Ingen linjegrense: med stor tekst brytes «Norsk (bokmål)» i stedet for å kuttes, og valget blir høyere. */}
            <Text style={[type.calloutStrong, { color: selected ? colors.white : colors.text, flexShrink: 1, textAlign: "center" }]} accessibilityLanguage={o.lang ?? lang}>
              {o.label}
            </Text>
            {o.dot ? <View style={[styles.segmentDot, { backgroundColor: selected ? colors.white : colors.blue }]} testID={`${testIDPrefix}${o.value}-dot`} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Faner på mørk flate (Oversikt / Bagasje / Vilkår / Reiseplan). */
export function DarkTabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const lang = useA11yLanguage();
  return (
    <View accessibilityLanguage={lang} style={styles.tabs} accessibilityRole="tablist">
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
            <Text style={[type.footnoteStrong, { color: selected ? colors.text : colors.onDark, textAlign: "center" }]}>{t.label}</Text>
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

/**
 * Trykkbar rad i en innstillingsliste: ikon, tittel, ev. undertekst og en pil
 * (eller et «åpnes utenfor appen»-ikon). `danger` for slett-rader.
 */
export function NavRow({ icon, title, subtitle, onPress, external, danger, testID, accessibilityHint }: { icon: IconName; title: string; subtitle?: string | null; onPress: () => void; external?: boolean; danger?: boolean; testID?: string; accessibilityHint?: string }) {
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.infoRow, styles.navRow, pressed && { backgroundColor: colors.inset }]}
    >
      <View style={styles.infoIcon}>
        <Icon name={icon} size={20} color={fg} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.callout, { color: fg }]}>{title}</Text>
        {subtitle ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <Icon name={external ? "external" : "chevronRight"} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export function Banner({ tone, children, testID, dark }: { tone: "info" | "warning" | "error"; children: ReactNode; testID?: string; dark?: boolean }) {
  const lang = useA11yLanguage();
  const light = { info: [colors.blueSoft, colors.blue], warning: [colors.warningSoft, colors.warning], error: [colors.dangerSoft, colors.danger] } as const;
  const onDark = { info: colors.onDarkMuted, warning: colors.warningOnDark, error: "#FFB4AB" } as const;
  const [bg, fg] = dark ? [colors.raised, onDark[tone]] : light[tone];
  return (
    <View accessibilityLanguage={lang} testID={testID} style={[styles.banner, { backgroundColor: bg }, dark && { borderWidth: 1, borderColor: colors.darkBorder }]} accessibilityRole={tone === "info" ? "summary" : "alert"}>
      <Icon name={tone === "info" ? "info" : "alert"} size={16} color={fg} />
      <Text style={[type.footnote, { color: fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

/**
 * `detail`: lengre tekst bak en utvidelse. `label`: for rene opplysninger som
 * ikke må leses før listen – vises lukket som en kort, tydelig knapp
 * («Om «ca.»-priser»), og åpnes til hele teksten. Advarsler har aldri `label`.
 */
export type NoticeItem = { key: string; tone: "info" | "warning"; text: string; detail?: string; label?: string; testID?: string };

/**
 * Korte meldinger over innhold på mørk bakgrunn, samlet i én rolig flate så de
 * ikke skyver innholdet ned. En melding med `detail` kan åpnes for hele teksten.
 */
export function Notices({ items }: { items: NoticeItem[] }) {
  if (!items.length) return null;
  // En åpnebar linje er en ekte trykkflate på 44 pt; står den sist, er den sin egen luft i bunnen.
  const last = items[items.length - 1]!;
  const endsWithButton = Boolean(last.detail || last.label);
  return (
    <View style={[styles.notices, endsWithButton && { paddingBottom: 0 }]}>
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
  const fg = tone === "warning" ? colors.warningOnDark : colors.onDarkMuted;
  const expandable = Boolean(detail || label);
  const shown = open ? (detail ?? text) : (label ?? text);
  const body = (
    <>
      <View style={styles.noticeIcon}>
        <Icon name={tone === "warning" ? "alert" : "info"} size={15} color={fg} />
      </View>
      <Text style={[type.footnote, { color: fg, flex: 1 }, label && !open ? { color: colors.onDark, fontWeight: "600" } : null]}>{shown}</Text>
      {expandable ? (
        <View style={styles.noticeIcon}>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} color={colors.onDark} />
        </View>
      ) : null}
    </>
  );
  if (!expandable) {
    return (
      <View accessibilityLanguage={lang} testID={testID} style={styles.noticeLine} accessibilityRole={tone === "warning" ? "alert" : "summary"}>
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
      style={({ pressed }) => [styles.noticeLine, styles.noticeButton, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

/** «Demo»-merke: testdata skal aldri kunne forveksles med ekte priser. */
export function DemoBadge({ testID }: { testID?: string }) {
  const lang = useA11yLanguage();
  const { t } = useI18n();
  return (
    <View accessibilityLanguage={lang} style={styles.demo} testID={testID} accessible accessibilityLabel={t.common.demoBadgeLabel}>
      <Text style={styles.demoText}>{t.common.demoBadge}</Text>
    </View>
  );
}

export function Field({ label, error, icon, ...props }: TextInputProps & { label: string; error?: string | null; icon?: IconName }) {
  const lang = useA11yLanguage();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.footnoteStrong, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, focused && { borderColor: colors.blue }, error ? { borderColor: colors.danger } : null]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.blue : colors.textSecondary} /> : null}
        <TextInput
          accessibilityLanguage={lang}
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

/**
 * `note`: en regel som stopper knappene akkurat nå («Høyst ett spedbarn per voksen»), under raden – der den
 * biter – og i VoiceOver-hintet.
 */
export function Stepper({ label, hint, value, min, max, onChange, note, testID }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void; note?: string | null; testID?: string }) {
  const { t } = useI18n();
  const lang = useA11yLanguage();
  return (
    <View style={{ gap: 2 }}>
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      {/* VoiceOver: én justerbar kontroll (sveip opp/ned); knappene er for trykk. */}
      <View
        style={styles.row12}
        accessible
        accessibilityLanguage={lang}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint={[hint, note].filter(Boolean).join(". ") || undefined}
        accessibilityValue={{ min, max, now: value, text: String(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment" && value < max) onChange(value + 1);
          if (e.nativeEvent.actionName === "decrement" && value > min) onChange(value - 1);
        }}
        testID={`stepper-${label}`}
      >
        <Pressable onPress={() => onChange(value - 1)} disabled={value <= min} accessibilityRole="button" accessibilityLabel={t.common.fewer(label)} style={[styles.stepButton, value <= min && { opacity: 0.35 }]}>
          <Icon name="minus" size={18} color={colors.text} />
        </Pressable>
        <Text style={[type.bodyStrong, type.tabular, { color: colors.text, minWidth: 20, textAlign: "center" }]}>{value}</Text>
        <Pressable onPress={() => onChange(value + 1)} disabled={value >= max} accessibilityRole="button" accessibilityLabel={t.common.more(label)} style={[styles.stepButton, value >= max && { opacity: 0.35 }]}>
          <Icon name="plus" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
      {note ? (
        <View style={styles.stepperNote} testID={testID ? `${testID}-note` : undefined}>
          <Icon name="info" size={14} color={colors.textSecondary} />
          <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Ark fra bunnen (hvitt) med tittel og «Ferdig». */
export function BottomSheet({ visible, title, onClose, children, testID, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; testID?: string; footer?: ReactNode }) {
  const lang = useA11yLanguage();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={styles.sheetRoot} accessibilityLanguage={lang}>
        {/* Bakgrunnen lukker ved trykk; for VoiceOver er «Ferdig» og tofingers-Z (escape) veien ut. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View accessibilityLanguage={lang} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} testID={testID} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            <LinkButton label={t.common.done} onPress={onClose} testID={testID ? `${testID}-done` : undefined} />
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
  secondary: { minHeight: TOUCH, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  secondaryLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  secondaryDark: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  link: { minHeight: TOUCH, justifyContent: "center" },

  iconDark: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  iconGlass: { backgroundColor: "rgba(12, 13, 15, 0.45)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.18)" },
  iconLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.white, fontVariant: ["tabular-nums"] },

  chip: { minHeight: 36, minWidth: TOUCH, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  chipDark: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  chipLight: { backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.lightBorder },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },

  segmented: { flexDirection: "row", backgroundColor: colors.inset, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, minHeight: TOUCH, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingHorizontal: space.md },
  segmentSelected: { backgroundColor: colors.blue },
  segmentDot: { width: 6, height: 6, borderRadius: 3 },

  // Fanene deler raden; får etikettene ikke plass (stor tekst), brytes raden i stedet for at ordene kuttes.
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tab: { flexGrow: 1, flexShrink: 0, flexBasis: "auto", minHeight: TOUCH, borderRadius: radius.input, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.darkBorder },
  tabSelected: { backgroundColor: colors.white, borderColor: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.xl, gap: space.lg },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  infoRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 40 },
  infoIcon: { width: 28, alignItems: "center" },

  banner: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", borderRadius: radius.input, paddingHorizontal: space.md, paddingVertical: 10 },
  navRow: { minHeight: TOUCH + 8, borderRadius: radius.sm, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  notices: { backgroundColor: colors.raised, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  noticeLine: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  noticeIcon: { paddingTop: 2 },
  // Hele raden er trykkflaten: minst 44 pt høy, uten hitSlop over naboene.
  noticeButton: { minHeight: TOUCH, alignItems: "center" },
  demo: { alignSelf: "flex-start", backgroundColor: colors.warningSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  demoText: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.6, color: colors.warning },

  inputWrap: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, paddingHorizontal: space.md },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text },

  stepperRow: { flexDirection: "row", alignItems: "center", minHeight: 56 },
  stepperNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingBottom: space.xs },
  stepButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center" },

  sheetRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md, maxHeight: "90%" },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: colors.lightBorder, marginBottom: space.xs },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  state: { alignItems: "center", gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  stateIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  stateActions: { alignSelf: "stretch", gap: space.sm, marginTop: space.sm },
});
