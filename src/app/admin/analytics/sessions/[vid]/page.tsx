"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import {
  Loader2,
  ChevronLeft,
  Smartphone,
  Monitor,
  Tablet,
  MousePointer2,
  AlertCircle,
  Eye,
  Sparkles,
  Activity,
  ExternalLink,
  Search,
  Wind,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface TimelineEvent {
  t: number;
  type: string;
  pathname?: string;
  label?: string;
  referrer?: string;
  [k: string]: string | number | undefined;
}

interface Meta {
  first_seen?: string;
  last_seen?: string;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  language?: string;
  viewport?: string;
  screen?: string;
  color_scheme?: string;
  connection?: string;
  orientation?: string;
  display_mode?: string;
  timezone?: string;
  pageviews?: string;
  first_pathname?: string;
  first_referrer?: string;
  first_utm_source?: string;
  first_utm_campaign?: string;
  last_pathname?: string;
  last_referrer?: string;
  last_utm_source?: string;
}

const EVENT_ICONS: Record<string, LucideIcon> = {
  pageview: Eye,
  click: MousePointer2,
  "js-error": AlertCircle,
  "ai-chat-message": Sparkles,
  search: Search,
  outbound: ExternalLink,
  "web-vital": Activity,
};

const EVENT_COLORS: Record<string, string> = {
  pageview: "text-emerald-500",
  click: "text-blue-500",
  "js-error": "text-red-500",
  "ai-chat-message": "text-purple-500",
  search: "text-amber-500",
  outbound: "text-sky-500",
  "web-vital": "text-pink-500",
  "404": "text-orange-500",
};

