"use client";

import { useState } from "react";
import { ThumbsUp, Loader2, Check, Share2 } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

interface Props {
  propunereId: string;
  currentCount: number;
  threshold: number;
}

export function VoteButtonClient({ propunereId, currentCount, threshold }: Props) {
  const [count, setCount] = useState(currentCount);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleVote() {
    if (voted || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/propuneri-legislative/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propunere_id: propunereId }),
      });
      const json = await res.json() as { ok?: boolean; new_count?: number; sent?: boolean; error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setVoted(true);
          setError("Ai susținut deja această propunere.");
          return;
        }
        setError(json.error ?? "Eroare la vot");
        return;
      }
      setCount(json.new_count ?? count + 1);
      setVoted(true);
      if (json.sent) {
        setError(null);
      }
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    const url = `${SITE_URL}/propuneri-legislative/${propunereId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (navigator.share) {
        await navigator.share({ url });
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleVote}
          disabled={voted || loading}
          className={`flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-button)] font-semibold text-sm transition-all ${
            voted
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 cursor-default"
              : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:scale-[0.98]"
          } disabled:cursor-not-allowed`}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : voted ? (
            <Check size={16} />
          ) : (
            <ThumbsUp size={16} />
          )}
          {voted ? `Ai susținut! (${count} total)` : `Susțin această propunere`}
        </button>
        <button
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] transition-colors"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
          {copied ? "Copiat!" : "Distribuie"}
        </button>
      </div>

      {voted && count < threshold && (
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Mai lipsesc <strong>{threshold - count}</strong> susținători. Distribuie ca să ajungem la {threshold}!
        </p>
      )}

      {voted && count >= threshold && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center font-semibold">
          🎉 Pragul a fost atins! Propunerea va fi trimisă automat la autoritate.
        </p>
      )}

      {error && (
        <p className="text-xs text-amber-600">{error}</p>
      )}
    </div>
  );
}
