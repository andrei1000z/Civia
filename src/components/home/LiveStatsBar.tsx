"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, CheckCircle2, Megaphone } from "lucide-react";

interface LiveData {
  totalSesizari: number;
  inLucru: number;
  rezolvate: number;
  petitiiActive: number;
}

/**
 * Ticker național — sesizări totale + în lucru + rezolvate (≥3 ca să nu
 * pară gol) + petiții active.
 *
 * 5/12/2026: scos AQI după ștergerea completă a /aer.
 */
export function LiveStatsBar() {
  const [data, setData] = useState<LiveData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchJson = async <T,>(url: string, fallback: T): Promise<T> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return fallback;
        return (await res.json()) as T;
      } catch {
        return fallback;
      }
    };
    Promise.all([
      fetchJson<{ data: { total: number; today: number; inLucru: number; rezolvate?: number } | null }>(
        "/api/statistici/summary",
        { data: null },
      ),
      fetchJson<{ data: { active: number } | null }>(
        "/api/petitii/count",
        { data: { active: 0 } },
      ),
    ]).then(([summary, petitii]) => {
      if (cancelled) return;
      const s = summary.data ?? { total: 0, today: 0, inLucru: 0, rezolvate: 0 };
      setData({
        totalSesizari: s.total,
        inLucru: s.inLucru,
        rezolvate: s.rezolvate ?? 0,
        petitiiActive: petitii.data?.active ?? 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data
    ? [
        {
          icon: Activity,
          text: `${data.totalSesizari.toLocaleString("ro-RO")} sesizări totale`,
          color: "text-emerald-500",
        },
        {
          icon: Clock,
          text: `${data.inLucru.toLocaleString("ro-RO")} sesizări în lucru`,
          color: "text-amber-500",
        },
        ...(data.rezolvate >= 3
          ? [
              {
                icon: CheckCircle2,
                text: `${data.rezolvate.toLocaleString("ro-RO")} sesizări rezolvate`,
                color: "text-green-600",
              },
            ]
          : []),
        ...(data.petitiiActive >= 1
          ? [
              {
                icon: Megaphone,
                text: `${data.petitiiActive.toLocaleString("ro-RO")} petiții active`,
                color: "text-purple-500",
              },
            ]
          : []),
      ]
    : [
        { icon: Activity, text: "Se încarcă statisticile live...", color: "text-[var(--color-text-muted)]" },
      ];

  return (
    <section
      aria-label="Statistici live Civia"
      className="bg-[var(--color-surface)] border-b border-[var(--color-border)] overflow-hidden"
      // height fix (nu minHeight) — minHeight permitea variatii in inaltime cand
      // continutul wrap-uia pe mobile. height fix asigura zero CLS la mount.
      style={{ height: "44px" }}
    >
      <div className="relative">
        {/*
          The ticker math: animation translates the inner row by -50%,
          so the second copy lands exactly where the first one was —
          seamless loop. That math only works when the row's own width
          equals the SUM of its children, not the parent. Without
          `w-max`, a default `display:flex` block takes the parent's
          width (≈ viewport), so `-50%` equals half a viewport — and
          when the content is shorter than 2× viewport you get a
          visible gap between sets that "teleports" back. Setting the
          flex row to `w-max` (= width: max-content) pins its width to
          its content, so -50% lines up perfectly with one set's
          width. The list is duplicated 4× as a safety belt for very
          wide screens / very few stats — the loop still uses -50%
          (= halfway through 4 sets, identical to start).
        */}
        <div className="flex w-max animate-ticker whitespace-nowrap" aria-hidden="true">
          {[...stats, ...stats, ...stats, ...stats].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-6 py-3 text-sm shrink-0 border-r border-[var(--color-border)]"
              >
                <Icon size={16} className={stat.color} aria-hidden="true" />
                <span className="text-[var(--color-text)]">{stat.text}</span>
              </div>
            );
          })}
        </div>
        <div className="sr-only">
          {stats.map((s, i) => (
            <span key={i}>
              {s.text}
              {i < stats.length - 1 ? ". " : ""}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
