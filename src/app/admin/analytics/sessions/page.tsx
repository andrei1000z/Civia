"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Loader2,
  ChevronLeft,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  ArrowRight,
  Search,
  Bot,
  AlertCircle,
  XCircle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Session {
  vid: string;
  lastSeen: number;
  meta: Record<string, string>;
}

const PAGE_SIZE = 50;

// Heuristică pentru detecție bot: pageviews=0 sau UA conține semn de bot.
// Adăugat mai 2026 ca să poți filtra noise-ul în lista de sesiuni.
const BOT_UA_RE = /bot|crawl|spider|scraper|headless|phantom|puppeteer|playwright|axios|curl|wget|python-requests/i;
function isLikelyBot(s: Session): boolean {
  if (s.meta.pageviews === "0" || s.meta.pageviews === undefined) return true;
  const ua = s.meta.user_agent ?? "";
  return BOT_UA_RE.test(ua);
}

function isErroredSession(s: Session): boolean {
  return Number(s.meta.errors ?? "0") > 0 || Number(s.meta.js_errors ?? "0") > 0;
}

function hasFormAbandon(s: Session): boolean {
  return Number(s.meta.form_abandons ?? "0") > 0;
}

function timeSince(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}z`;
}

function flag(country: string): string {
  if (!country || country.length !== 2) return "🌐";
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function deviceIcon(device: string) {
  if (device === "mobile") return <Smartphone size={12} aria-hidden="true" />;
  if (device === "tablet") return <Tablet size={12} aria-hidden="true" />;
  return <Monitor size={12} aria-hidden="true" />;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState("");
  // Filtre noi (mai 2026):
  const [hideBots, setHideBots] = useState(true); // implicit ON
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlyAbandon, setOnlyAbandon] = useState(false);

  const load = async (off: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sessions-list", limit: PAGE_SIZE, offset: off }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setSessions(json.sessions ?? []);
      setTotalCount(json.totalCount ?? 0);
      setOffset(off);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
  }, []);

  const filtered = useMemo(() => {
    let out = sessions;
    if (hideBots) out = out.filter((s) => !isLikelyBot(s));
    if (onlyErrors) out = out.filter(isErroredSession);
    if (onlyAbandon) out = out.filter(hasFormAbandon);
    if (filter.trim()) {
      const f = filter.toLowerCase();
      out = out.filter(
        (s) =>
          s.vid.toLowerCase().includes(f) ||
          (s.meta.country ?? "").toLowerCase().includes(f) ||
          (s.meta.city ?? "").toLowerCase().includes(f) ||
          (s.meta.browser ?? "").toLowerCase().includes(f) ||
          (s.meta.device ?? "").toLowerCase().includes(f) ||
          (s.meta.last_pathname ?? "").toLowerCase().includes(f) ||
          (s.meta.first_referrer ?? "").toLowerCase().includes(f),
      );
    }
    return out;
  }, [sessions, hideBots, onlyErrors, onlyAbandon, filter]);

  // CSV export — generează fișier în memorie + trigger download. User
  // îl deschide în Excel/Sheets pentru analiză avansată (pivot tables,
  // segmentare custom). Include doar sesiunile FILTRATE curent.
  const exportCsv = () => {
    const headers = [
      "vid", "last_seen", "pageviews", "country", "city", "device",
      "browser", "os", "viewport", "first_referrer", "first_pathname",
      "last_pathname", "errors", "form_abandons",
    ];
    const rows = filtered.map((s) => [
      s.vid,
      new Date(s.lastSeen).toISOString(),
      s.meta.pageviews ?? "0",
      s.meta.country ?? "",
      s.meta.city ?? "",
      s.meta.device ?? "",
      s.meta.browser ?? "",
      s.meta.os ?? "",
      s.meta.viewport ?? "",
      s.meta.first_referrer ?? "",
      s.meta.first_pathname ?? "",
      s.meta.last_pathname ?? "",
      s.meta.errors ?? "0",
      s.meta.form_abandons ?? "0",
    ]);
    const escape = (v: string) => {
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => escape(String(c))).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civia-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <header className="mb-6">
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-3 transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" /> Analytics dashboard
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold flex items-center gap-2 mb-2">
          <Users size={26} className="text-[var(--color-primary)]" aria-hidden="true" />
          Sesiuni vizitatori
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Lista vizitatorilor recenți (max {totalCount}). Click pe oricine pentru a vedea timeline-ul complet
          de pageview-uri + click-uri + erori + tot ce a făcut.
        </p>
      </header>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrează după țară, oraș, browser, path, vid..."
            className="w-full h-10 pl-9 pr-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>

        {/* Filter chips + CSV export. Toggle-uri pentru: ascunde bot-i,
            doar sesiuni cu erori, doar cu form abandon. Export CSV
            descarcă DOAR sesiunile filtrate curent (asistent debug). */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip
            active={hideBots}
            onClick={() => setHideBots((v) => !v)}
            icon={Bot}
            label="Ascunde bot-i"
            variant="default"
          />
          <FilterChip
            active={onlyErrors}
            onClick={() => setOnlyErrors((v) => !v)}
            icon={AlertCircle}
            label="Doar cu erori"
            variant="error"
          />
          <FilterChip
            active={onlyAbandon}
            onClick={() => setOnlyAbandon((v) => !v)}
            icon={XCircle}
            label="Doar cu form abandon"
            variant="warning"
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            title="Descarcă sesiunile filtrate curent ca CSV pentru analiză în Excel/Sheets"
          >
            <Download size={12} />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Nicio sesiune nu se potrivește.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const m = s.meta;
            return (
              <Link
                key={s.vid}
                href={`/admin/analytics/sessions/${encodeURIComponent(s.vid)}`}
                className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 hover:border-[var(--color-primary)]/30 hover:shadow-[var(--shadow-1)] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-emerald-900 flex items-center justify-center text-white text-xs font-bold">
                    {(m.country || "??").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-xs text-[var(--color-text)] truncate">
                        {s.vid}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        acum {timeSince(s.lastSeen)} · <span className="tabular-nums">{m.pageviews ?? "?"}</span> pageviews
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap mt-1">
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden="true">{flag(m.country ?? "")}</span>
                        {m.city || m.country || "unknown"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        {deviceIcon(m.device ?? "")}
                        {m.device}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{m.browser} / {m.os}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{m.viewport}</span>
                      {m.first_referrer && m.first_referrer !== "direct" && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Globe size={11} aria-hidden="true" />
                            from {m.first_referrer}
                          </span>
                        </>
                      )}
                    </div>
                    {m.last_pathname && (
                      <p className="text-[11px] text-[var(--color-primary)] mt-1 font-mono truncate">
                        {m.last_pathname}
                      </p>
                    )}
                  </div>
                  <ArrowRight size={14} className="text-[var(--color-text-muted)] shrink-0 mt-3" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Counter cu sumar filtrare */}
      {!loading && (
        <p className="text-[10px] text-[var(--color-text-muted)] mb-2">
          {filtered.length === sessions.length
            ? `${filtered.length} sesiuni`
            : `${filtered.length} din ${sessions.length} sesiuni (după filtre)`}
        </p>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className={cn(
              "h-10 px-4 rounded-[var(--radius-xs)] text-sm font-medium transition-colors",
              offset === 0
                ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed"
                : "bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]",
            )}
          >
            ← Înapoi
          </button>
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} din {totalCount}
          </span>
          <button
            type="button"
            onClick={() => load(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= totalCount}
            className={cn(
              "h-10 px-4 rounded-[var(--radius-xs)] text-sm font-medium transition-colors",
              offset + PAGE_SIZE >= totalCount
                ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed"
                : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]",
            )}
          >
            Înainte →
          </button>
        </div>
      )}
    </div>
  );
}

// Reusable filter chip — toggle state + variant pentru context cromatic.
function FilterChip({
  active,
  onClick,
  icon: Icon,
  label,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Bot;
  label: string;
  variant?: "default" | "error" | "warning";
}) {
  const activeStyles = {
    default: "bg-[var(--color-primary)] text-white border-[var(--color-primary)]",
    error: "bg-rose-500 text-white border-rose-500",
    warning: "bg-amber-500 text-white border-amber-500",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-pill)] border text-xs font-medium transition-all",
        active
          ? activeStyles
          : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40",
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </button>
  );
}
