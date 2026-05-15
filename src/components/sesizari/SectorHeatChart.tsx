"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

interface HeatmapData {
  bySector: Record<string, number>;
  total: number;
  judet: string;
}

interface Props {
  judet?: string;
  /** Dacă true include și sesizările `rezolvat`/`respins` (istoric complet). */
  includeAll?: boolean;
}

/**
 * Mini-heatmap pe sectoare București — bar chart orizontal cu culori
 * graduale (verde → ambră → roșu) după densitate.
 *
 * De ce bar chart si nu Leaflet GeoJSON: mai simplu de citit, fără să
 * încarce încă o bibliotecă pe pagina principala. Dacă userii cer
 * vizualizare pe hartă cu polygoane, mutăm în iterație viitoare.
 */
export function SectorHeatChart({ judet = "b", includeAll = false }: Props) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ judet });
    if (includeAll) params.set("all", "1");
    fetch(`/api/sesizari/heatmap?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) {
          setError(j.error);
        } else {
          setData(j.data);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Eroare"));
    return () => {
      cancelled = true;
    };
  }, [judet, includeAll]);

  // Heatmap-ul are sens doar pentru București (sectoare). Pentru alte
  // județe, ascundem componentul — fallback la lista cu sesizari.
  if (judet !== "b") return null;

  if (error) {
    return null;
  }

  if (!data) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Se încarcă harta caldură pe sectoare…
      </div>
    );
  }

  if (data.total === 0) {
    return null;
  }

  // Pentru rationale de culoare: maxCount per sector e referință relativă.
  const max = Math.max(...Object.values(data.bySector), 1);

  const colorFor = (count: number): { bar: string; text: string } => {
    const pct = count / max;
    if (pct >= 0.66) return { bar: "bg-red-500", text: "text-red-700 dark:text-red-300" };
    if (pct >= 0.33) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" };
    if (count > 0) return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" };
    return { bar: "bg-[var(--color-surface-2)]", text: "text-[var(--color-text-muted)]" };
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm inline-flex items-center gap-2">
          <MapPin size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
          Densitate pe sectoare
        </h3>
        <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
          {data.total} {includeAll ? "total" : "active"}
        </span>
      </div>
      <div className="space-y-1.5">
        {(["S1", "S2", "S3", "S4", "S5", "S6"] as const).map((s) => {
          const count = data.bySector[s] ?? 0;
          const pct = max > 0 ? (count / max) * 100 : 0;
          const c = colorFor(count);
          return (
            <div key={s} className="flex items-center gap-3 text-xs">
              <span className="w-7 font-mono font-semibold text-[var(--color-text-muted)] shrink-0">
                {s}
              </span>
              <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] overflow-hidden relative">
                <div
                  className={`h-full transition-all ${c.bar}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className={`w-10 text-right tabular-nums font-semibold ${c.text}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
        {includeAll
          ? "Total sesizări depuse, indiferent de status."
          : "Doar sesizările active (excluse rezolvate și respinse)."}
      </p>
    </div>
  );
}
