import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useReducedMotion } from "motion/react";
import type { Pin } from "./StaticDiscoveryMap";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The discovery map, rendered with MapLibre GL JS.
 *
 * Tiles, sprites and glyphs come from OpenFreeMap («positron» style: pale
 * sea, sand-coloured land, quiet labels), which needs no key. The style's
 * own attribution (OpenFreeMap · OpenMapTiles · OpenStreetMap contributors)
 * is shown by the attribution control. Pins are real <button>s carried by
 * MapLibre markers, with the live price as their accessible name.
 *
 * If the style cannot be fetched (offline, blocked network) the map falls
 * back to the self-contained SVG map with the same pins, so the section never
 * shows an empty blue box.
 */
const StaticDiscoveryMap = lazy(() => import("./StaticDiscoveryMap"));

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

function pinContent(btn: HTMLButtonElement, p: Pin, on: boolean) {
  btn.replaceChildren();
  const pill = document.createElement("span");
  pill.className = "hs-pin__pill";
  pill.textContent = p.price ? p.price.replace(/^fra\s/, (m) => m.charAt(0).toUpperCase() + m.slice(1)) : p.label;
  const dot = document.createElement("span");
  dot.className = "hs-pin__dot";
  const name = document.createElement("span");
  name.className = "hs-pin__name";
  name.textContent = p.label;
  btn.append(pill, dot, name);
  btn.classList.toggle("is-on", on);
  btn.setAttribute("aria-pressed", String(on));
  btn.setAttribute("aria-label", `${p.label}${p.price ? ` · ${p.price}` : ""}`);
  btn.style.zIndex = on ? "2" : "1";
}

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
  const reduce = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const latest = useRef({ selected, onSelect });
  latest.current = { selected, onSelect };
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!container.current) return;
    let loaded = false;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        center: [12, 50],
        zoom: 3,
        minZoom: 1,
        maxZoom: 12,
        attributionControl: { compact: false },
        cooperativeGestures: true,
        locale: {
          "NavigationControl.ZoomIn": t("home.map.zoomin"),
          "NavigationControl.ZoomOut": t("home.map.zoomout"),
          "CooperativeGesturesHandler.WindowsHelpText": "Bruk Ctrl + rullehjul for å zoome kartet",
          "CooperativeGesturesHandler.MacHelpText": "Bruk ⌘ + rullehjul for å zoome kartet",
          "CooperativeGesturesHandler.MobileHelpText": "Bruk to fingre for å flytte kartet",
        },
      });
    } catch {
      setStatus("failed");
      return;
    }
    mapRef.current = map;
    const store = markers.current;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    const fail = () => {
      if (loaded) return;
      loaded = true;
      setStatus("failed");
    };
    const timer = window.setTimeout(fail, 12_000);
    map.once("load", () => {
      loaded = true;
      window.clearTimeout(timer);
      setStatus("ready");
    });
    // A failing style request is a failure; a single missing tile after load is not.
    map.on("error", () => fail());
    return () => {
      window.clearTimeout(timer);
      store.forEach((m) => m.remove());
      store.clear();
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; pins, selection and labels are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    for (const [id, m] of markers.current) {
      if (!pins.some((p) => p.id === id)) {
        m.remove();
        markers.current.delete(id);
      }
    }
    for (const p of pins) {
      let m = markers.current.get(p.id);
      if (!m) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hs-pin";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const cur = latest.current;
          cur.onSelect(cur.selected === p.id ? null : p.id);
        });
        m = new maplibregl.Marker({ element: btn, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map);
        markers.current.set(p.id, m);
      }
      pinContent(m.getElement() as HTMLButtonElement, p, p.id === selected);
      m.setLngLat([p.lng, p.lat]);
    }
    if (pins.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      pins.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: { top: 72, bottom: 64, left: 72, right: 72 }, maxZoom: 6, animate: !reduce, duration: 600 });
    } else if (pins.length === 1) {
      map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 5, animate: !reduce });
    }
  }, [pins, selected, status, reduce]);

  if (status === "failed") {
    return (
      <Suspense fallback={<div className={cn("shimmer rounded-[22px]", className)} aria-hidden="true" />}>
        <StaticDiscoveryMap pins={pins} selected={selected} onSelect={onSelect} className={className} />
      </Suspense>
    );
  }

  return (
    <div className={cn("map-sea relative overflow-hidden rounded-[22px]", className)} role="region" aria-label={t("home.map.aria")}>
      <div ref={container} className="absolute inset-0" />
      {status === "loading" && <div className="shimmer pointer-events-none absolute inset-0" aria-hidden="true" />}
    </div>
  );
}
