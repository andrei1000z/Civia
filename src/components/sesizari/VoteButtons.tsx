"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { trackSesizareVote, trackAuthModalOpen } from "@/components/analytics/CiviaTracker";

interface VoteButtonsProps {
  code: string;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote?: -1 | 1 | null;
  size?: "sm" | "md";
  layout?: "horizontal" | "vertical";
}

export function VoteButtons({
  code,
  initialUpvotes,
  initialDownvotes,
  initialUserVote = null,
  size = "md",
  layout = "horizontal",
}: VoteButtonsProps) {
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState<-1 | 1 | null>(initialUserVote);
  const [loading, setLoading] = useState(false);

  const handleVote = async (value: 1 | -1) => {
    if (!user) {
      trackAuthModalOpen("vote");
      openAuthModal();
      return;
    }
    if (loading) return;
    setLoading(true);

    // Calculate optimistic update
    const newValue = userVote === value ? 0 : value;
    const prevVote = userVote;
    // 2026-05-25 — track vote action (don't track unvote/toggle-off).
    if (newValue !== 0) trackSesizareVote(newValue === 1 ? "up" : "down");

    // Optimistic
    if (prevVote === 1) setUpvotes((v) => v - 1);
    if (prevVote === -1) setDownvotes((v) => v - 1);
    if (newValue === 1) setUpvotes((v) => v + 1);
    if (newValue === -1) setDownvotes((v) => v + 1);
    setUserVote(newValue === 0 ? null : (newValue as 1 | -1));

    try {
      const res = await fetch(`/api/sesizari/${code}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });
      if (!res.ok) throw new Error("Vote failed");
    } catch {
      // Rollback
      if (prevVote === 1) setUpvotes((v) => v + 1);
      if (prevVote === -1) setDownvotes((v) => v + 1);
      if (newValue === 1) setUpvotes((v) => v - 1);
      if (newValue === -1) setDownvotes((v) => v - 1);
      setUserVote(prevVote);
      toast("Nu s-a putut înregistra votul", "error");
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? 14 : 16;
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        layout === "vertical" && "flex-col"
      )}
    >
      <button
        type="button"
        onClick={() => handleVote(1)}
        disabled={loading}
        aria-pressed={userVote === 1}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] px-3 min-h-[44px] transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
          userVote === 1
            ? "bg-emerald-500 text-white"
            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]",
          textClass
        )}
        aria-label={`Mă afectează și pe mine — votează pozitiv (${upvotes} ${upvotes === 1 ? "vot" : "voturi"})`}
        title="Mă afectează și pe mine — votează pozitiv"
      >
        <ThumbsUp size={iconSize} aria-hidden="true" />
        <span className="tabular-nums">{upvotes}</span>
      </button>
      <button
        type="button"
        onClick={() => handleVote(-1)}
        disabled={loading}
        aria-pressed={userVote === -1}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] px-3 min-h-[44px] transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
          userVote === -1
            ? "bg-red-500 text-white"
            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]",
          textClass
        )}
        aria-label={`Nu cred că e o problemă reală — votează negativ (${downvotes} ${downvotes === 1 ? "vot" : "voturi"})`}
        title="Nu cred că e o problemă reală — votează negativ"
      >
        <ThumbsDown size={iconSize} aria-hidden="true" />
        <span className="tabular-nums">{downvotes}</span>
      </button>
    </div>
  );
}
