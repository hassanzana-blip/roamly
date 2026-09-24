import type { MapPoint } from "./destinationMap";

/**
 * Kartgeometri for Utforsk-kartet (Apple Maps er Web Mercator). Rene
 * funksjoner, så de kan prøves uten et kart: hvilket utsnitt et område
 * trenger, hvor en flyplass havner på skjermen, hvilke nåler som ville
 * dekke hverandre, og hvordan kartet flyttes så en valgt nål ikke havner
 * under kortet.
 */

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type Size = { width: number; height: number };
export type Coordinate = { latitude: number; longitude: number };

const RAD = Math.PI / 180;
const MAX_LAT = 85;
const clampLat = (lat: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
/** Mercator-y (radianer) for en breddegrad. */
export const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (clampLat(lat) * RAD) / 2));
const latFromMercY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

/**
 * Som Apple Maps: kartets midtpunkt er utsnittets `latitude`, og høyden måles
 * i Mercator symmetrisk rundt det. Halve høyden (Mercator-radianer) for et utsnitt:
 */
const halfHeight = (lat: number, delta: number) => (mercY(lat + delta / 2) - mercY(lat - delta / 2)) / 2;
/** Breddegradsspennet som gir en gitt halv Mercator-høyde rundt `lat`. */
function deltaFor(lat: number, half: number): number {
  let lo = 0;
  let hi = 2 * MAX_LAT;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (halfHeight(lat, mid) < half) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Det tetteste utsnittet der alle punktene står minst `margin` pt fra kanten i
 * et kart på `size` – allerede i kartets sideforhold. `minDelta` (grader bredde)
 * hindrer at ett eller to punkter gir gatenivå.
 */
export function fitRegion(coords: Coordinate[], size: Size, { margin = 36, minDelta = 12 }: { margin?: number; minDelta?: number } = {}): Region {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const top = mercY(Math.max(...lats));
  const bottom = mercY(Math.min(...lats));
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const w = Math.max(size.width - 2 * margin, 1);
  const h = Math.max(size.height - 2 * margin, 1);
  const scale = Math.min(w / Math.max((maxLng - minLng) * RAD, 1e-6), h / Math.max(top - bottom, 1e-6), size.width / (minDelta * RAD));
  const latitude = latFromMercY((top + bottom) / 2);
  return { latitude, longitude: (minLng + maxLng) / 2, latitudeDelta: deltaFor(latitude, size.height / scale / 2), longitudeDelta: Math.min(size.width / scale / RAD, 360) };
}

/**
 * Apple Maps viser minst det utsnittet det blir bedt om, utvidet til kartets
 * sideforhold rundt samme midtpunkt. Samme utvidelse her, så nålene plasseres
 * der kartet faktisk viser dem.
 */
export function fitAspect(r: Region, size: Size): Region {
  if (size.width <= 0 || size.height <= 0) return r;
  const w = r.longitudeDelta * RAD;
  const h = 2 * halfHeight(r.latitude, r.latitudeDelta);
  const scale = Math.min(size.width / w, size.height / h);
  return { latitude: r.latitude, longitude: r.longitude, latitudeDelta: deltaFor(r.latitude, size.height / scale / 2), longitudeDelta: Math.min(size.width / scale / RAD, 360) };
}

/** Punkt → skjermkoordinat (pt) i et kart med utsnittet `r` (allerede tilpasset med fitAspect) og størrelsen `size`. */
export function project(c: Coordinate, r: Region, size: Size): { x: number; y: number } {
  let dLng = c.longitude - r.longitude;
  if (dLng < -180) dLng += 360;
  if (dLng > 180) dLng -= 360;
  const scale = size.width / (r.longitudeDelta * RAD);
  const x = size.width / 2 + dLng * RAD * scale;
  const y = size.height / 2 - (mercY(c.latitude) - mercY(r.latitude)) * scale;
  return { x, y };
}

export type Cluster = { id: string; lead: MapPoint; members: MapPoint[] };

/**
 * Omtrent hvor stor en nål er (pt) med vanlig tekststørrelse: en enkelt nål
 * («BCN») og en gruppe («LHR» med et lite «+1»-merke i hjørnet) er ulikt brede. Med større tekst vokser
 * nålene (høyst 1,4×, som nålenes maxFontSizeMultiplier), og da må de ryddes mer.
 */
export const PIN_BOX = { width: 50, groupWidth: 62, height: 30 };
export const MAX_PIN_SCALE = 1.4;
export function pinBox(members: number, fontScale = 1) {
  const k = Math.min(Math.max(fontScale, 1), MAX_PIN_SCALE);
  return { width: (members > 1 ? PIN_BOX.groupWidth : PIN_BOX.width) * k, height: PIN_BOX.height * k };
}

type Group = { lead: MapPoint; at: { x: number; y: number }; members: MapPoint[]; locked: boolean };
function overlap(a: Group, b: Group, fontScale: number) {
  const wa = pinBox(a.members.length, fontScale);
  const wb = pinBox(b.members.length, fontScale);
  return Math.abs(a.at.x - b.at.x) < (wa.width + wb.width) / 2 && Math.abs(a.at.y - b.at.y) < (wa.height + wb.height) / 2;
}

/**
 * Nåler som ville dekke hverandre, slås sammen til én gruppe. Gruppen står på
 * sin første flyplass (i reisemålslistens rekkefølge) – aldri et gjettet
 * midtpunkt – og viser hvor mange den har. Det valgte reisemålet slås aldri sammen.
 */
export function clusterPoints(points: MapPoint[], r: Region, size: Size, selectedId: string | null = null, fontScale = 1): Cluster[] {
  const shown = fitAspect(r, size);
  const ordered = [...points].sort((a, b) => Number(b.destination.id === selectedId) - Number(a.destination.id === selectedId));
  let groups: Group[] = [];
  for (const p of ordered) {
    const g: Group = { lead: p, at: project(p, shown, size), members: [p], locked: p.destination.id === selectedId };
    const near = g.locked ? undefined : groups.find((x) => !x.locked && overlap(x, g, fontScale));
    if (near) near.members.push(p);
    else groups.push(g);
  }
  // En gruppe er bredere enn en nål: grupper som nå dekker hverandre (eller en nål), slås sammen til ingenting overlapper.
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]!;
        const b = groups[j]!;
        if (a.locked || b.locked || !overlap(a, b, fontScale)) continue;
        a.members.push(...b.members);
        groups = groups.filter((_, k) => k !== j);
        changed = true;
        break outer;
      }
  }
  return groups.map((g) => ({ id: g.members.map((m) => m.destination.id).join("+"), lead: g.lead, members: g.members }));
}