function flag(country: string): string {
  if (!country || country.length !== 2) return "🌐";
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function deviceIcon(device?: string) {
  if (device === "mobile") return <Smartphone size={14} aria-hidden="true" />;
  if (device === "tablet") return <Tablet size={14} aria-hidden="true" />;
  return <Monitor size={14} aria-hidden="true" />;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

function timeSince(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `acum ${s}s`;
  if (s < 3600) return `acum ${Math.round(s / 60)} min`;
  if (s < 86400) return `acum ${Math.round(s / 3600)}h`;
  return `acum ${Math.round(s / 86400)} zile`;
}

export default function SessionDetailPage({ params }: { params: Promise<{ vid: string }> }) {
  const { vid } = use(params);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [meta, setMeta] = useState<Meta>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "session-timeline", vid }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Failed");
        setEvents(json.events ?? []);
        setMeta(json.meta ?? {});
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [vid]);

  const firstSeen = Number(meta.first_seen) || 0;
  const lastSeen = Number(meta.last_seen) || 0;
  const sessionMinutes = firstSeen && lastSeen ? Math.round((lastSeen - firstSeen) / 60000) : 0;

  // Group events by date
  const grouped: Record<string, TimelineEvent[]> = {};
  for (const ev of events) {
    const date = new Date(ev.t).toISOString().slice(0, 10);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(ev);
  }

  return (
    // Layout-ul /admin oferă deja container-narrow + padding (fără dublu wrap).
    <div>
      <header className="mb-6">
        <Link
          href="/admin/analytics/sessions"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-3 transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" /> Toate sesiunile
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-1 inline-flex items-center gap-2">
          <span aria-hidden="true">{flag(meta.country ?? "")}</span>
          <span className="font-mono text-base md:text-xl">{vid}</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {firstSeen
            ? `Activă de ${timeSince(firstSeen)} · ultima activitate ${timeSince(lastSeen)}${sessionMinutes ? ` · sesiune ~${sessionMinutes} min` : ""}`
            : "Necunoscută"}
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Timeline */}
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-4 flex items-center gap-2">
              <Activity size={18} aria-hidden="true" />
              Timeline ({events.length} evenimente)
            </h2>

            {events.length === 0 ? (
              <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center text-sm text-[var(--color-text-muted)]">
                Niciun eveniment înregistrat (vizitator gol sau timeline expirat).
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([date, evs]) => (
                  <section key={date}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 sticky top-0 bg-[var(--color-bg)] py-2 z-10">
                      {new Date(date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
                      <span className="ml-2 text-[var(--color-text)] tabular-nums">({evs.length})</span>
                    </h3>
                    <ol className="space-y-2 border-l-2 border-[var(--color-border)] pl-4 ml-1">
                      {evs.map((ev, i) => {
                        const Icon = EVENT_ICONS[ev.type] ?? Wind;
                        const color = EVENT_COLORS[ev.type] ?? "text-[var(--color-text-muted)]";
                        return (
                          <li key={i} className="relative">
                            <span
                              className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-[var(--color-bg)] border-2 border-current"
                              style={{ borderColor: "currentColor" }}
                            />
                            <div className={color}>
                              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 hover:border-[var(--color-primary)]/30 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                  <Icon size={14} aria-hidden="true" />
                                  <span className="text-xs font-bold uppercase tracking-wider">
                                    {ev.type}
                                  </span>
                                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)] tabular-nums">
                                    {new Date(ev.t).toLocaleTimeString("ro-RO", { timeZone: "Europe/Bucharest" })}
                                  </span>
                                </div>
                                {ev.pathname && (
                                  <p className="font-mono text-xs text-[var(--color-text)] truncate">
                                    {ev.pathname}
                                  </p>
                                )}
                                {ev.label && (
                                  <p className="text-xs text-[var(--color-text)] truncate">
                                    <span className="text-[var(--color-text-muted)]">label:</span>{" "}
                                    <span className="font-medium">{ev.label}</span>
                                  </p>
                                )}
                                {ev.referrer && ev.referrer !== "direct" && (
                                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                                    de la {ev.referrer}
                                  </p>
                                )}
                                {/* Render any other props */}
                                {Object.entries(ev)
                                  .filter(([k]) => !["t", "type", "pathname", "label", "referrer"].includes(k))
                                  .slice(0, 3)
                                  .map(([k, v]) => (
                                    <p key={k} className="text-[10px] text-[var(--color-text-muted)]">
                                      {k}: <span className="text-[var(--color-text)]">{String(v)}</span>
                                    </p>
                                  ))}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar with device fingerprint */}
          <aside className="lg:sticky lg:top-24 space-y-3">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3">
                Device fingerprint
              </h3>
              <dl className="space-y-2 text-xs">
                {meta.device && (
                  <Row label="Device" value={
                    <span className="inline-flex items-center gap-1">
                      {deviceIcon(meta.device)}
                      {meta.device}
                    </span>
                  } />
                )}
                {meta.browser && <Row label="Browser" value={meta.browser} />}
                {meta.os && <Row label="OS" value={meta.os} />}
                {meta.viewport && <Row label="Viewport" value={meta.viewport} />}
                {meta.screen && <Row label="Screen" value={meta.screen} />}
                {meta.orientation && <Row label="Orientare" value={meta.orientation} />}
                {meta.display_mode && <Row label="Display" value={meta.display_mode} />}
                {meta.color_scheme && <Row label="Color scheme" value={meta.color_scheme} />}
                {meta.connection && meta.connection !== "unknown" && (
                  <Row label="Conexiune" value={meta.connection} />
                )}
              </dl>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3">
                Locație + limbă
              </h3>
              <dl className="space-y-2 text-xs">
                {meta.country && <Row label="Țară" value={`${flag(meta.country)} ${meta.country}`} />}
                {meta.city && meta.city !== "unknown, " + meta.country && (
                  <Row label="Oraș" value={meta.city} />
                )}
                {meta.language && <Row label="Limbă" value={meta.language} />}
                {meta.timezone && meta.timezone !== "unknown" && (
                  <Row label="Timezone" value={meta.timezone} />
                )}
              </dl>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3">
                Acquisition
              </h3>
              <dl className="space-y-2 text-xs">
                {meta.first_pathname && <Row label="Landing" value={meta.first_pathname} mono />}
                {meta.first_referrer && (
                  <Row label="From" value={meta.first_referrer === "direct" ? "direct (typed/saved)" : meta.first_referrer} />
                )}
                {meta.first_utm_source && <Row label="UTM source" value={meta.first_utm_source} />}
                {meta.first_utm_campaign && <Row label="UTM campaign" value={meta.first_utm_campaign} />}
                {meta.pageviews && <Row label="Pageviews" value={meta.pageviews} />}
              </dl>
            </div>

            {firstSeen && lastSeen && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
                <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3">
                  Sesiune
                </h3>
                <dl className="space-y-2 text-xs">
                  <Row label="Prima activitate" value={formatTime(firstSeen)} />
                  <Row label="Ultima activitate" value={formatTime(lastSeen)} />
                  <Row label="Durată" value={`${sessionMinutes} min`} />
                </dl>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-semibold shrink-0">
        {label}
      </dt>
      <dd className={`text-[var(--color-text)] text-right truncate min-w-0 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
