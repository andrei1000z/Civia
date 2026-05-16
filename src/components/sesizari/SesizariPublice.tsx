"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ThumbsUp, MessageSquare, MapPin, Filter, Image as ImgIcon, Loader2, Map as MapIconLucide, List, Link as LinkIcon, Check, ChevronDown, X } from "lucide-react";
import dynamic from "next/dynamic";
import { ShareButton } from "./ShareButton";
import { SectorHeatChart } from "./SectorHeatChart";
import { OverdueBadge } from "./OverdueBadge";

const SesizariMap = dynamic(() => import("@/components/maps/SesizariMap").then((m) => m.SesizariMap), { ssr: false });
import { STATUS_COLORS, STATUS_LABELS, SESIZARE_TIPURI } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";
import { timeAgo, cn } from "@/lib/utils";
import { stripForPreview } from "@/lib/privacy";
import { Badge } from "@/components/ui/Badge";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { SesizareFeedRow } from "@/lib/supabase/types";
import { useCountyOptional } from "@/lib/county-context";

type SortKey = "recent" | "votate";
type ViewMode = "list" | "map";

const PAGE_SIZE = 20;

export function SesizariPublice() {
  const county = useCountyOptional();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<SesizareFeedRow[]>([]);
  // Read initial filter state from URL — so shared links carry filters
  const [filterTip, setFilterTip] = useState<string>(
    () => searchParams.get("tip") || "toate",
  );
  const [filterStatus, setFilterStatus] = useState<string>(
    () => searchParams.get("status") || "toate",
  );
  // County filter — only meaningful on the national /sesizari surface;
  // when scoped to /[judet]/sesizari useCountyOptional() pins the
  // county and we hide the dropdown entirely.
  const [filterCounty, setFilterCounty] = useState<string>(
    () => searchParams.get("judet") || "toate",
  );
  const [sort, setSort] = useState<SortKey>(
    () => (searchParams.get("sort") === "votate" ? "votate" : "recent"),
  );
  const [view, setView] = useState<ViewMode>(
    () => (searchParams.get("view") === "map" ? "map" : "list"),
  );
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copied, setCopied] = useState(false);
  // Filtre collapsed default. Deschise automat daca user are filtru activ
  // (ex: a venit din /sesizari?tip=parcare → filtrul e vizibil instant).
  const hasActiveFilter =
    filterTip !== "toate" ||
    filterStatus !== "toate" ||
    filterCounty !== "toate" ||
    sort !== "recent";
  const [filtersOpen, setFiltersOpen] = useState(hasActiveFilter);
  const activeFilterCount =
    (filterTip !== "toate" ? 1 : 0) +
    (filterStatus !== "toate" ? 1 : 0) +
    (filterCounty !== "toate" ? 1 : 0) +
    (sort !== "recent" ? 1 : 0);

  // Push filter state into URL (replace, no history pollution)
  // — so a copy-paste of current URL preserves exact view.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterTip !== "toate") params.set("tip", filterTip);
    if (filterStatus !== "toate") params.set("status", filterStatus);
    if (filterCounty !== "toate" && !county) params.set("judet", filterCounty);
    if (sort !== "recent") params.set("sort", sort);
    if (view !== "list") params.set("view", view);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filterTip, filterStatus, filterCounty, sort, view, router, pathname, county]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // Resolved county filter: route-scoped county wins, otherwise the
  // dropdown selection. When neither is set the API receives no county
  // and returns the full national feed.
  const effectiveCounty = county?.id ?? (filterCounty !== "toate" ? filterCounty : null);

  // "loading" is derived: true when last-fetched key differs from current filter key
  const fetchKey = `${filterTip}|${filterStatus}|${sort}|${effectiveCounty ?? "all"}`;
  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null);
  const loading = lastFetchedKey !== fetchKey;

  // Fetch from API
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filterTip !== "toate") params.set("tip", filterTip);
    if (filterStatus !== "toate") params.set("status", filterStatus);
    if (effectiveCounty) params.set("county", effectiveCounty);
    params.set("sort", sort);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");

    fetch(`/api/sesizari?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? [];
        setRows(data);
        setHasMore(data.length >= PAGE_SIZE);
        setLastFetchedKey(fetchKey);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLastFetchedKey(fetchKey);
      });

    return () => controller.abort();
  }, [filterTip, filterStatus, sort, fetchKey, effectiveCounty]);

  // Realtime: instead of auto-refetching the entire feed on every
  // INSERT (which sent ~10-20 KB through origin per viewer × per new
  // sesizare), we just count the relevant new rows and show a
  // "N sesizări noi — reîmprospătează" pill. The user clicks it
  // when they want to refresh; until then the list is stable AND
  // the origin doesn't ship anything. The Supabase realtime payload
  // is filtered client-side against the current filter set so the
  // count is accurate per view.
  const [pendingNew, setPendingNew] = useState(0);
  // Total platform-wide count (toate aprobate, NU filtrate). User a cerut
  // să apară numărul global de sesizări făcute, nu cele 20 paginate. Sursa:
  // /api/v1/stats (cached 15 min). Fallback la rows.length dacă API eșuează.
  const [totalCount, setTotalCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/v1/stats")
      .then((r) => r.json())
      .then((j) => {
        if (typeof j?.data?.total === "number") setTotalCount(j.data.total);
      })
      .catch(() => { /* silent — fallback la rows.length */ });
  }, []);
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channelName = `sesizari-realtime-${typeof crypto !== "undefined" ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sesizari" },
        (payload: { new: SesizareFeedRow }) => {
          const row = payload.new as SesizareFeedRow;
          if (!row.publica || row.moderation_status !== "approved") return;
          if (effectiveCounty && row.county && row.county !== effectiveCounty) return;
          if (filterTip !== "toate" && row.tip !== filterTip) return;
          if (filterStatus !== "toate" && row.status !== filterStatus) return;
          setPendingNew((n) => n + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveCounty, filterTip, filterStatus, sort]);

  // User-triggered refetch — runs only when the pill is clicked.
  // Hits the same /api/sesizari path that powers the initial load
  // so the row arrives anonymized + truncated like the rest.
  const refreshFeed = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterTip !== "toate") params.set("tip", filterTip);
      if (filterStatus !== "toate") params.set("status", filterStatus);
      if (effectiveCounty) params.set("county", effectiveCounty);
      params.set("sort", sort);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", "0");
      const res = await fetch(`/api/sesizari?${params.toString()}`);
      const j = await res.json();
      const fresh = (j.data ?? []) as SesizareFeedRow[];
      if (fresh.length > 0) setRows(fresh);
      setPendingNew(0);
    } catch {
      // Silent — user can click again.
    }
  }, [filterTip, filterStatus, effectiveCounty, sort]);

  const filtered = rows;

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-1">
          <button
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              view === "list" ? "bg-[var(--color-surface)] shadow-sm" : "text-[var(--color-text-muted)]"
            )}
          >
            <List size={14} /> Listă
          </button>
          <button
            onClick={() => setView("map")}
            aria-pressed={view === "map"}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              view === "map" ? "bg-[var(--color-surface)] shadow-sm" : "text-[var(--color-text-muted)]"
            )}
          >
            <MapIconLucide size={14} /> Hartă
          </button>
        </div>
      </div>

      {/* Filters — hidden on map view; the map already provides spatial
          filtering and the controls just compete with the canvas for
          attention. The list view still gets the full filter bar.
          UX (user request 2026-05-14): „1 buton care deschide aia si
          sa deschida mai mic" → toate dropdown-urile sunt acum
          collapsible sub un singur trigger „Filtrează (N active)".
          Auto-expand daca exista filtre active (deep-link / share). */}
      {view !== "map" && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] mb-5">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-[var(--radius-md)]"
            aria-expanded={filtersOpen}
            aria-controls="sesizari-filtre-panel"
          >
            <span className="inline-flex items-center gap-2">
              <Filter size={15} className="text-[var(--color-text-muted)]" aria-hidden="true" />
              <span className="text-sm font-medium">Filtrează</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-semibold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
              {loading && <Loader2 size={13} className="animate-spin text-[var(--color-text-muted)]" aria-hidden="true" />}
            </span>
            <span className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              {!filtersOpen && (
                <span className="hidden sm:inline">
                  {totalCount !== null ? `${totalCount.toLocaleString("ro-RO")} sesizări` : `${filtered.length}`}
                </span>
              )}
              <ChevronDown
                size={16}
                className={cn(
                  "transition-transform",
                  filtersOpen ? "rotate-180" : "rotate-0",
                )}
                aria-hidden="true"
              />
            </span>
          </button>
          {filtersOpen && (
            <div
              id="sesizari-filtre-panel"
              className="px-4 pb-4 pt-1 border-t border-[var(--color-border)] animate-fade-in"
            >
              <div className={cn(
                "grid gap-2.5 mt-3",
                // 4 cols when county dropdown is shown (national surface),
                // 3 cols when route-scoped county hides the dropdown.
                county ? "sm:grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2 md:grid-cols-4",
              )}>
                <select value={filterTip} onChange={(e) => setFilterTip(e.target.value)} className={selectClass}>
                  <option value="toate">Toate tipurile</option>
                  {SESIZARE_TIPURI.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
                  <option value="toate">Orice status</option>
                  {/* Keep the order in sync with the workflow in
                      src/lib/sesizari/status.ts so the dropdown reads
                      top→bottom the way the lifecycle progresses. */}
                  <option value="nou">Nou</option>
                  <option value="inregistrata">Înregistrată</option>
                  <option value="redirectionata">Redirecționată</option>
                  <option value="in-lucru">În lucru</option>
                  <option value="actiune-autoritate">Acțiune autoritate</option>
                  <option value="interventie">Intervenție</option>
                  <option value="amanata">Amânată</option>
                  <option value="rezolvat">Rezolvat</option>
                  <option value="respins">Respins</option>
                </select>
                {!county && (
                  <select value={filterCounty} onChange={(e) => setFilterCounty(e.target.value)} className={selectClass}>
                    <option value="toate">Toate județele</option>
                    {ALL_COUNTIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass}>
                  <option value="recent">Cele mai recente</option>
                  <option value="votate">Cele mai votate</option>
                </select>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterTip("toate");
                    setFilterStatus("toate");
                    setFilterCounty("toate");
                    setSort("recent");
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                >
                  <X size={12} aria-hidden="true" />
                  Resetează filtrele
                </button>
              )}
            </div>
          )}
          <div className="px-4 pb-4 pt-1 flex flex-wrap items-center justify-between text-xs gap-2 border-t border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)] inline-flex items-center gap-2 flex-wrap">
              <span>
                {totalCount !== null
                  ? `${totalCount.toLocaleString("ro-RO")} sesizări pe Civia`
                  : `${filtered.length} sesizări`}
                {" · 🔴 live"}
              </span>
              {pendingNew > 0 && (
                <button
                  type="button"
                  onClick={refreshFeed}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white font-medium text-[10px] hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  title="Actualizează lista cu noile sesizări"
                >
                  ↻ {pendingNew} {pendingNew === 1 ? "nouă" : "noi"}
                </button>
              )}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={copyUrl}
                className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium"
                title="Copiază link cu filtrul curent"
              >
                {copied ? <Check size={11} /> : <LinkIcon size={11} />}
                {copied ? "Link copiat" : "Copiază link"}
              </button>
              {(() => {
                const params = new URLSearchParams();
                if (filterTip !== "toate") params.set("tip", filterTip);
                if (filterStatus !== "toate") params.set("status", filterStatus);
                if (effectiveCounty) params.set("county", effectiveCounty);
                const exportUrl = `/api/sesizari/export?${params.toString()}`;
                return (
                  <a
                    href={exportUrl}
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium"
                    title="Descarcă CSV cu filtrul curent"
                  >
                    📥 Export CSV
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap pe sectoare — vizibil doar pe view List, doar pentru
          București (county slug „b") sau pe pagina națională unde
          majoritatea sesizărilor sunt din București. Pentru județe
          non-București nu se renderează (component-ul returnează null). */}
      {view === "list" && (!effectiveCounty || effectiveCounty === "b") && (
        <SectorHeatChart judet="b" />
      )}

      {view === "map" && filtered.length > 0 ? (
        <SesizariMap limit={50} height="600px" zoom={12} />
      ) : loading && rows.length === 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 min-w-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-5 w-16 rounded-full bg-[var(--color-surface-2)]" />
                <div className="h-5 w-20 rounded-full bg-[var(--color-surface-2)]" />
              </div>
              <div className="h-5 bg-[var(--color-surface-2)] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[var(--color-surface-2)] rounded w-1/2 mb-3" />
              <div className="h-3 bg-[var(--color-surface-2)] rounded w-full mb-1" />
              <div className="h-3 bg-[var(--color-surface-2)] rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        (() => {
          const hasActiveFilter =
            filterTip !== "toate" || filterStatus !== "toate" || filterCounty !== "toate";
          return (
            <div className="py-20 text-center">
              <div className="text-6xl mb-4 opacity-40">📮</div>
              <p className="text-lg font-semibold mb-2">
                {hasActiveFilter
                  ? "Nu există sesizări cu filtrele actuale"
                  : "Fii primul care semnalează ceva în această zonă"}
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
                {hasActiveFilter
                  ? "Încearcă alte combinații de filtre, sau resetează-le ca să vezi toate sesizările disponibile."
                  : "Platforma e gratuită și nu cere cont. 2 minute — noi scriem textul formal, identificăm autoritatea competentă, tu primești un cod de urmărire."}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTip("toate");
                      setFilterStatus("toate");
                      setFilterCounty("toate");
                      setSort("recent");
                    }}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    <span aria-hidden="true">🔄</span> Resetează filtrele
                  </button>
                )}
                <Link
                  href={county ? `/${county.slug}/sesizari` : "/sesizari"}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
                >
                  Fă o sesizare acum →
                </Link>
              </div>
            </div>
          );
        })()
      ) : (
        <>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 min-w-0">
          {filtered.map((s) => {
            const tipLabel = SESIZARE_TIPURI.find((t) => t.value === s.tip)?.label ?? s.tip;
            const tipIcon = SESIZARE_TIPURI.find((t) => t.value === s.tip)?.icon ?? "📝";
            return (
              <Link
                key={s.id}
                href={`/sesizari/${s.code}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/30 hover:-translate-y-0.5 transition-all overflow-hidden min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                aria-label={`${s.titlu} — ${STATUS_LABELS[s.status]}, ${s.upvotes} ${s.upvotes === 1 ? "vot" : "voturi"}`}
              >
                <div className="flex items-start justify-between mb-3 gap-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge bgColor={STATUS_COLORS[s.status]} color="white">
                      {STATUS_LABELS[s.status]}
                    </Badge>
                    <Badge variant="neutral">
                      <span className="mr-1" aria-hidden="true">{tipIcon}</span>
                      {tipLabel}
                    </Badge>
                    {s.formal_text && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-medium"
                        title="Text rescris în limbaj formal"
                      >
                        <span aria-hidden="true">✨</span> Formal
                      </span>
                    )}
                    <OverdueBadge
                      createdAt={s.created_at}
                      status={s.status}
                      officialResponseAt={null}
                    />
                  </div>
                  <time
                    dateTime={s.created_at}
                    className="text-xs text-[var(--color-text-muted)] shrink-0 whitespace-nowrap"
                    suppressHydrationWarning
                  >
                    {timeAgo(s.created_at)}
                  </time>
                </div>
                <h3 className="font-semibold mb-1 line-clamp-2 break-words">{s.titlu}</h3>
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-2 min-w-0">
                  <MapPin size={12} className="shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1 min-w-0">{s.locatie}</span>
                  <span className="shrink-0" aria-hidden="true">·</span>
                  <span className="shrink-0">{s.sector}</span>
                </div>
                <p className="text-sm text-[var(--color-text)] mb-3 line-clamp-2 break-words">
                  {s.formal_text ? stripForPreview(s.formal_text) : s.descriere}
                </p>
                {(s.imagini.length > 0 || s.resolved_photo_url) && (
                  <div className="flex gap-1 mb-3">
                    {s.imagini.slice(0, s.resolved_photo_url ? 2 : 3).map((url, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] overflow-hidden flex items-center justify-center">
                        {url.startsWith("http") ? (
                          <Image src={url} alt={`Fotografie sesizare ${s.code ?? ""}`} fill sizes="56px" className="object-cover" />
                        ) : (
                          <ImgIcon size={16} className="text-[var(--color-text-muted)]" aria-label="Imagine indisponibilă" />
                        )}
                        {i === 0 && s.resolved_photo_url && (
                          <span className="absolute bottom-0 inset-x-0 bg-red-500/90 text-white text-[8px] font-bold text-center leading-tight py-0.5">
                            BEFORE
                          </span>
                        )}
                      </div>
                    ))}
                    {s.resolved_photo_url && (
                      <div className="relative w-14 h-14 rounded-[var(--radius-xs)] overflow-hidden ring-2 ring-emerald-500">
                        <Image src={s.resolved_photo_url} alt="După" fill sizes="56px" className="object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-500/90 text-white text-[8px] font-bold text-center leading-tight py-0.5">
                          AFTER
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] gap-2 min-w-0">
                  <span className="text-xs text-[var(--color-text-muted)] truncate min-w-0 flex-1">
                    <span className="font-mono" aria-label={`cod ${s.code}`}>{s.code}</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"
                      aria-label={`${s.upvotes} ${s.upvotes === 1 ? "vot" : "voturi"}`}
                    >
                      <ThumbsUp size={13} aria-hidden="true" />
                      <span className="font-medium tabular-nums">{s.upvotes}</span>
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"
                      aria-label={`${s.nr_comentarii} ${s.nr_comentarii === 1 ? "comentariu" : "comentarii"}`}
                    >
                      <MessageSquare size={13} aria-hidden="true" />
                      <span className="font-medium tabular-nums">{s.nr_comentarii}</span>
                    </span>
                    <ShareButton code={s.code} size="sm" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Load more */}
        {hasMore && filtered.length >= PAGE_SIZE && (
          <div className="flex justify-center mt-8">
            <button
              onClick={async () => {
                setLoadingMore(true);
                const params = new URLSearchParams();
                if (filterTip !== "toate") params.set("tip", filterTip);
                if (filterStatus !== "toate") params.set("status", filterStatus);
                if (effectiveCounty) params.set("county", effectiveCounty);
                params.set("sort", sort);
                params.set("limit", String(PAGE_SIZE));
                params.set("offset", String(rows.length));
                try {
                  const res = await fetch(`/api/sesizari?${params.toString()}`);
                  const j = await res.json();
                  const newRows = (j.data ?? []) as SesizareFeedRow[];
                  setRows((prev) => [...prev, ...newRows]);
                  setHasMore(newRows.length >= PAGE_SIZE);
                } catch {
                  // silent
                } finally {
                  setLoadingMore(false);
                }
              }}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              {loadingMore ? (
                <><Loader2 size={14} className="animate-spin" /> Se încarcă...</>
              ) : (
                <>Încarcă mai multe sesizări</>
              )}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

const selectClass = cn(
  "w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)]",
  "border border-[var(--color-border)] text-sm",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
);
