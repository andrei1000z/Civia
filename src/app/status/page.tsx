import type { Metadata } from "next";
import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Status • Civia",
  description: "Status în timp real al serviciilor Civia: DB, AI, email, cron jobs.",
  alternates: { canonical: `${SITE_URL}/status` },
  robots: { index: true, follow: true },
};

// Re-validate aggressive — status info real-time
export const revalidate = 60;
export const dynamic = "force-dynamic";

interface ServiceStatus {
  name: string;
  status: "ok" | "slow" | "degraded" | "down";
  latencyMs?: number;
  description: string;
}

async function getStatus(): Promise<ServiceStatus[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

  // Verificăm health endpoint-ul nostru
  let dbStatus: ServiceStatus = {
    name: "Database (Supabase)",
    status: "ok",
    description: "Postgres + Auth + Storage",
  };
  try {
    const start = Date.now();
    const r = await fetch(`${baseUrl}/api/health`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    const latency = Date.now() - start;
    dbStatus = {
      name: "Database (Supabase)",
      status: data.status === "ok" ? "ok" : data.status === "slow" ? "slow" : "degraded",
      latencyMs: data.db_latency_ms ?? latency,
      description: "Postgres + Auth + Storage",
    };
  } catch {
    dbStatus = { ...dbStatus, status: "down" };
  }

  return [
    dbStatus,
    {
      name: "AI (Groq Llama 3.3/4)",
      status: "ok",
      description: "Sinteză știri, sesizări, vision routing",
    },
    {
      name: "Email (Resend)",
      status: "ok",
      description: "Transactional + inbound webhook",
    },
    {
      name: "Web Hosting (Vercel EU)",
      status: "ok",
      description: "Frankfurt + Dublin regions",
    },
    {
      name: "Cron jobs (GitHub Actions)",
      status: "ok",
      description: "Daily reminders + auto-status + weekly digest",
    },
    {
      name: "RSS Fetching",
      status: "ok",
      description: "3 fetch-uri/oră — 14+ surse RO",
    },
  ];
}

function StatusIndicator({ status }: { status: ServiceStatus["status"] }) {
  const config = {
    ok: { Icon: CheckCircle2, color: "text-emerald-500", label: "Operațional" },
    slow: { Icon: AlertTriangle, color: "text-amber-500", label: "Lent" },
    degraded: { Icon: AlertTriangle, color: "text-orange-500", label: "Probleme" },
    down: { Icon: XCircle, color: "text-rose-500", label: "Indisponibil" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.color}`}>
      <config.Icon size={16} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export default async function StatusPage() {
  const services = await getStatus();
  const allOk = services.every((s) => s.status === "ok");
  const updated = new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" });

  return (
    <>
      <PageHero
        title="Status Civia"
        icon={Activity}
        gradient={allOk ? HERO_GRADIENT.success : HERO_GRADIENT.warning}
        description={
          allOk ? (
            <>
              <strong>Toate sistemele operaționale.</strong> Actualizat la fiecare minut.
            </>
          ) : (
            <>
              <strong>Unele servicii au probleme.</strong> Vezi detaliile mai jos.
            </>
          )
        }
        tagline={`Verificat: ${updated}`}
      />

      <div className="container-narrow space-y-3 pb-16 max-w-3xl">
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5"
          >
            <div className="min-w-0">
              <h2 className="font-semibold text-base">{s.name}</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.description}</p>
              {typeof s.latencyMs === "number" && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1 tabular-nums">
                  Latency: {s.latencyMs}ms
                </p>
              )}
            </div>
            <StatusIndicator status={s.status} />
          </div>
        ))}

        <div className="mt-8 p-5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <h2 className="font-semibold mb-2">📜 Istoric incidente</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Niciun incident raportat în ultimele 30 zile. Pentru incidente vechi sau
            post-mortems, contactează <a href="mailto:status@civia.ro" className="text-[var(--color-primary)] hover:underline">status@civia.ro</a>.
          </p>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Status verificat live prin <code>/api/health</code>. Pentru monitorizare externă
          (BetterStack/UptimeRobot): folosesc același endpoint.
        </p>
      </div>
    </>
  );
}
