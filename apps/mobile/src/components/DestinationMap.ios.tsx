import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Text } from "./a11y";
import type { DestinationMapProps } from "./DestinationMap";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space } from "../lib/theme";

/**
 * Apple Maps (MapKit) via react-native-maps. Standardleverandøren på iOS:
 * ingen API-nøkkel, ingen Google-kart, ingen posisjon. Mørk, dempet stil
 * så nålene – HelloSkys reisemål – er det som synes. Nålene viser bare
 * IATA-koden; et trykk viser reisemålet i kortet under kartet.
 */
export function DestinationMap({ points, selectedId, onSelect, bottomInset }: DestinationMapProps) {
  const { t, locale } = useI18n();
  const lang = useA11yLanguage();
  const map = useRef<MapView>(null);

  const fitAll = () =>
    map.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      { edgePadding: { top: 48, right: 32, bottom: bottomInset + 32, left: 32 }, animated: false },
    );

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      accessibilityLabel={t.explore.mapLabel}
      accessibilityLanguage={lang}
      userInterfaceStyle="dark"
      mapType="mutedStandard"
      showsPointsOfInterests={false}
      showsUserLocation={false}
      showsCompass={false}
      pitchEnabled={false}
      rotateEnabled={false}
      onMapReady={fitAll}
      onPress={(e) => {
        // Et trykk på en nål gir også et trykk på kartet; bare et trykk utenfor nålene lukker kortet.
        if (e.nativeEvent.action !== "marker-press") onSelect(null);
      }}
      testID="destination-map"
    >
      {points.map((p) => {
        const selected = p.destination.id === selectedId;
        return (
          <Marker
            // Ny nøkkel ved valg: egendefinerte nåler tegnes ikke på nytt når tracksViewChanges er av.
            key={`${p.destination.id}-${selected ? "on" : "off"}`}
            identifier={p.destination.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            tracksViewChanges={false}
            zIndex={selected ? 2 : 1}
            onPress={() => onSelect(p.destination.id)}
            accessibilityRole="button"
            accessibilityLabel={t.explore.pinLabel(p.destination.names[locale].city, p.destination.iata)}
            accessibilityHint={t.explore.pinHint}
            testID={`map-pin-${p.destination.id}`}
          >
            <View style={[styles.pin, selected && styles.pinSelected]}>
              <Text style={[styles.code, selected && { color: colors.white }]} maxFontSizeMultiplier={1.6}>{p.destination.iata}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.bg },
  pinSelected: { backgroundColor: colors.blue, borderColor: colors.white },
  code: { fontSize: 12, lineHeight: 15, fontWeight: "700", letterSpacing: 0.3, color: colors.text, fontVariant: ["tabular-nums"] },
});
