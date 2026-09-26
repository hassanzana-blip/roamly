import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./a11y";
import { Image } from "expo-image";
import type { Carrier } from "@contracts/types";
import { colors } from "../lib/theme";

/**
 * Flyselskapets merke slik leverandøren leverte det (Duffel/KAYAK `logoUrl`) –
 * aldri tegnet, gjettet eller endret. Mangler det, eller lastes det ikke, står
 * selskapets kode i en nøytral sirkel.
 */
export function AirlineLogo({ carrier, size = 36 }: { carrier: Pick<Carrier, "iata" | "name" | "logoUrl">; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = carrier.logoUrl && /^https:\/\//.test(carrier.logoUrl) && !failed ? carrier.logoUrl : null;
  const code = (carrier.iata || carrier.name).slice(0, 3).toUpperCase();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {url ? (
        <Image source={{ uri: url }} style={{ width: size * 0.72, height: size * 0.72 }} contentFit="contain" onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.code, { fontSize: Math.round(size * 0.34) }]}>{code}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.inset, borderWidth: 1, borderColor: colors.lightBorder, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  code: { fontWeight: "700", color: colors.text, letterSpacing: 0.2 },
});
