"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox, Link2, Copy, Check } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface FeedbackEntry {
  t: number;
  kind: string;
  message: string;
  email: string | null;
  userId: string | null;
  country: string | null;
  pathname: string | null;
}

interface Props {
  onImportUrl?: (url: string) => void;
}

const URL_RE = /(https?:\/\/[^\s)]+)/i;

/**
 * Listă cu petiții propuse de cetățeni. Citește din Redis
 * `civia:feedback:messages` filtrate `kind=idea` + prefix
 * "[Petiție propusă]" (scrise de ProposePetitieForm).
 *
 * Acțiune principală: button „Importă URL" care prepopulează form-ul
 * de import din admin/petitii (handler din parent).
 */
export function PropuneriCetateni({ onImportUrl }: Props) {
  const [rows, setRows] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          "/api/admin/feedback/redis?kind=idea&prefix=" +
            encodeURIComponent("[Petiție propusă]") +
            "&limit=100",
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setRows(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Eroare");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <section
      aria-label="Petiții propuse de cetățeni"
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5 mb-6"
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-sm inline-flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-[var(--radius-xs)] bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center"
            aria-hidden="true"
          >
            <Inbox size={13} />
          </span>
          Propuneri cetățeni
        </h2>
        {rows && (
          <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
            {rows.length} {rows.length === 1 ? "propunere" : "propuneri"}
          </span>
        )}
      </header>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">
          Nu am putut încărca propunerile: {error}
        </p>
      )}

      {rows === null && !error ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" aria-hidden="true" />
        </div>
      ) : rows && rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] italic py-2">
          Nicio propunere încă. Cetățenii pot trimite linkuri de pe{" "}
          <a
            href="/petitii/propune"
            className="text-[var(--color-primary)] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            /petitii/propune
          </a>
          .
        </p>
      ) : (
        <ul className="space-y-2.5">
          {(rows ?? []).map((r, i) => {
            const urlMatch = r.message.match(URL_RE);
            const url = urlMatch?.[1] ?? null;
            const cleanText = r.message
              .replace(/^\[Petiție propusă\]\s*/i, "")
              .trim();
            return (
              <li
                key={`${r.t}-${i}`}
                className="rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap">
                  <time className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                    {formatDateTime(new Date(r.t).toISOString())}
                  </time>
                  <div className="flex items-center gap-1.5">
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="text-[10px] text-[var(--color-primary)] hover:underline truncate max-w-[200px]"
                      >
                        {r.email}
                      </a>
                    )}
                    {r.country && (
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {r.country}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[var(--color-text)] whitespace-pre-line leading-relaxed mb-2 break-words">
                  {cleanText}
                </p>
                {url && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline truncate max-w-[260px]"
                    >
                      <Link2 size={11} aria-hidden="true" />
                      <span className="truncate">{url}</span>
                    </a>
                    {onImportUrl && (
                      <button
                        type="button"
                        onClick={() => onImportUrl(url)}
                        className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-full)] bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                      >
                        Importă URL
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(url)}
                      aria-label="Copiază URL"
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--radius-full)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[10px]"
                    >
                      {copied === url ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
