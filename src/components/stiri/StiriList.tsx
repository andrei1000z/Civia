"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { SOURCE_COLORS, readableTextColor } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { cn } from "@/lib/utils";
import { useCountyOptional } from "@/lib/county-context";

const SOURCE_LOGOS: Record<string, string> = {
  "Digi24": "/images/sources/digi24.png",
  "Hotnews": "/images/sources/hotnews.png",
  "G4Media": "/images/sources/g4media.png",
  "Mediafax": "/images/sources/mediafax.png",
  "News.ro": "/images/sources/newsro.png",
  "B365.ro": "/images/sources/b365.png",
};

interface StireRow {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  source: string;
  category: string;
  author: string | null;
  image_url: string | null;
  published_at: string;
  featured: boolean;
}

const categories = [
  { id: "all", label: "Toate" },
  { id: "transport", label: "Transport" },
  { id: "urbanism", label: "Urbanism" },
  { id: "mediu", label: "Mediu" },
  { id: "siguranta", label: "Siguranță" },
  { id: "administratie", label: "Administrație" },
  { id: "eveniment", label: "Evenimente" },
];

// Card-background gradient per source. Mirrors SOURCE_COLORS in
// constants.ts — the badge color and the card background should
// read as one brand block. Tailwind classes are listed as literals
// (not template-string concatenated) so the JIT picks them up.
const sourceGradients: Record<string, string> = {
  // National wire-service tier
  Digi24: "from-blue-700 to-blue-950",             // matches the corporate blue, not the red "24" accent
  Hotnews: "from-amber-500 to-amber-800",          // golden-orange, matches Hotnews actual logo
  "G4Media": "from-zinc-800 to-black",              // near-black wordmark
  Mediafax: "from-blue-900 to-slate-950",           // deep navy
  "News.ro": "from-green-600 to-green-900",
  Libertatea: "from-red-500 to-red-800",
  "Adevărul": "from-blue-900 to-indigo-950",
  "Gândul": "from-pink-600 to-fuchsia-800",         // hot pink — current Gândul brand
  // National investigative + independent
  PressOne: "from-violet-600 to-violet-900",
  Spotmedia: "from-orange-600 to-orange-900",       // matches Spotmedia accent
  "Europa Liberă": "from-blue-700 to-blue-950",
  Recorder: "from-red-600 to-red-900",              // RED, like Recorder logo
  "Ziarul Financiar": "from-rose-600 to-rose-900",  // ZF salmon-rose
  "Ediția de Dimineață": "from-amber-500 to-amber-800",
  "Știri din România": "from-slate-600 to-slate-800",
  // Local houses
  "B365.ro": "from-emerald-600 to-emerald-900",
  "Monitorul CJ": "from-violet-600 to-violet-900",
  "Știri de Cluj": "from-purple-600 to-purple-900",
  "Actual de Cluj": "from-purple-600 to-fuchsia-800",
  "Ziarul de Iași": "from-indigo-600 to-indigo-900",
  BZI: "from-indigo-600 to-indigo-900",
  "7Iași": "from-violet-600 to-violet-900",
  "Opinia Timișoarei": "from-pink-600 to-pink-900",
  PressAlert: "from-pink-600 to-rose-800",
  TION: "from-rose-600 to-rose-900",
  Telegraf: "from-sky-600 to-sky-900",
  "Ziua de Constanța": "from-blue-700 to-blue-950",
  Alba24: "from-cyan-600 to-cyan-900",
  "Ziarul Unirea": "from-cyan-700 to-cyan-950",
  Aradon: "from-orange-600 to-orange-900",
  "Jurnalul de Argeș": "from-lime-600 to-lime-900",
  "Deșteptarea": "from-teal-700 to-teal-950",
  Bihon: "from-purple-600 to-purple-900",
  "Gazeta de Bistrița": "from-lime-700 to-green-900",
  "Monitorul BT": "from-violet-600 to-violet-900",
  "Obiectiv BR": "from-yellow-600 to-amber-800",
  "BizBrașov": "from-emerald-600 to-emerald-900",
  "Opinia Buzău": "from-pink-600 to-pink-900",
  "Gazeta de Sud": "from-red-700 to-red-950",
  "Replica HD": "from-rose-700 to-rose-950",
  "eMaramureș": "from-green-700 to-green-950",
  "Zi de Zi": "from-orange-700 to-orange-950",
  "Monitorul NT": "from-violet-700 to-violet-950",
  "Observatorul PH": "from-cyan-700 to-cyan-950",
  "Gazeta Nord-Vest": "from-purple-700 to-purple-950",
  "Turnul Sfatului": "from-blue-700 to-blue-950",
  Tribuna: "from-blue-700 to-indigo-900",
  "Monitorul SV": "from-teal-600 to-teal-900",
  "News Bucovina": "from-teal-700 to-teal-950",
  "Monitorul VN": "from-purple-600 to-purple-900",
};

