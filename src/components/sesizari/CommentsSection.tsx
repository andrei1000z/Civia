"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, ThumbsUp, ThumbsDown, CornerDownRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { trackCommentPost, trackAuthModalOpen } from "@/components/analytics/CiviaTracker";
import type { SesizareCommentRow } from "@/lib/supabase/types";

interface CommentsSectionProps {
  code: string;
  initialComments: SesizareCommentRow[];
}

interface CommentMeta {
  upvotes: number;
  downvotes: number;
  userVote: -1 | 1 | null;
}

export function CommentsSection({ code, initialComments }: CommentsSectionProps) {
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  // Per-comment vote state — populated lazily; absent = not yet loaded.
  // Optimistic updates: client state changes immediately, server sync in background.
  const [voteMeta, setVoteMeta] = useState<Record<string, CommentMeta>>({});

  useEffect(() => {
    setComments(initialComments);
    // audit fix: inițializează voteMeta din tally-urile reale (getComments le
    // atașează acum), ca afișajul + optimistic-update-ul să pornească de la DB.
    const init: Record<string, CommentMeta> = {};
    for (const c of initialComments) {
      init[c.id] = {
        upvotes: c.upvotes ?? 0,
        downvotes: c.downvotes ?? 0,
        userVote: c.user_vote ?? null,
      };
    }
    setVoteMeta(init);
  }, [initialComments]);

  // Group comments: top-level + replies map keyed by parent_comment_id.
  // 1-level threading — replies to replies become flat (rendered as replies
  // to the parent's first-level reply too). Reddit-style flat replies.
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, SesizareCommentRow[]>();
  for (const c of comments) {
    if (c.parent_comment_id) {
      const arr = repliesByParent.get(c.parent_comment_id) ?? [];
      arr.push(c);
      repliesByParent.set(c.parent_comment_id, arr);
    }
  }

  const post = async (text: string, parentId: string | null) => {
    const res = await fetch(`/api/sesizari/${code}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, parent_comment_id: parentId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Eroare");
    return json.data as SesizareCommentRow;
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      trackAuthModalOpen("comment");
      openAuthModal();
      return;
    }
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const row = await post(body.trim(), null);
      setComments((prev) => [...prev, row]);
      setBody("");
      trackCommentPost("sesizare");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare";
      setError(msg);
      toast(msg, "error");
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!replyBody.trim() || replyPosting) return;
    setReplyPosting(true);
    try {
      const row = await post(replyBody.trim(), parentId);
      setComments((prev) => [...prev, row]);
      setReplyBody("");
      setReplyTo(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setReplyPosting(false);
    }
  };

  const handleVote = async (commentId: string, value: -1 | 1) => {
    if (!user) {
      openAuthModal();
      return;
    }
    // Optimistic update — UI răspunde instant. Pe error rollback.
    const prev = voteMeta[commentId] ?? { upvotes: 0, downvotes: 0, userVote: null };
    const newValue = prev.userVote === value ? 0 : value;
    const next: CommentMeta = {
      upvotes: prev.upvotes
        + (newValue === 1 ? 1 : 0)
        - (prev.userVote === 1 ? 1 : 0),
      downvotes: prev.downvotes
        + (newValue === -1 ? 1 : 0)
        - (prev.userVote === -1 ? 1 : 0),
      userVote: newValue === 0 ? null : (newValue as -1 | 1),
    };
    setVoteMeta((m) => ({ ...m, [commentId]: next }));

    try {
      const res = await fetch(`/api/sesizari/${code}/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });
      if (!res.ok) throw new Error("Vote failed");
    } catch {
      // Rollback
      setVoteMeta((m) => ({ ...m, [commentId]: prev }));
      toast("Nu s-a putut înregistra votul", "error");
    }
  };

  const renderComment = (c: SesizareCommentRow, isReply: boolean) => {
    const meta = voteMeta[c.id] ?? { upvotes: 0, downvotes: 0, userVote: null };
    return (
      <article
        key={c.id}
        className={cn(
          "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4",
          isReply && "ml-6 md:ml-8 border-l-2 border-l-[var(--color-primary)]/30",
        )}
      >
        <header className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isReply && (
              <CornerDownRight
                size={14}
                className="text-[var(--color-text-muted)] shrink-0"
                aria-hidden="true"
              />
            )}
            <p className="font-medium text-sm truncate">{c.author_name}</p>
          </div>
          <TimeAgo
            date={c.created_at}
            className="text-xs text-[var(--color-text-muted)] shrink-0"
          />
        </header>
        <p className="text-sm whitespace-pre-wrap mb-3">{c.body}</p>

        {/* Actions: like / dislike / reply */}
        <div className="flex items-center gap-1 -ml-1">
          <button
            type="button"
            onClick={() => handleVote(c.id, 1)}
            aria-pressed={meta.userVote === 1}
            aria-label={`Like (${meta.upvotes})`}
            className={cn(
              "inline-flex items-center gap-1 h-8 px-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              meta.userVote === 1
                ? "bg-emerald-500 text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
            )}
          >
            <ThumbsUp size={12} aria-hidden="true" />
            <span className="tabular-nums">{meta.upvotes}</span>
          </button>
          <button
            type="button"
            onClick={() => handleVote(c.id, -1)}
            aria-pressed={meta.userVote === -1}
            aria-label={`Dislike (${meta.downvotes})`}
            className={cn(
              "inline-flex items-center gap-1 h-8 px-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              meta.userVote === -1
                ? "bg-red-500 text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
            )}
          >
            <ThumbsDown size={12} aria-hidden="true" />
            <span className="tabular-nums">{meta.downvotes}</span>
          </button>
          {/* Reply button — only on top-level comments (1-nivel threading) */}
          {!isReply && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(replyTo === c.id ? null : c.id);
                setReplyBody("");
              }}
              className="ml-1 inline-flex items-center gap-1 h-8 px-2 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <CornerDownRight size={12} aria-hidden="true" />
              Răspunde
            </button>
          )}
        </div>

        {/* Inline reply composer */}
        {replyTo === c.id && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReply(c.id);
            }}
            className="mt-3 pt-3 border-t border-[var(--color-border)]"
          >
            <label htmlFor={`reply-${c.id}`} className="sr-only">
              Răspuns la {c.author_name}
            </label>
            <textarea
              id={`reply-${c.id}`}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value.slice(0, 2000))}
              rows={2}
              placeholder={`Răspunde lui ${c.author_name}...`}
              className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              disabled={replyPosting}
              autoFocus
              autoCapitalize="sentences"
              spellCheck
            />
            <div className="flex items-center justify-between gap-2 mt-2">
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  replyBody.length >= 1800
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-[var(--color-text-muted)]"
                )}
              >
                {replyBody.length}/2000
              </span>
              <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReplyTo(null);
                  setReplyBody("");
                }}
              >
                Anulează
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={replyPosting}
                disabled={!replyBody.trim() || replyPosting}
                aria-busy={replyPosting}
                leftIcon={<Send size={12} aria-hidden="true" />}
              >
                Trimite
              </Button>
              </div>
            </div>
          </form>
        )}
      </article>
    );
  };

  return (
    <section aria-labelledby="comments-heading">
      <h3 id="comments-heading" className="font-[family-name:var(--font-sora)] font-semibold text-lg mb-4 flex items-center gap-2">
        <MessageSquare size={18} aria-hidden="true" />
        Comentarii (<span className="tabular-nums">{comments.length}</span>)
      </h3>

      {/* Compose top-level */}
      <form
        onSubmit={handlePost}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 mb-4"
      >
        {user ? (
          <>
            <label htmlFor="comment-body" className="sr-only">Comentariul tău</label>
            <textarea
              id="comment-body"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="Scrie un comentariu..."
              aria-describedby="comment-count"
              className="w-full p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              disabled={posting}
              autoCapitalize="sentences"
              spellCheck
            />
            <div className="flex items-center justify-between mt-2">
              <span id="comment-count" className="text-xs text-[var(--color-text-muted)] tabular-nums">
                {body.length}/2000
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={posting}
                disabled={!body.trim() || posting}
                aria-busy={posting}
                leftIcon={<Send size={14} aria-hidden="true" />}
              >
                {posting ? "Se trimite..." : "Trimite"}
              </Button>
            </div>
            {error && <p role="alert" className="text-xs text-red-500 mt-2">{error}</p>}
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={openAuthModal}
            className="w-full"
          >
            Autentifică-te ca să comentezi <span aria-hidden="true">→</span>
          </Button>
        )}
      </form>

      {/* List */}
      {topLevel.length === 0 ? (
        <div className="text-center py-10 px-4 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)]">
          <MessageSquare
            size={36}
            className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-60"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[var(--color-text)] mb-1">Niciun comentariu încă</p>
          {user ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              Lasă tu primul comentariu — alți cetățeni pot adăuga context.
            </p>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-block mt-1 text-xs text-[var(--color-primary)] font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 rounded px-1"
            >
              Autentifică-te ca să lași primul comentariu <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map((c) => (
            <div key={c.id} className="space-y-2">
              {renderComment(c, false)}
              {(repliesByParent.get(c.id) ?? []).map((reply) =>
                renderComment(reply, true),
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
