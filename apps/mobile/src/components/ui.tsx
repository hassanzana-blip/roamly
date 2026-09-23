import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, radius, SKY_MARK_PATH, space } from "../lib/theme";

export function SkyMark({ size = 28, color = colors.azure }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={SKY_MARK_PATH} fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </Svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="HelloSky">
      <SkyMark size={size + 2} />
      <Text style={[styles.wordmarkText, { fontSize: size }]}>hellosky</Text>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, testID }: { children: ReactNode; muted?: boolean; style?: object; testID?: string }) {
  return (
    <Text testID={testID} style={[styles.body, muted && styles.muted, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
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
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        pressed && variant === "primary" && { backgroundColor: colors.azurePressed },
        inactive && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.azure} />
      ) : (
        <Text style={[styles.buttonText, variant !== "primary" && { color: colors.azureInk }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Banner({ tone, children, testID }: { tone: "info" | "warning" | "error"; children: ReactNode; testID?: string }) {
  const bg = tone === "info" ? colors.mint : tone === "warning" ? colors.warningSurface : "#FDECEA";
  const fg = tone === "info" ? colors.petrol : tone === "warning" ? colors.warning : colors.destructive;
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: bg }]} accessibilityRole={tone === "info" ? "summary" : "alert"}>
      <Text style={[styles.bannerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

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
            style={[styles.segment, selected && styles.segmentSelected]}
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
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Flere ${label.toLowerCase()}`}
          style={[styles.stepButton, value >= max && styles.buttonDisabled]}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Chips<T extends string | number>({ value, options, onChange, label, format }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; format: (v: T) => string }) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}: ${format(o)}`}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.textMuted} style={[styles.input, error ? { borderColor: colors.destructive } : null]} {...props} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center", gap: 6 },
  wordmarkText: { fontFamily: fonts.bold, color: colors.petrol, letterSpacing: -0.9 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.petrol },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.petrol },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  buttonPrimary: { backgroundColor: colors.azure },
  buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.azure },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  banner: { borderRadius: radius.md, padding: space.md },
  bannerText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  segmented: { flexDirection: "row", backgroundColor: colors.muted, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
  segmentSelected: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  segmentTextSelected: { color: colors.petrol },
  stepperRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  stepperLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.input, alignItems: "center", justifyContent: "center" },
  stepButtonText: { fontFamily: fonts.semibold, fontSize: 20, color: colors.azureInk },
  stepValue: { fontFamily: fonts.bold, fontSize: 16, minWidth: 18, textAlign: "center", color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 36, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.input, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: colors.petrol, borderColor: colors.petrol },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.white },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.input, paddingHorizontal: space.md, fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.white },
  fieldError: { fontFamily: fonts.medium, fontSize: 13, color: colors.destructive },
});

export const uiStyles = styles;
