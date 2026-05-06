"use client";

import { useMemo } from "react";
import { GeoJsonLayer } from "./GeoJsonLayer";
import { NationalAqiLayer } from "./NationalAqiLayer";
import { geojsonUrl } from "@/lib/maps/geojson-url";
import dynamic from "next/dynamic";

const DynamicRoadsLayer = dynamic(() => import("./DynamicRoadsLayer").then(m => ({ default: m.DynamicRoadsLayer })), { ssr: false });
const DynamicPedestrianLayer = dynamic(() => import("./DynamicPedestrianLayer").then(m => ({ default: m.DynamicPedestrianLayer })), { ssr: false });
const DynamicTransitLayer = dynamic(() => import("./DynamicTransitLayer").then(m => ({ default: m.DynamicTransitLayer })), { ssr: false });
import { METRO_COLORS } from "@/lib/constants";
import type { PathOptions } from "leaflet";
import type { Feature } from "geojson";

interface HartiLayersProps {
  activeTab: "bicicleta" | "pejos" | "auto" | "transport" | "aer";
  showDedicate: boolean;
  showMarcate: boolean;
  showRecomandate: boolean;
  showParcuri: boolean;
  showPietonal: boolean;
  showTraversari: boolean;
  visibleLines: string[];
  /** When set, the AQI heatmap clips to this bounding box instead of
   *  rendering Romania-wide. Used on /[judet]/harti so the heatmap only
   *  colors the county. */
  clipBounds?: [[number, number], [number, number]];
  /** Display name of the county we're clipped to — surfaces in the
   *  zoom-out CTA when the user pans/zooms outside the box. */
  countyName?: string;
}

// All bike paths shown as green — no categories, no "recomandate"
function bikePathFilter(feature: Feature): boolean {
  const p = feature.properties ?? {};
  // Only show dedicated cycleways and marked lanes, NOT recommended routes
  return p.highway === "cycleway" || p.cycleway === "track" || p.cycleway === "lane" || p.cycleway === "opposite" || p.bicycle === "designated";
}

const bikeStyle = () =>
  (feature?: Feature): PathOptions => {
    if (!feature) return { weight: 0 };
    if (!bikePathFilter(feature)) return { weight: 0, opacity: 0 };
    return {
      color: "#059669",
      weight: 4,
      opacity: 0.85,
    };
  };

// Metro line styling — colour from OSM tags or fallback to METRO_COLORS
function metroLineStyle(visibleLines: string[]) {
  return (feature?: Feature): PathOptions => {
    if (!feature) return { weight: 0 };
    const ref = (feature.properties?.ref as string) ?? "";
    if (!visibleLines.includes(ref)) return { weight: 0, opacity: 0 };
    const color = (feature.properties?.colour as string) ?? METRO_COLORS[ref] ?? "#64748b";
    return { color, weight: 5, opacity: 0.85 };
  };
}

function metroStationStyle(): PathOptions {
  return {
    radius: 6,
    fillColor: "#ffffff",
    color: "#1e293b",
    weight: 2,
    opacity: 1,
    fillOpacity: 1,
  } as PathOptions;
}

// pedestrianAccessStyle / pedestrianRestrictedStyle removed — the old
// 23 MB pietonal-romania.json + 255 kB pietonal-neaccesibil.json are no
// longer loaded. Footway styling now lives in DynamicPedestrianLayer
// which serves Overpass results on the current viewport.

const parkStyle: PathOptions = {
  color: "#059669",
  weight: 1.5,
  opacity: 0.7,
  fillColor: "#10b981",
  fillOpacity: 0.25,
};

const tramStyle: PathOptions = {
  color: "#EAB308",
  weight: 3,
  opacity: 0.7,
  dashArray: "4 4",
};

// Trolleybus + bus national line networks come from
// scripts/fetch-national-geojson.ts (relation-member dedupe mode):
// each LineString is one OSM way listing all routes that traverse
// it. Different colors so the eye can split them apart at a glance:
//   trolleybus = violet dashed   (electric)
//   bus        = orange thin      (combustion)
const trolleybusStyle: PathOptions = {
  color: "#8B5CF6",
  weight: 2.5,
  opacity: 0.7,
  dashArray: "2 4",
};

const busStyle: PathOptions = {
  color: "#EA580C",
  weight: 1.5,
  opacity: 0.55,
};

function transitLinePopup(label: string) {
  return (feature: Feature): string => {
    const p = feature.properties ?? {};
    const ref = p.ref ?? "";
    const refCount = typeof p.ref_count === "number" ? p.ref_count : null;
    const name = p.name ?? label;
    const operator = p.operator
      ? `<br/><span style="font-size:10px;color:#94a3b8">${p.operator}</span>`
      : "";
    const title = ref
      ? `Linii ${ref}${refCount && refCount > 1 ? ` <span style="color:#94a3b8;font-weight:400">(${refCount})</span>` : ""}`
      : name;
    return `<div style="min-width:160px"><b>${title}</b><br/><span style="font-size:11px;color:#64748b">${label}</span>${operator}</div>`;
  };
}

const trolleybusPopup = transitLinePopup("Linie troleibuz");
const busPopup = transitLinePopup("Linie autobuz");

function bikePopup(feature: Feature): string {
  const p = feature.properties ?? {};
  const name = p.name ?? "Pistă de bicicletă";
  return `<div style="min-width:180px"><b>${name}</b><br/><span style="font-size:11px;color:#64748b">Pistă ciclism</span></div>`;
}

