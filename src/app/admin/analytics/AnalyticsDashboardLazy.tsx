"use client";

import nextDynamic from "next/dynamic";

/**
 * Client wrapper pentru lazy-load AnalyticsDashboard.
 *
 * 2026-05-24 — Next 16 nu mai permite `ssr: false` în next/dynamic call-uri
 * direct în Server Components. Mut wrapper în client component.
 *
 * Beneficii păstrate:
 *   - 1168 LOC + recharts NU sunt în main bundle (-200ms initial admin load)
 *   - SSR oricum n-ar fi util (dashboard interactiv, auth-gated)
 */
const AnalyticsDashboard = nextDynamic(
  () => import("./AnalyticsDashboard").then((m) => ({ default: m.AnalyticsDashboard })),
  {
    ssr: false,
    loading: () => (
      <div className="container-narrow py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)] mt-4">Se încarcă dashboardul analitic...</p>
      </div>
    ),
  },
);

export function AnalyticsDashboardLazy() {
  return <AnalyticsDashboard />;
}
