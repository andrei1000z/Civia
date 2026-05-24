import type { Metadata } from "next";
import nextDynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Analytics — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// 2026-05-24 PERF: lazy-load 1168 LOC + recharts -> -200ms initial admin
// page (din audit Wave 4). ssr:false ok pentru că admin oricum cere auth.
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

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboard />;
}
