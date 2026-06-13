"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Marker, useMapEvents } from "react-leaflet";
import { X, MapPin, Check, Loader2, Crosshair } from "lucide-react";
import { BUCHAREST_CENTER } from "@/lib/constants";

const LeafletMap = dynamic(() => import("../maps/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--color-surface-2)] animate-pulse flex items-center justify-center">
      <p className="text-[var(--color-text-muted)] text-sm">Se încarcă harta…</p>
    </div>
  ),
});

export interface PickedLocation {
  lat: number;
  lng: number;
  locatie: string;
  sector?: string | null;
  countyCode?: string | null;
  countyName?: string | null;
  locality?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Centru inițial al hărții — locația deja aleasă, sau centrul județului. */
  initialCenter?: [number, number];
  initialZoom?: number;
  onConfirm: (loc: PickedLocation) => void;
}

/** Captează click/tap pe hartă și raportează coordonatele înapoi. Trebuie să
 *  fie copil al <MapContainer> (îl primește prin children-ul din LeafletMap). */
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * 2026-06-13 — Picker de locație pe hartă (feedback tester Reddit): pentru
 * cetățenii care NU dau permisiune de geolocație browserului, o alternativă —
 * apeși pe stradă/trotuar pe hartă, luăm adresa prin reverse-geocode
 * (/api/geocode). Zero permisiuni cerute.
 */
export default function MapLocationPicker({
  open,
  onClose,
  initialCenter = BUCHAREST_CENTER,
  initialZoom = 13,
  onConfirm,
}: Props) {
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<PickedLocation | null>(null);
  const geocodeCtrl = useRef<AbortController | null>(null);

  // Reset la fiecare deschidere — fără locație „stale" din sesiunea trecută.
  useEffect(() => {
    if (open) {
      setPicked(null);
      setResult(null);
      setResolving(false);
    }
  }, [open]);

  // Esc închide.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handlePick = useCallback(async (lat: number, lng: number) => {
    setPicked([lat, lng]);
    setResolving(true);
    setResult(null);
    geocodeCtrl.current?.abort();
    const ctrl = new AbortController();
    geocodeCtrl.current = ctrl;
    const tid = setTimeout(() => ctrl.abort(), 6_000);
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { signal: ctrl.signal });
      const json = await res.json();
      const d = json?.data;
      const locatie = d?.shortAddress || d?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setResult({
        lat,
        lng,
        locatie,
        sector: d?.sector ?? null,
        countyCode: d?.countyCode ?? null,
        countyName: d?.countyName ?? null,
        locality: d?.locality ?? null,
      });
    } catch {
      // Geocode a eșuat/abort — păstrăm coordonatele brute ca fallback util.
      setResult({ lat, lng, locatie: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    } finally {
      clearTimeout(tid);
      setResolving(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-priority)] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-picker-title"
        className="w-full sm:max-w-2xl bg-[var(--color-surface)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] overflow-hidden flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-4rem)] animate-modal-pop"
      >
        {/* Header */}
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 id="map-picker-title" className="font-[family-name:var(--font-sora)] font-bold text-base inline-flex items-center gap-2">
              <MapPin size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
              Alege locația pe hartă
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Apasă pe stradă/trotuarul unde e problema — luăm adresa automat. Fără permisiuni.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide harta"
            className="shrink-0 w-9 h-9 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {/* Map */}
        <div className="relative h-[clamp(280px,52vh,520px)] w-full bg-[var(--color-surface-2)]">
          <LeafletMap center={picked ?? initialCenter} zoom={initialZoom} scrollWheelZoom={true}>
            <ClickCapture onPick={handlePick} />
            {picked && <Marker position={picked} />}
          </LeafletMap>
          {!picked && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface)]/95 border border-[var(--color-border)] shadow-[var(--shadow-2)] text-xs font-medium text-[var(--color-text)]">
                <Crosshair size={12} className="text-[var(--color-primary)]" aria-hidden="true" />
                Apasă pe hartă ca să pui pinul
              </span>
            </div>
          )}
        </div>

        {/* Result + confirm */}
        <div className="shrink-0 p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="min-h-[2.5rem] mb-3 flex items-center gap-2 text-sm">
            {resolving ? (
              <span className="inline-flex items-center gap-2 text-[var(--color-text-muted)]">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Caut adresa…
              </span>
            ) : result ? (
              <span className="text-[var(--color-text)]">
                <MapPin size={13} className="inline text-[var(--color-primary)] mr-1 -mt-0.5" aria-hidden="true" />
                <strong>{result.locatie}</strong>
                {result.countyName ? <span className="text-[var(--color-text-muted)]"> · {result.countyName}</span> : null}
              </span>
            ) : (
              <span className="text-[var(--color-text-muted)]">Nicio locație aleasă încă.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              Anulează
            </button>
            <button
              type="button"
              disabled={!result || resolving}
              onClick={() => {
                if (result) {
                  onConfirm(result);
                  onClose();
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              <Check size={16} aria-hidden="true" />
              Folosește această locație
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
