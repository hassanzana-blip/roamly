import { MAP_AREAS, MAP_POINTS, AREA_OF_AIRPORT, areaRegion, initialArea, pointsIn } from "../lib/destinationMap";
import { clusterPoints, fitAspect, fitRegion, project, revealAbove, zoomInOn, leftArea, pinBox, type Cluster, type Region, type Size } from "../lib/mapGeometry";

// Kartets geometri uten et kart: Web Mercator som i Apple Maps, i omtrent den
// kartflaten Utforsk har på iPhone i 375, 390 og 430 pt bredde.
const PHONES: Record<string, Size> = { "375": { width: 375, height: 430 }, "390": { width: 390, height: 470 }, "430": { width: 430, height: 540 } };
const MARGIN = 20;
const inside = (p: { x: number; y: number }, s: Size) => p.x >= MARGIN && p.x <= s.width - MARGIN && p.y >= MARGIN && p.y <= s.height - MARGIN;
const iatas = (c: Cluster[]) => c.flatMap((g) => g.members.map((m) => m.destination.iata)).sort();
/** Ingen to nåler (med sin faktiske bredde: enkelt eller gruppe, og tekststørrelse) dekker hverandre. */
function noOverlap(c: Cluster[], r: Region, size: Size, fontScale = 1) {
  const at = c.map((g) => ({ ...project(g.lead, fitAspect(r, size), size), box: pinBox(g.members.length, fontScale) }));
  for (let i = 0; i < at.length; i++)
    for (let j = i + 1; j < at.length; j++) {
      const a = at[i]!;
      const b = at[j]!;
      expect(Math.abs(a.x - b.x) >= (a.box.width + b.box.width) / 2 || Math.abs(a.y - b.y) >= (a.box.height + b.box.height) / 2).toBe(true);
    }
}

