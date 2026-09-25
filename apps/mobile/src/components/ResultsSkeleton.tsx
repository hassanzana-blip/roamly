import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { Text } from "./a11y";
import { useReducedMotion } from "../lib/motion";
import { useA11yLanguage } from "../i18n";
import { colors, radius, space, type } from "../lib/theme";

/** Én grå flate i plassholderkortet (ikke noe innhold, ingen tall). */
function Bone({ w, h = 12, r = 6, style }: { w: number | `${number}%`; h?: number; r?: number; style?: object }) {
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.inset }, style]} />;
}

/** Et plassholderkort med samme form som resultatkortet (to strekninger og pris), så listen ikke hopper når svaret kommer. */
function SkeletonCard() {
  const leg = (
    <View style={{ gap: 6 }}>
      <View style={styles.between}>
        <Bone w={78} h={10} />
        <Bone w={96} h={10} />
      </View>
      <View style={styles.route}>
        <Bone w={44} h={18} />
        <Bone w={26} h={10} />
        <View style={styles.line} />
        <Bone w={26} h={10} />
        <Bone w={44} h={18} />
      </View>
    </View>
  );
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Bone w={22} h={22} r={11} />
        <Bone w={96} h={12} />
      </View>
      {leg}
      {leg}
      <View style={[styles.between, styles.footer]}>
        <View style={{ gap: 5 }}>
          <Bone w={104} h={10} />
          <Bone w={128} h={10} />
        </View>
        <View style={{ gap: 5, alignItems: "flex-end" }}>
          <Bone w={92} h={24} r={8} />
          <Bone w={84} h={10} />
        </View>
      </View>
    </View>
  );
}

/**
 * Mens søket pågår: en rolig statuslinje (hva som skjer, og at det kan ta tid) og plassholderkort i samme form som
 * resultatene. Plassholderne er bare grå flater – ingen priser, tider eller selskaper – og er skjult for VoiceOver;
 * statuslinjen leses opp. Med «Reduser bevegelse» står de stille, ellers pulserer de svakt.
 */
export function ResultsSkeleton({ title, body, testID }: { title: string; body: string; testID?: string }) {
  const lang = useA11yLanguage();
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.72, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <View style={styles.wrap} testID={testID}>
      <View accessibilityLanguage={lang} style={styles.status} accessible accessibilityRole="progressbar" accessibilityLabel={`${title} ${body}`} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.onDark} size="small" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.calloutStrong, { color: colors.onDark }]}>{title}</Text>
          <Text style={[type.footnote, { color: colors.onDarkMuted }]} testID={testID ? `${testID}-body` : undefined}>
            {body}
          </Text>
        </View>
      </View>
      <Animated.View style={{ gap: 10, opacity: pulse }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID ? `${testID}-cards` : undefined}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  status: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.raised, borderRadius: radius.input, borderWidth: 1, borderColor: colors.darkBorder, paddingHorizontal: space.md, paddingVertical: space.md },
  card: { backgroundColor: colors.white, borderRadius: radius.input, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  route: { flexDirection: "row", alignItems: "center", gap: 6 },
  line: { flex: 1, height: 1.5, backgroundColor: colors.inset, marginHorizontal: 4 },
  footer: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
});
