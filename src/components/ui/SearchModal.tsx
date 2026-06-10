"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search as SearchIcon,
  FileText,
  BookOpen,
  Calendar,
  Newspaper,
  MapPin,
  Sparkles,
  X,
  ArrowRight,
  Send,
  Megaphone,
  Flag,
  Building2,
  Clock,
  Loader2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type:
    | "sesizare"
    | "ghid"
    | "eveniment"
    | "stire"
    | "page"
    | "judet"
    | "petitie"
    | "protest"
    | "glosar"
    | "ghid-sesizare"
    | "autoritate"
    | "ai";
  title: string;
  url: string;
  excerpt?: string;
  meta?: string;
  score?: number;
  group?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: typeof FileText; color: string }
> = {
  sesizare: { label: "Sesizare", icon: FileText, color: "text-emerald-600 dark:text-emerald-400" },
  "ghid-sesizare": { label: "Tip sesizare", icon: FileText, color: "text-emerald-600 dark:text-emerald-400" },
  petitie: { label: "Petiție", icon: Megaphone, color: "text-purple-600 dark:text-purple-400" },
  protest: { label: "Protest", icon: Flag, color: "text-rose-600 dark:text-rose-400" },
  stire: { label: "Știre", icon: Newspaper, color: "text-blue-600 dark:text-blue-400" },
  eveniment: { label: "Eveniment", icon: Calendar, color: "text-amber-600 dark:text-amber-400" },
  ghid: { label: "Ghid", icon: BookOpen, color: "text-violet-600 dark:text-violet-400" },
  glosar: { label: "Glosar", icon: BookOpen, color: "text-violet-600 dark:text-violet-400" },
  page: { label: "Pagină", icon: ArrowRight, color: "text-[var(--color-text-muted)]" },
  judet: { label: "Județ", icon: MapPin, color: "text-cyan-600 dark:text-cyan-400" },
  autoritate: { label: "Autoritate", icon: Building2, color: "text-slate-600 dark:text-slate-400" },
  ai: { label: "Acțiune", icon: Sparkles, color: "text-emerald-600 dark:text-emerald-400" },
};

const GROUP_LABELS: Record<string, string> = {
  actiuni: "Acțiuni rapide",
  navigatie: "Navigație rapidă",
  sesizari: "Sesizări",
  petitii_proteste: "Petiții & Proteste",
  stiri_evenimente: "Știri & Evenimente",
  ghiduri: "Ghiduri & Glosar",
  autoritati: "Autorități",
};

const GROUP_ORDER = [
  "actiuni",
  "navigatie",
  "sesizari",
  "petitii_proteste",
  "stiri_evenimente",
  "ghiduri",
  "autoritati",
];

const RECENT_KEY = "civia.search.recent";
const RECENT_MAX = 6;

/**
 * Quick actions afișate când input-ul e gol — facilitează navigare rapidă
 * la cele mai comune intenții (depune sesizare, vezi proteste, ghiduri).
 */