function metroLinePopup(feature: Feature): string {
  const p = feature.properties ?? {};
  const name = p.name ?? `Linia ${p.ref ?? ""}`;
  return `<div><b>${name}</b><br/><span style="font-size:11px;color:#64748b">${p.operator ?? "Metrorex"}</span></div>`;
}

function metroStationPopup(feature: Feature): string {
  const p = feature.properties ?? {};
  return `<div><b>${p.name ?? "Stație metrou"}</b><br/><span style="font-size:11px;color:#64748b">${p.operator ?? "Metrorex"}</span></div>`;
}

// pedestrianPopup + pedestrianRestrictedPopup moved into
// DynamicPedestrianLayer where the rendering now happens.

function parkPopup(feature: Feature): string {
  const p = feature.properties ?? {};
  return `<div><b>${p.name ?? "Parc"}</b></div>`;
}

export default function HartiLayers(props: HartiLayersProps) {
  const {
    activeTab,
    showDedicate,
    showMarcate,
    showRecomandate,
    showParcuri,
    showPietonal,
    visibleLines,
    clipBounds,
    countyName,
  } = props;

  // Memoize style functions — stable references prevent GeoJSON re-creation on every map pan/zoom
  // show* aren't args la bikeStyle(); sunt totuși deps logice fiindcă schimbarea
  // lor poate trigger-uia un re-render intenționat dacă bikeStyle ajunge să
  // consume props în viitor.
  const memoizedBikeStyle = useMemo(
    () => bikeStyle(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showDedicate, showMarcate, showRecomandate]
  );
  const memoizedMetroStyle = useMemo(() => metroLineStyle(visibleLines), [visibleLines]);

  if (activeTab === "bicicleta") {
    return (
      <GeoJsonLayer
        key="bike"
        url={geojsonUrl("bicicleta-romania.json")}
        style={memoizedBikeStyle}
        popupFormatter={bikePopup}
      />
    );
  }

  if (activeTab === "pejos") {
    // Parks stay static — 2 MB, covers every leisure=park in RO in one
    // shot. Footways + pedestrian streets are now served by Overpass
    // on the current viewport (DynamicPedestrianLayer) — the old
    // pietonal-romania.json was 23 MB and destroyed mobile first-load.
    return (
      <>
        {showParcuri && (
          <GeoJsonLayer key="parks" url={geojsonUrl("parcuri-romania.json")} style={parkStyle} popupFormatter={parkPopup} />
        )}
        {showPietonal && <DynamicPedestrianLayer />}
      </>
    );
  }

  if (activeTab === "auto") {
    return (
      <>
        {/* Static layers: autostrăzi + naționale (always visible, lightweight) */}
        <GeoJsonLayer
          key="autostrazi"
          url={geojsonUrl("autostrazi-romania.json")}
          style={() => ({ color: "#DC2626", weight: 3, opacity: 0.9 })}
          popupFormatter={(f: Feature) => {
            const p = f.properties ?? {};
            return `<b>${p.ref || "Autostradă"}</b><br/><span style="font-size:11px;color:#64748b">${p.name || ""}</span>`;
          }}
        />
        <GeoJsonLayer
          key="nationale"
          url={geojsonUrl("nationale-romania.json")}
          style={(f?: Feature) => {
            const hw = f?.properties?.highway;
            if (hw === "trunk") return { color: "#F97316", weight: 2, opacity: 0.8 };
            return { color: "#EAB308", weight: 1.5, opacity: 0.7 };
          }}
          popupFormatter={(f: Feature) => {
            const p = f.properties ?? {};
            return `<b>${p.ref || "DN"}</b><br/><span style="font-size:11px;color:#64748b">${p.name || "Drum național"}</span>`;
          }}
        />
        {/* Dynamic: streets load from Overpass API when zoomed in (zoom >= 13) */}
        <DynamicRoadsLayer />
      </>
    );
  }

  if (activeTab === "transport") {
    return (
      <>
        {/* Static national backbone — always on, sized to load fast.
            Layered bottom-up so combustion-bus (lowest weight) sits
            under everything else, then trolleybus, then trams, then
            metro on top. Click order matches: metro popup wins over
            tram, etc. */}
        <GeoJsonLayer
          key="bus"
          url={geojsonUrl("autobuz-romania.json")}
          style={busStyle}
          popupFormatter={busPopup}
        />
        <GeoJsonLayer
          key="trolleybus"
          url={geojsonUrl("troleibuz-romania.json")}
          style={trolleybusStyle}
          popupFormatter={trolleybusPopup}
        />
        <GeoJsonLayer key="trams" url={geojsonUrl("tramvai-romania.json")} style={tramStyle} />
        <GeoJsonLayer key="metro-lines" url={geojsonUrl("metrou.json")} style={memoizedMetroStyle} popupFormatter={metroLinePopup} />
        <GeoJsonLayer key="metro-stations" url={geojsonUrl("metrou-statii.json")} style={metroStationStyle()} popupFormatter={metroStationPopup} />
        {/* Dynamic: bus stops + extra rail progressively stream in
            from Overpass at zoom >= 13. */}
        <DynamicTransitLayer />
      </>
    );
  }

  if (activeTab === "aer") {
    return (
      <NationalAqiLayer
        key={clipBounds ? `aqi-county-${clipBounds[0]?.join(",")}` : "aqi-national"}
        clipBounds={clipBounds}
        countyName={countyName}
      />
    );
  }

  return null;
}
