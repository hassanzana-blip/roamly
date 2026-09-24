import { useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Text } from "./a11y";
import type { DestinationMapProps } from "./DestinationMap";
import { areaRegion } from "../lib/destinationMap";
import { MAX_PIN_SCALE, clusterPoints, fitAspect, leftArea, revealAbove, zoomInOn, type Region, type Size } from "../lib/mapGeometry";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space } from "../lib/theme";

/**
 * Apple Maps (MapKit) via react-native-maps. Standardleverandøren på iOS:
 * ingen API-nøkkel, ingen Google-kart, ingen posisjon. Mørk, dempet stil
 * så nålene – HelloSkys reisemål – er det som synes.
 *
 * - Kartet åpner i et område (Europa, eller det valgte reisemålets område),
 *   ikke hele verden på én gang; knappene over kartet bytter område.
 * - Hver nål står på nøyaktig flyplassen søket bruker og viser IATA-koden.
 *   Nåler som ville dekke hverandre, blir én gruppe på den første flyplassen
 *   («EBL +1»); et trykk zoomer inn til de kan velges hver for seg.
 * - Kortet for det valgte reisemålet ligger over bunnen av kartet i stedet for
 *   å krympe det; kartet flyttes bare hvis nålen ellers havner under kortet.
 */
export function DestinationMap(props: DestinationMapProps) {
  // Utsnittet regnes ut fra kartets faktiske størrelse, så kartet tegnes først når den er målt.
  const [size, setSize] = useState<Size | null>(null);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
      }}
      testID="destination-map-frame"
    >
      {size ? <AppleMap {...props} size={size} /> : null}
    </View>
  );
}

function AppleMap({ points, selectedId, onSelect, bottomInset, area, areaRequest, onLeaveArea, size }: DestinationMapProps & { size: Size }) {
  const { t, locale } = useI18n();
  const lang = useA11yLanguage();
  const map = useRef<MapView>(null);
  const [initial] = useState<Region>(() => areaRegion(area ?? "world", size));
  const [region, setRegion] = useState<Region>(initial);
  // Kartets egne flyttinger (områdeknapp, nål over kortet) skal ikke regnes som at kunden dro kartet bort.
  const ownMove = useRef(false);
  const moveTo = (r: Region, ms: number) => {
    ownMove.current = true;
    map.current?.animateToRegion(r, ms);
  };

  // Områdeknappene: hvert trykk flytter kartet, også til samme område igjen.
  const firstRequest = useRef(areaRequest);
  useEffect(() => {
    if (areaRequest === firstRequest.current || !area) return;
    // Kartet melder det nye utsnittet i onRegionChangeComplete når det er framme.
    moveTo(areaRegion(area, size), 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaRequest]);

  // Valgt reisemål: flytt kartet bare hvis nålen ellers er skjult under kortet (eller utenfor kartet).
  useEffect(() => {
    const p = points.find((x) => x.destination.id === selectedId);
    if (!p || bottomInset <= 0) return;
    const next = revealAbove(p, region, size, bottomInset);
    if (next) moveTo(next, 350);
    // Bare når valget eller kortets høyde endres – ikke for hver kartbevegelse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, bottomInset]);

  // Større tekst gir større nåler; da ryddes det mer (høyst 1,4×, som nålenes tekst).
  const fontScale = PixelRatio.getFontScale();
  const clusters = useMemo(() => clusterPoints(points, region, size, selectedId, fontScale), [points, region, size, selectedId, fontScale]);

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
      initialRegion={initial}
      // Apple-merket og «Juridisk» skal ikke skjules av kortet.
      mapPadding={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
      onRegionChangeComplete={(r) => {
        setRegion(r);
        if (ownMove.current) {
          ownMove.current = false;
          return;
        }
        if (area && leftArea(r, areaRegion(area, size))) onLeaveArea();
      }}
      onPress={(e) => {
        // Et trykk på en nål gir også et trykk på kartet; bare et trykk utenfor nålene lukker kortet.
        if (e.nativeEvent.action !== "marker-press") onSelect(null);
      }}
      testID="destination-map"
    >
      {clusters.map((c) => {
        const p = c.lead;
        if (c.members.length > 1) {
          const places = c.members.map((m) => `${m.destination.names[locale].city} (${m.destination.iata})`).join(", ");
          return (
            <Marker
              key={`group-${c.id}`}
              identifier={`group-${c.id}`}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              tracksViewChanges={false}
              stopPropagation
              zIndex={1}
              onPress={() => {
                const next = zoomInOn(c.members, fitAspect(region, size), size);
                setRegion(next);
                map.current?.animateToRegion(next, 400);
                onLeaveArea();
              }}
              accessibilityRole="button"
              accessibilityLabel={t.explore.clusterLabel(c.members.length, places)}
              accessibilityHint={t.explore.clusterHint}
              testID={`map-group-${c.id}`}
            >
              <View style={styles.hit}>
                <View style={[styles.pin, styles.group]}>
                  <Text style={[styles.code, { color: colors.white }]} maxFontSizeMultiplier={MAX_PIN_SCALE}>{p.destination.iata}</Text>
                  <View style={styles.count}>
                    <Text style={styles.countText} maxFontSizeMultiplier={MAX_PIN_SCALE}>{`+${c.members.length - 1}`}</Text>
                  </View>
                </View>
              </View>
            </Marker>
          );
        }
        const selected = p.destination.id === selectedId;
        return (
          <Marker
            // Ny nøkkel ved valg: egendefinerte nåler tegnes ikke på nytt når tracksViewChanges er av.
            key={`${p.destination.id}-${selected ? "on" : "off"}`}
            identifier={p.destination.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            tracksViewChanges={false}
            stopPropagation
            zIndex={selected ? 3 : 2}
            onPress={() => onSelect(p.destination.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t.explore.pinLabel(p.destination.names[locale].city, p.destination.iata)}
            accessibilityHint={t.explore.pinHint}
            testID={`map-pin-${p.destination.id}`}
          >
            <View style={styles.hit}>
              <View style={[styles.pin, selected && styles.pinSelected]}>
                <Text style={[styles.code, selected && { color: colors.white }]} maxFontSizeMultiplier={MAX_PIN_SCALE}>{p.destination.iata}</Text>
              </View>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  // 44 pt trykkflate rundt nålen; midten av flaten er flyplassens nøyaktige punkt.
  hit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  pin: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 26, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.bg },
  pinSelected: { backgroundColor: colors.blue, borderColor: colors.white, minHeight: 30, paddingHorizontal: space.md },
  // Ekstra plass til høyre, så merket ikke dekker koden.
  group: { backgroundColor: colors.raised, borderColor: colors.white, paddingRight: space.lg },
  // Antallet som et lite merke i hjørnet, så en gruppe er nesten like smal som en enkelt nål.
  count: { position: "absolute", top: -10, right: -10, minWidth: 22, paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.bg, alignItems: "center" },
  code: { fontSize: 14, lineHeight: 18, fontWeight: "700", letterSpacing: 0.4, color: colors.text, fontVariant: ["tabular-nums"] },
  countText: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
});
