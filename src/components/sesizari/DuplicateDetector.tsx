"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Users, ArrowRight, X } from "lucide-react";

interface Candidate {
  code: string;
  titlu: string;
  locatie: string;
  sector?: string | null;
  status?: string;
  distance_m?: number;
}

interface Props {
  tip: string | null;
  lat: number | null;
  lng: number | null;
  sector?: string | null;
  /** Show only when user has engaged enough (tip + locatie set). */
  enabled?: boolean;
}

/**
 * F2 Duplicate Detection — inspired by SeeClickFix issue clustering.
 *
 * Detecteaza sesizari nearby (50m default) cu acelasi tip in ultimele
 * 7 zile. Daca match: shows soft inline card cu „X alti au raportat
 * asta aici. Adauga vocea ta in loc sa duplici."
 *
 * Trigger: tip + lat/lng set (after location detection).
 * Debounce: 800ms after coords change.
 * Dismissable per session.
 */
export function DuplicateDetector({ tip, lat, lng, sector, enabled = true }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || dismissed || !tip || lat == null || lng == null) return;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch("/api/sesizari/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tip, lat, lng, sector, radius: 50 }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!cancelled && j?.candidates?.length > 0) {
            setCandidates(j.candidates as Candidate[]);
          }
        })
        .catch(() => { /* silent */ })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tip, lat, lng, sector, enabled, dismissed]);

  if (dismissed || candidates.length === 0 || loading) return null;

  return (
    <div
      role="region"
      aria-label="Sesizari similare nearby"
      className="lc-glass-2 rounded-[var(--radius-md)] p-4 my-3 border border-amber-200 dark:border-amber-900"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
          <Users size={18} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm text-[var(--color-text)] leading-tight">
              {candidates.length === 1
                ? "Cineva a raportat ceva similar aici"
                : `${candidates.length} cetățeni au raportat ceva similar aici`}
            </h3>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Ascunde sugestia"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
            <strong>Adaugă vocea ta</strong> la sesizările existente — mai multe
            trimiteri = prioritate mai mare la primărie decât duplicate noi.
          </p>
          <ul className="space-y-1.5 mb-3">
            {candidates.slice(0, 3).map((c) => (
              <li key={c.code}>
                <Link
                  href={`/sesizari/${c.code}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-between gap-2 text-xs hover:bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] px-2 py-1.5 transition-colors group"
                >
                  <span className="truncate flex-1 text-[var(--color-text)]">
                    {c.titlu}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 tabular-nums">
                    {c.distance_m != null ? `${c.distance_m}m` : c.sector ?? ""}
                  </span>
                  <ArrowRight
                    size={11}
                    className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-[var(--color-text-muted)] italic flex items-center gap-1">
            <AlertTriangle size={10} aria-hidden="true" />
            Sau continuă cu sesizarea ta dacă e o problemă diferită.
          </p>
        </div>
      </div>
    </div>
  );
}