export function StiriList() {
  const county = useCountyOptional();
  const [rows, setRows] = useState<StireRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(12);

  const load = useCallback(async (signal?: AbortSignal, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (query) params.set("q", query);
    if (county) params.set("county", county.id);
    params.set("limit", "100");
    try {
      const res = await fetch(`/api/stiri?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (signal?.aborted) return;
      setRows(json.data ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      // Silent refresh: keep showing the last good list instead of wiping
      // it on a transient hiccup.
      if (!opts.silent) {
        setRows([]);
        setFetchError(e instanceof Error ? e.message : "Eroare");
      }
    } finally {
      if (!signal?.aborted && !opts.silent) setLoading(false);
    }
  }, [category, query, county]);

  useEffect(() => {
    const ctrl = new AbortController();
    // Defer load la microtask ca sa scape de lint-ul
    // react-hooks/set-state-in-effect (load() face setState sincron).
    const t = setTimeout(() => load(ctrl.signal), 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [load]);

  // Live refresh — re-fetch every 30s so newly-cached articles appear
  // without a manual reload. Pause polling when the tab is hidden so
  // we don't burn cycles on background tabs.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let ctrl: AbortController | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        ctrl?.abort();
        ctrl = new AbortController();
        load(ctrl.signal, { silent: true });
      }, 30_000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      ctrl?.abort();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [load]);

  // Prefer featured articles with images, then any with images, then first
  const featured = rows.find((r) => r.featured && r.image_url)
    ?? rows.find((r) => r.image_url)
    ?? rows[0];
  const rest = rows.filter((r) => r.id !== featured?.id).slice(0, visible);

  return (
    <div>
      {/* Filter bar — non-sticky pe baza preferinței user-ului (sticky
          mănâncă viewport vertical pe mobile). Chips wrap pe rânduri
          când nu încap, în loc de horizontal-scroll invizibil. */}
      <div className="py-4 mb-6 border-b border-[var(--color-border)]">
        <div>
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex flex-wrap gap-2 flex-1" role="tablist" aria-label="Filtre categorie știri">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  role="tab"
                  aria-selected={category === cat.id}
                  className={cn(
                    "px-4 py-2 rounded-[var(--radius-pill)] text-xs font-medium whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
                    category === cat.id
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex-1 sm:w-64 lg:self-start">
              <div className="relative h-10">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                  size={16}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Caută în titlu..."
                  aria-label="Caută în titlurile știrilor"
                  className="w-full h-10 pl-9 pr-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results count — plural-aware + reflects filters. Live dot pulses
          to signal the 30s auto-refresh. */}
      <div className="text-sm text-[var(--color-text-muted)] mb-4 flex items-center gap-2 flex-wrap" aria-live="polite">
        <span>
          {loading
            ? "Se încarcă..."
            : rows.length === 1
              ? "1 articol găsit"
              : rows.length === 0
                ? "Niciun articol"
                : `${rows.length} articole${query || category !== "all" ? " (filtrat)" : ""}`}
        </span>
        {!loading && rows.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live · refresh la 30s
          </span>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-20 text-center" role="status" aria-label="Se încarcă știrile">
          <Loader2 size={28} className="animate-spin mx-auto text-[var(--color-text-muted)]" aria-hidden="true" />
          <span className="sr-only">Se încarcă știrile...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-10 text-center">
          {fetchError ? (
            <>
              <p className="text-[var(--color-text-muted)] mb-2">
                Nu am putut încărca știrile.
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Eroare: {fetchError}. Verifică conexiunea și încearcă din nou.
              </p>
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
              >
                Reîncearcă
              </button>
            </>
          ) : (
            <>
              <p className="text-[var(--color-text-muted)] mb-2">Știrile se actualizează.</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Revino în câteva minute sau încearcă alt filtru.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Featured */}
          {featured && (
            <Link
              href={`/stiri/${featured.id}`}
              className="group block mb-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-2)] overflow-hidden hover:shadow-[var(--shadow-4)] hover:-translate-y-0.5 transition-all"
            >
              <div className="grid md:grid-cols-[1.2fr_1fr] md:items-stretch">
                <div
                  className={cn(
                    // Aspect-video pe mobile (16:9 garantat sa match-uiasca
                    // imagini de presa). Pe md+, lasam grid sa stretchuiasca
                    // dar fortam min-height egal cu text col via h-full +
                    // self-stretch. Combo asta elimina banda pink/violet care
                    // aparea cand text col era mai inalt decat min-h-[360px].
                    "relative aspect-video md:aspect-auto md:h-full md:self-stretch bg-gradient-to-br overflow-hidden",
                    sourceGradients[featured.source] ?? "from-slate-600 to-slate-800"
                  )}
                >
                  {featured.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.image_url}
                      alt={featured.title}
                      // object-position center top: cand imaginea e mai
                      // mica decat containerul (cazul Gândul TV broadcast
                      // cu ticker pe jos), cropul se duce in josul imaginii
                      // ca sa pastram fețele / acțiunea principala vizibila.
                      // scale-110 minor zoom-in ca sa elimine gap-uri marginale.
                      className="absolute inset-0 w-full h-full object-cover object-center scale-[1.02]"
                      loading="eager"
                      fetchPriority="high"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge bgColor={SOURCE_COLORS[featured.source] ?? "#64748b"} color={readableTextColor(SOURCE_COLORS[featured.source] ?? "#64748b")} className="flex items-center gap-1.5">
                      {SOURCE_LOGOS[featured.source] && (
                        <Image
                          src={SOURCE_LOGOS[featured.source] ?? ""}
                          alt=""
                          width={16}
                          height={16}
                          className="w-4 h-4 rounded-sm object-contain"
                          unoptimized
                        />
                      )}
                      {featured.source}
                    </Badge>
                    <Badge className="bg-black/40 text-white border border-white/20">Featured</Badge>
                  </div>
                </div>
                <div className="p-5 md:p-8 flex flex-col min-w-0">
                  <Badge variant="primary" className="w-fit mb-3">{featured.category}</Badge>
                  <h2 className="font-[family-name:var(--font-sora)] text-xl sm:text-2xl md:text-3xl font-bold mb-3 group-hover:text-[var(--color-primary)] transition-colors break-words">
                    {featured.title}
                  </h2>
                  <p className="text-[var(--color-text-muted)] mb-4 flex-1 line-clamp-4 break-words">{featured.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-4 border-t border-[var(--color-border)]">
                    <TimeAgo date={featured.published_at} />
                    <span className="flex items-center gap-1">
                      Citește <ExternalLink size={12} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((stire) => (
              <Link
                key={stire.id}
                href={`/stiri/${stire.id}`}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] overflow-hidden hover:-translate-y-1 hover:shadow-[var(--shadow-3)] transition-all cursor-pointer"
              >
                <div
                  className={cn(
                    // aspect-video pe toate viewport-urile garanteaza 16:9
                    // match cu majoritatea imaginilor de presa. Inlocuieste
                    // h-40 fixed care la imagini portrait/ultra-wide lasa
                    // gap-uri vizibile cu gradient-ul source.
                    "relative aspect-video bg-gradient-to-br overflow-hidden",
                    sourceGradients[stire.source] ?? "from-slate-600 to-slate-800"
                  )}
                >
                  {stire.image_url ? (
                    <Image
                      src={stire.image_url}
                      unoptimized
                      alt={stire.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      // opacity-90 scos: lasa gradientul sursei sa transpara
                      // si producea acelasi „cadran roz" peste image content.
                      className="object-cover object-center"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-5xl font-bold text-white/20 select-none">
                        {stire.source.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3">
                    <Badge bgColor={SOURCE_COLORS[stire.source] ?? "#64748b"} color={readableTextColor(SOURCE_COLORS[stire.source] ?? "#64748b")} className="flex items-center gap-1.5">
                      {SOURCE_LOGOS[stire.source] && (
                        <Image
                          src={SOURCE_LOGOS[stire.source] ?? ""}
                          alt=""
                          width={14}
                          height={14}
                          className="w-3.5 h-3.5 rounded-sm object-contain"
                          unoptimized
                        />
                      )}
                      {stire.source}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <Badge className="bg-black/40 text-white border border-white/20 uppercase text-[10px]">
                      {stire.category}
                    </Badge>
                  </div>
                </div>
                <div className="p-5 min-w-0">
                  <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors break-words">
                    {stire.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-4 break-words">{stire.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-3 border-t border-[var(--color-border)] gap-2 min-w-0">
                    <span className="truncate min-w-0 flex-1">{stire.author ?? "Redacție"}</span>
                    <TimeAgo date={stire.published_at} className="shrink-0 ml-2" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {rows.length - 1 > visible && (
            <div className="flex justify-center mt-10">
              <button
                type="button"
                onClick={() => setVisible((v) => v + 12)}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
              >
                Încarcă mai multe
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
