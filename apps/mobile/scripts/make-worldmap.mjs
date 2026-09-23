// Lager assets/world-dots.png: et prikket verdenskart (hvite prikker på
// transparent) som diskret tekstur bak de mørke toppfeltene i appen.
// Landområdene kommer fra world-atlas (Natural Earth 1:110m, offentlig
// eiendom), som nettet allerede har i rotens node_modules.
// Kjør fra apps/mobile: node scripts/make-worldmap.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootRequire = createRequire(path.resolve(here, "../../../package.json"));
const { geoContains } = await import(rootRequire.resolve("d3-geo"));
const { feature } = await import(rootRequire.resolve("topojson-client"));
const land = feature(rootRequire("world-atlas/land-110m.json"), rootRequire("world-atlas/land-110m.json").objects.land);
const Jimp = createRequire(import.meta.url)("jimp-compact");

// Ekvirektangulær projeksjon, uten Antarktis: lengdegrad −180…180, breddegrad 80…−58.
const W = 1200;
const LAT_TOP = 80;
const LAT_BOTTOM = -58;
const STEP = 12; // piksler mellom prikkene
const H = Math.round((W * (LAT_TOP - LAT_BOTTOM)) / 360);
const R = 2.2; // prikkradius

const img = new Jimp(W, H, 0x00000000);
for (let y = STEP / 2; y < H; y += STEP) {
  for (let x = STEP / 2; x < W; x += STEP) {
    const lon = (x / W) * 360 - 180;
    const lat = LAT_TOP - (y / H) * (LAT_TOP - LAT_BOTTOM);
    if (!geoContains(land, [lon, lat])) continue;
    // Myk kant: alfa faller av mot prikkens rand.
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy);
        const a = Math.max(0, Math.min(1, R + 0.5 - d));
        if (a <= 0) continue;
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        img.setPixelColor(Jimp.rgbaToInt(255, 255, 255, Math.round(255 * a)), px, py);
      }
    }
  }
}
const out = path.resolve(here, "../assets/world-dots.png");
await img.writeAsync(out);
console.log(`skrev ${out} (${W}×${H})`);
