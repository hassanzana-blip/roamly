import { useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Photo as PhotoData } from "../lib/destinations";
import { colors } from "../lib/theme";
import { useA11yLanguage, useI18n } from "../i18n";
import { useReducedMotion } from "../lib/motion";

/**
 * Foto med nøytralt svart overlegg for lesbar tekst. Bildet følger med appen;
 * lastes det likevel ikke, står en mørk flate igjen og innholdet er like
 * lesbart. Kilde og lisens beholdes i bilderegisteret, uten å dekke fotoet med tekst.
 */
export function PhotoBackdrop({
  photo,
  style,
  children,
  scrim = "medium",
  testID,
}: {
  photo: PhotoData | null;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scrim?: "light" | "medium" | "strong";
  testID?: string;
}) {
  const { locale } = useI18n();
  const lang = useA11yLanguage();
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  const show = photo && !failed;
  return (
    <View style={[styles.root, style]} testID={testID}>
      {show ? (
        <Image
          source={photo.image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={reduced ? 0 : 150}
          onError={() => setFailed(true)}
          accessible
          accessibilityLanguage={lang}
          accessibilityLabel={photo.credit.caption[locale]}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, scrim === "light" ? styles.scrimLight : scrim === "strong" ? styles.scrimStrong : styles.scrimMedium]} />
      {children}
    </View>
  );
}

/** Mørk toning fra bunnen, så hvit tekst nederst på et foto alltid kan leses. */
export function BottomFade({ height = "60%", strength = 0.85 }: { height?: `${number}%` | number; strength?: number }) {
  return (
    <View style={[styles.fade, { height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0C0D0F" stopOpacity={0} />
            <Stop offset="1" stopColor="#0C0D0F" stopOpacity={strength} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  root: { backgroundColor: colors.raised, overflow: "hidden" },
  scrimLight: { backgroundColor: "rgba(12, 13, 15, 0.25)" },
  scrimMedium: { backgroundColor: colors.scrim },
  scrimStrong: { backgroundColor: colors.scrimStrong },
});
