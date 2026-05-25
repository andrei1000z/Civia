// Analytics container — mounts Plausible (script) + CiviaTracker (custom, Redis-backed).
// Plausible keeps the historical aggregate; CiviaTracker feeds /admin/analytics.
//
// 2026-05-25 OPTIMIZATION: skip analytics pe paths fără valoare statistică:
//   - /admin/* — staff context, nu user behavior
//   - /legal/* — pagini text statice rare-visitate
//   - /embed/* — iframe content (caller-side analytics deja)
//   - /actualizari — changelog rar-vizitat
// Salvare -10-15% edge requests analytics.

"use client";
import { usePathname } from "next/navigation";
import { CiviaTracker, trackCustomEvent } from "@/components/analytics/CiviaTracker";

const SKIP_PREFIXES = ["/admin", "/legal", "/embed", "/actualizari"];

export function Analytics() {
  const pathname = usePathname();
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const api = process.env.NEXT_PUBLIC_PLAUSIBLE_API;

  // Skip TOATE analytics pe paths fără valoare statistică pentru product.
  const skip = SKIP_PREFIXES.some((p) => pathname.startsWith(p));
  if (skip) return null;

  return (
    <>
      {domain && (
        <script
          defer
          data-domain={domain}
          data-api={api ?? "https://plausible.io/api/event"}
          src="https://plausible.io/js/script.js"
        />
      )}
      <CiviaTracker />
    </>
  );
}

// Helper to fire custom events. Pushes to both Plausible (if loaded) and the
// Civia backend so each event shows up in /admin/analytics.
export function trackEvent(name: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  const plausible = (
    window as unknown as {
      plausible?: (name: string, opts?: { props?: Record<string, string | number> }) => void;
    }
  ).plausible;
  if (plausible) plausible(name, { props });
  trackCustomEvent(name, props ?? {});
}
