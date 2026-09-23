import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { colors, fonts, radius, shadow, SKY_MARK_PATH, space, TOUCH } from "../lib/theme";

// ─── Merke og tekst ──────────────────────────────────────────────────────────

export function SkyMark({ size = 28, color = colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={SKY_MARK_PATH} fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </Svg>
  );
}

export function Wordmark({ size = 24, onDark = true }: { size?: number; onDark?: boolean }) {
  const color = onDark ? colors.white : colors.navy;
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="HelloSky">
      <SkyMark size={size + 2} color={color} />
      <Text style={[styles.wordmarkText, { fontSize: size, color }]}>hellosky</Text>
    </View>
  );
}

export function Title({ children, onDark }: { children: ReactNode; onDark?: boolean }) {
  return (
    <Text style={[styles.title, onDark && { color: colors.white }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Body({ children, muted, style, testID }: { children: ReactNode; muted?: boolean; style?: object; testID?: string }) {
  return (
    <Text testID={testID} style={[styles.body, muted && styles.muted, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, floating, testID }: { children: ReactNode; style?: ViewStyle; floating?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, floating && shadow.card, style]}>
      {children}
    </View>
  );
}

// ─── Mørkt toppfelt ─────────────────────────────────────────────────────────

/** Prikket verdenskart (assets/world-dots.png) som diskret tekstur på mørke flater. */
export function WorldTexture({ top = 0 }: { top?: number }) {
  return (
    <Image
      source={require("../../assets/world-dots.png")}
      style={[styles.texture, { top }]}
      resizeMode="cover"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Rund knapp på mørk bakgrunn (tilbake, filter, lukk). */
export function CircleButton({ icon, label, onPress, badge, testID }: { icon: IconName; label: string; onPress: () => void; badge?: number; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} aktive` : label}
      hitSlop={4}
      style={({ pressed }) => [styles.circle, pressed && { backgroundColor: colors.navyRaised }]}
    >
      <Icon name={icon} size={20} color={colors.white} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Navigasjonslinjen på mørke skjermer: rund tilbakeknapp, tittel i midten og
 * valgfri handling til høyre. Innholdet under (f.eks. rute) ligger i samme felt.
 */
export function ScreenHeader({ title, onBack, backLabel = "Tilbake", backIcon = "arrowLeft", right, children }: { title: string; onBack?: () => void; backLabel?: string; backIcon?: IconName; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <WorldTexture top={insets.top + 24} />
      <View style={styles.headerRow}>
        {onBack ? <CircleButton icon={backIcon} label={backLabel} onPress={onBack} testID="header-back" /> : <View style={styles.circleSpacer} />}
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {right ?? <View style={styles.circleSpacer} />}
      </View>
      {children}
    </View>
  );
}

// ─── Rute ───────────────────────────────────────────────────────────────────

/** Fly, stiplet linje og landingspunkt – ruten mellom to flyplasskoder. */
export function RouteLine({ dark, top, bottom }: { dark?: boolean; top?: string; bottom?: string }) {
  const line = dark ? "rgba(255,255,255,0.45)" : colors.input;
  return (
    <View style={styles.routeLine} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {top ? <Text style={[styles.routeMeta, dark && { color: colors.onDarkMuted }]}>{top}</Text> : null}
      <View style={styles.routeTrack}>
        <Icon name="plane" size={18} color={dark ? colors.white : colors.indigo} rotate={45} />
        <View style={[styles.dots, { borderColor: line }]} />
        <View style={[styles.routeEnd, { borderColor: dark ? colors.white : colors.indigo, backgroundColor: dark ? colors.navy : colors.white }]} />
      </View>
      {bottom ? <Text style={[styles.routeMeta, dark && { color: colors.onDarkMuted }]}>{bottom}</Text> : null}
    </View>
  );
}

/** Store flyplasskoder i hver ende av ruten, med by under – øverst på mørke skjermer. */
export function RouteHero({ from, to, label }: { from: { code: string; city: string }; to: { code: string; city: string }; label: string }) {
  return (
    <View style={styles.hero} accessible accessibilityLabel={label}>
      <View style={styles.heroEnd}>
        <Text style={styles.heroCode}>{from.code}</Text>
        <Text style={styles.heroCity} numberOfLines={1}>
          {from.city}
        </Text>
      </View>
      <RouteLine dark />
      <View style={[styles.heroEnd, { alignItems: "flex-end" }]}>
        <Text style={styles.heroCode}>{to.code}</Text>
        <Text style={[styles.heroCity, { textAlign: "right" }]} numberOfLines={1}>
          {to.city}
        </Text>
      </View>
    </View>
  );
}

/** Flyselskapets kode i en rund brikke (vi har ingen logoer, så koden står der i stedet). */
export function CarrierBadge({ code, size = 36 }: { code: string; size?: number }) {
  return (
    <View style={[styles.carrierBadge, { width: size, height: size, borderRadius: size / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.carrierCode, { fontSize: size * 0.36 }]}>{code.slice(0, 3).toUpperCase()}</Text>
    </View>
  );
}

/** Liten etikett (reiseklasse, varighet). */
export function Pill({ children, tone = "indigo", icon }: { children: ReactNode; tone?: "indigo" | "neutral" | "success" | "warning"; icon?: IconName }) {
  const bg = tone === "indigo" ? colors.indigoSoft : tone === "success" ? colors.successSurface : tone === "warning" ? colors.warningSurface : colors.surfaceMuted;
  const fg = tone === "indigo" ? colors.indigoInk : tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/** Billettens perforering: stiplet linje med halvsirkler i hver kant (fargen er bakgrunnen bak kortet). */
export function TicketDivider({ notch = colors.navy }: { notch?: string }) {
  return (
    <View style={styles.ticketDivider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.notch, { left: -space.lg - 10, backgroundColor: notch }]} />
      <View style={styles.ticketDash} />
      <View style={[styles.notch, { right: -space.lg - 10, backgroundColor: notch }]} />
    </View>
  );
}

// ─── Kontroller ─────────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "onDark";
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const inactive = disabled || loading;
  const fg = variant === "primary" ? colors.white : variant === "onDark" ? colors.white : colors.indigoInk;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && [styles.buttonPrimary, shadow.button],
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "onDark" && styles.buttonOnDark,
        pressed && variant === "primary" && { backgroundColor: colors.indigoPressed },
        pressed && variant !== "primary" && { opacity: 0.75 },
        inactive && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Tekstlenke (f.eks. «Nullstill») med full trykkflate. */
export function LinkButton({ label, onPress, testID, accessibilityLabel }: { label: string; onPress: () => void; testID?: string; accessibilityLabel?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} hitSlop={8} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ tone, children, testID }: { tone: "info" | "warning" | "error"; children: ReactNode; testID?: string }) {
  const bg = tone === "info" ? colors.indigoSoft : tone === "warning" ? colors.warningSurface : colors.destructiveSurface;
  const fg = tone === "info" ? colors.indigoInk : tone === "warning" ? colors.warning : colors.destructive;
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: bg }]} accessibilityRole={tone === "info" ? "summary" : "alert"}>
      <Icon name={tone === "info" ? "info" : "alert"} size={18} color={fg} />
      <Text style={[styles.bannerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/** Valg mellom få alternativer som separate piller (valgt = indigo). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
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
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepperLabel}>{label}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
      <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value}`}>
        <Pressable
          onPress={() => onChange(value - 1)}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Færre ${label.toLowerCase()}`}
          style={[styles.stepButton, value <= min && styles.buttonDisabled]}
        >
          <Icon name="minus" size={18} color={colors.indigoInk} />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Flere ${label.toLowerCase()}`}
          style={[styles.stepButton, value >= max && styles.buttonDisabled]}
        >
          <Icon name="plus" size={18} color={colors.indigoInk} />
        </Pressable>
      </View>
    </View>
  );
}

export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  label,
  format,
  dark,
  testIDPrefix,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  format: (v: T) => string;
  dark?: boolean;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
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
            style={({ pressed }) => [
              styles.chip,
              dark ? styles.chipDark : null,
              selected && (dark ? styles.chipDarkSelected : styles.chipSelected),
              pressed && !selected && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.chipText, dark && { color: colors.white }, selected && (dark ? { color: colors.navy } : styles.chipTextSelected)]}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, error, icon, ...props }: TextInputProps & { label: string; error?: string | null; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused, error ? { borderColor: colors.destructive } : null]}>
        {icon ? <Icon name={icon} size={20} color={focused ? colors.indigo : colors.textMuted} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
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
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/** Grå felt-flis med ikon, etikett og verdi (dato, reisende, klasse). */
export function Tile({ icon, label, value, onPress, accessibilityLabel, accessibilityHint, testID, style }: { icon: IconName; label: string; value: string; onPress: () => void; accessibilityLabel?: string; accessibilityHint?: string; testID?: string; style?: ViewStyle }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.border }, style]}
    >
      <Icon name={icon} size={18} color={colors.indigo} />
      <View style={{ flex: 1 }}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

