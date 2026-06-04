"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { SESIZARE_STATUS_VALUES } from "@/lib/sesizari/status";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { SesizareFeedRow } from "@/lib/supabase/types";
import { useCountyOptional } from "@/lib/county-context";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--color-surface-2)] animate-pulse rounded-[var(--radius-md)] flex items-center justify-center">
      <p className="text-[var(--color-text-muted)] text-sm">Se încarcă harta...</p>
    </div>
  ),
});

const MarkerLayer = dynamic(() => import("./SesizariMarkersLayer"), { ssr: false });

interface SesizariMapProps {
  limit?: number;
  height?: string;
  zoom?: number;
}

interface MarkerData {
  id: string;
  code: string;
  titlu: string;
  locatie: string;
  status: string;
  data: string;
  comentarii: number;
  coords: [number, number];
}

export function SesizariMap({ limit = 15, height = "400px", zoom = 12 }: SesizariMapProps) {
  const county = useCountyOptional();
  const [markers, setMarkers] = useState<MarkerData[]>([]);

  useEffect(() => {
    fetch(`/api/sesizari?limit=${limit}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data as SesizareFeedRow[]) ?? [];
        // Defense 5/21/2026: filtreaza rows fara lat/lng valid INAINTE
        // de a le da la Leaflet. Daca API esueaza sa returneze coords
        // (sau o sesizare are NULL in DB), Leaflet arunca „Invalid
        // LatLng object: (undefined, undefined)" si harta cade in
        // error boundary.
        setMarkers(
          rows
            .filter((r) =>
              typeof r.lat === "number" &&
              typeof r.lng === "number" &&
              !Number.isNaN(r.lat) &&
              !Number.isNaN(r.lng),
            )
            .map((r) => ({
              id: r.id,
              code: r.code,
              titlu: r.titlu,
              locatie: r.locatie,
              status: r.status,
              data: r.created_at,
              comentarii: r.nr_comentarii,
              coords: [r.lat, r.lng] as [number, number],
            })),
        );
      })
      .catch(() => setMarkers([]));
  }, [limit]);

  // Realtime inserts — OPTIONAL. Daca esueaza (rate limit, network drop,
  // free tier concurrency limit), pagina continua sa functioneze fara
  // live updates. NU vrem ca un esec de subscribe sa propage in error
  // boundary si sa arate „Conexiunea cu baza e instabila".
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowser>["channel"]> | null = null;
    let removed = false;
    try {
      const supabase = createSupabaseBrowser();
      const channelName = `map-sesizari-realtime-${typeof crypto !== "undefined" ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sesizari" },
          (payload: { new: SesizareFeedRow }) => {
            try {
              const r = payload.new as SesizareFeedRow;
              if (!r.publica) return;
              setMarkers((prev) => {
                const next: MarkerData = {
                  id: r.id,
                  code: r.code,
                  titlu: r.titlu,
                  locatie: r.locatie,
                  status: r.status,
                  data: r.created_at,
                  comentarii: 0,
                  coords: [r.lat, r.lng],
                };
                return [next, ...prev].slice(0, limit);
              });
            } catch { /* silent */ }
          },
        )
        .subscribe();
    } catch {
      // Realtime subscribe failed — degradare grațioasă, fără re-throw.
    }
    return () => {
      if (channel && !removed) {
        try {
          const supabase = createSupabaseBrowser();
          supabase.removeChannel(channel);
          removed = true;
        } catch { /* silent */ }
      }
    };
  }, [limit]);

  return (
    <div
      style={{ height }}
      className="w-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)] relative"
    >
      <LeafletMap center={county?.center} zoom={county ? 10 : zoom}>
        <MarkerLayer data={markers} />
      </LeafletMap>
      {/* 2026-05-26 — legenda: TOATE statusurile, mai transparent (20%).
          Flex-wrap max-width 280px pe mobile / 360px pe desktop ca să nu
          ocupe toată harta. Backdrop blur puternic ca textul să rămână
          lizibil peste tile-urile OSM. */}
      <div
        className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 max-w-[280px] sm:max-w-[400px] rounded-[var(--radius-xs)] bg-[var(--color-surface)]/40 backdrop-blur-xl border border-[var(--color-border)]/50 shadow-[var(--shadow-1)]"
        aria-label="Legenda hărții"
      >
        {SESIZARE_STATUS_VALUES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1 text-[10px] font-medium leading-none whitespace-nowrap">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: STATUS_COLORS[status] }}
              aria-hidden="true"
            />
            <span className="text-[var(--color-text)]">{STATUS_LABELS[status]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
