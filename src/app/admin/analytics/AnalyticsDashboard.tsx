"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity, Users, Eye, Gauge, Globe2, MapPin, Smartphone, Monitor,
  Link2, TrendingUp, Clock, AlertTriangle, RefreshCw, Zap, MousePointerClick,
  Frown, Search, Bot, LogIn, Copy, Download, ExternalLink,
  MessageSquareMore, Mail,
} from "lucide-react";
import { Sparkline } from "@/components/analytics/Sparkline";

interface Vitals {
  p50: number;
  p75: number;
  p95: number;
  rating: Record<string, number>;
  samples: number;
}

interface Summary {
  ok: boolean;
  total: Record<string, string | number>;
  routes: Record<string, string | number>;
  referrers: Record<string, string | number>;
  countries: Record<string, string | number>;
  cities: Record<string, string | number>;
  languages: Record<string, string | number>;
  hourly: Record<string, string | number>;
  errors: Record<string, string | number>;
  errorPaths: Record<string, string | number>;
  eventsTotal: Record<string, string | number>;
  scrollDepth: Record<string, string | number>;
  utmSource: Record<string, string | number>;
  utmMedium: Record<string, string | number>;
  utmCampaign: Record<string, string | number>;
  landingPages: Record<string, string | number>;
  today: { dau: number };
  yesterday: { dau: number };
  wau: number;
  mau: number;
  stickiness: number;
  topUsers: { id: string; views: number }[];
  eventsStream: { t: number; type: string; pathname?: string; country?: string; city?: string; device?: string; referrer?: string; userId?: string | null }[];
  perf: { avgLoadTime: number; avgTimeOnPage: number };
  vitals: Record<string, Vitals>;
  clicks: Record<string, string | number>;
  outbound: Record<string, string | number>;
  rageClicks: Record<string, string | number>;
  searchTerms: Record<string, string | number>;
  searchZero: Record<string, string | number>;
  aiUsage: Record<string, string | number>;
  authEvents: Record<string, string | number>;
  formAbandon: Record<string, string | number>;
  formAbandonFields?: Record<string, string | number>;
  visionConfidence?: Record<string, string | number>;
  visionTips?: Record<string, string | number>;
  visionAuthorities?: Record<string, string | number>;
  visionAcceptance?: Record<string, string | number>;
  sessionsPerReferrer?: Record<string, string | number>;
  nonBouncesPerReferrer?: Record<string, string | number>;
  copyEvents: Record<string, string | number>;
  pwaEvents: Record<string, string | number>;
  funnels: Record<string, Record<string, string | number>>;
  feedback: Array<{
    t: number;
    kind: string;
    message: string;
    email: string | null;
    userId: string | null;
    country: string | null;
    pathname: string | null;
  }>;
  feedbackCounts: Record<string, string | number>;
  newsletter: Array<{
    t: number;
    email: string;
    sectors: string[];
    country: string | null;
  }>;
  newsletterCounts: Record<string, string | number>;
  // Insights noi (mai 2026):
  // rageClicksPerRoute: chei „path|label" → count (ex: „/sesizari|Trimite"=12)
  // lcpPerRoute: chei „path|rating" → count (ex: „/harti|poor"=47)
  // trendDau7d: ultimele 7 zile DAU (vechi → recent) pentru sparkline
  rageClicksPerRoute?: Record<string, string | number>;
  lcpPerRoute?: Record<string, string | number>;
  trendDau7d?: number[];
  serverTime: number;
}

const VITAL_UNIT: Record<string, string> = {
  LCP: "ms", INP: "ms", FCP: "ms", TTFB: "ms", CLS: "",
};

function formatVital(name: string, v: number): string {
  if (name === "CLS") return v.toFixed(3);
  return `${Math.round(v)}${VITAL_UNIT[name] ?? "ms"}`;
}

function vitalColor(name: string, p75: number): string {
  // web.dev thresholds
  const t: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };
  const [good, poor] = t[name] ?? [Infinity, Infinity];
  if (p75 <= good) return "#059669";
  if (p75 <= poor) return "#F59E0B";
  return "#DC2626";
}

