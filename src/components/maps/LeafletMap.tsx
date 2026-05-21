"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L, { Canvas } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, type ReactNode } from "react";
import { BUCHAREST_CENTER } from "@/lib/constants";

// Fix default icons for Next.js
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function createColoredIcon(color: string, size = 28): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    "></div>`,
    className: "custom-marker-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export function createDotIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    className: "custom-dot-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  children?: ReactNode;
  className?: string;
  scrollWheelZoom?: boolean;
  flyToTarget?: { coords: [number, number]; zoom?: number } | null;
}

// Leaflet are nevoie de un tick dupa mount ca sa-si reseteze size-ul
// (parintele isi termina layout-ul). 100ms = un cadru @ 60fps + buffer.
const MAP_INVALIDATE_DELAY_MS = 100;

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), MAP_INVALIDATE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
}

function FlyTo({ target }: { target: { coords: [number, number]; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target.coords, target.zoom ?? 15, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

const TILE_URLS: Record<string, { url: string; attr: string }> = {
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  satelit: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; Maxar, Earthstar',
  },
};

export default function LeafletMap({
  center = BUCHAREST_CENTER,
  zoom = 12,
  children,
  className = "w-full h-full",
  scrollWheelZoom = true,
  flyToTarget = null,
  tileStyle = "standard",
}: LeafletMapProps & { tileStyle?: string }) {
  const tile = TILE_URLS[tileStyle] ?? TILE_URLS.standard!;
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      className={className}
      zoomControl={true}
      renderer={new Canvas({ padding: 0.5 })}
      preferCanvas={true}
    >
      <TileLayer
        key={tileStyle}
        url={tile.url}
        attribution={tile.attr}
      />
      <MapResizer />
      <FlyTo target={flyToTarget} />
      {children}
    </MapContainer>
  );
}

export { Marker, Popup, Polyline, Circle };
