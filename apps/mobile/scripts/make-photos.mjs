// Kopierer HelloSkys godkjente reisefoto fra nettets register
// (public/destinations/*.jpg og public/photos/hero-wing-1280.jpg) inn i appen
// som assets/photos/<id>.jpg, 1080 px brede (skarpt på full bredde på iPhone)
// og komprimert. Samme bilder, samme opphav – se src/lib/destinations.ts for
// hvilket reisemål hvert bilde hører til og hvordan det krediteres (samme
// kilde som nettets register i src/content/photos.ts).
// Kjør fra apps/mobile: node scripts/make-photos.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const Jimp = createRequire(import.meta.url)("jimp-compact");
const pub = path.resolve(here, "../../../public");
const out = path.resolve(here, "../assets/photos");
fs.mkdirSync(out, { recursive: true });

// id i appen → fil i nettets register
const SOURCES = {
  "hero-wing": "photos/hero-wing-1280.jpg",
  paris: "destinations/paris.jpg",
  london: "destinations/london.jpg",
  barcelona: "destinations/barcelona.jpg",
  lisboa: "destinations/lisboa.jpg",
  rome: "destinations/rome.jpg",
  athens: "destinations/athens.jpg",
  malaga: "destinations/malaga.jpg",
  warszawa: "destinations/warsaw.jpg",
  tromso: "destinations/tromso.jpg",
  istanbul: "destinations/istanbul.jpg",
  dubai: "destinations/dubai.jpg",
  beirut: "destinations/beirut.jpg",
  erbil: "destinations/erbil.jpg",
  sulaymaniyah: "destinations/sulaymaniyah.jpg",
  jeddah: "destinations/jeddah.jpg",
  marrakech: "destinations/marrakech.jpg",
  bangkok: "destinations/bangkok.jpg",
  tokyo: "destinations/tokyo.jpg",
  colombo: "destinations/srilanka.jpg",
  delhi: "destinations/delhi.jpg",
  dhaka: "destinations/dhaka.jpg",
  islamabad: "destinations/islamabad.jpg",
  kabul: "destinations/kabul.jpg",
  nyc: "destinations/nyc.jpg",
};

let total = 0;
for (const [id, rel] of Object.entries(SOURCES)) {
  const img = await Jimp.read(path.join(pub, rel));
  if (img.bitmap.width > 1080) img.resize(1080, Jimp.AUTO);
  img.quality(74);
  const file = path.join(out, `${id}.jpg`);
  await img.writeAsync(file);
  total += fs.statSync(file).size;
}
console.log(`skrev ${Object.keys(SOURCES).length} bilder til ${out} (${Math.round(total / 1024)} kB)`);
