// Lager app-ikon og splash fra HelloSky-merket (samme sti som nettets SkyMark):
// hvit «H» på azur (ikon, fullflate kvadrat – iOS runder hjørnene selv) og
// azur «H» på transparent (splash). Kjør: node scripts/make-icons.cjs
const Jimp = require("jimp-compact");
const path = require("path");

const AZURE = 0x1164e8ff;
const SS = 4; // supersampling
const OUT = 1024;
const N = OUT * SS;

// Stien fra src/lib/theme.ts (SKY_MARK_PATH), med buen som punkter.
function markPolygon() {
  const pts = [[8, 16], [36, 8], [36, 34], [64, 34], [64, 22], [92, 28], [92, 92], [64, 92], [64, 60]];
  // A14 14 0 0 0 36 60: fra (64,60) mot klokka over toppen (50,46) til (36,60)
  for (let i = 1; i < 48; i++) {
    const a = (i / 48) * Math.PI; // 0..π
    pts.push([50 + 14 * Math.cos(a), 60 - 14 * Math.sin(a)]);
  }
  pts.push([36, 60], [36, 92], [8, 92]);
  return pts;
}

function rasterize(scaleFrac) {
  // Merket er 84 enheter bredt (8–92) og fyller scaleFrac av bredden, sentrert.
  const s = (scaleFrac * N) / 84;
  const poly = markPolygon().map(([x, y]) => [N / 2 + (x - 50) * s, N / 2 + (y - 50) * s]);
  const mask = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5));
      const to = Math.min(N - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = from; x <= to; x++) mask[y * N + x] = 1;
    }
  }
  return mask;
}

async function render(file, { bg, fg, scaleFrac, opaque = false }) {
  const mask = rasterize(scaleFrac);
  const img = new Jimp(OUT, OUT, bg);
  const [fr, fgG, fb, fa] = [(fg >>> 24) & 255, (fg >>> 16) & 255, (fg >>> 8) & 255, fg & 255];
  const [br, bgG, bb, ba] = [(bg >>> 24) & 255, (bg >>> 16) & 255, (bg >>> 8) & 255, bg & 255];
  for (let y = 0; y < OUT; y++) {
    for (let x = 0; x < OUT; x++) {
      let c = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) c += mask[(y * SS + sy) * N + x * SS + sx];
      const t = c / (SS * SS);
      const mix = (a, b) => Math.round(a + (b - a) * t);
      img.setPixelColor(Jimp.rgbaToInt(mix(br, fr), mix(bgG, fgG), mix(bb, fb), mix(ba, fa)), x, y);
    }
  }
  // App Store avviser app-ikoner med alfakanal: ikonet skrives som RGB.
  if (opaque) img.rgba(false);
  await img.writeAsync(path.resolve(__dirname, "..", "assets", file));
}

(async () => {
  await render("icon.png", { bg: AZURE, fg: 0xffffffff, scaleFrac: 0.52, opaque: true });
  await render("splash-icon.png", { bg: 0x1164e800, fg: AZURE, scaleFrac: 0.6 });
  console.log("assets/icon.png og assets/splash-icon.png skrevet");
})();
