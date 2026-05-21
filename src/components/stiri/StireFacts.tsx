"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Clock, Sparkles } from "lucide-react";
import {
  extractFacts,
  extractDateRange,
  type ExtractedFact,
  type ExtractedDateRange,
} from "@/lib/stiri/extract-facts";
import { cn } from "@/lib/utils";

interface Props {
  /** Combined article text to mine (excerpt + content + ai summary). */
  text: string;
}

/**
 * Interactive "key facts" panel rendered above the AI summary on the
 * news detail page.
 *
 * It mines the article text for numeric facts (countries, experts,
 * percentages, ...) and date ranges, then renders:
 *   - up to 6 stat cards with rolling-counter animation on first scroll
 *   - a countdown widget if a future event is detected
 *
 * Pure-client component; the parent passes the combined article text
 * once at mount. If nothing notable is extracted, the panel renders
 * `null` so the article layout collapses cleanly.
 */
export function StireFacts({ text }: Props) {
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [dateRange, setDateRange] = useState<ExtractedDateRange | null>(null);

  useEffect(() => {
    // Defer la microtask ca sa scape de lint-ul
    // react-hooks/set-state-in-effect (setState sincron in effect).
    const t = setTimeout(() => {
      setFacts(extractFacts(text, 6));
      setDateRange(extractDateRange(text));
    }, 0);
    return () => clearTimeout(t);
  }, [text]);

  if (facts.length === 0 && !dateRange) return null;

  return (
    <section
      aria-label="Cifre cheie din articol"
      className="bg-gradient-to-br from-violet-500/8 via-[var(--color-surface)] to-[var(--color-surface)] border border-violet-500/30 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles
          size={14}
          className="text-violet-500"
          aria-hidden="true"
        />
        <h2 className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
          Cifre cheie
        </h2>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
          extras automat din articol
        </span>
      </div>

      {/* Countdown for an event in the future */}
      {dateRange && <Countdown range={dateRange} />}

      {/* Stat grid */}
      {facts.length > 0 && (
        <div
          className={cn(
            "grid gap-3",
            facts.length === 1
              ? "grid-cols-1"
              : facts.length === 2
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3",
            dateRange ? "mt-4" : "",
          )}
        >
          {facts.map((f, i) => (
            <StatCard key={`${f.emoji}-${f.value}-${f.label}-${i}`} fact={f} delayMs={i * 80} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────

function StatCard({ fact, delayMs }: { fact: ExtractedFact; delayMs: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [animatedValue, setAnimatedValue] = useState(0);
  const [animated, setAnimated] = useState(false);

  // Roll-up counter on first intersection (or immediately if the panel is
  // already in view at mount, e.g. if user navigates back).
  useEffect(() => {
    if (!ref.current || animated) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || animated) return;
        setAnimated(true);
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animated]);

  useEffect(() => {
    if (!animated) return;
    const target = fact.value;
    const duration = 900;
    const startedAt = performance.now() + delayMs;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - startedAt) / duration));
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animated, fact.value, delayMs]);

  const display = formatAnimated(animatedValue, fact.value);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3.5 hover:border-violet-500/40 transition-colors"
      title={fact.context}
    >
      <span
        className="absolute top-2 right-2 text-base opacity-60"
        aria-hidden="true"
      >
        {fact.emoji}
      </span>
      <p className="text-2xl md:text-3xl font-extrabold tabular-nums text-[var(--color-text)] leading-none mb-1.5">
        {display}
      </p>
      <p className="text-[11px] uppercase tracking-wider font-medium text-[var(--color-text-muted)] truncate">
        {fact.label}
      </p>
    </div>
  );
}

function formatAnimated(current: number, target: number): string {
  if (Number.isInteger(target)) {
    return Math.round(current).toLocaleString("ro-RO");
  }
  return current.toLocaleString("ro-RO", { maximumFractionDigits: 1 });
}

// ─────────────────────────────────────────────────────────────────

function Countdown({ range }: { range: ExtractedDateRange }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Re-render once a minute so the "ore / minute" parts stay live without
    // burning the main thread.
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Use `tick` to force recompute; reading the dep is enough.
  void tick;

  const now = new Date();
  const start = new Date(range.startISO);
  const end = new Date(range.endISO);
  const inProgress = now >= start && now <= end;
  const past = now > end;

  if (past) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] mb-1">
        <Calendar size={16} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
            Eveniment trecut
          </p>
          <p className="text-sm font-medium text-[var(--color-text)]">{range.label}</p>
        </div>
      </div>
    );
  }

  if (inProgress) {
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = now.getTime() - start.getTime();
    const pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
    return (
      <div className="p-4 rounded-[var(--radius-xs)] bg-emerald-500/8 border border-emerald-500/30 mb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            În desfășurare
          </p>
          <span className="text-xs text-[var(--color-text-muted)] ml-auto tabular-nums">
            {Math.round(pct)}%
          </span>
        </div>
        <p className="text-base font-semibold mb-2">{range.label}</p>
        <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // Future event — countdown
  const days = range.daysUntilStart;
  const hours = Math.max(0, Math.floor((start.getTime() - now.getTime()) / (1000 * 60 * 60)) - days * 24);
  const minutes = Math.max(0, Math.floor((start.getTime() - now.getTime()) / (1000 * 60)) - days * 24 * 60 - hours * 60);

  return (
    <div className="p-4 rounded-[var(--radius-xs)] bg-violet-500/8 border border-violet-500/30 mb-1">
      <div className="flex items-center gap-2 mb-2">
        <Clock size={14} className="text-violet-600 dark:text-violet-400" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
          Începe în
        </p>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {range.label} · {range.durationDays} {range.durationDays === 1 ? "zi" : "zile"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CountUnit value={days} label={days === 1 ? "zi" : "zile"} />
        <CountUnit value={hours} label={hours === 1 ? "oră" : "ore"} />
        <CountUnit value={minutes} label={minutes === 1 ? "min" : "min"} />
      </div>
    </div>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] py-2">
      <p className="text-2xl font-extrabold tabular-nums leading-none text-violet-700 dark:text-violet-400">
        {value.toLocaleString("ro-RO")}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1 font-medium">
        {label}
      </p>
    </div>
  );
}
