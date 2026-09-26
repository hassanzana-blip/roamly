import { useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Pressable, Text } from "./a11y";
import type { DestinationMapProps } from "./DestinationMap";
import { areaRegion, initialArea, offMapAirports, placeOffMapButtons } from "../lib/destinationMap";
import { MAX_PIN_SCALE, clusterPoints, fitAspect, fitRegion, focusOn, leftArea, zoomInOn, type Cluster, type Region, type Size } from "../lib/mapGeometry";
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

function AppleMap({ points, selectedId, onSelect, bottomInset, area, areaRequest, onLeaveArea, fitToPoints, size }: DestinationMapProps & { size: Size }) {
  const { t, locale } = useI18n();
  const lang = useA11yLanguage();
  const map = useRef<MapView>(null);
  // Med et aktivt søk åpner kartet på treffene; ellers på området.
  const [initial] = useState<Region>(() => (fitToPoints && points.length ? fitRegion(points, size) : areaRegion(area ?? "world", size)));
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

  // Søket endret treffene: tilpass kartet til dem (minst 12° bredt, så ett treff ikke gir gatenivå).
  // Husker hvilke treff kartet sist ble tilpasset, men bare mens søket står: når søket tømmes,
  // glemmes det, så et nytt søk – også det samme som før – alltid flytter kartet til treffene.
  // Åpnet midt i et søk starter kartet allerede på treffene (initial), så da flyttes det ikke.
  const pointsKey = points.map((p) => p.destination.id).join(",");
  const fittedKey = useRef<string | null>(fitToPoints ? pointsKey : null);
  useEffect(() => {
    if (!fitToPoints) {
      fittedKey.current = null;
      return;
    }
    if (!points.length || pointsKey === fittedKey.current) return;
    fittedKey.current = pointsKey;
    moveTo(fitRegion(points, size), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, fitToPoints]);

  // Større tekst gir større nåler; da ryddes det mer (høyst 1,4×, som nålenes tekst).
  const fontScale = PixelRatio.getFontScale();

  // Valgt reisemål: zoom inn til den valgte nålen og naboene som dekket den, er egne nåler,
  // og flytt kartet så nålen står over kortet. Står stille hvis ingenting må endres.
  useEffect(() => {
    if (!selectedId || bottomInset <= 0) return;
    const next = focusOn(selectedId, points, region, size, bottomInset, fontScale, areaRegion(initialArea(selectedId), size));
    if (next) moveTo(next, 350);
    // Bare når valget eller kortets høyde endres – ikke for hver kartbevegelse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, bottomInset]);

  const clusters = useMemo(() => clusterPoints(points, region, size, selectedId, fontScale), [points, region, size, selectedId, fontScale]);

  const cityOf = (c: Cluster) => c.lead.destination.names[locale].city;
  const placesOf = (ms: Cluster["members"]) => ms.map((m) => `${m.destination.names[locale].city} (${m.destination.iata})`).join(", ");
  const coordinateOf = (c: Cluster) => ({ latitude: c.lead.latitude, longitude: c.lead.longitude });
  const zoomTo = (c: Cluster) => {
    const next = zoomInOn(c.members, fitAspect(region, size), size);
    setRegion(next);
    map.current?.animateToRegion(next, 400);
    onLeaveArea();
  };

  const pinMarker = (c: Cluster) => (
    <Marker
      key={`${c.lead.destination.id}-off`}
      identifier={c.lead.destination.id}
      coordinate={coordinateOf(c)}
      tracksViewChanges={false}
      stopPropagation
      zIndex={2}
      onPress={() => onSelect(c.lead.destination.id)}
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      accessibilityLabel={t.explore.pinLabel(cityOf(c), c.lead.destination.iata)}
      accessibilityHint={t.explore.pinHint}
      testID={`map-pin-${c.lead.destination.id}`}
    >
      <View style={styles.hit}>
        <View style={styles.pin}>
          <Text style={styles.code} maxFontSizeMultiplier={MAX_PIN_SCALE}>{c.lead.destination.iata}</Text>
        </View>
      </View>
    </Marker>
  );

  const groupMarker = (c: Cluster) => (
    <Marker
      key={`group-${c.id}`}
      identifier={`group-${c.id}`}
      coordinate={coordinateOf(c)}
      tracksViewChanges={false}
      stopPropagation
      zIndex={1}
      onPress={() => zoomTo(c)}
      accessibilityRole="button"
      accessibilityLabel={t.explore.clusterLabel(c.members.length, placesOf(c.members))}
      accessibilityHint={t.explore.clusterHint}
      testID={`map-group-${c.id}`}
    >
      <View style={styles.hit}>
        <View style={[styles.pin, styles.group]}>
          <Text style={[styles.code, { color: colors.white }]} maxFontSizeMultiplier={MAX_PIN_SCALE}>{c.lead.destination.iata}</Text>
          <View style={styles.count}>
            <Text style={styles.countText} maxFontSizeMultiplier={MAX_PIN_SCALE}>{`+${c.members.length - 1}`}</Text>
          </View>
        </View>
      </View>
    </Marker>
  );

  // Den valgte nålen er alltid synlig og øverst. Har den naboer tett inntil (før kartet har
  // zoomet inn), viser den «+N», og et trykk zoomer til de er egne nåler.
  const selectedMarker = (c: Cluster) => {
    const others = c.members.slice(1);
    const label = t.explore.pinLabel(cityOf(c), c.lead.destination.iata);
    return (
      <Marker
        // Ny nøkkel ved valg og ved endret gruppe: egendefinerte nåler tegnes ikke på nytt når tracksViewChanges er av.
        key={`${c.id}-on`}
        identifier={c.lead.destination.id}
        coordinate={coordinateOf(c)}
        tracksViewChanges={false}
        stopPropagation
        zIndex={3}
        onPress={() => {
          if (others.length) zoomTo(c);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        accessibilityLabel={others.length ? t.explore.selectedWithNeighbours(label, placesOf(others)) : label}
        accessibilityHint={others.length ? t.explore.clusterHint : undefined}
        testID={others.length ? `map-group-${c.id}` : `map-pin-${c.lead.destination.id}`}
      >
        <View style={styles.hit}>
          <View style={[styles.pin, styles.pinSelected]}>
            <Text style={[styles.code, { color: colors.white }]} maxFontSizeMultiplier={MAX_PIN_SCALE}>{c.lead.destination.iata}</Text>
            {others.length ? (
              <View style={styles.count}>
                <Text style={styles.countText} maxFontSizeMultiplier={MAX_PIN_SCALE}>{`+${others.length}`}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Marker>
    );
  };

  // Fjerne flyplasser i området som ikke er på kartet (Tromsø fra Europa, Tokyo fra Asia): en knapp med navn.
  // Bare når ingen reisemål er valgt: med kortet åpent er det for lite kart til en knapp til
  // (særlig med stor tekst). Lukkes kortet, er knappen der igjen.
  const offMap = (selectedId ? [] : offMapAirports(area, region, size)).map((o) => {
    const n = o.point.destination.names[locale];
    return { ...o, city: n.city, text: `${o.arrow} ${n.city} (${o.point.destination.iata})` };
  });
  // Aldri over en nål: knappen flyttes til en ledig plass øverst.
  const offMapSpots = placeOffMapButtons(offMap, clusters, region, size, bottomInset, fontScale);

  return (
    <>
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
      {clusters.map((c) => (c.selected ? selectedMarker(c) : c.members.length > 1 ? groupMarker(c) : pinMarker(c)))}
    </MapView>
    {offMap.map((o, i) => (
      <Pressable
        key={o.point.destination.id}
        onPress={() => onSelect(o.point.destination.id)}
        accessibilityRole="button"
        accessibilityLabel={t.explore.offMapLabel(o.city, o.point.destination.iata)}
        accessibilityHint={t.explore.pinHint}
        testID={`map-off-${o.point.destination.id}`}
        style={({ pressed }) => [styles.edgeButton, { left: offMapSpots[i]!.left, top: offMapSpots[i]!.top }, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.edgeText} maxFontSizeMultiplier={MAX_PIN_SCALE} numberOfLines={1}>{o.text}</Text>
      </Pressable>
    ))}
    </>
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
  // Knapp for en flyplass utenfor kartet; plassen velges så den aldri dekker en nål (placeOffMapButtons).
  edgeButton: { position: "absolute", minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.onDarkMuted },
  edgeText: { fontSize: 14, lineHeight: 18, fontWeight: "700", color: colors.white },
  code: { fontSize: 14, lineHeight: 18, fontWeight: "700", letterSpacing: 0.4, color: colors.text, fontVariant: ["tabular-nums"] },
  countText: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
});
