import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertCircle, ArrowRight, Mic } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Civia widget",
  description: "Mini-dashboard cu sesizările active — embed pentru widget home screen.",
  robots: { index: false, follow: false }, // nu indexăm widget-ul
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

interface SearchParams {
  judet?: string;
  theme?: "light" | "dark" | "auto";
  size?: "small" | "medium" | "large";
}

/**
 * Pagina widget — optimizată pentru iframe embed în alte aplicații sau
 * încărcată în WebView widget pe Android (Glance + WebView).
 *
 * Stil minimalist, fără chrome (no navbar/footer). Tipografie mare, contrast
 * ridicat. Auto-refresh la 60s prin `revalidate`.
 *
 * URL: /widget?judet=b&theme=auto&size=medium
 */
export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const judet = (params.judet ?? "").toLowerCase();
  const theme = params.theme ?? "auto";
  const size = params.size ?? "medium";

  const admin = createSupabaseAdmin();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const activeQ = admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .not("status", "in", "(rezolvat,respins)");
  const lastDayQ = admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .gte("created_at", yesterday);
  const recentQ = admin
    .from("sesizari")
    .select("code, titlu, locatie, status, created_at")
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(size === "small" ? 1 : size === "medium" ? 3 : 5);

  if (judet) {
    activeQ.eq("county", judet);
    lastDayQ.eq("county", judet);
    recentQ.eq("county", judet);
  }

  const [activeRes, lastDayRes, recentRes] = await Promise.all([
    activeQ,
    lastDayQ,
    recentQ,
  ]);

  const active = activeRes.count ?? 0;
  const lastDay = lastDayRes.count ?? 0;
  const recent = recentRes.data ?? [];

  // Theme — auto = prefers-color-scheme via CSS; light/dark hard-coded
  const wrapperClass =
    theme === "dark"
      ? "bg-slate-900 text-white"
      : theme === "light"
        ? "bg-white text-slate-900"
        : "bg-white text-slate-900 dark:bg-slate-900 dark:text-white";

  return (
    <div
      className={`min-h-[100dvh] ${wrapperClass} p-4 font-sans`}
      style={{ fontFeatureSettings: '"tnum"' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center text-white font-bold text-sm">
            C
          </div>
          <span className="font-bold text-sm">Civia{judet ? ` · ${judet.toUpperCase()}` : ""}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider opacity-50">live</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/20">
          <Activity size={12} className="text-emerald-600 mb-1" aria-hidden="true" />
          <p className="text-2xl font-extrabold tabular-nums leading-none">{active}</p>
          <p className="text-[10px] uppercase tracking-wider opacity-70 mt-1">active</p>
        </div>
        <div className="rounded-lg p-3 bg-blue-500/10 border border-blue-500/20">
          <AlertCircle size={12} className="text-blue-600 mb-1" aria-hidden="true" />
          <p className="text-2xl font-extrabold tabular-nums leading-none">{lastDay}</p>
          <p className="text-[10px] uppercase tracking-wider opacity-70 mt-1">noi 24h</p>
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="space-y-2 mb-3">
          {recent.map((r) => (
            <li key={r.code} className="text-xs leading-tight">
              <span className="font-mono opacity-50 text-[10px]">#{r.code}</span>{" "}
              <span className="font-semibold">{r.titlu}</span>
              <div className="opacity-60 text-[10px] mt-0.5 truncate">{r.locatie}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Link
          href="/sesizari/voce"
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Mic size={12} aria-hidden="true" />
          Voce
        </Link>
        <Link
          href="/sesizari-publice"
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-slate-200 dark:bg-slate-700 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        >
          Vezi tot
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
