import { MAP_AREAS, MAP_POINTS, AREA_OF_AIRPORT, EDGE_AIRPORTS, EDGE_BAND, areaRegion, initialArea, offMapAirports, placeOffMapButtons, pointsIn } from "../lib/destinationMap";
import { clusterPoints, fitAspect, fitRegion, focusOn, project, revealAbove, zoomInOn, leftArea, pinBox, type Cluster, type Region, type Size } from "../lib/mapGeometry";

// Kartets geometri uten et kart: Web Mercator som i Apple Maps, i omtrent den
// kartflaten Utforsk har på iPhone i 375, 390 og 430 pt bredde.
const PHONES: Record<string, Size> = { "375": { width: 375, height: 430 }, "390": { width: 390, height: 470 }, "430": { width: 430, height: 540 } };
const MARGIN = 20;
const inside = (p: { x: number; y: number }, s: Size) => p.x >= MARGIN && p.x <= s.width - MARGIN && p.y >= MARGIN && p.y <= s.height - MARGIN;
const iatas = (c: Cluster[]) => c.flatMap((g) => g.members.map((m) => m.destination.iata)).sort();
/** Ingen to nåler (med sin faktiske bredde: enkelt eller gruppe, og tekststørrelse) dekker hverandre. */
function noOverlap(c: Cluster[], r: Region, size: Size, fontScale = 1) {
  const at = c.map((g) => ({ ...project(g.lead, fitAspect(r, size), size), box: pinBox(g.members.length, fontScale, g.selected), id: g.id }));
  for (let i = 0; i < at.length; i++)
    for (let j = i + 1; j < at.length; j++) {
      const a = at[i]!;
      const b = at[j]!;
      const apart = Math.abs(a.x - b.x) >= (a.box.width + b.box.width) / 2 || Math.abs(a.y - b.y) >= (a.box.height + b.box.height) / 2;
      if (!apart) throw new Error(`nålene ${a.id} og ${b.id} overlapper`);
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

  it.each(Object.keys(PHONES))("hvert område viser sine flyplasser med luft til kanten; de fjerne (Tromsø, Tokyo) har en knapp med navn når de er utenfor (%s pt)", (w) => {
    const size = PHONES[w]!;
    for (const a of MAP_AREAS) {
      const r = areaRegion(a, size);
      const off = offMapAirports(a, r, size).map((o) => o.point.destination.iata);
      for (const p of pointsIn(a)) {
        const edge = (EDGE_AIRPORTS[a] ?? []).includes(p.destination.iata);
        if (edge) expect(off.includes(p.destination.iata) || inside(project(p, r, size), size)).toBe(true);
        else {
          expect(inside(project(p, r, size), size)).toBe(true);
          // Båndet øverst er fritt for nåler når området har knapper der.
          if (EDGE_AIRPORTS[a]) expect(project(p, r, size).y).toBeGreaterThanOrEqual(EDGE_BAND);
        }
      }
    }
    // «Hele verden» viser alle 24 uten knapper.
    const world = areaRegion("world", size);
    for (const p of MAP_POINTS) expect(inside(project(p, world, size), size)).toBe(true);
    expect(offMapAirports("world", world, size)).toEqual([]);
  });

  it("Tromsø er ikke borte fra Europa: knappen «↑ Tromsø» peker nordover, og Tokyo «→» fra Asia", () => {
    for (const size of Object.values(PHONES)) {
      expect(offMapAirports("europe", areaRegion("europe", size), size).map((o) => [o.point.destination.iata, o.arrow])).toEqual([["TOS", "↑"]]);
      const asia = offMapAirports("asia", areaRegion("asia", size), size).map((o) => [o.point.destination.iata, o.arrow]);
      expect(asia).toHaveLength(1);
      expect(asia[0]![0]).toBe("HND");
      expect(["→", "↗", "↘"]).toContain(asia[0]![1]);
    }
  });

  it("Europa åpner nyttig: flyplassene fyller kartet (ikke et tomt midtfelt med alt presset ned)", () => {
    for (const size of Object.values(PHONES)) {
      const r = areaRegion("europe", size);
      const ys = pointsIn("europe").filter((p) => p.destination.iata !== "TOS").map((p) => project(p, r, size).y);
      const xs = pointsIn("europe").filter((p) => p.destination.iata !== "TOS").map((p) => project(p, r, size).x);
      expect((Math.max(...ys) - Math.min(...ys)) / (size.height - EDGE_BAND)).toBeGreaterThan(0.5);
      expect((Math.max(...xs) - Math.min(...xs)) / size.width).toBeGreaterThan(0.6);
      // Midt i kartet er det flyplasser – ikke tomt.
      expect(ys.some((y) => Math.abs(y - (size.height + EDGE_BAND) / 2) < size.height * 0.2)).toBe(true);
    }
  });

  it("Europa åpner på Europa – ikke hele kloden: omtrent 35–70° bredt, ikke 200°", () => {
    for (const size of Object.values(PHONES)) {
      const r = areaRegion("europe", size);
      expect(r.longitudeDelta).toBeGreaterThan(35);
      expect(r.longitudeDelta).toBeLessThan(70);
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

  it("det valgte reisemålet leder alltid sin gruppe – det havner aldri under en annen nål", () => {
    const size = PHONES["375"]!;
    const c = clusterPoints(MAP_POINTS, areaRegion("world", size), size, "sulaymaniyah");
    const sel = c.filter((g) => g.selected);
    expect(sel).toHaveLength(1);
    expect(sel[0]!.lead.destination.id).toBe("sulaymaniyah");
    expect(iatas(c)).toHaveLength(24);
  });
});

describe("valgt nål: aldri dekket, og naboene kan finnes hver for seg (regresjon for 1883e5c)", () => {
  const FONT_SCALES = [1, 1.4];
  const ids = MAP_POINTS.map((p) => p.destination.id);

  it("hvert valgt reisemål × hvert område × 375/390/430 × vanlig og stor tekst: ingen nåler overlapper, den valgte leder sin gruppe, ingen flyplass borte", () => {
    let cases = 0;
    for (const size of Object.values(PHONES))
      for (const fs of FONT_SCALES)
        for (const a of MAP_AREAS)
          for (const id of ids) {
            const r = areaRegion(a, size);
            const c = clusterPoints(MAP_POINTS, r, size, id, fs);
            noOverlap(c, r, size, fs);
            expect(iatas(c)).toHaveLength(24);
            const sel = c.filter((g) => g.selected);
            expect(sel).toHaveLength(1);
            expect(sel[0]!.lead.destination.id).toBe(id);
            cases++;
          }
    expect(cases).toBe(3 * 2 * 5 * 24);
  });

  it("etter valget (focusOn), fra hvert område × 375/390/430 × vanlig og stor tekst: den valgte og hver nabo som dekket den, er egne nåler, synlige over kortet, uten overlapp", () => {
    for (const [w, size] of Object.entries(PHONES))
      for (const fs of FONT_SCALES)
        for (const id of ids)
          for (const a of MAP_AREAS) {
            const cover = fs > 1 ? 260 : 190;
            const home = areaRegion(initialArea(id), size);
            // Fra et videre utsnitt enn reisemålets område starter valget i området (se focusOn).
            const r = fitAspect(areaRegion(a, size), size).longitudeDelta > fitAspect(home, size).longitudeDelta * 1.05 ? home : areaRegion(a, size);
            // Nålene som dekket den valgte direkte (uten gruppering) før valget.
            const shown0 = fitAspect(r, size);
            const p0 = MAP_POINTS.find((p) => p.destination.id === id)!;
            const at0 = project(p0, shown0, size);
            const sb = pinBox(1, fs, true);
            const nb = pinBox(1, fs);
            const covering = MAP_POINTS.filter((q) => q !== p0 && Math.abs(project(q, shown0, size).x - at0.x) < (sb.width + nb.width) / 2 && Math.abs(project(q, shown0, size).y - at0.y) < (sb.height + nb.height) / 2);
            const before = { lead: p0, members: [p0, ...covering] };
            const next = focusOn(id, MAP_POINTS, areaRegion(a, size), size, cover, fs, home) ?? r;
            const shown = fitAspect(next, size);
            const c = clusterPoints(MAP_POINTS, next, size, id, fs);
            noOverlap(c, next, size, fs);
            const where = `${id} i ${a}, ${w} pt, tekst ${fs}`;
            for (const m of before.members) {
              const g = c.find((x) => x.lead === m);
              if (g?.members.length !== 1) throw new Error(`${m.destination.iata} er ikke en egen nål etter valg av ${where}`);
              const at = project(m, shown, size);
              if (!(at.x >= 0 && at.x <= size.width && at.y >= 0 && at.y <= size.height - cover)) throw new Error(`${m.destination.iata} er ikke synlig over kortet etter valg av ${where}`);
            }
            const at = project(before.lead, shown, size);
            expect(at.y).toBeLessThanOrEqual(size.height - cover - 24 + 1e-6);
          }
  });

  it("valgt fra «Hele verden»: kartet går til reisemålets område før naboene skilles", () => {
    const size = PHONES["390"]!;
    const next = focusOn("barcelona", MAP_POINTS, areaRegion("world", size), size, 190, 1, areaRegion("europe", size))!;
    expect(fitAspect(next, size).longitudeDelta).toBeLessThanOrEqual(fitAspect(areaRegion("europe", size), size).longitudeDelta + 1e-9);
  });

  it("eksempel fra gjennomgangen: London valgt i Europa (375 pt) – Paris var skjult bak; etter valget er begge egne nåler", () => {
    const size = PHONES["375"]!;
    const r = areaRegion("europe", size);
    const before = clusterPoints(MAP_POINTS, r, size, "london").find((g) => g.selected)!;
    expect(before.members.map((m) => m.destination.iata)).toEqual(["LHR", "CDG"]);
    const next = focusOn("london", MAP_POINTS, r, size, 190)!;
    const c = clusterPoints(MAP_POINTS, next, size, "london");
    expect(c.find((g) => g.lead.destination.iata === "LHR")?.members).toHaveLength(1);
    expect(c.find((g) => g.lead.destination.iata === "CDG")?.members).toHaveLength(1);
  });
});

describe("knappen for en flyplass utenfor kartet dekker aldri en nål", () => {
  it("hvert område, og etter hvert valg (når kortet er lukket igjen) × 375/390/430 × vanlig og stor tekst", () => {
    let checked = 0;
    for (const [w, size] of Object.entries(PHONES))
      for (const fs of [1, 1.4])
        for (const a of MAP_AREAS)
          for (const id of [null, ...MAP_POINTS.map((p) => p.destination.id)]) {
            // Knappen vises bare uten åpent kort; etter et valg står kartet der valget flyttet det.
            const cover = 0;
            const r0 = areaRegion(a, size);
            const regions = id ? [focusOn(id, MAP_POINTS, r0, size, fs > 1 ? 260 : 190, fs, areaRegion(initialArea(id), size)) ?? r0] : [r0];
            for (const r of regions) {
              const off = offMapAirports(a, r, size).map((o) => ({ side: o.side, text: `${o.arrow} ${o.point.destination.names.nb.city} (${o.point.destination.iata})` }));
              if (!off.length) continue;
              const c = clusterPoints(MAP_POINTS, r, size, null, fs);
              const spots = placeOffMapButtons(off, c, r, size, cover, fs);
              const shown = fitAspect(r, size);
              for (const s of spots) {
                if (!(s.left >= 0 && s.left + s.width <= size.width && s.top >= 0 && s.top + s.height <= size.height - cover)) throw new Error(`knappen er utenfor kartet: ${a}, ${id}, ${w} pt, tekst ${fs}`);
                for (const g of c) {
                  const at = project(g.lead, shown, size);
                  const b = pinBox(g.members.length, fs);
                  const hit = at.x + b.width / 2 > s.left && at.x - b.width / 2 < s.left + s.width && at.y + b.height / 2 > s.top && at.y - b.height / 2 < s.top + s.height;
                  if (hit) throw new Error(`knappen dekker ${g.id}: ${a}, valgt ${id}, ${w} pt, tekst ${fs}`);
                }
                checked++;
              }
            }
          }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("kortet over kartet", () => {
  const size = PHONES["390"]!;
  const cover = 190;

  it("en nål som allerede er synlig over kortet (Warszawa, nord i Europa): kartet står stille", () => {
    const r = areaRegion("europe", size);
    const waw = MAP_POINTS.find((p) => p.destination.iata === "WAW")!;
    expect(revealAbove(waw, r, size, cover)).toBeNull();
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