const QUICK_ACTIONS: { title: string; url: string; icon: typeof Send; color: string; sub: string }[] = [
  {
    title: "Fă o sesizare",
    url: "/sesizari",
    icon: Send,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    sub: "AI generează emailul către primărie",
  },
  {
    title: "Vezi petițiile active",
    url: "/petitii",
    icon: Megaphone,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    sub: "Semnează cauze civice",
  },
  {
    title: "Proteste programate",
    url: "/proteste",
    icon: Flag,
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    sub: "Manifestări anunțate",
  },
  {
    title: "Întreruperi din zona ta",
    url: "/intreruperi",
    icon: Zap,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    sub: "Apă, gaz, curent",
  },
];

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecentSearch(q: string) {
  if (typeof window === "undefined" || !q.trim()) return;
  try {
    const recent = getRecentSearches();
    const norm = q.trim();
    const next = [norm, ...recent.filter((r) => r.toLowerCase() !== norm.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* localStorage blocked */
  }
}

/**
 * Highlight: split text pe match (case-insensitive) și wrap în <mark>.
 * Folosit pe titlu + excerpt pentru rezultate.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length); // longest first ca să match prefer pattern complet
  if (words.length === 0) return <>{text}</>;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-sm px-0.5"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(getRecentSearches());
      return;
    }
    const t = setTimeout(() => {
      setQuery("");
      setResults([]);
      setActive(0);
    }, 150);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: SearchResult[] };
        if (cancelled) return;
        setResults(json.data ?? []);
        setActive(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q.length < 2 ? 0 : 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const navigate = useCallback(
    (url: string, recordQuery?: string) => {
      if (recordQuery) pushRecentSearch(recordQuery);
      onClose();
      router.push(url);
    },
    [onClose, router],
  );

  // Group results by group key, in defined order
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const g = r.group ?? "navigatie";
      (groups[g] ??= []).push(r);
    }
    const out: Array<{ group: string; label: string; items: SearchResult[] }> = [];
    for (const g of GROUP_ORDER) {
      if (groups[g] && groups[g].length > 0) {
        out.push({ group: g, label: GROUP_LABELS[g] ?? g, items: groups[g] });
      }
    }
    return out;
  }, [results]);

  // Flat list pentru keyboard nav (cu indices peste grupuri)
  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const r = flatResults[active];
        if (r) {
          e.preventDefault();
          navigate(r.url, query);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, flatResults, active, navigate, onClose, query]);

  // Scroll active in view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const showEmpty = query.trim().length < 2;
  const showLoading = !showEmpty && loading;
  const showResults = !showEmpty && !loading && grouped.length > 0;
  const showNoResults = !showEmpty && !loading && grouped.length === 0;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center px-3 pt-[8vh] pb-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Caută pe Civia"
        className="w-full max-w-2xl bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] border border-[var(--color-border)] overflow-hidden animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--color-border)]">
          <SearchIcon
            size={20}
            className={cn(
              "shrink-0",
              loading ? "text-violet-500" : "text-[var(--color-text-muted)]",
            )}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută sesizări, petiții, județe, autorități, ghiduri..."
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
            autoComplete="off"
            spellCheck={false}
            aria-label="Caută"
            // WAI-ARIA 1.2 combobox (audit search): input controlează listbox-ul
            // de rezultate; aria-activedescendant urmează opțiunea activă fără să
            // mute focusul din input (navigare cu săgeți + anunț screen reader).
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showResults}
            aria-controls="civia-search-listbox"
            aria-activedescendant={
              showResults && active >= 0 ? `civia-search-opt-${active}` : undefined
            }
          />
          {loading && (
            <Loader2
              size={14}
              className="animate-spin text-violet-500"
              aria-hidden="true"
            />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Șterge query"
              className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          ref={listRef}
          className="max-h-[min(70vh,32rem)] overflow-y-auto"
        >
          {/* Empty state: quick actions + recent searches */}
          {showEmpty && (
            <div className="p-4 space-y-5">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-2.5">
                  <Sparkles size={11} aria-hidden="true" />
                  Acțiuni rapide
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.url}
                        type="button"
                        onClick={() => navigate(a.url)}
                        className={cn(
                          "flex items-start gap-2.5 p-3 rounded-[var(--radius-xs)] border text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                          a.color,
                        )}
                      >
                        <Icon size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-tight truncate">
                            {a.title}
                          </p>
                          <p className="text-[10px] opacity-75 truncate">{a.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {recent.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                      <Clock size={11} aria-hidden="true" />
                      Căutări recente
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem(RECENT_KEY);
                        } catch {/* noop */}
                        setRecent([]);
                      }}
                      className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      Șterge tot
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setQuery(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-xs text-[var(--color-text)] transition-colors"
                      >
                        <Clock size={10} aria-hidden="true" className="opacity-60" />
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-2.5">
                  <TrendingUp size={11} aria-hidden="true" />
                  Caută orice
                </p>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Tastează numele unei probleme („groapă"), județ („Cluj"), petiție,
                  protest, lege, autoritate sau orice termen civic. Search-ul se
                  uită în <strong className="text-[var(--color-text)]">sesizări, petiții, proteste,
                  știri, ghiduri, glosar și autorități</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {showLoading && (
            <div className="p-4 space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded skeleton-shimmer shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded skeleton-shimmer w-3/4" />
                    <div className="h-2.5 rounded skeleton-shimmer w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="px-4 py-10 text-center">
              <div className="text-3xl mb-2" aria-hidden="true">🔍</div>
              <p className="text-sm text-[var(--color-text)] font-medium mb-1">
                Niciun rezultat pentru „{query}"
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Verifică ortografia sau încearcă alți termeni.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/sesizari?q=${encodeURIComponent(query)}`, query)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-button)] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all active:scale-[0.97]"
              >
                <Send size={12} aria-hidden="true" />
                Trimite o sesizare despre „{query.slice(0, 30)}"
              </button>
            </div>
          )}

          {/* Grouped results */}
          {showResults &&
            (() => {
              let globalIdx = -1;
              return (
                <div className="py-1" id="civia-search-listbox" role="listbox" aria-label="Rezultate căutare">
                  {grouped.map((g) => (
                    <div key={g.group} className="mb-1" role="group" aria-label={g.label}>
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]" aria-hidden="true">
                        {g.label}
                        <span className="ml-1.5 opacity-60">({g.items.length})</span>
                      </div>
                      <div>
                        {g.items.map((r) => {
                          globalIdx += 1;
                          const idx = globalIdx;
                          const meta = TYPE_META[r.type] ?? TYPE_META.page;
                          const Icon = meta.icon;
                          const isActive = idx === active;
                          return (
                              <Link
                                key={`${r.type}-${r.url}-${idx}`}
                                id={`civia-search-opt-${idx}`}
                                href={r.url}
                                data-idx={idx}
                                role="option"
                                aria-selected={isActive}
                                onMouseEnter={() => setActive(idx)}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(r.url, query);
                                }}
                                className={cn(
                                  "flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                                  isActive
                                    ? "bg-[var(--color-surface-2)]"
                                    : "hover:bg-[var(--color-surface-2)]",
                                )}
                              >
                                <Icon
                                  size={16}
                                  className={cn("mt-0.5 shrink-0", meta.color)}
                                  aria-hidden="true"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[var(--color-text)] truncate">
                                      <HighlightedText text={r.title} query={query} />
                                    </span>
                                    {r.meta && (
                                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] shrink-0 ml-auto">
                                        {r.meta}
                                      </span>
                                    )}
                                  </div>
                                  {r.excerpt && (
                                    <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                                      <HighlightedText text={r.excerpt} query={query} />
                                    </div>
                                  )}
                                </div>
                                {isActive && (
                                  <ArrowRight
                                    size={12}
                                    className="text-violet-500 shrink-0 mt-1.5"
                                    aria-hidden="true"
                                  />
                                )}
                              </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">↓</kbd>
            <span className="ml-1 hidden sm:inline">navighează</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">↵</kbd>
            <span className="ml-1 hidden sm:inline">deschide</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">Esc</kbd>
            <span className="ml-1 hidden sm:inline">închide</span>
          </span>
        </div>
      </div>
    </div>
  );
}
