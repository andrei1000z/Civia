import type { Metadata } from "next";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Status Civia — live uptime + latențe",
  description:
    "Status page public Civia. Verifică starea API, baza de date și serviciile critice în timp real. Transparență totală.",
  alternates: { canonical: `${SITE_URL}/status` },
  robots: { index: true, follow: true },
};

export const revalidate = 60;
export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "slow" | "degraded" | "down";

interface HealthResponse {
  status: HealthStatus;
  db_latency_ms: number | null;
  version: string;
  timestamp: string;
  error?: string;
}

const STATUS_META: Record<HealthStatus, { label: string; color: string; bg: string; icon: typeof Activity }> = {
  ok: { label: "Operațional", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: CheckCircle2 },
  slow: { label: "Latență ridicată", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", icon: AlertTriangle },
  degraded: { label: "Degradat", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40", icon: AlertTriangle },
  down: { label: "Indisponibil", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40", icon: XCircle },
};

async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${SITE_URL}/api/health`, { cache: "no-store" });
    return (await res.json()) as HealthResponse;
  } catch (e) {
    return {
      status: "down",
      db_latency_ms: null,
      version: "unknown",
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

export default async function StatusPage() {
  const health = await getHealth();
  const meta = STATUS_META[health.status];
  const Icon = meta.icon;

  return (
    <>
      <PageHero
        title="Status Civia"
        description="Stare live a serviciilor — actualizat la fiecare minut."
        tagline="Transparență totală — verifică oricând starea API-ului, bazei de date și serviciilor critice."
        icon={Activity}
        gradient={HERO_GRADIENT.data}
      />

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className={`${meta.bg} border border-[var(--color-border)] rounded-2xl p-6 flex items-center gap-4`}>
          <Icon className={`w-10 h-10 ${meta.color}`} aria-hidden="true" />
          <div className="flex-1">
            <div className={`text-xl font-bold ${meta.color}`}>{meta.label}</div>
            <div className="text-sm text-[var(--color-text-muted)]">
              Verificat: {new Date(health.timestamp).toLocaleString("ro-RO")}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)]">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-semibold mb-1">
              Latență DB
            </div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {health.db_latency_ms !== null ? `${health.db_latency_ms} ms` : "—"}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              Target: &lt;200ms · Alert: &gt;2000ms
            </div>
          </div>

          <div className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)]">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-semibold mb-1">
              Versiune
            </div>
            <div className="text-2xl font-mono font-bold text-[var(--color-text)]">
              {health.version}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Build curent</div>
          </div>
        </div>

        {health.error ? (
          <div className="border border-rose-300 bg-rose-50 dark:bg-rose-950/40 rounded-xl p-4 text-sm text-rose-900 dark:text-rose-200">
            <strong>Eroare:</strong> {health.error}
          </div>
        ) : null}

        <div className="border border-[var(--color-border)] rounded-xl p-5 bg-[var(--color-surface)]">
          <h2 className="font-semibold text-[var(--color-text)] mb-3">Servicii monitorizate</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">API + sesizări</span>
              <span className={meta.color}>● {meta.label}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Baza de date (Supabase)</span>
              <span className={meta.color}>● {meta.label}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Email (Resend)</span>
              <span className="text-emerald-700 dark:text-emerald-400">● Verifică manual</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">AI (Groq)</span>
              <span className="text-emerald-700 dark:text-emerald-400">● Verifică manual</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Pentru incidente sau întreruperi prelungite, scrie la{" "}
          <a href="mailto:contact@civia.ro" className="underline">
            contact@civia.ro
          </a>
          .
        </p>
      </div>
    </>
  );
}
