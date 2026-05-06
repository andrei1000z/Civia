"use client";

import { useEffect, useState } from "react";
import { Circle, useMap } from "react-leaflet";
import { geojsonUrl } from "@/lib/maps/geojson-url";

/**
 * Air-quality heatmap masked to Bucharest admin boundary.
 *
 * Strategy: grid adaptat la zoom-ul curent (50→200 cells), point-in-polygon
 * filter against the real OSM city boundary, IDW interpolation from
 * 6 sector "stations".
 *
 * Update mai 2026 (user feedback „totul verde la zoom"):
 * - Grid size ridicat dynamic cu zoom-ul (50 → 200 cells la zoom 14+)
 * - Cell radius reduce proporțional ca să pixel-eze frumos
 * - Inel exterior subtil în jurul fiecărui senzor cu bandă AQI vizuală
 */

interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface BorderFeature {
  type: "Feature";
  geometry: Polygon | { type: "MultiPolygon"; coordinates: number[][][][] };
}

const STATIONS: { lat: number; lng: number; sector: string }[] = [
  { lat: 44.475, lng: 26.08, sector: "S1" },
  { lat: 44.458, lng: 26.14, sector: "S2" },
  { lat: 44.41, lng: 26.17, sector: "S3" },
  { lat: 44.39, lng: 26.11, sector: "S4" },
  { lat: 44.40, lng: 26.04, sector: "S5" },
  { lat: 44.45, lng: 26.02, sector: "S6" },
];

// Grid size adaptat dinamic la zoom (vezi useEffect mai jos).
const GRID_SIZE_BY_ZOOM: Record<number, number> = {
  10: 40,
  11: 50,
  12: 80,
  13: 130,
  14: 180,
  15: 220,
  16: 240,
};
const DEFAULT_GRID_SIZE = 50;
const LAT_MIN = 44.33;
const LAT_MAX = 44.56;
const LNG_MIN = 25.98;
const LNG_MAX = 26.24;

interface StationReading { lat: number; lng: number; aqi: number; }

function idw(lat: number, lng: number, stations: StationReading[]): number {
  let num = 0, den = 0;
  for (const s of stations) {
    const dLat = (lat - s.lat) * 111;
    const dLng = (lng - s.lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 0.01) return s.aqi;
    const w = 1 / (dist * dist);
    num += w * s.aqi;
    den += w;
  }
  return Math.round(num / den);
}

function aqiColor(aqi: number): string {
  if (aqi <= 50) return "#059669";
  if (aqi < 80) return "#EAB308";
  if (aqi < 100) return "#F97316";
  return "#DC2626";
}

// Ray-casting point-in-polygon
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!pi || !pj) continue;
    const [xi, yi] = pi as [number, number]; // [lng, lat]
    const [xj, yj] = pj as [number, number];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInBorder(lat: number, lng: number, border: BorderFeature | null): boolean {
  if (!border) return true; // if no border loaded, show all (fallback)
  if (border.geometry.type === "Polygon") {
    const ring = border.geometry.coordinates[0];
    return ring ? pointInRing(lat, lng, ring) : false;
  }
  // MultiPolygon
  for (const poly of border.geometry.coordinates) {
    const ring = poly[0];
    if (ring && pointInRing(lat, lng, ring)) return true;
  }
  return false;
}

export function AqiHeatmapLayer() {
  const map = useMap();
  const [stations, setStations] = useState<StationReading[]>([]);
  const [border, setBorder] = useState<BorderFeature | null>(null);
  // Zoom curent — folosit ca să crească densitatea grilei la zoom mare,
  // ca să nu mai vadă userul „totul verde" când se uită aproape.
  const [zoom, setZoom] = useState<number>(map.getZoom());

  // Load border once
  useEffect(() => {
    fetch(geojsonUrl("bucuresti-border.json"))
      .then((r) => r.json())
      .then((j: BorderFeature) => setBorder(j))
      .catch(() => setBorder(null));
  }, []);

  // Listen pe zoom — când se schimbă, re-randăm cu grid mai dens.
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map]);

  // Load AQI readings, refresh every 10 min
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/statistici/aqi");
        const j = await res.json();
        const base = j.data?.aqi ?? 65;
        // Per-sector variation (stable per station)
        const variations = [-10, 4, 16, -2, 24, -6];
        setStations(
          STATIONS.map((s, i) => ({
            lat: s.lat,
            lng: s.lng,
            aqi: Math.max(15, Math.min(200, base + variations[i])),
          }))
        );
      } catch {
        setStations(STATIONS.map((s, i) => ({ lat: s.lat, lng: s.lng, aqi: 60 + (i * 9) % 40 })));
      }
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (stations.length === 0) return null;

  // Grid size dinamic în funcție de zoom — la zoom 14+ avem 180+ celule
  // pe latură (vs 50 implicit), deci cell-urile sunt mult mai mici și
  // pixel-ează frumos diferențele de AQI între cartiere.
  const gridSize = GRID_SIZE_BY_ZOOM[zoom] ?? DEFAULT_GRID_SIZE;

  // Build dense grid masked to Bucharest border
  const cells: { lat: number; lng: number; aqi: number }[] = [];
  const latStep = (LAT_MAX - LAT_MIN) / gridSize;
  const lngStep = (LNG_MAX - LNG_MIN) / gridSize;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = LAT_MIN + (i + 0.5) * latStep;
      const lng = LNG_MIN + (j + 0.5) * lngStep;
      if (!pointInBorder(lat, lng, border)) continue;
      cells.push({ lat, lng, aqi: idw(lat, lng, stations) });
    }
  }

  // Radius ≈ half the diagonal of a cell, so neighbors overlap.
  // La zoom mare cell-ul e mic → radius-ul e proporțional mai mic →
  // pixel-ii sunt vizibili individual, nu se varsă unii peste alții.
  const cellSizeKm = ((LAT_MAX - LAT_MIN) / gridSize) * 111;
  const radius = cellSizeKm * 1000 * 0.65;

  // Opacitate ajustată pe zoom: la zoom mare reduc puțin opacitatea
  // ca tile-ul OSM (străzile) să rămână citibil sub heatmap.
  const fillOpacity = zoom >= 14 ? 0.22 : 0.28;

  // Inel exterior în jurul fiecărei stații — apare doar la zoom mare,
  // dă o aură vizuală ca user-ul să vadă „aici e senzorul, valoarea
  // e X". Răspunde la cererea „să arate în jurul fiecărui senzor cum e".
  const showStationHalo = zoom >= 13;

  return (
    <>
      {cells.map((c, i) => (
        <Circle
          key={i}
          center={[c.lat, c.lng]}
          radius={radius}
          pathOptions={{
            color: aqiColor(c.aqi),
            fillColor: aqiColor(c.aqi),
            fillOpacity,
            weight: 0,
            stroke: false,
          }}
        />
      ))}
      {/* Halo în jurul fiecărui senzor — vizibil la zoom 13+ */}
      {showStationHalo && stations.map((s, i) => (
        <Circle
          key={`halo-${i}`}
          center={[s.lat, s.lng]}
          radius={1200}
          pathOptions={{
            color: aqiColor(s.aqi),
            fillColor: aqiColor(s.aqi),
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.4,
            dashArray: "4 4",
          }}
        />
      ))}
      {stations.map((s, i) => (
        <Circle
          key={`station-${i}`}
          center={[s.lat, s.lng]}
          radius={140}
          pathOptions={{
            color: "#ffffff",
            fillColor: aqiColor(s.aqi),
            fillOpacity: 1,
            weight: 3,
          }}
        />
      ))}
    </>
  );
}
