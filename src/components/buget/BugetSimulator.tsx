"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Scale, Share2, Check, RotateCcw, ArrowRight } from "lucide-react";
import {
  getCategoriiSimulator,
  compara,
  echilibreazaLa100,
  shareText,
} from "@/lib/buget/simulator";

/** „Tu împarți bugetul" — joc de 90 de secunde, commit-then-reveal:
 *  aloci procente pe categorii FĂRĂ să vezi bugetul real, apoi reveal +
 *  comparație + share + CTA pe categoria cu diferența maximă. */
export function BugetSimulator() {
  const categorii = useMemo(() => getCategoriiSimulator(), []);
  const [alloc, setAlloc] = useState<Record<string, number>>(
    Object.fromEntries(categorii.map((c) => [c.key, 0])),
  );
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const total = categorii.reduce((s, c) => s + (alloc[c.key] ?? 0), 0);
  const rezultat = useMemo(
    () => (revealed ? compara(alloc, categorii) : null),
    [revealed, alloc, categorii],
  );

  const share = async () => {
    if (!rezultat) return;
    try {
      await navigator.clipboard.writeText(shareText(rezultat));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponibil */ }
  };

  const reset = () => {
    setAlloc(Object.fromEntries(categorii.map((c) => [c.key, 0])));
    setRevealed(false);
  };

  if (revealed && rezultat) {
    return (
      <div className="space-y-4">
        {/* Scor */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center shadow-[var(--shadow-1)]">
          <p className="text-4xl font-extrabold tabular-nums text-[var(--color-text)]">
            {rezultat.similaritate}%
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            atât de aproape e împărțirea ta de bugetul real al unei primării de capitală
          </p>
        </div>

        {/* Comparația pe categorii — bare pereche Tu vs Real */}
        <div className="space-y-3">
          {rezultat.perCategorie.map((c) => (
            <div key={c.key} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-[var(--shadow-1)]">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </p>
                <p className={`text-xs font-bold tabular-nums ${c.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : c.delta < 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-text-muted)]"}`}>
                  {c.delta > 0 ? `+${c.delta}` : c.delta} pp
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Tu</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-2)]">
                    <div className="h-full rounded-[var(--radius-full)] bg-[var(--color-primary)]" style={{ width: `${Math.min(c.userPct, 100)}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs font-bold tabular-nums text-[var(--color-text)]">{c.userPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Real</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-2)]">
                    <div className="h-full rounded-[var(--radius-full)] bg-slate-500" style={{ width: `${c.realPct}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs font-bold tabular-nums text-[var(--color-text-muted)]">{c.realPct}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cârligul de acțiune — pe diferența maximă */}
        {rezultat.ceaMaiMareDiferenta && rezultat.ceaMaiMareDiferenta.delta !== 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4 text-sm">
            <p className="text-[var(--color-text)]">
              Cea mai mare diferență a ta:{" "}
              <strong>
                {rezultat.ceaMaiMareDiferenta.emoji} {rezultat.ceaMaiMareDiferenta.label}
              </strong>{" "}
              ({rezultat.ceaMaiMareDiferenta.delta > 0 ? "+" : ""}
              {rezultat.ceaMaiMareDiferenta.delta} puncte față de alocarea reală).
            </p>
            <Link
              href="/bugetare-participativa"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:underline"
            >
              Transformă diferența în acțiune — propune o prioritate
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={share}
            className="btn-press inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-1)] hover:opacity-90 transition"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
            {copied ? "Copiat — lipește-l oriunde" : "Distribuie rezultatul"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Încearcă din nou
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categorii.map((c) => (
        <div key={c.key} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-[var(--shadow-1)]">
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor={`sim-${c.key}`} className="text-sm font-semibold text-[var(--color-text)]">
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </label>
            <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">{alloc[c.key] ?? 0}%</span>
          </div>
          <input
            id={`sim-${c.key}`}
            type="range"
            min={0}
            max={50}
            step={1}
            value={alloc[c.key] ?? 0}
            onChange={(e) => setAlloc((p) => ({ ...p, [c.key]: Number(e.target.value) }))}
            className="w-full accent-[var(--color-primary)]"
          />
        </div>
      ))}

      {/* Total + acțiuni */}
      <div className="sticky bottom-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3.5 shadow-[var(--shadow-3)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Total alocat:{" "}
            <span className={`tabular-nums font-extrabold ${total === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {total}%
            </span>{" "}
            <span className="text-xs text-[var(--color-text-muted)]">(trebuie exact 100%)</span>
          </p>
          {total !== 100 && total > 0 && (
            <button
              type="button"
              onClick={() => setAlloc((p) => echilibreazaLa100(p, categorii.map((c) => c.key)))}
              className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] transition"
            >
              ⚖️ Echilibrează la 100%
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={total !== 100}
          className="btn-press inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-1)] transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Scale size={15} aria-hidden="true" />
          Dezvăluie bugetul real
        </button>
      </div>
    </div>
  );
}
