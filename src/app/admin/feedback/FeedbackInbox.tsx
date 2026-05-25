"use client";

import { useMemo, useState } from "react";
import { Bug, Lightbulb, HelpCircle, MessageSquare, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface RedisFeedbackEntry {
  t: number;
  kind: string;
  message: string;
  email: string | null;
  userId: string | null;
  country: string | null;
  pathname: string | null;
}

interface Props {
  redisEntries: RedisFeedbackEntry[];
  sqlCount: number;
}

const KIND_META: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: "Bug", icon: Bug, color: "#DC2626" },
  idea: { label: "Idee", icon: Lightbulb, color: "#F59E0B" },
  question: { label: "Întrebare", icon: HelpCircle, color: "#0EA5E9" },
  other: { label: "Altele", icon: MessageSquare, color: "#64748B" },
};

const FILTERS = ["all", "bug", "idea", "question", "other"] as const;
type FilterKind = (typeof FILTERS)[number];

/**
 * Inbox-ul de feedback persistat în Redis (`civia:feedback:messages`).
 * Mutat aici din /admin/analytics 2026-05-25 — admin-ul vrea toate
 * canalele de feedback într-un singur loc.
 */
export function FeedbackInbox({ redisEntries, sqlCount }: Props) {
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: redisEntries.length };
    for (const e of redisEntries) {
      acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    }
    return acc;
  }, [redisEntries]);

  const filtered = useMemo(() => {
    if (kindFilter === "all") return redisEntries;
    return redisEntries.filter((e) => e.kind === kindFilter);
  }, [redisEntries, kindFilter]);

  return (
    <section
      aria-label="Feedback inbox (Redis)"
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5 mb-6"
    >
      <header className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="font-semibold text-sm inline-flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-[var(--radius-xs)] bg-blue-500/15 text-blue-600 dark:text-blue-400 grid place-items-center"
            aria-hidden="true"
          >
            <MessageSquare size={13} />
          </span>
          Inbox rapid · Redis
        </h2>
        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
          {redisEntries.length} Redis · {sqlCount} SQL
        </span>
      </header>

      <div
        className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label="Filtru tip feedback"
      >
        {FILTERS.map((f) => {
          const active = kindFilter === f;
          const meta = f === "all" ? null : KIND_META[f];
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKindFilter(f)}
              className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-full)] text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30"
              }`}
            >
              {meta && <meta.icon size={11} aria-hidden="true" />}
              {f === "all" ? "Toate" : meta?.label}
              <span className="opacity-70 tabular-nums">({counts[f] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] italic py-2">
          Niciun mesaj în acest filtru.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.slice(0, 50).map((e, i) => {
            const meta = KIND_META[e.kind] ?? KIND_META.other!;
            const Icon = meta.icon;
            return (
              <li
                key={`${e.t}-${i}`}
                className="rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-full)] text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                  >
                    <Icon size={10} aria-hidden="true" />
                    {meta.label}
                  </span>
                  <time className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                    {formatDateTime(new Date(e.t).toISOString())}
                  </time>
                </div>
                <p className="text-[var(--color-text)] whitespace-pre-line leading-relaxed break-words mb-1.5">
                  {e.message}
                </p>
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-[var(--color-text-muted)]">
                  {e.email && (
                    <a
                      href={`mailto:${e.email}`}
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline truncate max-w-[200px]"
                    >
                      <Mail size={10} aria-hidden="true" />
                      {e.email}
                    </a>
                  )}
                  {e.country && <span>{e.country}</span>}
                  {e.pathname && (
                    <span className="truncate max-w-[200px]" title={e.pathname}>
                      {(() => {
                        try {
                          return new URL(e.pathname).pathname;
                        } catch {
                          return e.pathname;
                        }
                      })()}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
