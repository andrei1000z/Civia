"use client";

import { useState, useRef, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Sparkles, Check, Loader2, X } from "lucide-react";

interface Props {
  stireId: string;
}

const STORAGE_KEY_PREFIX = "civia.stire.feedback.";

/**
 * Card mic sub DESPRE pe /stiri/[id]:
 *  - 👍 Like → counter Redis + animație + UI sound (Web Audio API tone)
 *      + mulțumire afișată 2 sec.
 *  - 👎 Dislike → expandă o textarea „Ce putem îmbunătăți?" + submit →
 *      counter Redis + insert în feedback_submissions cu topic=
 *      „stire-dislike" + page_path=/stiri/{id}, vizibil în /admin/feedback.
 *
 * localStorage memorează că user-ul a reacționat deja pentru această stire
 * → nu poate să-i mai apese de mai multe ori în același tab (anti-spam soft).
 */
export function StireFeedbackCard({ stireId }: Props) {
  const [reacted, setReacted] = useState<"like" | "dislike" | null>(null);
  const [showDislikeForm, setShowDislikeForm] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Restore previous reaction from localStorage (avoid re-spam)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + stireId);
      if (stored === "like" || stored === "dislike") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReacted(stored);
      }
    } catch {/* localStorage blocked */}
  }, [stireId]);

  /**
   * Două note „ding-ding!" în do major (E5 → A5 ascendent) ca să sune
   * vesel-confirmativ, nu robotic. Web Audio API pe pure oscilator —
   * zero asset, ~50 bytes JS, funcționează pe orice browser modern.
   */
  const playLikeSound = () => {
    try {
      const W = window as unknown as {
        webkitAudioContext?: typeof AudioContext;
        AudioContext?: typeof AudioContext;
      };
      const AudioCtor = W.AudioContext ?? W.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor();
      const ctx = audioCtxRef.current;
      const note = (freq: number, startOffset: number, duration: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = "sine";
        o.frequency.value = freq;
        const t = ctx.currentTime + startOffset;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.start(t);
        o.stop(t + duration);
      };
      note(659.25, 0, 0.15); // E5
      note(880.0, 0.09, 0.25); // A5
    } catch {
      /* silent fail — sound is decorative */
    }
  };

  const send = async (kind: "like" | "dislike", commentBody?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/stiri/${stireId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, comment: commentBody?.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "Eroare la trimitere");
      }
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + stireId, kind);
      } catch {/* noop */}
      setReacted(kind);
      if (kind === "like") {
        playLikeSound();
      }
      setDone(true);
      // Hide "Mulțumim" after a moment (only for likes — dislike form has own state)
      if (kind === "like") {
        setTimeout(() => setDone(false), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = () => {
    if (reacted || submitting) return;
    void send("like");
  };

  const handleDislikeIntent = () => {
    if (reacted || submitting) return;
    setShowDislikeForm(true);
  };

  const handleDislikeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await send("dislike", comment);
    setShowDislikeForm(false);
  };

  // ─── Already reacted ──────────────────────────────────────────────
  if (reacted === "like") {
    return (
      <div className="bg-[var(--color-surface)] border border-emerald-500/30 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
          <Sparkles size={14} className="text-emerald-500" aria-hidden="true" />
          {done ? "Mulțumim pentru apreciere! ✨" : "Ai apreciat sinteza"}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
          Feedback-ul tău ne ajută să îmbunătățim AI-ul.
        </p>
      </div>
    );
  }

  if (reacted === "dislike") {
    return (
      <div className="bg-[var(--color-surface)] border border-rose-500/30 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
        <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300 font-semibold">
          <Check size={14} aria-hidden="true" />
          Feedback trimis
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
          Vom analiza ce putem îmbunătăți. Mulțumim!
        </p>
      </div>
    );
  }

  // ─── Default: like/dislike picker ────────────────────────────────
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
      {!showDislikeForm ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={12} className="text-violet-500" aria-hidden="true" />
            <p className="text-[10px] uppercase tracking-wider font-bold text-violet-700 dark:text-violet-400">
              Sinteza ta
            </p>
          </div>
          <p className="text-sm font-[family-name:var(--font-sora)] font-semibold mb-3 leading-snug">
            Ți-a plăcut prezentarea?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLike}
              disabled={submitting}
              aria-label="Apreciez sinteza"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-[var(--radius-button)] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <ThumbsUp size={14} aria-hidden="true" />
              )}
              Da
            </button>
            <button
              type="button"
              onClick={handleDislikeIntent}
              disabled={submitting}
              aria-label="Nu mi-a plăcut sinteza"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-[var(--radius-button)] bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
            >
              <ThumbsDown size={14} aria-hidden="true" />
              Nu chiar
            </button>
          </div>
          {error && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2">{error}</p>
          )}
        </>
      ) : (
        <form onSubmit={handleDislikeSubmit}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-rose-700 dark:text-rose-400 mb-0.5">
                Feedback
              </p>
              <p className="text-sm font-[family-name:var(--font-sora)] font-semibold leading-snug">
                Ce putem îmbunătăți?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDislikeForm(false)}
              aria-label="Renunță"
              className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] inline-flex items-center justify-center text-[var(--color-text-muted)] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 2000))}
            rows={4}
            maxLength={2000}
            placeholder="Ex: sinteza ratează contextul X, sau aruncă cifre greșite, sau nu surprinde concluzia articolului…"
            autoFocus
            className="w-full p-3 text-sm rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {comment.length}/2000
            </span>
            <button
              type="submit"
              disabled={submitting || comment.trim().length < 3}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-button)] bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {submitting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Check size={12} aria-hidden="true" />
              )}
              Trimite
            </button>
          </div>
          {error && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-2">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}
