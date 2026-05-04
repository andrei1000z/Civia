"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { GeoJSON as LeafletGeoJSON, Layer, PathOptions, StyleFunction } from "leaflet";
import type { Feature } from "geojson";

/**
 * Shared progressive-rendering engine for on-viewport Overpass layers
 * (roads, footways, transit). One persistent L.geoJSON layer per
 * component receives features in requestAnimationFrame chunks, backed
 * by a module-scoped FIFO cache so small pans reuse cells without
 * re-querying Overpass.
 *
 * Consumers pass a `buildQuery(bbox)` callback so the hook doesn't
 * need to know about the specific OSM tags being fetched. Everything
 * else — cache key, chunking, debounce, abort, buffer, no-blank pans
 * — is handled here.
 */

const CHUNK_SIZE = 200;
const CACHE_CAP = 40;
const BBOX_GRID = 0.02;
const VIEWPORT_BUFFER = 0.25;

function snap(v: number): number {
  return Math.round(v / BBOX_GRID) * BBOX_GRID;
}

function cacheKeyFor(zoom: number, s: number, w: number, n: number, e: number, ns: string): string {
  return `${ns}|${zoom}|${snap(s)}|${snap(w)}|${snap(n)}|${snap(e)}`;
}

// Each consumer gets its own logical cache namespace so a roads query
// and a footways query keyed to the same bbox+zoom don't collide.
const featureCache = new Map<string, Feature[]>();

function cachePut(key: string, features: Feature[]) {
  if (featureCache.has(key)) featureCache.delete(key);
  featureCache.set(key, features);
  while (featureCache.size > CACHE_CAP) {
    const firstKey = featureCache.keys().next().value;
    if (firstKey === undefined) break;
    featureCache.delete(firstKey);
  }
}

interface UseProgressiveLayerOptions {
  /** Stable namespace used as cache key prefix. Must be unique per layer. */
  cacheNamespace: string;
  /** Min map zoom at which we actually query Overpass. */
  minZoom: number;
  /** Debounce in ms after moveend/zoomend before we fetch. */
  debounceMs?: number;
  /** Build the Overpass QL body for a given bbox string. */
  buildQuery: (bbox: string) => string;
  /** Path style per feature. */
  styleFn: (f?: Feature) => PathOptions;
  /** Optional HTML popup per feature. If omitted, no popup is bound. */
  popupFn?: (f: Feature) => string;
  /**
   * Optional point-to-layer hook. When provided, Overpass "node" elements
   * will be emitted as Point features and rendered via this callback —
   * used by the transit layer for bus stops.
   */
  pointToLayer?: (f: Feature, latlng: L.LatLng) => Layer;
  /** Return true to keep an OSM element, false to drop it. */
  elementFilter?: (el: Record<string, unknown>) => boolean;
}

interface UseProgressiveLayerState {
  loading: boolean;
  lowZoom: boolean;
}

export function useProgressiveOverpassLayer(opts: UseProgressiveLayerOptions): UseProgressiveLayerState {
  const {
    cacheNamespace,
    minZoom,
    debounceMs = 300,
    buildQuery,
    styleFn,
    popupFn,
    pointToLayer,
    elementFilter,
  } = opts;

  const map = useMap();
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastKeyRef = useRef("");
  const [loading, setLoading] = useState(false);
  const [lowZoom, setLowZoom] = useState(map.getZoom() < minZoom);

  const cancelPaint = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const paintProgressive = useCallback((features: Feature[]) => {
    cancelPaint();
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (features.length === 0) return;

    let i = 0;
    const tick = () => {
      rafRef.current = null;
      if (!layerRef.current) return;
      const slice = features.slice(i, i + CHUNK_SIZE);
      if (slice.length === 0) return;
      layerRef.current.addData({ type: "FeatureCollection", features: slice } as never);
      i += CHUNK_SIZE;
      if (i < features.length) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelPaint]);

  const fetchFeatures = useCallback(() => {
    const zoom = map.getZoom();
    if (zoom < minZoom) {
      setLowZoom(true);
      cancelPaint();
      layerRef.current?.clearLayers();
      lastKeyRef.current = "";
      return;
    }
    setLowZoom(false);

    const bounds = map.getBounds();
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();

    const key = cacheKeyFor(zoom, s, w, n, e, cacheNamespace);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    const cached = featureCache.get(key);
    if (cached) {
      setLoading(false);
      paintProgressive(cached);
      return;
    }

    // 1.5× viewport padding on fetch so a tiny pan keeps the same cell.
    const latPad = (n - s) * VIEWPORT_BUFFER;
    const lngPad = (e - w) * VIEWPORT_BUFFER;
    const fs = s - latPad;
    const fw = w - lngPad;
    const fn = n + latPad;
    const fe = e + lngPad;
    const bbox = `${fs.toFixed(4)},${fw.toFixed(4)},${fn.toFixed(4)},${fe.toFixed(4)}`;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const query = buildQuery(bbox).replace(/\s+/g, " ").trim();

    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => {
        if (ctrl.signal.aborted) return;
        const elements = (j.elements ?? []) as Array<Record<string, unknown>>;
        const features: Feature[] = [];
        for (const el of elements) {
          if (elementFilter && !elementFilter(el)) continue;
          if (el.type === "way" && Array.isArray(el.geometry)) {
            features.push({
              type: "Feature",
              properties: (el.tags as Record<string, string>) ?? {},
              geometry: {
                type: "LineString",
                coordinates: (el.geometry as Array<{ lat: number; lon: number }>).map((p) => [p.lon, p.lat]),
              },
            });
          } else if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
            features.push({
              type: "Feature",
              properties: (el.tags as Record<string, string>) ?? {},
              geometry: {
                type: "Point",
                coordinates: [el.lon, el.lat],
              },
            });
          }
        }
        cachePut(key, features);
        setLoading(false);
        if (lastKeyRef.current === key) paintProgressive(features);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [map, minZoom, cacheNamespace, buildQuery, paintProgressive, cancelPaint, elementFilter]);

  useEffect(() => {
    const layer = L.geoJSON(undefined, {
      style: styleFn as StyleFunction,
      ...(popupFn
        ? {
            onEachFeature: (feature: Feature, lyr: Layer) => {
              lyr.bindPopup(popupFn(feature));
            },
          }
        : {}),
      ...(pointToLayer ? { pointToLayer } : {}),
    });
    layer.addTo(map);
    layerRef.current = layer;

    if (map.getZoom() >= minZoom) {
      fetchFeatures();
    } else {
      setLowZoom(true);
    }

    return () => {
      cancelPaint();
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
      // Defensive: dacă layerul a fost deja detașat (componenta s-a
      // unmount-uit deja când a apărut un re-render rapid), removeLayer
      // throw-uia „Cannot read properties of undefined (reading
      // '_leaflet_pos')" — vedem 2× pe săptămână în Sentry.
      try {
        if (layer && map && (map as unknown as { hasLayer?: (l: unknown) => boolean }).hasLayer?.(layer)) {
          map.removeLayer(layer);
        }
      } catch {
        // Layer already removed by Leaflet internals — ignore
      }
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, minZoom]);

  useMapEvents({
    moveend: () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fetchFeatures, debounceMs);
    },
    zoomend: () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fetchFeatures, debounceMs);
    },
  });

  return { loading, lowZoom };
}
