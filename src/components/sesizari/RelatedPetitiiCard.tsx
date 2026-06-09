"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ScrollText, ArrowRight } from "lucide-react";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";
import { CTA } from "@/lib/constants";
import type { RelatedPetitie } from "@/lib/petitii/related";

/**
 * Chaining sesizare→petiție (Faza 1) — card „Următorul pas" în SuccessScreen.
 * După ce a trimis o sesizare, propunem petiții pe aceeași temă (la momentul de
 * intenție maximă). Județul se derivă din sector (S1-S6 ⇒ B) sau din locație.
 * Zero rezultate / loading → return null (fără flicker, fără layout shift).
 */
export function RelatedPetitiiCard({
  tip,
  locatie,
  sector,
}: {
  tip: string;
  locatie: string;
  sector?: string | null;
}) {
  const [petitii, setPetitii] = useState<RelatedPetitie[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    // Județ: sectorul (București) e semnal mai sigur decât textul locației.
    const county = sector && /^S[1-6]$/i.test(sector) ? "B" : detectCountyFromLocatie(locatie);
    const params = new URLSearchParams({ tip });
    if (county) params.set("county", county);

    fetch(`/api/petitii/related?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ok?: boolean; petitii?: RelatedPetitie[] } | null) => {
        if (json?.ok && Array.isArray(json.petitii)) setPetitii(json.petitii);
      })
      .catch(() => {
        /* abort / network — lăsăm cardul ascuns */
      });

    return () => ctrl.abort();
  }, [tip, locatie, sector]);

  // Loading sau zero rezultate → nu randăm nimic.
  if (!petitii || petitii.length === 0) return null;

  return (
    <div className="mt-6 p-4 sm:p-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-primary)] mb-2 inline-flex items-center gap-1">
        <Sparkles size={11} aria-hidden="true" /> Și la nivel național?
      </p>
      <h3 className="font-semibold text-sm sm:text-base mb-1 text-[var(--color-text)]">
        Există petiții pe aceeași temă — adaugă-ți vocea
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
        Sesizarea rezolvă problema local. Petiția împinge schimbarea la nivel de
        politică. Semnează în 10 secunde:
      </p>

      <ul className="space-y-2">
        {petitii.map((p) => {
          const pct =
            p.target_signatures > 0
              ? Math.min(100, Math.round((p.signature_count / p.target_signatures) * 100))
              : 0;
          return (
            <li key={p.slug}>
              <Link
                href={`/petitii/${p.slug}`}
                className="group block p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-2)] transition-all"
              >
                <div className="flex items-start gap-2">
                  <ScrollText
                    size={15}
                    className="text-[var(--color-primary)] mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                      {p.title}
                    </p>
                    {p.target_signatures > 0 && (
                      <>
                        <div className="mt-1.5 h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums">
                          {p.signature_count.toLocaleString("ro-RO")} semnături
                        </p>
                      </>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] shrink-0 mt-0.5">
                    {CTA.PETITION_HERO}
                    <ArrowRight
                      size={13}
                      className="group-hover:translate-x-0.5 transition-transform"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
