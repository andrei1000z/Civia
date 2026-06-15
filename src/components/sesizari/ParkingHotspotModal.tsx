"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Shield, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildBolarziRequest } from "@/lib/sesizari/parking";

interface HotspotData {
  count: number;
  codes: string[];
  sample: Array<{ code: string; titlu: string; locatie: string }>;
  threshold: number;
  isHotspot: boolean;
}

interface ParkingHotspotModalProps {
  lat: number;
  lng: number;
  excludeCode?: string | null;
  authorName: string;
  authorAddress: string;
  locatie: string;
  onClose: () => void;
}

const ASPMB_EMAIL = "office@aspmb.ro";

export function ParkingHotspotModal({
  lat,
  lng,
  excludeCode,
  authorName,
  authorAddress,
  locatie,
  onClose,
}: ParkingHotspotModalProps) {
  const [data, setData] = useState<HotspotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    if (excludeCode) params.set("exclude", excludeCode);
    fetch(`/api/sesizari/parking-hotspot?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Eroare");
        setData(j.data as HotspotData);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Eroare");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [lat, lng, excludeCode]);

  // Escape key closes the modal. Body scroll lock mirrors other modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Only surface the modal if we actually have a hotspot. Loading/empty
  // states render nothing — the user's submit-success flow isn't
  // interrupted by noise.
  if (loading) return null;
  if (error) return null;
  if (!data?.isHotspot) return null;

  const bolarziBody = buildBolarziRequest({
    authorName,
    authorAddress,
    locatie,
    lat,
    lng,
    priorReportCount: data.count,
    priorReportCodes: data.codes,
  });
  const subject = `Cerere montare stâlpișori anti-parcare — ${locatie}`;
  const mailto = `mailto:${ASPMB_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bolarziBody)}`;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-priority)] flex items-start md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotspot-title"
        className="w-full max-w-xl my-8 bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-xl)] border border-[var(--color-border)] outline-none max-h-[calc(100dvh-4rem)] overflow-y-auto animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center" aria-hidden="true">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 id="hotspot-title" className="text-lg font-semibold">Zonă cu probleme recurente</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Am detectat <strong className="tabular-nums">{data.count}</strong> {data.count === 1 ? "sesizare" : "sesizări"} de parcare ilegală la mai puțin de 50m de locația ta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Închide modalul"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm">
            Sancționarea individuală nu rezolvă problema când se repetă. Vrei să trimitem o cerere oficială către <strong>Administrația Străzilor București</strong> pentru montarea de stâlpișori de protecție (bolarzi)?
          </p>

          {data.sample.length > 0 && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] p-3 space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                Sesizări anterioare în această zonă ({data.count} în total):
              </p>
              <ul className="text-xs space-y-1.5">
                {data.sample.map((s) => (
                  <li key={s.code}>
                    <Link
                      href={`/sesizari/${s.code}`}
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="font-mono font-semibold">{s.code}</span>
                      <ExternalLink size={10} aria-hidden="true" />
                      <span className="sr-only">(deschide în tab nou)</span>
                    </Link>
                    <span className="ml-2 text-[var(--color-text-muted)]">{s.titlu}</span>
                  </li>
                ))}
              </ul>
              {data.count > data.sample.length && (
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  ... și încă <span className="tabular-nums">{data.count - data.sample.length}</span> {data.count - data.sample.length === 1 ? "sesizare" : "sesizări"}.
                </p>
              )}
            </div>
          )}

          <div className="rounded-[var(--radius-sm)] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 text-xs text-blue-900 dark:text-blue-300">
            <p>
              <strong>Cum funcționează:</strong> Cererea generată citează codurile sesizărilor anterioare drept dovadă a problemei sistemice — un argument mult mai puternic decât o cerere individuală.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <a
              href={mailto}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              <Shield size={15} aria-hidden="true" />
              Da, trimite cererea către ASPMB
            </a>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
            >
              Nu, mulțumesc
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
