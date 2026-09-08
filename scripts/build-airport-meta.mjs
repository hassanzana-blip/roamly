// Bygger flyplassregisteret fra OurAirports (public domain).
//
// OurAirports har ~80 000 oppføringer og CSV-en er 12 MB. Ingenting av det
// skal til nettleseren. Denne skriver et komprimert JSON-register som bare
// serveren leser, med flyplasser som faktisk har rutetrafikk og IATA-kode.
//
//   node scripts/build-airport-meta.mjs [sti/til/airports.csv countries.csv]
//
// Kjøres manuelt når registeret skal oppdateres, ikke ved hver bygg: dataene
// endrer seg sjelden, og bygget skal ikke være avhengig av nettverk.
import fs from "node:fs/promises";
import path from "node:path";

const SRC = process.argv[2] ?? "/tmp/airports.csv";
const COUNTRIES = process.argv[3] ?? "/tmp/countries.csv";
const OUT = path.resolve("api/data/airports-meta.json");

/** Minimal CSV-leser for OurAirports-formatet: sitattegn, komma, ingen linjeskift i felt. */
function parseCsv(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
        } else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const [countryHead, ...countryRows] = parseCsv(await fs.readFile(COUNTRIES, "utf8"));
const cCode = countryHead.indexOf("code");
const cName = countryHead.indexOf("name");
const countryName = new Map(countryRows.map((r) => [r[cCode], r[cName]]));

const [head, ...rows] = parseCsv(await fs.readFile(SRC, "utf8"));
const col = Object.fromEntries(head.map((h, i) => [h, i]));

// Bare flyplasser med rutetrafikk og IATA-kode: det er de en kunde kan fly til.
const out = [];
for (const r of rows) {
  const iata = (r[col.iata_code] ?? "").trim().toUpperCase();
  if (iata.length !== 3) continue;
  if (r[col.scheduled_service] !== "yes") continue;
  const type = r[col.type];
  if (type !== "large_airport" && type !== "medium_airport") continue;
  const cc = r[col.iso_country];
  out.push({
    i: iata,
    k: (r[col.icao_code] ?? "").trim().toUpperCase() || undefined,
    n: r[col.name],
    c: r[col.municipality] || r[col.name],
    y: countryName.get(cc) ?? cc,
    cc,
    r: r[col.iso_region],
    la: Math.round(Number(r[col.latitude_deg]) * 1e4) / 1e4,
    lo: Math.round(Number(r[col.longitude_deg]) * 1e4) / 1e4,
    b: type === "large_airport" ? 1 : 0,
  });
}
out.sort((a, b) => (b.b - a.b) || a.i.localeCompare(b.i));
await fs.writeFile(OUT, JSON.stringify(out));
const kb = Math.round((await fs.stat(OUT)).size / 1024);
console.log(`[airport-meta] ${out.length} flyplasser med rutetrafikk → ${OUT} (${kb} kB)`);
