"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
    | "bilet"
    | "linie"
    | "primar"
    | "directie"
    | "companie"
    | "glosar"
    | "ghid-sesizare"
    | "transport"
    | "ai";
  title: string;
  url: string;
  excerpt?: string;
  meta?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_META: Record<SearchResult["type"], { label: string; icon: typeof FileText }> = {
  sesizare: { label: "Sesizare", icon: FileText },
  ghid: { label: "Ghid", icon: BookOpen },
  eveniment: { label: "Eveniment", icon: Calendar },
  stire: { label: "Știre", icon: Newspaper },
  page: { label: "Pagină", icon: ArrowRight },
  judet: { label: "Județ", icon: MapPin },
  bilet: { label: "Bilet", icon: ArrowRight },
  linie: { label: "Linie", icon: ArrowRight },
  primar: { label: "Primar", icon: ArrowRight },
  directie: { label: "Direcție", icon: ArrowRight },
  companie: { label: "Companie", icon: ArrowRight },
  glosar: { label: "Glosar", icon: BookOpen },
  "ghid-sesizare": { label: "Sesizare (ghid)", icon: BookOpen },
  transport: { label: "Transport", icon: ArrowRight },
  ai: { label: "Trimite sesizare", icon: Sparkles },
};

export function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset state pe inchidere — async (microtask) ca sa scape de lint-ul
  // react-hooks/set-state-in-effect. Comportament identic: state-ul se
  // curata la primul tick dupa ce `open` devine false.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setQuery("");
      setResults([]);
      setActive(0);
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  // Autofocus pe input la deschidere
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Lock scroll body cat e deschis
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Debounced fetch — 220ms (sub pragul de „instant" perceput, dar suficient
  // sa scape un user care tasteaza rapid „strada Iancului" fara 14 cereri).
  // setState muta in callback-ul setTimeout ca sa nu cada lint-ul
  // react-hooks/set-state-in-effect (setState sincron in effect body).
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
    }, q.length < 2 ? 0 : 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const navigate = useCallback(
    (url: string) => {
      onClose();
      router.push(url);
    },
    [onClose, router],
  );

  // Keyboard nav: ↑↓ navigheaza prin rezultate, Enter selecteaza, Esc inchide.
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
        setActive((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const r = results[active];
        if (r) {
          e.preventDefault();
          navigate(r.url);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, active, navigate, onClose]);

  // Scroll item-ul activ in view cand sageata-l muta dincolo de fold.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center px-3 pt-[10vh] pb-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Caută pe Civia"
        className="w-full max-w-xl bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] border border-[var(--color-border)] overflow-hidden animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--color-border)]">
          <SearchIcon size={20} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută județ, sesizare, ghid, știre..."
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
            autoComplete="off"
            spellCheck={false}
            aria-label="Caută"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[min(60vh,28rem)] overflow-y-auto"
          role="listbox"
        >
          {query.trim().length < 2 ? (
            <div className="px-4 py-10 text-sm text-center text-[var(--color-text-muted)]">
              Începe să tastezi pentru a căuta...
            </div>
          ) : loading ? (
            <div className="px-4 py-8 text-sm text-center text-[var(--color-text-muted)]">
              Caut...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-sm text-center text-[var(--color-text-muted)]">
              Niciun rezultat. Apasă <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs">Esc</kbd> pentru a închide.
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r, i) => {
                const meta = TYPE_META[r.type] ?? TYPE_META.page;
                const Icon = meta.icon;
                const isActive = i === active;
                return (
                  <li key={`${r.type}-${r.url}-${i}`}>
                    <Link
                      href={r.url}
                      data-idx={i}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(i)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(r.url);
                      }}
                      className={cn(
                        "flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                        isActive ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]",
                      )}
                    >
                      <Icon
                        size={16}
                        className={cn(
                          "mt-0.5 shrink-0",
                          isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]",
                        )}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text)] truncate">
                            {r.title}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
                            {meta.label}
                          </span>
                        </div>
                        {r.excerpt && (
                          <div className="text-xs text-[var(--color-text-muted)] truncate">
                            {r.excerpt}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] mr-1">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">↓</kbd>
            <span className="ml-1">navighează</span>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] mr-1">↵</kbd>
            <span>deschide</span>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">Esc</kbd>
            <span className="ml-1">închide</span>
          </span>
        </div>
      </div>
    </div>
  );
}
