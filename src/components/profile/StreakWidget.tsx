"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

interface Props {
  userId: string;
}

/**
 * Civic Streak — prominent retention widget (audit item #110).
 *
 * Shows the current consecutive-day streak with anti-churn psychology:
 *   • > 0  → flame icon + "X zile la rând. Nu rupe lanțul!"
 *   • = 0  → soft prompt: "Pornește un streak azi cu o acțiune civică"
 *
 * Backed by /api/profile/[id]/badges (already returns counts.streak).
 * Self-contained — no parent state, no props beyond userId.
 */
export function StreakWidget({ userId }: Props) {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile/${userId}/badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.data) return;
        setStreak(j.data.counts?.streak ?? 0);
      })
      .catch(() => { /* silent — nice-to-have */ });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (streak === null) {
    return (
      <div
        className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 bg-[var(--color-surface)] animate-pulse"
        aria-label="Se încarcă streak-ul"
      >
        <div className="h-12 w-32 bg-[var(--color-surface-2)] rounded mb-2" />
        <div className="h-4 w-48 bg-[var(--color-surface-2)] rounded" />
      </div>
    );
  }

  const hasStreak = streak > 0;

  // Tier colors — escalate the visual stakes with the number.
  const tier =
    streak >= 100 ? "legend"
      : streak >= 30 ? "diamond"
        : streak >= 7 ? "fire"
          : streak >= 3 ? "spark"
            : streak >= 1 ? "ember"
              : "cold";

  const tierStyle: Record<typeof tier, string> = {
    legend:  "from-amber-500 via-orange-500 to-rose-500",
    diamond: "from-cyan-400 via-sky-500 to-indigo-600",
    fire:    "from-orange-500 via-rose-500 to-rose-600",
    spark:   "from-amber-400 via-orange-500 to-rose-500",
    ember:   "from-amber-300 via-orange-400 to-rose-400",
    cold:    "from-slate-400 via-slate-500 to-slate-600",
  };

  return (
    <div
      className={
        hasStreak
          ? "relative overflow-hidden rounded-[var(--radius-md)] p-5 text-white shadow-[var(--shadow-2)] bg-gradient-to-br " + tierStyle[tier]
          : "border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 bg-[var(--color-surface)]"
      }
    >
      {hasStreak ? (
        <>
          <div className="flex items-baseline gap-3">
            <Flame
              className="w-10 h-10 drop-shadow-md"
              fill="currentColor"
              aria-hidden="true"
            />
            <div>
              <div className="text-4xl font-extrabold tabular-nums leading-none">
                {streak}
              </div>
              <div className="text-xs uppercase tracking-wider opacity-90 mt-1">
                {streak === 1 ? "zi" : "zile"} la rând
              </div>
            </div>
          </div>
          <p className="text-sm mt-3 opacity-95 leading-snug">
            {streak >= 100
              ? "Ești civic guardian. Continuă să fii exemplul comunității."
              : streak >= 30
                ? "O lună întreagă! Comunitatea te urmărește."
                : streak >= 7
                  ? "O săptămână întreagă. Nu rupe lanțul azi!"
                  : streak >= 3
                    ? "Trei zile la rând — abia ai pornit. Mai dă-i puțin foc!"
                    : "Prima zi! Mâine întoarce-te pentru zi 2."}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Flame
              className="w-8 h-8 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
            <div>
              <div className="text-lg font-bold text-[var(--color-text)]">
                Niciun streak activ
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Trimite o sesizare, votează sau lasă un comentariu azi
              </div>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-snug">
            Streak-ul tău urcă pentru fiecare zi consecutivă cu acțiune civică.
            La 3 zile primești prima insignă 🔥.
          </p>
        </>
      )}
    </div>
  );
}
