"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";

/**
 * P3.27 — Buton „Aproape de mine" pe /sesizari-publice.
 *
 * Cere geolocation, calculează nearest sesizări via /api/sesizari/duplicates
 * (radius mare), redirect la /sesizari-publice?nearby=lat,lng. Filtrul apoi
 * sortează sesizările după distanță.
 *
 * Privacy: locația NU se salvează server-side. E folosită doar pentru
 * filtrare ad-hoc în URL. Reset cu un click.
 */
export function NearbyMeButton({ className }: { className?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "denied" | "unavailable">("idle");

  const handleClick = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        router.push(`/sesizari-publice?nearby=${lat},${lng}`);
        setState("idle");
      },
      (err) => {
        setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
        setTimeout(() => setState("idle"), 3500);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        {state === "loading" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}
        {state === "loading" ? "Detectez locația..." : "Aproape de mine"}
      </button>
      {state === "denied" && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          Permisiunea de geolocation refuzată. Activează în setări browser.
        </p>
      )}
      {state === "unavailable" && (
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
          Geolocation indisponibilă pe acest dispozitiv.
        </p>
      )}
    </div>
  );
}
