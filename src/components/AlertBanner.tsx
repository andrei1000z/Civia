"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X, Info, AlertOctagon } from "lucide-react";

interface AlertPayload {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  link?: string;
  source: string;
}

const DISMISSED_KEY = "civia:alerts:dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* quota */
  }
}

// Phase 3 v2 round 3: bg cu /95 alpha + backdrop-blur-sm.
// Când AlertBanner e sticky-top (z-60) și utilizatorul scrol-ează peste
// content, se vede subtil ce trece pe sub el — feel iOS premium.
// Severity colors rămân la fel (red/amber/blue) — doar adăugăm transparency.
const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: typeof Info }> = {
  critical: {
    bg: "bg-red-600/95 dark:bg-red-700/95 backdrop-blur-sm",
    text: "text-white",
    icon: AlertOctagon,
  },
  warning: {
    bg: "bg-amber-500/95 dark:bg-amber-600/95 backdrop-blur-sm",
    text: "text-white",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-blue-600/95 dark:bg-blue-700/95 backdrop-blur-sm",
    text: "text-white",
    icon: Info,
  },
};

export function AlertBanner() {
  const [alert, setAlert] = useState<AlertPayload | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Citire localStorage doar pe client → setState în effect e intenționat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissed());

    let cancelled = false;
    // Helper: treat res.ok===false as silent-skip (keep previous
    // alert visible) instead of nulling the banner out. Prevents
    // a 5xx from /api/alerts hiding an alert that was valid 30s ago.
    const fetchAlert = async () => {
      try {
        const r = await fetch("/api/alerts");
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setAlert(j.data as AlertPayload | null);
      } catch {
        /* silent — network blip, retry next tick */
      }
    };

    fetchAlert();

    // Re-check every 5 minutes, but only while the tab is visible.
    // Background tabs polling every 5 min drained phone battery
    // with no user benefit.
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(fetchAlert, 5 * 60_000);
    };
    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
        fetchAlert(); // catch-up when user returns to the tab
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!alert || dismissed.has(alert.id)) return null;

  const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info!;
  const Icon = style.icon;

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(alert.id);
    setDismissed(next);
    saveDismissed(next);
  };

  const body = (
    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
      <span className="font-bold text-sm">{alert.title}</span>
      <span className="text-sm opacity-90 truncate">{alert.message}</span>
    </div>
  );

  return (
    <div
      // FIXED top-16 — sits direct sub navbar-ul fixed (h-16 = 64px).
      // z higher than nav (z-50) ca să nu fie acoperit de glass blur.
      // data-alert-banner: CSS in globals.css foloseste :has() pentru a creste
      // body padding-top de la pt-16 la pt-[7rem] cand bannerul e prezent —
      // altfel content-ul de sus al paginii ramane ascuns sub el.
      data-alert-banner
      className={`${style.bg} ${style.text} fixed top-16 left-0 right-0 z-[var(--z-banner)] shadow-md`}
      role={alert.severity === "critical" ? "alert" : "status"}
      aria-live={alert.severity === "critical" ? "assertive" : "polite"}
    >
      <div className="container-narrow flex items-center gap-3 py-2.5">
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        {alert.link ? (
          <Link href={alert.link} className="flex-1 min-w-0 hover:opacity-90 transition-opacity">
            {body}
          </Link>
        ) : (
          body
        )}
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 w-9 h-9 sm:w-8 sm:h-8 -mr-2 rounded-full hover:bg-white/20 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Închide această alertă"
          title="Închide alerta"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
