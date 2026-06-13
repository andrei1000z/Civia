"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, ThumbsUp, Send } from "lucide-react";

interface Stats {
  resolved_today: number;
  new_today: number;
  votes_today: number;
  sent_today: number;
}

const ZERO: Stats = { resolved_today: 0, new_today: 0, votes_today: 0, sent_today: 0 };

/**
 * 🎁 MEDIUM #14 — Counter „Azi pe Civia" homepage.
 *
 * Live counter cu 4 metrici: sesizari rezolvate azi / noi / voturi / trimise.
 * Refresh la 30s automat. CountUp animation gradual.
 */
export function TodayCounter() {
  const [stats, setStats] = useState<Stats>(ZERO);
  const [animated, setAnimated] = useState<Stats>(ZERO);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch("/api/stats/today");
        if (!r.ok) return;
        const data = (await r.json()) as Stats;
        if (mounted && data && typeof data === "object") setStats(data);
      } catch {
        /* silent */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Animate count-up
  useEffect(() => {
    const start = animated;
    const target = stats;
    const dur = 800;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setAnimated({
        resolved_today: Math.round(start.resolved_today + (target.resolved_today - start.resolved_today) * e),
        new_today: Math.round(start.new_today + (target.new_today - start.new_today) * e),
        votes_today: Math.round(start.votes_today + (target.votes_today - start.votes_today) * e),
        sent_today: Math.round(start.sent_today + (target.sent_today - start.sent_today) * e),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  const items = [
    { label: "Rezolvate azi", value: animated.resolved_today, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Sesizări noi", value: animated.new_today, icon: FileText, color: "text-sky-500" },
    { label: "Voturi azi", value: animated.votes_today, icon: ThumbsUp, color: "text-amber-500" },
    { label: "Trimise la primării", value: animated.sent_today, icon: Send, color: "text-violet-500" },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      role="status"
      aria-live="polite"
      aria-label="Statistici Civia astăzi"
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
        >
          <it.icon size={18} className={`${it.color} mb-2`} aria-hidden="true" />
          <p className="text-2xl font-bold tabular-nums">{it.value}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