/** Ark fra bunnen med tittel og «Ferdig». */
export function BottomSheet({ visible, title, onClose, children, testID }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Lukk" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} testID={testID}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {title}
            </Text>
            <LinkButton label="Ferdig" onPress={onClose} testID={testID ? `${testID}-done` : undefined} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Tom tilstand, lasting og feil: ikon i ring, tittel, forklaring og ev. handlinger. */
export function StateView({ icon, title, body, children, testID, busy, dark }: { icon: IconName; title: string; body?: string; children?: ReactNode; testID?: string; busy?: boolean; dark?: boolean }) {
  return (
    <View style={styles.state} testID={testID}>
      <View style={[styles.stateIcon, dark && { backgroundColor: colors.navyRaised }]}>
        {busy ? <ActivityIndicator color={dark ? colors.white : colors.indigo} /> : <Icon name={icon} size={28} color={dark ? colors.white : colors.indigo} />}
      </View>
      <Text style={[styles.stateTitle, dark && { color: colors.white }]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[styles.stateBody, dark && { color: colors.onDarkMuted }]}>{body}</Text> : null}
      {children ? <View style={styles.stateActions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center", gap: 6 },
  wordmarkText: { fontFamily: fonts.heavy, letterSpacing: -0.9 },
  title: { fontFamily: fonts.heavy, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, color: colors.text },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.md },

  texture: { position: "absolute", left: -60, width: 560, height: 215, opacity: 0.14 },
  header: { backgroundColor: colors.navy, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.xl, overflow: "hidden" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: colors.white },
  circle: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, borderColor: colors.navyLine, alignItems: "center", justifyContent: "center" },
  circleSpacer: { width: TOUCH, height: TOUCH },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.navy },

  routeLine: { flex: 1, alignItems: "stretch", gap: 2, paddingHorizontal: space.sm },
  routeTrack: { flexDirection: "row", alignItems: "center", gap: 4 },
  dots: { flex: 1, borderTopWidth: 1.5, borderStyle: "dashed" },
  routeEnd: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  routeMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  hero: { flexDirection: "row", alignItems: "center" },
  heroEnd: { minWidth: 84, maxWidth: 120 },
  heroCode: { fontFamily: fonts.heavy, fontSize: 36, lineHeight: 42, letterSpacing: -0.5, color: colors.white },
  heroCity: { fontFamily: fonts.medium, fontSize: 13, color: colors.onDarkMuted },

  carrierBadge: { backgroundColor: colors.indigoSoft, alignItems: "center", justifyContent: "center" },
  carrierCode: { fontFamily: fonts.heavy, color: colors.indigoInk, letterSpacing: 0.3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
  ticketDivider: { height: 20, justifyContent: "center", marginVertical: space.xs },
  ticketDash: { borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.border },
  notch: { position: "absolute", width: 20, height: 20, borderRadius: 10, top: 0 },

  button: { minHeight: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: space.sm },
  buttonPrimary: { backgroundColor: colors.indigo },
  buttonSecondary: { backgroundColor: colors.indigoSoft },
  buttonGhost: { backgroundColor: "transparent" },
  buttonOnDark: { backgroundColor: colors.navyRaised, borderWidth: 1, borderColor: colors.navyLine },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  link: { minHeight: TOUCH, minWidth: TOUCH, justifyContent: "center", alignItems: "flex-end" },
  linkText: { fontFamily: fonts.bold, fontSize: 15, color: colors.indigoInk },

  banner: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", borderRadius: radius.md, padding: space.md },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },

  segmented: { flexDirection: "row", gap: space.sm },
  segment: { flex: 1, minHeight: TOUCH, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md, backgroundColor: colors.surfaceMuted },
  segmentSelected: { backgroundColor: colors.indigo },
  segmentText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary },
  segmentTextSelected: { color: colors.white },

  stepperRow: { flexDirection: "row", alignItems: "center", minHeight: 56 },
  stepperLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: colors.indigoSoft, alignItems: "center", justifyContent: "center" },
  stepValue: { fontFamily: fonts.bold, fontSize: 17, minWidth: 22, textAlign: "center", color: colors.text },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 40, minWidth: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: colors.indigo },
  chipDark: { backgroundColor: colors.navyRaised },
  chipDarkSelected: { backgroundColor: colors.white },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.white },

  fieldLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: "transparent", backgroundColor: colors.surfaceMuted, paddingHorizontal: space.md },
  inputFocused: { borderColor: colors.indigo, backgroundColor: colors.white },
  input: { flex: 1, minHeight: 50, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  fieldError: { fontFamily: fonts.medium, fontSize: 13, color: colors.destructive },

  tile: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: space.lg, paddingVertical: space.md },
  tileLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  tileValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 1 },

  sheetRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(18, 21, 74, 0.45)" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md, maxHeight: "88%" },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.input, marginBottom: space.xs },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text },

  state: { alignItems: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  stateIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.indigoSoft, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  stateTitle: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text, textAlign: "center" },
  stateBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: "center", maxWidth: 320 },
  stateActions: { alignSelf: "stretch", gap: space.sm, marginTop: space.sm },
});
