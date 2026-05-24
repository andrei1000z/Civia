import type { Metadata } from "next";
import { AnalyticsDashboardLazy } from "./AnalyticsDashboardLazy";

export const metadata: Metadata = {
  title: "Analytics — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboardLazy />;
}
