"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Clock,
  Users,
  ExternalLink,
  List as ListIcon,
  Map as MapIcon,
  Locate,
  Loader2,
  Calendar,
  Share2,
} from "lucide-react";
import {
  type Interruption,
  type InterruptionType,
  TYPE_COLORS,
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/data/intreruperi";
import { ALL_COUNTIES } from "@/data/counties";

const IntreruperiMap = dynamic(() => import("./IntreruperiMap"), {
  ssr: false,
  loading: () => (
    <div className="relative w-full h-[500px] md:h-[600px] bg-[var(--color-surface-2)] overflow-hidden rounded-[var(--radius-md)]">
      <svg
        className="absolute inset-0 w-full h-full opacity-30"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="gridIntr" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gridIntr)" className="text-slate-400" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Se încarcă harta...</p>
      </div>
    </div>
  ),
});

type ViewMode = "list" | "map";
type TypeFilter = "toate" | InterruptionType;
type SortMode = "timp" | "distanta";

const TYPE_TABS: Array<{ value: TypeFilter; label: string }> = [
  { value: "toate", label: "Toate" },
  { value: "apa", label: "Apă" },
  { value: "caldura", label: "Caldură" },
  { value: "gaz", label: "Gaz" },
  { value: "electricitate", label: "Curent" },
  { value: "lucrari-strazi", label: "Stradă" },
];

// Haversine distance în km între 2 puncte lat/lng
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

// Relative time: „În 2h", „Mâine 08:00", „Ieri"
// IMPORTANT: timeZone explicit (Europe/Bucharest) ca server (UTC) și
// client (local) să producă ACELAȘI text. Altfel React hydration error.
//
// Returns null when the time is in the PAST. The chip on InterruptionCard
// composes "se termină ${relativeTime(endAt)}", so a past endAt would
// produce nonsense like "se termină acum 9 min" (= ends 9 min ago).
// Caller falls back to hiding the chip when null.
function relativeTime(iso: string): string | null {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((t - now) / 60_000);
  if (diffMin < 0) return null;
  if (diffMin < 60) return `în ${diffMin} min`;
  if (diffMin < 24 * 60) return `în ${Math.round(diffMin / 60)}h`;
  const d = new Date(t);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (days === 1) return `mâine ${d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" })}`;
  if (days < 7) return d.toLocaleDateString("ro-RO", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
}

function timeRangeLabel(startAt: string, endAt: string): string {
  // sameDay folosește toDateString() care depinde de timezone-ul runtime —
  // pentru consistență server (UTC) ↔ client (Europe/Bucharest) folosim
  // tot timeZone explicit.
  const s = new Date(startAt);
  const e = new Date(endAt);
  const sLocal = s.toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" });
  const eLocal = e.toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" });
  const sameDay = sLocal === eLocal;
  const fmt = (d: Date) =>
    d.toLocaleString("ro-RO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Bucharest",
    });
  if (sameDay) {
    return `${fmt(s)} — ${e.toLocaleString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Bucharest",
    })}`;
  }
  return `${fmt(s)} — ${fmt(e)}`;
}

