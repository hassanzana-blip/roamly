import { useMemo, useState } from "react";
import { geoCentroid, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { Minus, Plus } from "lucide-react";
import world from "world-atlas/countries-110m.json";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The discovery map: sand-coloured land on a pale sea, one price pin per
 * destination in view. Land comes from Natural Earth (world-atlas, public
 * domain) and is drawn as plain SVG, so it needs no tile provider, no API key
 * and no third-party requests. Pins are HTML buttons laid over the SVG, so
 * they are real, focusable controls with the live price as their name.
 *
 * The projection fits whatever destinations are currently shown, so a
 * Europe-only selection zooms in while «Langtur» shows the world.
 */

type Pin = { id: string; label: string; price: string | null; lat: number; lng: number };

const COUNTRY_NB: Record<string, string> = {
  Norway: "Norge", Sweden: "Sverige", Denmark: "Danmark", Finland: "Finland", Iceland: "Island",
  "United Kingdom": "Storbritannia", Ireland: "Irland", France: "Frankrike", Spain: "Spania", Portugal: "Portugal",
  Italy: "Italia", Germany: "Tyskland", Poland: "Polen", Netherlands: "Nederland", Belgium: "Belgia", Switzerland: "Sveits",
  Austria: "Østerrike", Greece: "Hellas", Turkey: "Türkiye", Morocco: "Marokko", Egypt: "Egypt", Ukraine: "Ukraina",
  Romania: "Romania", Hungary: "Ungarn", "Czech Republic": "Tsjekkia", Czechia: "Tsjekkia", Croatia: "Kroatia", Serbia: "Serbia",
  Bulgaria: "Bulgaria", Lebanon: "Libanon", Iraq: "Irak", "Saudi Arabia": "Saudi-Arabia", "United Arab Emirates": "Emiratene",
  Iran: "Iran", India: "India", Pakistan: "Pakistan", Afghanistan: "Afghanistan", Bangladesh: "Bangladesh", "Sri Lanka": "Sri Lanka",
  Thailand: "Thailand", Japan: "Japan", China: "Kina", Russia: "Russland", "United States of America": "USA", Canada: "Canada",
  Mexico: "Mexico", Brazil: "Brasil", Algeria: "Algerie", Libya: "Libya", Tunisia: "Tunisia", Eritrea: "Eritrea", Ethiopia: "Etiopia",
  Sudan: "Sudan", Kazakhstan: "Kasakhstan", Mongolia: "Mongolia", Australia: "Australia", Indonesia: "Indonesia", Vietnam: "Vietnam",
  Myanmar: "Myanmar", Syria: "Syria", Jordan: "Jordan", Israel: "Israel", Georgia: "Georgia", Azerbaijan: "Aserbajdsjan",
};

const SEA_LABELS: { name: string; lat: number; lng: number }[] = [
  { name: "Atlanterhavet", lat: 46, lng: -18 },
  { name: "Middelhavet", lat: 36.5, lng: 16 },
  { name: "Nordsjøen", lat: 56.5, lng: 3 },
];

const LAND: FeatureCollection<Geometry, { name: string }> = feature(
  world as unknown as Topology,
  (world as unknown as Topology).objects.countries as GeometryCollection<{ name: string }>,
);

export default function DiscoveryMap({
  pins,
  selected,
  onSelect,
  className,
}: {
  pins: Pin[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  const t = useT();
  const [zoom, setZoom] = useState(1);
  const W = 800;
  const H = 640;

  const { path, project } = useMemo(() => {
    const points: FeatureCollection = {
      type: "FeatureCollection",
      features: pins.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
    };
    const projection = geoMercator();
    if (pins.length >= 2) projection.fitExtent([[90, 70], [W - 90, H - 70]], points as GeoPermissibleObjects);
    else if (pins.length === 1) projection.center([pins[0].lng, pins[0].lat]).scale(900).translate([W / 2, H / 2]);
    else projection.center([12, 50]).scale(520).translate([W / 2, H / 2]);
    // Never closer than a country, never further than the whole world.
    projection.scale(Math.min(Math.max(projection.scale(), 110), 1400) * zoom);
    const cx = W / 2;
    const cy = H / 2;
    const [tx, ty] = projection.translate();
    projection.translate([cx + (tx - cx) * zoom, cy + (ty - cy) * zoom]);
    return { path: geoPath(projection), project: (lng: number, lat: number) => projection([lng, lat]) ?? [NaN, NaN] };
  }, [pins, zoom]);

  const labels = useMemo(() => {
    return LAND.features
      .map((f: Feature<Geometry, { name: string }>) => {
        const nb = COUNTRY_NB[f.properties.name];
        if (!nb) return null;
        const [lng, lat] = geoCentroid(f);
        const [x, y] = project(lng, lat);
        const area = Math.abs(path.area(f));
        if (!Number.isFinite(x) || x < 30 || x > W - 30 || y < 30 || y > H - 30 || area < 900) return null;
        return { name: nb, x, y };
      })
      .filter((l): l is { name: string; x: number; y: number } => l !== null);
  }, [path, project]);

  return (
    <div className={cn("map-sea relative overflow-hidden rounded-[22px]", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-label={t("home.map.aria")}>
        <g>
          {LAND.features.map((f: Feature<Geometry, { name: string }>, i: number) => (
            <path key={(f.id as string) ?? i} d={path(f) ?? undefined} className="fill-[hsl(42_45%_93%)] stroke-white/90 dark:fill-[hsl(349_10%_22%)] dark:stroke-white/10" strokeWidth={0.8} />
          ))}
        </g>
        <g className="pointer-events-none select-none">
          {SEA_LABELS.map((s) => {
            const [x, y] = project(s.lng, s.lat);
            if (!Number.isFinite(x) || x < 40 || x > W - 40 || y < 20 || y > H - 20) return null;
            return (
              <text key={s.name} x={x} y={y} textAnchor="middle" className="fill-[hsl(206_30%_55%)] text-[15px] italic" style={{ fontFamily: "inherit" }}>
                {s.name}
              </text>
            );
          })}
          {labels.map((l) => (
            <text key={l.name} x={l.x} y={l.y} textAnchor="middle" className="fill-foreground/75 text-[15px] font-medium dark:fill-white/70" style={{ fontFamily: "inherit" }}>
              {l.name}
            </text>
          ))}
        </g>
      </svg>

      {/* Pins as real buttons: the price is the accessible name. */}
      {pins.map((p) => {
        const [x, y] = project(p.lng, p.lat);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const on = p.id === selected;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(on ? null : p.id)}
            aria-pressed={on}
            aria-label={`${p.label}${p.price ? ` · ${p.price}` : ""}`}
            className={cn(
              "absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center outline-none",
              "focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-ring",
            )}
            style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
          >
            <span
              className={cn(
                "t-num whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] font-medium shadow-soft transition-colors",
                on ? "bg-primary text-primary-foreground" : "bg-white text-foreground hover:bg-blush",
              )}
            >
              {p.price ? capitalizeFirst(p.price.replace(/^fra\s/, "")) : p.label}
            </span>
            <span className={cn("mt-1 size-2.5 rounded-full border-2 border-white shadow-sm", on ? "bg-primary" : "bg-foreground")} aria-hidden="true" />
            {/* Bynavnet bare på den valgte: ellers drukner kartet i etiketter. */}
            <span className={cn("mt-0.5 text-[13px] font-medium text-foreground", on ? "block" : "sr-only")} aria-hidden="true">
              {p.label}
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button type="button" onClick={() => setZoom((z) => Math.min(4, z * 1.4))} aria-label={t("home.map.zoomin")} className="grid size-11 place-items-center rounded-xl bg-white text-foreground shadow-soft hover:bg-blush">
          <Plus className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z / 1.4))} aria-label={t("home.map.zoomout")} className="grid size-11 place-items-center rounded-xl bg-white text-foreground shadow-soft hover:bg-blush">
          <Minus className="size-5" aria-hidden="true" />
        </button>
      </div>
      {pins.length === 0 && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">{t("home.map.empty")}</p>
      )}
    </div>
  );
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
