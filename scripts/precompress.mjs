// Forhåndskomprimerer det bygde frontend-bygget.
//
// Statiske filer ble servert ukomprimert: react-vendor alene var 348 kB over
// nettet i stedet for 110. Nå skrives .br og .gz ved siden av hver
// komprimerbar fil, og serveStatic({ precompressed: true }) velger den
// varianten klienten sier den forstår. Ingen CPU-kostnad per forespørsel, og
// bedre ratio enn komprimering i farten (brotli på nivå 11).
import { brotliCompress, gzip, constants } from "node:zlib";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const br = promisify(brotliCompress);
const gz = promisify(gzip);

const DIR = process.argv[2] ?? "dist/public";
/** Bare filtyper der komprimering faktisk gir noe. Bilder og fonter er alt komprimert. */
const EXT = new Set([".js", ".css", ".html", ".json", ".svg", ".txt", ".xml", ".webmanifest", ".map"]);
const MIN_BYTES = 1024;

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let files = 0;
let before = 0;
let after = 0;

for await (const file of walk(DIR)) {
  if (!EXT.has(path.extname(file))) continue;
  if (file.endsWith(".br") || file.endsWith(".gz")) continue;
  const buf = await fs.readFile(file);
  if (buf.length < MIN_BYTES) continue;
  const [b, g] = await Promise.all([
    br(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }),
    gz(buf, { level: 9 }),
  ]);
  await Promise.all([fs.writeFile(`${file}.br`, b), fs.writeFile(`${file}.gz`, g)]);
  files += 1;
  before += buf.length;
  after += b.length;
}

const kb = (n) => `${Math.round(n / 1024)} kB`;
console.log(`[precompress] ${files} filer: ${kb(before)} → ${kb(after)} brotli (${Math.round((1 - after / before) * 100)} % mindre)`);
