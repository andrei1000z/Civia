"use client";

import { useState } from "react";
import { Sparkles, Loader2, Link2 } from "lucide-react";
import { useToast } from "@/components/Toast";

/** Forma datelor extrase de /api/proteste/extract — câmpuri gata de mapat în form. */
export interface ProtestExtractData {
  title: string;
  subtitle: string;
  cause: string;
  description: string;
  start_at: string; // ISO 8601
  end_at: string; // ISO 8601
  location_name: string;
  city: string;
  county_slug: string;
  organizer: string;
  organizer_url: string;
  external_url: string;
  hashtag: string;
  expected_attendance: string;
  demands: string[];
}

/**
 * 2026-06-19 — „Completează din link". Lipești un link de protest (eveniment
 * Facebook, articol, pagina organizatorului) → /api/proteste/extract face scrape
 * + AI și întoarce câmpurile. Parintele le mapează în form-ul lui (public sau
 * admin) via `onExtracted`. Folosit pe /proteste/propune + admin „Adaugă protest".
 */
export function ProtestLinkImport({
  onExtracted,
  className,
}: {
  onExtracted: (data: ProtestExtractData) => void;
  className?: string;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const extract = async () => {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      toast("Lipește un link complet (https://...).", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/proteste/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare la extragere");
      onExtracted(j.data as ProtestExtractData);
      const n = j.filledCount ?? 0;
      toast(
        n > 0
          ? `Am completat ${n} ${n === 1 ? "câmp" : "câmpuri"} din link — verifică-le și ajustează.`
          : "N-am găsit detalii clare în link. Completează manual.",
        n > 0 ? "success" : "info",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare la extragere", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-[var(--color-primary)]/25 bg-gradient-to-br from-[var(--color-primary)]/[0.07] via-transparent to-[var(--color-news)]/[0.06] p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-news)] text-white grid place-items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_6px_-1px_rgba(0,0,0,0.2)]"
          aria-hidden="true"
        >
          <Sparkles size={15} />
        </span>
        <h3 className="text-sm font-bold text-[var(--color-text)]">Completează automat din link</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
        Lipește un link — eveniment Facebook, articol de presă sau pagina organizatorului — și completăm câmpurile cu AI. Verifici și trimiți.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Link2
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!loading) extract();
              }
            }}
            placeholder="https://facebook.com/events/..."
            aria-label="Link către protest"
            disabled={loading}
            className="w-full h-11 pl-9 pr-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={extract}
          disabled={loading || !url.trim()}
          className="lc-liquid lc-magnetic shrink-0 h-11 px-5 rounded-[var(--radius-full)] bg-gradient-to-br from-emerald-500/90 to-cyan-500/90 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        >
          {loading ? (
            <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={15} aria-hidden="true" />
          )}
          {loading ? "Se extrage..." : "Completează"}
        </button>
      </div>
    </div>
  );
}

/** ISO 8601 → valoarea pt. <input type="datetime-local"> (în fusul browserului). */
export function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