/** Utsnittet et trykk på en gruppe zoomer til: bare medlemmene, og alltid minst tre ganger nærmere enn nå. */
export function zoomInOn(members: Coordinate[], current: Region, size: Size): Region {
  const fit = fitRegion(members, size, { margin: 72, minDelta: 1 });
  if (fit.longitudeDelta <= current.longitudeDelta / 3) return fit;
  const longitudeDelta = current.longitudeDelta / 3;
  return { ...fit, longitudeDelta, latitudeDelta: deltaFor(fit.latitude, (size.height / size.width) * (longitudeDelta * RAD) / 2) };
}

/**
 * Når et reisemål velges, dekker kortet bunnen av kartet (`coveredBottom` pt).
 * Ligger nålen under kortet eller utenfor kartet, flyttes kartet (samme zoom)
 * så nålen står midt i den synlige delen. Ellers `null`: kartet står stille.
 */
export function revealAbove(c: Coordinate, r: Region, size: Size, coveredBottom: number, margin = 24): Region | null {
  const shown = fitAspect(r, size);
  const { x, y } = project(c, shown, size);
  const visibleBottom = size.height - coveredBottom - margin;
  const inside = x >= margin && x <= size.width - margin && y >= margin && y <= visibleBottom;
  if (inside) return null;
  const scale = size.width / (shown.longitudeDelta * RAD);
  const wantY = Math.max(margin, (size.height - coveredBottom) / 2);
  const latitude = latFromMercY(mercY(c.latitude) - (size.height / 2 - wantY) / scale);
  // Samme zoom: samme Mercator-høyde rundt det nye midtpunktet.
  const latitudeDelta = deltaFor(latitude, halfHeight(r.latitude, r.latitudeDelta));
  return { latitude, longitude: c.longitude, latitudeDelta, longitudeDelta: r.longitudeDelta };
}

/** Har kartet åpenbart forlatt området (kunden har dratt eller zoomet)? Da er ingen områdeknapp valgt. */
export function leftArea(visible: Region, area: Region): boolean {
  const dLat = Math.abs(visible.latitude - area.latitude);
  const dLng = Math.abs(visible.longitude - area.longitude);
  const zoom = visible.longitudeDelta / area.longitudeDelta;
  return dLat > area.latitudeDelta / 2 || dLng > area.longitudeDelta / 2 || zoom < 0.4 || zoom > 2.5;
}