function durationLabel(startAt: string, endAt: string): string {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "zi" : "zile"}`;
}

export function IntreruperiFilters({
  items,
  hideCountyFilter = false,
}: {
  items: Interruption[];
  /** Cand este folosit pe pagina /intreruperi/[county-slug], judetul e deja
   *  fixat in URL — ascundem dropdown-ul de judet ca sa nu fie redundant. */
  hideCountyFilter?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [type, setType] = useState<TypeFilter>("toate");
  const [county, setCounty] = useState<string>("toate");
  const [sort, setSort] = useState<SortMode>("timp");
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // Warm permission check — dacă user-ul a acordat deja, cerem fix cached
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const nav = navigator as Navigator & {
      permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> };
    };
    if (!nav.permissions?.query) return;
    nav.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => setMe([pos.coords.latitude, pos.coords.longitude]),
          () => { /* ignore */ },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 300_000 },
        );
      })
      .catch(() => { /* ignore */ });
  }, []);

  const requestMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
        setSort("distanta");
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const counties = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.county));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (type !== "toate" && i.type !== type) return false;
      if (county !== "toate" && i.county !== county) return false;
      return true;
    });

    if (sort === "distanta" && me) {
      list = [...list].sort((a, b) => {
        const da =
          a.lat != null && a.lng != null ? distanceKm(me, [a.lat, a.lng]) : Infinity;
        const db =
          b.lat != null && b.lng != null ? distanceKm(me, [b.lat, b.lng]) : Infinity;
        return da - db;
      });
    } else {
      list = [...list].sort((a, b) => {
        if (a.status === "in-desfasurare" && b.status !== "in-desfasurare") return -1;
        if (a.status !== "in-desfasurare" && b.status === "in-desfasurare") return 1;
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      });
    }
    return list;
  }, [items, type, county, sort, me]);

  return (
    <div>
      {/* Filter bar */}
      <div className="-mx-4 px-4 py-3 mb-5 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Filtrează după tip"
            className="flex flex-wrap items-center gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] max-w-full"
          >
            {TYPE_TABS.map((t) => {
              const count = t.value === "toate"
                ? items.length
                : items.filter((i) => i.type === t.value).length;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  role="tab"
                  aria-selected={type === t.value}
                  className={`shrink-0 px-3 h-8 rounded-[var(--radius-xs)] text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                    type === t.value
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                  }`}
                >
                  {t.value !== "toate" && <span aria-hidden="true">{TYPE_ICONS[t.value]}</span>}
                  {t.label}
                  <span className="opacity-70 text-[10px] tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          {!hideCountyFilter && (
            <select
              value={county}
              onChange={(e) => {
                const val = e.target.value;
                // Pe pagina nationala: schimbarea judetului navigheaza la
                // /intreruperi/[county-slug]. Eliminam state-ul local de filtru
                // pentru ca pagina dedicata are URL bookmark-abil + SEO.
                if (val === "toate") {
                  setCounty("toate");
                  return;
                }
                const targetCounty = ALL_COUNTIES.find((c) => c.id === val);
                if (targetCounty) {
                  router.push(`/intreruperi/${targetCounty.slug}`);
                } else {
                  setCounty(val);
                }
              }}
              aria-label="Schimbă județul (deschide pagina dedicată)"
              className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <option value="toate">Toate județele</option>
              {counties.map((c) => {
                const cnt = ALL_COUNTIES.find((co) => co.id === c);
                return (
                  <option key={c} value={c}>
                    {cnt?.name ?? (c === "B" ? "București" : c)}
                  </option>
                );
              })}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              if (!me) requestMe();
              else setSort((s) => (s === "distanta" ? "timp" : "distanta"));
            }}
            disabled={locating}
            aria-pressed={sort === "distanta"}
            title={me ? "Sortează după distanța de la tine" : "Localizează-mă"}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-xs)] border text-xs font-medium transition-colors ${
              sort === "distanta" && me
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
            } ${locating ? "opacity-60" : ""}`}
          >
            {locating ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Locate size={13} aria-hidden="true" />
            )}
            {me ? (sort === "distanta" ? "Distanță" : "Timp") : "Aproape de mine"}
          </button>

          <div
            className="ml-auto inline-flex rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5"
            role="group"
            aria-label="Mod de afișare"
          >
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`px-3 h-9 rounded-[6px] text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                view === "list"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <ListIcon size={13} aria-hidden="true" /> Listă
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              aria-pressed={view === "map"}
              className={`px-3 h-9 rounded-[6px] text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                view === "map"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <MapIcon size={13} aria-hidden="true" /> Hartă
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <div className="text-5xl mb-3 opacity-60" aria-hidden="true">
            🔎
          </div>
          <p className="text-base font-semibold mb-1">
            Nicio întrerupere cu aceste filtre
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Resetează filtrele să vezi tot ce e activ acum.
          </p>
          <button
            type="button"
            onClick={() => {
              setType("toate");
              setCounty("toate");
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            Resetează filtrele <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : view === "map" ? (
        <IntreruperiMap items={filtered} />
      ) : (
        <GroupedList items={filtered} me={me} />
      )}

      <p
        className="text-center text-xs text-[var(--color-text-muted)] mt-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {filtered.length} {filtered.length === 1 ? "întrerupere" : "întreruperi"}
      </p>
    </div>
  );
}

function groupByDay(
  items: Interruption[],
): Array<{ label: string; items: Interruption[] }> {
  const buckets = new Map<string, Interruption[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const item of items) {
    const start = new Date(item.startAt);
    start.setHours(0, 0, 0, 0);
    const days = Math.round((start.getTime() - today.getTime()) / 86_400_000);
    let key: string;
    if (days < 0) key = "Deja în curs";
    else if (days === 0) key = "Astăzi";
    else if (days === 1) key = "Mâine";
    else if (days < 7)
      key = start.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/Bucharest" });
    else
      key = start.toLocaleDateString("ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Bucharest" });

    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}

