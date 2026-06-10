"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";

/**
 * „Urmărește zona" prefiltrat pe provocare (Faza 2) — abonează userul la
 * county + categoria provocării ca să primească update în digestul local.
 * POST /api/area/follow cu consimțământ explicit (GDPR).
 */
export function UrmaresteZonaProvocare({
  county,
  category,
  arie,
}: {
  county: string;
  category: string;
  arie: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "auth" | "error">("idle");

  async function follow() {
    setState("busy");
    try {
      const res = await fetch("/api/area/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ county, category, consent: true, source: "web" }),
      });
      if (res.status === 401) {
        setState("auth");
        return;
      }
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 h-11 px-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check size={15} aria-hidden="true" />
        Urmărești {arie}
      </span>
    );
  }

  if (state === "auth") {
    return (
      <Link
        href="/cont"
        className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm font-medium hover:bg-[var(--color-border)] transition-colors"
      >
        <Bell size={15} aria-hidden="true" />
        Conectează-te ca să urmărești zona
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={follow}
      disabled={state === "busy"}
      className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm font-medium hover:bg-[var(--color-border)] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      {state === "busy" ? (
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        <Bell size={15} aria-hidden="true" />
      )}
      {state === "error" ? "Reîncearcă" : `Urmărește ${arie}`}
    </button>
  );
}
