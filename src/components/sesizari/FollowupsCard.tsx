"use client";

import { useEffect, useState } from "react";
import { Mail, Scale, Users, AlertTriangle, Share2, ExternalLink, Sparkles } from "lucide-react";
import type { FollowupsResult, FollowupAction } from "@/lib/groq/followups";

interface Props {
  code: string;
}

const ICON_MAP = {
  mail: Mail,
  scale: Scale,
  users: Users,
  alert: AlertTriangle,
  share: Share2,
} as const;

/**
 * Renders AI-generated follow-up actions for a sesizare detail page.
 *
 * Audit item #90. Fetches /api/sesizari/[code]/followups, displays 3
 * actionable chips with rationale. Self-contained — only needs code.
 */
export function FollowupsCard({ code }: Props) {
  const [data, setData] = useState<FollowupsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sesizari/${code}/followups`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((j) => !cancelled && setData(j.data))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return null; // silent — nice-to-have

  if (!data) {
    return (
      <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 bg-[var(--color-surface)] animate-pulse">
        <div className="h-4 w-40 bg-[var(--color-surface-2)] rounded mb-3" />
        <div className="space-y-2">
          <div className="h-12 bg-[var(--color-surface-2)] rounded" />
          <div className="h-12 bg-[var(--color-surface-2)] rounded" />
          <div className="h-12 bg-[var(--color-surface-2)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 bg-[var(--color-surface)] shadow-[var(--shadow-1)]">
      <h3 className="font-[family-name:var(--font-sora)] font-semibold text-sm flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        Pași următori — sugerați de AI
      </h3>
      <ul className="space-y-2">
        {data.actions.map((a: FollowupAction, i) => {
          const Icon = ICON_MAP[a.icon];
          const content = (
            <div className="flex items-start gap-3 p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)] border border-transparent transition-colors">
              <Icon
                size={18}
                className="text-[var(--color-primary)] flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[var(--color-text)] flex items-center gap-1.5">
                  {a.label}
                  {a.href ? <ExternalLink size={12} className="opacity-60" aria-hidden="true" /> : null}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">
                  {a.reason}
                </div>
              </div>
            </div>
          );
          return (
            <li key={`${a.label}-${i}`}>
              {a.href ? (
                <a
                  href={a.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-[var(--radius-xs)]"
                >
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
      {data.fallback ? (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-2 opacity-70">
          Sugestii generice — AI-ul nu a putut personaliza acum.
        </p>
      ) : null}
    </div>
  );
}