describe("områder", () => {
  it("hver flyplass hører til nøyaktig ett område; områdene til sammen er alle 24 reisemålene", () => {
    expect(Object.keys(AREA_OF_AIRPORT).sort()).toEqual(MAP_POINTS.map((p) => p.destination.iata).sort());
    const parts = MAP_AREAS.filter((a) => a !== "world").map((a) => pointsIn(a).length);
    expect(parts).toEqual([11, 5, 7, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(MAP_POINTS.length);
    expect(pointsIn("world")).toHaveLength(24);
  });

  it("kartet åpner i Europa, eller i området til reisemålet som er valgt", () => {
    expect(initialArea(null)).toBe("europe");
    expect(initialArea("tokyo")).toBe("asia");
    expect(initialArea("erbil")).toBe("middleEast");
    expect(initialArea("nyc")).toBe("americas");
  });

  it.each(Object.keys(PHONES))("hvert område (også hele verden) viser alle sine flyplasser med luft til kanten (%s pt)", (w) => {
    const size = PHONES[w]!;
    for (const a of MAP_AREAS) {
      const r = areaRegion(a, size);
      for (const p of pointsIn(a)) expect(inside(project(p, r, size), size)).toBe(true);
    }
  });

  it("Europa åpner på Europa – ikke hele kloden: omtrent 50–70° bredt, ikke 200°", () => {
    for (const size of Object.values(PHONES)) {
      const r = areaRegion("europe", size);
      expect(r.longitudeDelta).toBeGreaterThan(40);
      expect(r.longitudeDelta).toBeLessThan(75);
    }
  });

  it("ett reisemål (New York) gir et utsnitt på minst 12° bredde, ikke gatenivå", () => {
    const r = areaRegion("americas", PHONES["390"]!);
    expect(r.longitudeDelta).toBeGreaterThanOrEqual(12);
    expect(r.latitude).toBeCloseTo(40.64, 1);
    expect(r.longitude).toBeCloseTo(-73.78, 1);
  });
});

describe("rydding av nåler", () => {
  it.each(Object.keys(PHONES))("hvert område (%s pt): ingen synlige nåler dekker hverandre, og ingen flyplass forsvinner", (w) => {
    const size = PHONES[w]!;
    for (const a of MAP_AREAS) {
      const r = areaRegion(a, size);
      const c = clusterPoints(pointsIn(a), r, size);
      expect(iatas(c)).toEqual(pointsIn(a).map((p) => p.destination.iata).sort());
      noOverlap(c, r, size);
      // Gruppens nål står på en ekte flyplass (den første), aldri et gjettet midtpunkt.
      for (const g of c) expect(g.members[0]).toBe(g.lead);
    }
  });

  it.each(Object.keys(PHONES))("stor tekst (nåler 1,4× så store, %s pt): fortsatt ingen overlapp, og ingen flyplass forsvinner", (w) => {
    const size = PHONES[w]!;
    for (const a of MAP_AREAS) {
      const r = areaRegion(a, size);
      const c = clusterPoints(pointsIn(a), r, size, null, 2);
      expect(iatas(c)).toEqual(pointsIn(a).map((p) => p.destination.iata).sort());
      noOverlap(c, r, size, 2);
    }
  });

  it("Europa: de fleste flyplassene er egne nåler; bare svært nære par blir grupper", () => {
    for (const size of Object.values(PHONES)) {
      const c = clusterPoints(pointsIn("europe"), areaRegion("europe", size), size);
      expect(c.length).toBeGreaterThanOrEqual(7);
      expect(Math.max(...c.map((g) => g.members.length))).toBeLessThanOrEqual(2);
    }
  });

  it("hele verden: nære flyplasser blir grupper (færre nåler enn 24)", () => {
    const size = PHONES["375"]!;
    expect(clusterPoints(MAP_POINTS, areaRegion("world", size), size).length).toBeLessThan(MAP_POINTS.length);
  });

  it("Erbil og Sulaymaniyah (1,4° fra hverandre) er gruppert i Midtøsten-utsnittet; høyst to trykk (hvert minst 3× nærmere) gjør dem til egne nåler", () => {
    for (const size of Object.values(PHONES)) {
      let r = areaRegion("middleEast", size);
      const single = (iata: string, c: Cluster[]) => c.find((g) => g.lead.destination.iata === iata)?.members.length === 1;
      let c = clusterPoints(pointsIn("middleEast"), r, size);
      expect(single("EBL", c) && single("ISU", c)).toBe(false);
      let taps = 0;
      while (!(single("EBL", c) && single("ISU", c)) && taps < 2) {
        const g = c.find((x) => x.members.length > 1 && x.members.some((m) => m.destination.iata === "ISU" || m.destination.iata === "EBL"))!;
        const next = zoomInOn(g.members, r, size);
        expect(next.longitudeDelta).toBeLessThanOrEqual(r.longitudeDelta / 3 + 1e-9);
        for (const m of g.members) expect(inside(project(m, fitAspect(next, size), size), size)).toBe(true);
        r = next;
        c = clusterPoints(pointsIn("middleEast"), r, size);
        taps++;
      }
      expect(single("EBL", c) && single("ISU", c)).toBe(true);
    }
  });

  it("det valgte reisemålet slås aldri sammen med andre", () => {
    const size = PHONES["375"]!;
    const c = clusterPoints(MAP_POINTS, areaRegion("world", size), size, "sulaymaniyah");
    expect(c.find((g) => g.lead.destination.id === "sulaymaniyah")?.members).toHaveLength(1);
    expect(iatas(c)).toHaveLength(24);
  });
});

describe("kortet over kartet", () => {
  const size = PHONES["390"]!;
  const cover = 190;

  it("en nål som allerede er synlig over kortet: kartet står stille", () => {
    const r = areaRegion("europe", size);
    const tos = MAP_POINTS.find((p) => p.destination.iata === "TOS")!;
    expect(revealAbove(tos, r, size, cover)).toBeNull();
  });

  it("en nål som kortet dekker, flyttes opp i den synlige delen – samme zoom, samme flyplass", () => {
    const r = areaRegion("europe", size);
    const agp = MAP_POINTS.find((p) => p.destination.iata === "AGP")!;
    expect(project(agp, r, size).y).toBeGreaterThan(size.height - cover - 24);
    const next = revealAbove(agp, r, size, cover)!;
    expect(next.longitudeDelta).toBe(r.longitudeDelta);
    const at = project(agp, fitAspect(next, size), size);
    expect(at.y).toBeLessThan(size.height - cover - 24);
    expect(at.y).toBeGreaterThan(24);
    expect(at.x).toBeCloseTo(size.width / 2, 0);
  });

  it("et område regnes som forlatt først når kartet er dratt eller zoomet tydelig bort", () => {
    const e = areaRegion("europe", size);
    expect(leftArea(e, e)).toBe(false);
    expect(leftArea({ ...e, latitude: e.latitude - 2 }, e)).toBe(false);
    expect(leftArea({ ...e, longitude: e.longitude + e.longitudeDelta }, e)).toBe(true);
    expect(leftArea({ ...e, longitudeDelta: e.longitudeDelta / 4, latitudeDelta: e.latitudeDelta / 4 }, e)).toBe(true);
  });

  it("fitRegion: to punkter nær hverandre gir ikke gatenivå (minst minDelta)", () => {
    const r = fitRegion([{ latitude: 36.2, longitude: 43.9 }, { latitude: 35.6, longitude: 45.3 }], size, { minDelta: 12 });
    expect(r.longitudeDelta).toBeCloseTo(12, 5);
  });
});