function GroupedList({
  items,
  me,
}: {
  items: Interruption[];
  me: [number, number] | null;
}) {
  const groups = useMemo(() => groupByDay(items), [items]);
  // groupByDay folosește data curentă pentru bucketing („Astăzi", „Mâine").
  // Server SSR la 23:59 + client hydration la 00:01 = bucket-uri diferite.
  // suppressHydrationWarning pe wrapper anulează eroarea pe rare midnight crossings.
  return (
    <div className="space-y-6" suppressHydrationWarning>
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
            <span
              className={
                g.label === "Astăzi" || g.label === "Deja în curs"
                  ? "inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                  : "inline-block w-2 h-2 rounded-full bg-[var(--color-primary)]"
              }
              aria-hidden="true"
            />
            {g.label} <span className="opacity-60 normal-case">· {g.items.length}</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {g.items.map((i) => {
              const dist =
                me && i.lat != null && i.lng != null
                  ? distanceKm(me, [i.lat, i.lng])
                  : null;
              return <InterruptionCard key={i.id} item={i} distanceKm={dist} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function InterruptionCard({
  item,
  distanceKm: dist,
}: {
  item: Interruption;
  distanceKm: number | null;
}) {
  const isActive = item.status === "in-desfasurare";
  const isUpcoming = item.status === "programat";
  // Hydration-safe: relativeTime() folosește Date.now() care diferă între
  // SSR și CSR cu câteva ms → cauzează React #418/#419 în production.
  // Fix: deferăm până la post-mount, render null pe SSR.
  const [mounted, setMounted] = useState(false);
  // setState in effect is intentional — defer to post-mount so the
  // SSR pass renders absolute time, then swap to relative after
  // hydration. The alternative (rendering null) would shift layout
  // on every card on first paint. ESLint warning is acked.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // relativeTime() returns null when the time is in the past. Combined
  // with isActive/isUpcoming (which trust the scrape-time status), this
  // prevents nonsense chips like "se termină acum 9 min" when an outage
  // whose end-time slipped past hasn't been re-scraped yet.
  const startRel = mounted && isUpcoming ? relativeTime(item.startAt) : null;
  const endRel = mounted && isActive ? relativeTime(item.endAt) : null;
  const startRelative = startRel;
  const endRelative = endRel ? `se termină ${endRel}` : null;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    const url = `${window.location.origin}/intreruperi/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${TYPE_ICONS[item.type]} ${TYPE_LABELS[item.type]} — ${item.addresses[0] ?? ""}`,
          text: item.reason,
          url,
        });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <Link
      href={`/intreruperi/${item.id}`}
      className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-md)] transition-all min-w-0"
      style={{ borderLeftWidth: "4px", borderLeftColor: TYPE_COLORS[item.type] }}
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-xs)] text-lg shrink-0"
            style={{
              backgroundColor: TYPE_COLORS[item.type] + "20",
              color: TYPE_COLORS[item.type],
            }}
            aria-hidden="true"
          >
            {TYPE_ICONS[item.type]}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] flex items-center gap-1">
              {TYPE_LABELS[item.type]}
              {dist != null && (
                <span className="text-blue-500 font-bold normal-case tracking-normal">
                  · {formatDistance(dist)}
                </span>
              )}
            </p>
            <p className="font-semibold text-sm line-clamp-2">{item.reason}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
          style={{
            backgroundColor: STATUS_COLORS[item.status] + "20",
            color: STATUS_COLORS[item.status],
          }}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </div>

      {(startRelative || endRelative) && (
        <div
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full mb-3 ${
            isActive
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          }`}
          suppressHydrationWarning
        >
          <Clock size={10} aria-hidden="true" />
          {isActive ? endRelative : `începe ${startRelative}`}
        </div>
      )}

      {item.excerpt && (
        <p className="text-sm text-[var(--color-text)] mb-3 line-clamp-2">
          {item.excerpt}
        </p>
      )}

      <div className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)] mb-3">
        <div className="flex items-start gap-1.5 min-w-0">
          <MapPin size={12} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            {item.addresses.slice(0, 3).map((addr, i) => (
              <div key={i} className="truncate">
                {addr}
              </div>
            ))}
            {item.addresses.length > 3 && (
              <div className="text-[var(--color-text-muted)] italic">
                + alte {item.addresses.length - 3} adrese
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="shrink-0" />
          <span>
            {timeRangeLabel(item.startAt, item.endAt)}
            <span className="ml-1 opacity-70">
              · {durationLabel(item.startAt, item.endAt)}
            </span>
          </span>
        </div>
        {item.affectedPopulation != null && item.affectedPopulation > 0 && (
          <div className="flex items-center gap-1.5">
            <Users size={12} className="shrink-0" />
            <span>~{item.affectedPopulation.toLocaleString("ro-RO")} persoane</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] gap-2 min-w-0">
        <span className="text-[11px] text-[var(--color-text-muted)] truncate min-w-0 flex-1">
          {item.provider}
          {item.sector && ` · ${item.sector}`}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Distribuie"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <Share2 size={11} aria-hidden="true" />
          </button>
          <a
            href={`/api/intreruperi/${item.id}/ics`}
            onClick={(e) => e.stopPropagation()}
            aria-label="Adaugă în calendar"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            title="Descarcă în calendar (ICS)"
          >
            <Calendar size={11} aria-hidden="true" />
          </a>
          {(item.sourceEntryUrl || item.sourceUrl) && (
            <a
              href={item.sourceEntryUrl || item.sourceUrl!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              title={
                item.sourceEntryUrl
                  ? "Anunțul oficial exact (PDF/pagină)"
                  : `Lista ${item.provider} cu toate anunțurile`
              }
            >
              {item.sourceEntryUrl ? "PDF oficial" : "Vezi la provider"}{" "}
              <ExternalLink size={10} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}
