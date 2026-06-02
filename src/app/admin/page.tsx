import Link from "next/link";
import { FileText, Users, Newspaper, ArrowRight, Inbox } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { RefreshStiriButton } from "./RefreshStiriButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = createSupabaseAdmin();

  // ── Beginning of "today" in Bucharest local time, ISO for SQL filter ──
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const [
    totalSesizari,
    totalStiri,
    totalUsers,
    pendingTickets,
    todaySesizari,
    todayStiri,
    todayUsers,
  ] = await Promise.all([
    admin.from("sesizari").select("*", { count: "exact", head: true }),
    admin.from("stiri_cache").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("sesizare_status_tickets")
      .select("*", { count: "exact", head: true })
      .eq("decision", "pending"),
    admin
      .from("sesizari")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("stiri_cache")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
  ]);

  const stats = [
    {
      label: "Sesizări totale",
      value: totalSesizari.count ?? 0,
      delta: todaySesizari.count ?? 0,
      icon: FileText,
      href: "/admin/sesizari",
      color: "#2563EB",
      tint: "from-blue-500/10 to-transparent",
    },
    {
      label: "Articole știri indexate",
      value: totalStiri.count ?? 0,
      delta: todayStiri.count ?? 0,
      icon: Newspaper,
      href: "/stiri",
      color: "#059669",
      tint: "from-emerald-500/10 to-transparent",
    },
    {
      label: "Conturi active",
      value: totalUsers.count ?? 0,
      delta: todayUsers.count ?? 0,
      icon: Users,
      href: "/admin/utilizatori",
      color: "#8B5CF6",
      tint: "from-violet-500/10 to-transparent",
    },
  ];

  const pendingCount = pendingTickets.count ?? 0;

  return (
    <div className="space-y-6">
      {/* 3 hero stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const inner = (
            <>
              <div
                className={`absolute inset-0 rounded-[var(--radius-md)] bg-gradient-to-br ${stat.tint} opacity-80 pointer-events-none`}
                aria-hidden="true"
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-[var(--radius-xs)] grid place-items-center"
                    style={{ backgroundColor: `${stat.color}1a`, color: stat.color }}
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </div>
                  {stat.delta > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ color: stat.color, backgroundColor: `${stat.color}1a` }}
                      title={`${stat.delta} înregistrări noi azi`}
                    >
                      <span aria-hidden="true">●</span>
                      +{stat.delta} azi
                    </span>
                  )}
                </div>
                <p
                  className="text-4xl md:text-5xl font-extrabold tabular-nums leading-none"
                  style={{ color: stat.color }}
                >
                  {stat.value.toLocaleString("ro-RO")}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-2 font-medium uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
              {stat.href && (
                <ArrowRight
                  size={14}
                  className="absolute bottom-4 right-4 text-[var(--color-text-muted)] group-hover:translate-x-0.5 group-hover:text-[var(--color-text)] transition-all"
                  aria-hidden="true"
                />
              )}
            </>
          );

          if (stat.href) {
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group relative block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={stat.label}
              className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5"
              aria-label={`${stat.label}: ${stat.value}`}
            >
              {inner}
            </div>
          );
        })}
      </div>

      {/* Utility action — RSS feed refresh stays accessible since it's
          an *action*, not a duplicate of a nav tab. */}
      <RefreshStiriButton />

      {/* Pending status tickets — propuneri de la cetățeni care așteaptă
          decizie. Renderizat doar când există efectiv treabă. */}
      {pendingCount > 0 && (
        <Link
          href="/admin/sesizari/tickets"
          className="group flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div
            className="w-9 h-9 rounded-full bg-amber-500/20 grid place-items-center text-amber-600 dark:text-amber-400 shrink-0"
            aria-hidden="true"
          >
            <Inbox size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">
              {pendingCount}{" "}
              {pendingCount === 1
                ? "propunere de status așteaptă"
                : "propuneri de status așteaptă"}{" "}
              decizie
            </p>
            <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
              Cetățenii au raportat update-uri (intervenții, înregistrări,
              răspunsuri primite). Aprobă sau respinge.
            </p>
          </div>
          <ArrowRight
            size={14}
            className="text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
