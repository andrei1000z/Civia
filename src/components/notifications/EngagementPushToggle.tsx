"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dismissPrompt,
  undismissPrompt,
  isPromptDismissed,
} from "@/lib/preferences/sync";

// Cheia din dismissed_prompts respectată de broadcastToAllSubscribers (anunțuri
// civice noi) + /api/streaks/at-risk (remindere de streak).
const KEY = "no_broadcast";

/**
 * Opt-out pentru push-ul de IMPLICARE (non-esențial): anunțuri civice noi
 * (petiție/protest) + remindere de streak. Default ON (primești). OFF scrie
 * `no_broadcast` în dismissed_prompts (sync cross-device prin preferences).
 *
 * NU afectează notificările tranzacționale legate de sesizările TALE (schimbare
 * de status, răspuns autoritate) — acelea sunt mesaje de serviciu, mereu active.
 *
 * Înainte de fix-ul 6/17: flag-ul era verificat dar nimic nu-l SETA, iar check-ul
 * era `=== true` pe o valoare timestamp → opt-out-ul nu funcționa deloc.
 */
export function EngagementPushToggle() {
  // `on` = primește (cheia absentă). Hidratăm din storage după mount (SSR-safe).
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(!isPromptDismissed(KEY));
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    if (next) undismissPrompt(KEY);
    else dismissPrompt(KEY);
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[var(--color-text-muted)]">
        <Megaphone size={16} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <label
          htmlFor="engagement-push"
          className="block text-sm font-semibold text-[var(--color-text)]"
        >
          Notificări de implicare
        </label>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
          Anunțuri civice noi (petiții, proteste) și remindere de streak.
          Notificările despre sesizările tale nu sunt afectate.
        </p>
      </div>
      <button
        id="engagement-push"
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Notificări de implicare"
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
          on
            ? "bg-[var(--color-primary)]"
            : "bg-[var(--color-surface-2)] border border-[var(--color-border)]",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow-[var(--shadow-1)] transition-transform duration-200",
            on ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
