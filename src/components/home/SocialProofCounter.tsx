"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

interface Stats {
  lastHour: number;
  lastDay: number;
  total: number;
}

export function SocialProofCounter() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = () => {
      fetch("/api/sesizari/live-stats", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Stats | null) => {
          if (!cancelled && j) setStats(j);
        })
        .catch(() => { /* silent */ });
    };
    fetchStats();
    // Refresh la 90s (cache server-side e 60s, deci sweet spot).
    const id = setInterval(fetchStats, 90_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!stats || stats.total === 0) return null;

  // Mesaj contextual — preferam ultima ora cand exista activitate fresh.
  let main: string;
  if (stats.lastHour >= 3) {
    main = `${stats.lastHour} cetățeni au depus sesizări în ultima oră`;
  } else if (stats.lastDay >= 3) {
    main = `${stats.lastDay} sesizări noi în ultimele 24h`;
  } else {
    main = `${stats.total} sesizări trimise prin Civia`;
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
      </span>
      <Activity size={11} aria-hidden="true" />
      <span>{main}</span>
    </div>
  );
}
