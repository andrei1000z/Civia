"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  ArrowRight,
  AlertTriangle,
  MapPin,
  Calendar,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { getSesizareEventMeta, isRedundantEventDescription } from "@/lib/sesizari/events";
import type { SesizareFeedRow, SesizareTimelineRow } from "@/lib/supabase/types";

interface Result {
  sesizare: SesizareFeedRow;
  timeline: SesizareTimelineRow[];
}

export function UrmarireSesizare() {
  const [cod, setCod] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (cod.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/sesizari/${encodeURIComponent(cod.trim())}`);
      const text = await res.text();
      let json: { error?: string; data?: { sesizare?: SesizareFeedRow; timeline?: SesizareTimelineRow[] } };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Sesizarea nu a fost găsită. Verifică codul.");
      }
      if (!res.ok) throw new Error(json.error || "Nu am găsit sesizarea");
      if (!json.data?.sesizare) throw new Error("Sesizarea nu a fost găsită.");
      setResult({ sesizare: json.data.sesizare, timeline: json.data.timeline ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare căutare");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = result
    ? STATUS_COLORS[result.sesizare.status as keyof typeof STATUS_COLORS] ?? "#64748b"
    : null;
  const statusLabel = result
    ? STATUS_LABELS[result.sesizare.status as keyof typeof STATUS_LABELS] ?? result.sesizare.status
    : null;
  const cosignCount = result
    ? result.timeline.filter((e) => e.event_type === "cosemnat").length
    : 0;

  return (
    <div className="space-y-6">
      {/* Search card */}
      <form
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <label
          htmlFor="urm-cod"
          className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5"
        >
          Cod sesizare
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="urm-cod"
              type="text"
              value={cod}
              onChange={(e) => setCod(e.target.value.toUpperCase())}
              placeholder="ex: 00007"
              autoComplete="off"
              inputMode="text"
              spellCheck={false}
              maxLength={12}
              aria-describedby={error ? "urm-error" : "urm-hint"}
              aria-invalid={!!error}
              className="w-full h-12 pl-10 pr-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base font-mono tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || cod.trim().length < 3}
            aria-busy={loading}
            className="h-12 px-5 sm:px-6 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Caută</span>
          </button>
        </div>
        <p id="urm-hint" className="text-[11px] text-[var(--color-text-muted)] mt-2">
          Codul e cifric (ex: <span className="font-mono">00007</span>).
        </p>
        {error && (
          <div
            id="urm-error"
            role="alert"
            className="mt-3 p-3 rounded-[var(--radius-xs)] bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Result card */}
      {result && (
        <section
          aria-label="Rezultat căutare"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] overflow-hidden animate-fade-in-up"
        >
          {/* Header strip with status accent */}
          <div
            className="relative px-5 md:px-6 py-5 border-b border-[var(--color-border)] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${statusColor}1a, transparent 60%)`,
            }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
                  Cod sesizare
                </p>
                <p
                  className="font-mono font-bold text-2xl md:text-3xl mb-2"
                  aria-label={`Cod ${result.sesizare.code}`}
                >
                  {result.sesizare.code}
                </p>
                <h2 className="font-[family-name:var(--font-sora)] font-bold text-base md:text-lg leading-snug">
                  {result.sesizare.titlu}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)] flex-wrap">
                  {result.sesizare.locatie && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} aria-hidden="true" />
                      <span className="truncate max-w-[200px]">{result.sesizare.locatie}</span>
                    </span>
                  )}
                  {result.sesizare.created_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} aria-hidden="true" />
                      {formatDateTime(result.sesizare.created_at)}
                    </span>
                  )}
                  {cosignCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                      style={{ backgroundColor: "#0891B21a", color: "#0891B2" }}
                      title="Și alți cetățeni au depus aceeași sesizare"
                    >
                      <Users size={10} aria-hidden="true" />
                      +{cosignCount} {cosignCount === 1 ? "trimitere" : "trimiteri"}
                    </span>
                  )}
                </div>
              </div>
              {statusColor && statusLabel && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0"
                  style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: statusColor }}
                    aria-hidden="true"
                  />
                  {statusLabel}
                </span>
              )}
            </div>
            <Link
              href={`/sesizari/${result.sesizare.code}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline mt-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
            >
              Vezi pagina completă a sesizării
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>

          {/* Timeline */}
          <div className="p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-4">
              Istoric ({result.timeline.length}{" "}
              {result.timeline.length === 1 ? "eveniment" : "evenimente"})
            </p>
            {result.timeline.length === 0 ? (
              <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-xs)] p-4 text-center">
                <p className="text-sm text-[var(--color-text-muted)] italic leading-relaxed">
                  Sesizarea există dar nu are încă evenimente în istoric. Status-ul se actualizează
                  când autoritatea dă feedback sau un moderator marchează tranziția.
                </p>
              </div>
            ) : (
              <ol
                className="relative space-y-5"
                aria-label={`Istoric ${result.timeline.length} ${result.timeline.length === 1 ? "eveniment" : "evenimente"}`}
              >
                {result.timeline.map((step, i) => {
                  const meta = getSesizareEventMeta(step.event_type);
                  const Icon = meta.icon;
                  const isLast = i === result.timeline.length - 1;
                  const showDescription = !isRedundantEventDescription(step.event_type, step.description);
                  return (
                    <li key={step.id} className="relative pl-11">
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[14px] top-8 bottom-[-20px] w-0.5 rounded-full"
                          style={{ backgroundColor: `${meta.color}30` }}
                        />
                      )}
                      <span
                        className={cn(
                          "absolute left-0 top-0 w-[30px] h-[30px] rounded-full grid place-items-center ring-[3px] ring-[var(--color-surface)] shadow-sm",
                          isLast && "animate-pulse",
                        )}
                        style={{
                          backgroundColor: isLast ? meta.color : `${meta.color}1a`,
                          color: isLast ? "#fff" : meta.color,
                        }}
                        aria-hidden="true"
                      >
                        <Icon size={14} strokeWidth={isLast ? 2.5 : 2} />
                      </span>
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className={cn("text-sm leading-tight text-[var(--color-text)]", isLast ? "font-bold" : "font-semibold")}>
                          {meta.label}
                        </p>
                        {isLast && (
                          <span
                            className="inline-flex items-center text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-[var(--radius-full)]"
                            style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                          >
                            Acum
                          </span>
                        )}
                      </div>
                      {showDescription && step.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-2 inline-flex items-center gap-1 tabular-nums">
                        <Calendar size={10} aria-hidden="true" />
                        <time dateTime={step.created_at}>
                          {formatDateTime(step.created_at)}
                        </time>
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
