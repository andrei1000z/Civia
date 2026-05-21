"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
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
  voturi: number;
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
              voturi: r.voturi_net,
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
                  voturi: 0,
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
      <div className="absolute bottom-3 left-3 z-[400] bg-[var(--color-surface)] backdrop-blur border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-1.5">
          {(["nou", "in-lucru", "rezolvat"] as const).map((status) => (
            <div key={status} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[status] }} />
              <span className="text-[var(--color-text)]">{STATUS_LABELS[status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