const COUNTRY_FLAGS: Record<string, string> = {
  RO: "🇷🇴", MD: "🇲🇩", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷",
  IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", AT: "🇦🇹", CH: "🇨🇭", BE: "🇧🇪",
  IE: "🇮🇪", PT: "🇵🇹", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮",
  PL: "🇵🇱", CZ: "🇨🇿", HU: "🇭🇺", BG: "🇧🇬", GR: "🇬🇷", TR: "🇹🇷",
};

function toNum(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v) || 0;
  return 0;
}

function sum(rec: Record<string, string | number>): number {
  return Object.values(rec).reduce<number>((s, v) => s + toNum(v), 0);
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function StatCard({
  icon: Icon, label, value, sub, accent = "#2563EB", sparkline,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  /** Optional 7-day trend visualization in top-right corner. */
  sparkline?: { data: number[]; variant?: "primary" | "success" | "danger" | "warning"; title?: string };
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 relative">
      {sparkline && (
        <div className="absolute top-3 right-3" aria-hidden="true">
          <Sparkline {...sparkline} />
        </div>
      )}
      <Icon size={18} style={{ color: accent }} className="mb-2" />
      <p className="text-3xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

function BreakdownList({
  title, icon: Icon, data, max = 12, labelFn,
}: {
  title: string;
  icon: React.ElementType;
  data: Record<string, string | number>;
  max?: number;
  labelFn?: (k: string) => string;
}) {
  const entries = Object.entries(data || {})
    .map(([k, v]) => [k, toNum(v)] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-[var(--color-text-muted)]" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Fără date</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([k, v]) => {
            const pct = Math.round((v / total) * 100);
            return (
              <div key={k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate pr-2">{labelFn ? labelFn(k) : k}</span>
                  <span className="text-[var(--color-text-muted)] tabular-nums">
                    {fmt(v)} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HourlyChart({ data }: { data: Record<string, string | number> }) {
  // Build last 24 hourly buckets
  const now = new Date();
  const buckets: { label: string; value: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600_000);
    const key = `${d.toISOString().slice(0, 13).replace("T", " ")}`;
    buckets.push({ label: `${d.getUTCHours().toString().padStart(2, "0")}`, value: toNum(data[key]) });
  }
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-[var(--color-text-muted)]" />
        <h3 className="font-semibold text-sm">Vizualizări · ultimele 24h (UTC)</h3>
      </div>
      <div className="flex items-end gap-1 h-32">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${b.label}:00 — ${b.value}`}>
            <div
              className="w-full bg-[var(--color-primary)] rounded-t-sm transition-all"
              style={{ height: `${Math.max(2, (b.value / max) * 100)}%`, opacity: b.value > 0 ? 1 : 0.2 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[12]?.label}</span>
        <span>{buckets[23]?.label}</span>
      </div>
    </div>
  );
}

function DeviceBreakdown({ total }: { total: Record<string, string | number> }) {
  const device = {
    mobile: toNum(total.device_mobile),
    desktop: toNum(total.device_desktop),
    tablet: toNum(total.device_tablet),
  };
  const browser: Record<string, number> = {};
  const os: Record<string, number> = {};
  for (const [k, v] of Object.entries(total)) {
    if (k.startsWith("browser_")) browser[k.slice(8)] = toNum(v);
    if (k.startsWith("os_")) os[k.slice(3)] = toNum(v);
  }
  const sumDev = device.mobile + device.desktop + device.tablet || 1;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone size={16} className="text-[var(--color-text-muted)]" />
        <h3 className="font-semibold text-sm">Device · Browser · OS</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(["mobile", "desktop", "tablet"] as const).map((k) => (
          <div key={k} className="text-center p-2 bg-[var(--color-surface-2)] rounded-[var(--radius-xs)]">
            <p className="text-xl font-bold">{Math.round((device[k] / sumDev) * 100)}%</p>
            <p className="text-[10px] text-[var(--color-text-muted)] capitalize">{k}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Browsere</p>
          {Object.entries(browser).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="capitalize">{k}</span>
              <span className="text-[var(--color-text-muted)] tabular-nums">{fmt(v)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Sisteme</p>
          {Object.entries(os).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="capitalize">{k}</span>
              <span className="text-[var(--color-text-muted)] tabular-nums">{fmt(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summary" }),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as Summary;
      setData(json);
      setError(null);
      setLastFetch(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh la 30 secunde (era 5s — prea agresiv, request waste).
  // User poate trigger manual refresh prin tasta R sau butonul refresh.
  // 30s e sweet spot între freshness și economie request count.
  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, [load]);

  // Keyboard shortcut: R pentru manual refresh (skip pe inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.ctrlKey || e.metaKey) return; // ctrl+R reload normal
      load();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-muted)]">
        <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
        Se încarcă analytics...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle size={24} className="mx-auto mb-2 text-red-500" />
        <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
        <button
          onClick={load}
          className="mt-4 px-4 py-2 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm"
        >
          Reîncearcă
        </button>
      </div>
    );
  }

  if (!data) return null;

  const views = toNum(data.total.views);
  const dauDelta = data.today.dau - data.yesterday.dau;
  const errorCount = sum(data.errors);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold">📊 Analytics</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Actualizare la 5 sec · ultima: {lastFetch ? new Date(lastFetch).toLocaleTimeString() : "-"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/analytics/sessions"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] hover:bg-[var(--color-primary)] hover:text-white text-xs font-medium transition-colors"
          >
            <Users size={14} />
            Sesiuni vizitatori
          </Link>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-xs"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Weekly compare */}
      <WeeklyCompare />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="DAU (azi)"
          value={fmt(data.today.dau)}
          sub={`ieri: ${data.yesterday.dau} (${dauDelta >= 0 ? "+" : ""}${dauDelta})`}
          accent="#2563EB"
          sparkline={
            data.trendDau7d && data.trendDau7d.length > 0
              ? {
                  data: data.trendDau7d,
                  variant: dauDelta >= 0 ? "success" : "danger",
                  title: `DAU ultimele 7 zile: ${data.trendDau7d.join(" → ")}`,
                }
              : undefined
          }
        />
        <StatCard icon={Activity} label="WAU" value={fmt(data.wau)} accent="#8B5CF6" />
        <StatCard
          icon={TrendingUp}
          label="MAU"
          value={fmt(data.mau)}
          sub={`stickiness: ${data.stickiness}%`}
          accent="#059669"
        />
        <StatCard icon={Eye} label="Vizualizări totale" value={fmt(views)} accent="#F59E0B" />
        <StatCard
          icon={Gauge}
          label="Load time mediu"
          value={`${data.perf.avgLoadTime}ms`}
          accent="#0891B2"
        />
        <StatCard
          icon={Clock}
          label="Timp pe pagină"
          value={`${Math.round(data.perf.avgTimeOnPage / 1000)}s`}
          accent="#DB2777"
        />
        <StatCard
          icon={AlertTriangle}
          label="Erori JS"
          value={fmt(errorCount)}
          accent={errorCount > 0 ? "#DC2626" : "#6B7280"}
        />
        <StatCard
          icon={Link2}
          label="Custom events"
          value={fmt(sum(data.eventsTotal))}
          accent="#7C3AED"
        />
      </div>

      {/* Hourly chart */}
      <HourlyChart data={data.hourly} />

      {/* Breakdown grids */}
      <div className="grid md:grid-cols-2 gap-4">
        <BreakdownList
          title="Țări"
          icon={Globe2}
          data={data.countries}
          labelFn={(k) => `${COUNTRY_FLAGS[k] || "🌐"} ${k}`}
        />
        <BreakdownList title="Orașe" icon={MapPin} data={data.cities} />
        <BreakdownList title="Top pagini" icon={Eye} data={data.routes} max={15} />
        <BreakdownList title="Surse trafic" icon={Link2} data={data.referrers} max={15} />
        <BreakdownList title="Landing pages" icon={TrendingUp} data={data.landingPages} max={10} />
        <BreakdownList title="Limbi browser" icon={Globe2} data={data.languages} />
        <DeviceBreakdown total={data.total} />
        <BreakdownList title="Scroll depth %" icon={Monitor} data={data.scrollDepth} />
      </div>

      {/* UTM */}
      {(sum(data.utmSource) > 0 || sum(data.utmCampaign) > 0) && (
        <div className="grid md:grid-cols-3 gap-4">
          <BreakdownList title="UTM source" icon={Link2} data={data.utmSource} />
          <BreakdownList title="UTM medium" icon={Link2} data={data.utmMedium} />
          <BreakdownList title="UTM campaign" icon={Link2} data={data.utmCampaign} />
        </div>
      )}

      {/* Errors */}
      {errorCount > 0 && (
        <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-[var(--radius-md)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-semibold text-sm">Erori JavaScript</h3>
          </div>
          <div className="space-y-1 text-xs font-mono">
            {Object.entries(data.errors)
              .sort((a, b) => toNum(b[1]) - toNum(a[1]))
              .slice(0, 10)
              .map(([err, n]) => (
                <div key={err} className="flex justify-between gap-4 py-1 border-b border-[var(--color-border)] last:border-0">
                  <span className="truncate text-red-500">{err}</span>
                  <span className="text-[var(--color-text-muted)] shrink-0 tabular-nums">{toNum(n)}×</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Custom events */}
      {sum(data.eventsTotal) > 0 && (
        <BreakdownList title="Custom events" icon={Activity} data={data.eventsTotal} max={20} />
      )}

      {/* Web Vitals */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[var(--color-text-muted)]" />
          <h3 className="font-semibold text-sm">Web Vitals · performanță percepută</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["LCP", "INP", "CLS", "FCP", "TTFB"] as const).map((v) => {
            const d = data.vitals?.[v];
            if (!d) return null;
            const color = vitalColor(v, d.p75);
            return (
              <div key={v} className="p-3 bg-[var(--color-surface-2)] rounded-[var(--radius-xs)]">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-semibold tracking-wider">{v}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">n={d.samples}</span>
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color }}>
                  {d.samples === 0 ? "—" : formatVital(v, d.p75)}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  p50: {formatVital(v, d.p50)} · p95: {formatVital(v, d.p95)}
                </div>
                <div className="flex gap-1 mt-2 text-[10px]">
                  <span className="text-emerald-600">✓ {d.rating.good ?? 0}</span>
                  <span className="text-amber-500">! {d.rating["needs-improvement"] ?? 0}</span>
                  <span className="text-red-600">✗ {d.rating.poor ?? 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sesizare funnel */}
      {data.funnels && Object.keys(data.funnels).length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[var(--color-text-muted)]" />
            <h3 className="font-semibold text-sm">Funnel creare sesizare</h3>
          </div>
          {Object.entries(data.funnels).map(([funnel, steps]) => {
            const STEPS = ["start", "tip-selected", "ai-improve", "ai-improve-vision", "submitted"];
            const startCount = toNum(steps.start);
            return (
              <div key={funnel} className="space-y-2">
                {STEPS.filter((s) => steps[s] !== undefined).map((s) => {
                  const count = toNum(steps[s]);
                  const pct = startCount > 0 ? Math.round((count / startCount) * 100) : 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{s}</span>
                        <span className="text-[var(--color-text-muted)] tabular-nums">
                          {count} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-primary)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {toNum(steps.error) > 0 && (
                  <p className="text-xs text-red-500 mt-2">
                    ⚠ {toNum(steps.error)} erori la submit
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Click + outbound + rage */}
      <div className="grid md:grid-cols-2 gap-4">
        <BreakdownList title="Top click-uri (butoane + CTA)" icon={MousePointerClick} data={data.clicks} max={15} />
        <BreakdownList title="Link-uri externe" icon={ExternalLink} data={data.outbound} max={15} />
      </div>

      {/* Rage clicks — frustration */}
      {sum(data.rageClicks) > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[var(--color-surface)] border border-amber-500/30 rounded-[var(--radius-md)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Frown size={16} className="text-amber-500" />
              <h3 className="font-semibold text-sm">Rage clicks · pe label</h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              3+ click-uri în aceeași zonă în &lt;1s → butonul pare nefuncțional.
            </p>
            <BreakdownList title="" icon={Frown} data={data.rageClicks} max={10} />
          </div>

          {/* B1 NOU: Top pagini cu rage clicks (per route).
              Scopul: vezi exact ce pagină are UX bug, nu doar ce label. */}
          {data.rageClicksPerRoute && Object.keys(data.rageClicksPerRoute).length > 0 && (
            <div className="bg-[var(--color-surface)] border border-amber-500/30 rounded-[var(--radius-md)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Frown size={16} className="text-amber-500" />
                <h3 className="font-semibold text-sm">Top pagini cu rage clicks</h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                Pagina + butonul exact unde users se enervează. Click-trough la pagină pentru context.
              </p>
              <ul className="space-y-1.5">
                {Object.entries(data.rageClicksPerRoute)
                  .map(([k, v]) => ({ k, v: Number(v) }))
                  .sort((a, b) => b.v - a.v)
                  .slice(0, 10)
                  .map(({ k, v }) => {
                    const [path, label] = k.split("|");
                    return (
                      <li key={k} className="flex items-start gap-2 text-xs">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold tabular-nums shrink-0">
                          {v}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={path ?? "/"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] text-[var(--color-primary)] hover:underline truncate block"
                          >
                            {path ?? "(unknown)"}
                          </a>
                          <span className="text-[var(--color-text-muted)] truncate block">
                            {label ?? "(no label)"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* B5 NOU: Cele mai lente pagini după LCP rating.
          lcpPerRoute conține chei „path|rating" (good/needs-improvement/poor).
          Sortăm pagini după proporția de "poor" — astea sunt cele care fac
          users să plece înainte să vadă conținutul. */}
      {data.lcpPerRoute && Object.keys(data.lcpPerRoute).length > 0 && (() => {
        // Aggregate per path
        const perPath: Record<string, { good: number; ni: number; poor: number; total: number }> = {};
        for (const [k, v] of Object.entries(data.lcpPerRoute)) {
          const [path, rating] = k.split("|");
          if (!path || !rating) continue;
          const n = Number(v);
          perPath[path] ??= { good: 0, ni: 0, poor: 0, total: 0 };
          if (rating === "good") perPath[path].good += n;
          else if (rating === "needs-improvement") perPath[path].ni += n;
          else if (rating === "poor") perPath[path].poor += n;
          perPath[path].total += n;
        }
        const sorted = Object.entries(perPath)
          .filter(([, s]) => s.total >= 3) // ignore noise (path-uri cu < 3 măsurători)
          .sort((a, b) => (b[1].poor / b[1].total) - (a[1].poor / a[1].total))
          .slice(0, 10);
        if (sorted.length === 0) return null;
        return (
          <div className="bg-[var(--color-surface)] border border-rose-500/30 rounded-[var(--radius-md)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-rose-500" />
              <h3 className="font-semibold text-sm">Cele mai lente pagini · după LCP rating</h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Pagini cu cel mai mare procent de „poor" LCP (&gt; 4 secunde). User-ii pleacă înainte să vadă conținutul.
            </p>
            <ul className="space-y-2">
              {sorted.map(([path, s]) => {
                const pctPoor = Math.round((s.poor / s.total) * 100);
                const pctGood = Math.round((s.good / s.total) * 100);
                return (
                  <li key={path} className="text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <a
                        href={path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-[var(--color-primary)] hover:underline truncate"
                      >
                        {path}
                      </a>
                      <span className="text-[10px] tabular-nums text-[var(--color-text-muted)] shrink-0">
                        {s.total} măsurători
                      </span>
                    </div>
                    {/* Stacked bar: good (green) | ni (amber) | poor (red) */}
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
                      <span style={{ width: `${pctGood}%` }} className="bg-emerald-500" />
                      <span style={{ width: `${Math.round((s.ni / s.total) * 100)}%` }} className="bg-amber-500" />
                      <span style={{ width: `${pctPoor}%` }} className="bg-rose-500" />
                    </div>
                    <div className="flex items-center justify-between mt-0.5 text-[10px] text-[var(--color-text-muted)] tabular-nums">
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        {pctPoor}% poor
                      </span>
                      <span>{pctGood}% good</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* Search */}
      <div className="grid md:grid-cols-2 gap-4">
        <BreakdownList title="Căutări populare" icon={Search} data={data.searchTerms} max={15} />
        {sum(data.searchZero) > 0 && (
          <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-[var(--radius-md)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search size={16} className="text-red-500" />
              <h3 className="font-semibold text-sm">Căutări fără rezultate</h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Conținut lipsă — user-ii caută dar nu găsesc. Adaugă pagini pt. aceste queries.
            </p>
            <BreakdownList title="" icon={Search} data={data.searchZero} max={10} />
          </div>
        )}
      </div>

      {/* AI + Auth + PWA + Copy */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sum(data.aiUsage) > 0 && (
          <BreakdownList title="Folosire AI" icon={Bot} data={data.aiUsage} max={10} />
        )}
        {sum(data.authEvents) > 0 && (
          <BreakdownList title="Auth events" icon={LogIn} data={data.authEvents} max={10} />
        )}
        {sum(data.pwaEvents) > 0 && (
          <BreakdownList title="PWA install" icon={Download} data={data.pwaEvents} max={5} />
        )}
        {sum(data.copyEvents) > 0 && (
          <BreakdownList title="Copy events" icon={Copy} data={data.copyEvents} max={5} />
        )}
      </div>

      {/* Form abandon */}
      {sum(data.formAbandon) > 0 && (
        <BreakdownList title="Form abandon · unde pleacă user-ii" icon={AlertTriangle} data={data.formAbandon} max={15} />
      )}

      {/* Form abandon per field — granular, complementar cu step de mai sus.
          „sesizare|descriere" = userul era pe field-ul `descriere` cand a
          parasit pagina. Util sa vedem direct pe ce input se blocheaza. */}
      {data.formAbandonFields && sum(data.formAbandonFields) > 0 && (
        <BreakdownList
          title="Form abandon · pe ce field a parasit user-ul"
          icon={AlertTriangle}
          data={data.formAbandonFields}
          max={15}
        />
      )}

      {/* AI vision routing telemetry — confidence bucket, tip distribution,
          si acceptance rate. Triplet care raspunde: „cat e de bun
          modelul + cat de des userii accepta sugestia". */}
      {data.visionConfidence && sum(data.visionConfidence) > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <BreakdownList
            title="AI vision · distributie confidence"
            icon={AlertTriangle}
            data={data.visionConfidence}
            max={6}
          />
          {data.visionTips && sum(data.visionTips) > 0 && (
            <BreakdownList
              title="AI vision · tipuri detectate"
              icon={AlertTriangle}
              data={data.visionTips}
              max={12}
            />
          )}
          {data.visionAuthorities && sum(data.visionAuthorities) > 0 && (
            <BreakdownList
              title="AI vision · autoritati detectate"
              icon={AlertTriangle}
              data={data.visionAuthorities}
              max={10}
            />
          )}
          {data.visionAcceptance && sum(data.visionAcceptance) > 0 && (
            <BreakdownList
              title="AI vision · acceptance (accepted vs override)"
              icon={AlertTriangle}
              data={data.visionAcceptance}
              max={15}
            />
          )}
        </div>
      )}

      {/* Error paths — where crashes happen */}
      {sum(data.errorPaths) > 0 && (
        <BreakdownList title="Erori per pagină" icon={AlertTriangle} data={data.errorPaths} max={15} />
      )}

      {/* Per-judet errors — derivat din errorPaths agregand prefix-ul de
          county (/cj/... → CJ). Vede care judete au probleme specifice:
          ex daca CJ are 80% din erori si nu apare niciun alt judet → bug
          local. Fara key Redis suplimentar — derivat 100% dashboard-side. */}
      {sum(data.errorPaths) > 0 && (() => {
        const COUNTY_SLUGS = new Set<string>([
          "b", "ab", "ag", "ar", "bc", "bh", "bn", "br", "bt", "bv", "bz",
          "cj", "cl", "cs", "ct", "cv", "db", "dj", "gj", "gl", "gr", "hd",
          "hr", "if", "is", "mh", "mm", "ms", "nt", "ot", "ph", "sb", "sj",
          "sm", "sv", "tl", "tm", "tr", "vl", "vn", "vs",
        ]);
        const byCounty: Record<string, number> = {};
        for (const [path, count] of Object.entries(data.errorPaths)) {
          const c = Number(count) || 0;
          const slug = path.match(/^\/([a-z]{1,2})(?:\/|$)/)?.[1];
          if (slug && COUNTY_SLUGS.has(slug)) {
            byCounty[slug] = (byCounty[slug] ?? 0) + c;
          } else {
            byCounty["(national)"] = (byCounty["(national)"] ?? 0) + c;
          }
        }
        if (Object.keys(byCounty).length === 0) return null;
        return (
          <BreakdownList
            title="Erori per județ (derivat din path)"
            icon={AlertTriangle}
            data={byCounty}
            max={15}
          />
        );
      })()}

      {/* Growth funnel: sesiuni + bounce-rate pe sursa de referrer.
          Sessions = vid-uri unice care au inceput aici. Bounce = sesiuni
          cu un singur pageview. Util sa vedem care canal converteste
          (ex: Reddit are X sesiuni dar Y% bounce → engagement). */}
      {data.sessionsPerReferrer && sum(data.sessionsPerReferrer) > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-[var(--color-primary)]" />
            <h3 className="font-semibold text-sm">Growth funnel · pe sursa de referrer</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 font-semibold">Sursa</th>
                <th className="py-2 font-semibold text-right tabular-nums">Sesiuni</th>
                <th className="py-2 font-semibold text-right tabular-nums">Non-bounces</th>
                <th className="py-2 font-semibold text-right tabular-nums">Bounce rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.sessionsPerReferrer)
                .map(([source, sessionsRaw]) => {
                  const sessions = Number(sessionsRaw) || 0;
                  const nonBounces = Number(data.nonBouncesPerReferrer?.[source] ?? 0) || 0;
                  const bounceRate = sessions > 0 ? Math.round((1 - nonBounces / sessions) * 100) : 0;
                  return { source, sessions, nonBounces, bounceRate };
                })
                .sort((a, b) => b.sessions - a.sessions)
                .slice(0, 12)
                .map((row) => (
                  <tr key={row.source} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 font-medium text-[var(--color-text)]">{row.source}</td>
                    <td className="py-2 text-right tabular-nums">{row.sessions.toLocaleString("ro-RO")}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                      {row.nonBounces.toLocaleString("ro-RO")}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums font-semibold ${
                        row.bounceRate >= 80
                          ? "text-red-600 dark:text-red-400"
                          : row.bounceRate >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {row.bounceRate}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
            Bounce = sesiune cu o singura vizualizare (utilizatorul a inchis pagina fara sa
            mai navigheze). Sub 60% = bun, 60-80% = mediu, peste 80% = atentie.
          </p>
        </div>
      )}

      {/* Feedback inbox — what users told us */}
      {data.feedback && data.feedback.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquareMore size={16} className="text-[var(--color-primary)]" />
              <h3 className="font-semibold text-sm">
                Feedback · {data.feedback.length} mesaje
              </h3>
            </div>
            <div className="flex gap-3 text-[11px]">
              {Object.entries(data.feedbackCounts).map(([k, v]) => (
                <span key={k} className="text-[var(--color-text-muted)]">
                  {k}: <span className="font-semibold text-[var(--color-text)] tabular-nums">{toNum(v)}</span>
                </span>
              ))}
            </div>
          </div>
          <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
            {data.feedback.map((f, i) => (
              <li
                key={i}
                className="p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
              >
                <div className="flex items-center gap-2 mb-2 text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      f.kind === "bug"
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : f.kind === "idea"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : f.kind === "question"
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {f.kind}
                  </span>
                  <span className="text-[var(--color-text-muted)] tabular-nums">
                    {timeAgo(f.t)}
                  </span>
                  {f.country && (
                    <span className="text-[var(--color-text-muted)]">
                      {COUNTRY_FLAGS[f.country] || f.country}
                    </span>
                  )}
                  {f.email && (
                    <a
                      href={`mailto:${f.email}`}
                      className="text-[var(--color-primary)] hover:underline font-mono truncate"
                    >
                      {f.email}
                    </a>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{f.message}</p>
                {f.pathname && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-2 font-mono truncate">
                    ← {f.pathname}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Newsletter subscribers */}
      {data.newsletter && data.newsletter.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-[var(--color-primary)]" />
              <h3 className="font-semibold text-sm">
                Newsletter subscribers · {data.newsletter.length} recente
              </h3>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Total: <span className="font-semibold text-[var(--color-text)] tabular-nums">{toNum(data.newsletterCounts.total)}</span>
            </span>
          </div>
          <ul className="space-y-1 text-xs max-h-[320px] overflow-y-auto pr-2">
            {data.newsletter.map((n, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-[var(--color-surface-2)]"
              >
                <a
                  href={`mailto:${n.email}`}
                  className="font-mono text-[var(--color-primary)] hover:underline truncate"
                >
                  {n.email}
                </a>
                <div className="flex items-center gap-2 shrink-0 text-[var(--color-text-muted)]">
                  {n.country && <span>{COUNTRY_FLAGS[n.country] || n.country}</span>}
                  <span className="tabular-nums">{timeAgo(n.t)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Real-time feed */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[var(--color-text-muted)]" />
          <h3 className="font-semibold text-sm">Live feed · ultimele 50 evenimente</h3>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
        </div>
        <div className="space-y-1 text-xs font-mono max-h-96 overflow-y-auto">
          {data.eventsStream.length === 0 && (
            <p className="text-[var(--color-text-muted)]">Fără evenimente recente</p>
          )}
          {data.eventsStream.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1 border-b border-[var(--color-border)] last:border-0"
            >
              <span className="text-[var(--color-text-muted)] w-10 shrink-0 tabular-nums">{timeAgo(e.t)}</span>
              <span className="shrink-0">{COUNTRY_FLAGS[e.country || ""] || "🌐"}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--color-surface-2)] rounded">
                {e.type}
              </span>
              <span className="truncate text-[var(--color-text)]">{e.pathname || e.type}</span>
              {e.referrer && e.referrer !== "direct" && (
                <span className="text-[var(--color-text-muted)] truncate shrink-0">← {e.referrer}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top users */}
      {data.topUsers.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[var(--color-text-muted)]" />
            <h3 className="font-semibold text-sm">Top utilizatori (după vizualizări)</h3>
          </div>
          <div className="space-y-1 text-xs">
            {data.topUsers.map((u, i) => (
              <div key={u.id} className="flex justify-between py-1 border-b border-[var(--color-border)] last:border-0">
                <span className="font-mono truncate">
                  {i + 1}. {u.id.slice(0, 8)}...
                </span>
                <span className="text-[var(--color-text-muted)] tabular-nums">{fmt(u.views)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WeeklyCompare — săptămâna asta vs săptămâna trecută cu delta-uri
// ─────────────────────────────────────────────────────────────────

interface WeeklyData {
  avgDau: { current: number; previous: number; delta: number; deltaPct: number | null };
  totalViews: { current: number; previous: number; delta: number; deltaPct: number | null };
}

function WeeklyCompare() {
  const [data, setData] = useState<WeeklyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "weekly-compare" }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } catch { /* silent */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <h3 className="font-semibold text-sm mb-3 inline-flex items-center gap-2">
        📅 Săptămâna asta vs săptămâna trecută
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <CompareCard
          label="DAU mediu"
          current={data.avgDau.current}
          previous={data.avgDau.previous}
          deltaPct={data.avgDau.deltaPct}
        />
        <CompareCard
          label="Vizualizări totale"
          current={data.totalViews.current}
          previous={data.totalViews.previous}
          deltaPct={data.totalViews.deltaPct}
        />
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-3">
        Calculat pentru ultimele 7 zile vs cele 7 zile anterioare. DAU mediu = media zilnică.
      </p>
    </div>
  );
}

function CompareCard({
  label,
  current,
  previous,
  deltaPct,
}: {
  label: string;
  current: number;
  previous: number;
  deltaPct: number | null;
}) {
  const dir = current >= previous ? "up" : "down";
  const color = dir === "up" ? "text-emerald-500" : "text-red-500";
  const arrow = dir === "up" ? "↑" : "↓";
  return (
    <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums">
          {current.toLocaleString("ro-RO")}
        </span>
        {deltaPct !== null && (
          <span className={`text-xs font-bold ${color} tabular-nums`}>
            {arrow} {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
        săpt. trecută: <span className="tabular-nums">{previous.toLocaleString("ro-RO")}</span>
      </p>
    </div>
  );
}
