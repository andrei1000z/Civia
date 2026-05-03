"use client";

import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/Toast";

interface RefreshResult {
  scrapedCount: number;
  upserted: number;
  bySource: Record<string, number>;
  errors: string[];
  durationMs: number;
}

/**
 * Buton client-side care apelează /api/intreruperi/refresh cu sesiunea
 * admin (cookies via createSupabaseServer în route handler verifică
 * profile.role='admin'). Scrape-ul rulează imediat, nu așteaptă cron-ul
 * de 12h. Folosit pentru:
 * - Test după modificări la scrapers (vezi instant ce surse produc 0)
 * - Refresh on-demand când se așteaptă o întrerupere mare
 * - Debug în prod când o sursă pică
 */
export function RefreshScrapeButton() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);

  const trigger = async () => {
    if (running) return;
    if (!confirm("Trigger scrape acum? Durează 10-30 secunde și consumă quota Vercel function.")) return;
    setRunning(true);
    setResult(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/intreruperi/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || j.message || "Eroare scrape");
      const r: RefreshResult = {
        scrapedCount: j.scrapedCount ?? 0,
        upserted: j.upserted ?? 0,
        bySource: j.bySource ?? {},
        errors: j.errors ?? [],
        durationMs: Date.now() - start,
      };
      setResult(r);
      toast(`Scrape complet: ${r.scrapedCount} întreruperi din ${Object.keys(r.bySource).length} surse.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 mb-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="font-[family-name:var(--font-sora)] font-bold text-base mb-1 inline-flex items-center gap-2">
            <RefreshCw size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Trigger scrape manual
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Rulează acum scraping-ul tuturor celor 30 de surse (apă, gaz, curent,
            termoficare, lucrări strazi). Cron-ul oficial rulează la fiecare
            12 ore — folosește butonul ăsta pentru test imediat sau când aștepți
            o întrerupere mare.
          </p>
        </div>
        <button
          type="button"
          onClick={trigger}
          disabled={running}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          {running ? (
            <>
              <Loader2 size={14} className="motion-safe:animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              Refresh scrape
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-5 pt-5 border-t border-[var(--color-border)] space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">Complet în {(result.durationMs / 1000).toFixed(1)}s.</span>
            <span className="text-[var(--color-text-muted)]">
              {result.scrapedCount} întreruperi totale → {result.upserted} salvate în DB.
            </span>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
              Per sursă (entries)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
              {Object.entries(result.bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => (
                  <div
                    key={key}
                    className={`text-[11px] flex items-center justify-between gap-1 px-2 py-1.5 rounded-[var(--radius-xs)] ${
                      count === 0
                        ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                    }`}
                  >
                    <span className="truncate font-mono">{key}</span>
                    <span className="tabular-nums shrink-0">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400 mb-2 inline-flex items-center gap-1">
                <AlertTriangle size={10} /> Erori ({result.errors.length})
              </p>
              <ul className="space-y-1 text-[11px] font-mono text-rose-700 dark:text-rose-300">
                {result.errors.map((e, i) => (
                  <li key={i} className="bg-rose-500/5 border border-rose-500/20 rounded p-1.5">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
