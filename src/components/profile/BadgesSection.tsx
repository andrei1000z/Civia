"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import type { UserBadges } from "@/lib/badges";

interface Props {
  userId: string;
}

/**
 * Afișează badge-urile câștigate + următorul de atins pentru un user.
 * Folosit pe /cont. Public read (vezi /api/profile/[id]/badges).
 *
 * Strategie progres-disclosure: nu copleșim user-ul nou cu 16 badge-uri
 * goale. Arătăm:
 *   • câștigate (cu count actual)
 *   • next într-o categorie (cu „mai aveți X până la următorul")
 *
 * Dacă userul n-a făcut nimic încă, mesaj încurajator + linkuri spre
 * acțiuni („trimite prima sesizare", „votează", etc.).
 */
export function BadgesSection({ userId }: Props) {
  const [data, setData] = useState<{ badges: UserBadges; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile/${userId}/badges`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setData(j.data);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Eroare"));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return null; // silent fail — badges sunt nice-to-have
  }

  if (!data) {
    return (
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 animate-pulse"
        aria-label="Se încarcă insignele"
      >
        <div className="h-4 w-32 bg-[var(--color-surface-2)] rounded mb-3" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-[var(--color-surface-2)] rounded-full" />
          <div className="h-8 w-24 bg-[var(--color-surface-2)] rounded-full" />
        </div>
      </div>
    );
  }

  const { earned, next } = data.badges;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-1)]">
      <h3 className="font-[family-name:var(--font-sora)] font-semibold text-base flex items-center gap-2 mb-3">
        <Award size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        Insignele tale
      </h3>

      {earned.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Nu ai încă insigne. Trimite o sesizare, votează o problemă sau lasă un
          comentariu — fiecare acțiune îți aduce o insignă civică nouă.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {earned.map(({ badge, count }) => (
            <span
              key={badge.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm"
              title={`${badge.description}. Total: ${count}`}
            >
              <span aria-hidden="true">{badge.icon}</span>
              <span className="font-medium">{badge.name}</span>
            </span>
          ))}
        </div>
      )}

      {next.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
            Următoarele insigne
          </p>
          <ul className="space-y-1.5">
            {next.map(({ badge, remaining }) => (
              <li key={badge.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <span aria-hidden="true">{badge.icon}</span>
                  <span>{badge.name}</span>
                </span>
                <span className="text-[var(--color-text-muted)] tabular-nums">
                  mai ai {remaining}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
