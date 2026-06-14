/**
 * Native-feel utilities pentru TWA (Trusted Web Activity) Play Store.
 *
 * Plan 5/22/2026 — îmbunătățiri ca Civia să se simtă ca app nativ pe
 * Android (nu PWA browser). Toate funcțiile sunt no-op pe browser
 * normal sau iOS Safari — degrade gracefully.
 */

/**
 * Vibrație scurtă pentru feedback tactil (haptic).
 * Suportat: Android Chrome (toate versiunile), Samsung Internet.
 * NU suportat: iOS Safari (Apple block), desktop browsers.
 *
 * Pattern-uri standard:
 *  - „tap"    → 10ms  (buton apăsat, navigare)
 *  - „success" → 50ms  (sesizare trimisă cu succes)
 *  - „error"   → [50, 30, 50] (3 vibrații scurte = greșit)
 *  - „warning" → [30, 30, 30] (atenționare)
 */
export type HapticPattern = "tap" | "success" | "error" | "warning" | "heavy";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: 50,
  error: [50, 30, 50],
  warning: [30, 30, 30],
  heavy: 100,
};

export function haptic(pattern: HapticPattern = "tap"): void {
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  // Respect reduced motion preference — disabilităm haptic dacă userul
  // a setat „reduce motion" pe OS (Android Accessibility → Remove animations).
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Some browsers throw on vibrate from non-user-initiated context — ignore.
  }
}

/**
 * App Badge API — afișează un număr pe icon-ul Civia în Android launcher.
 * Ex: badge(3) → arată „3" peste icon → utilizatorul știe că are 3
 * sesizări cu update fără să deschidă app-ul.
 *
 * Suportat: Chrome 81+ pe Android, Edge desktop.
 * Auto-clear: badge() fără argument → șterge.
 */
export async function setAppBadge(count?: number): Promise<void> {
  if (typeof navigator === "undefined") return;
  // navigator.setAppBadge e experimental, deci type-cast.
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count === undefined || count === 0) {
      await nav.clearAppBadge?.();
    } else {
      await nav.setAppBadge?.(count);
    }
  } catch {
    // Permission denied sau API neavailabil — ignore.
  }
}

/**
 * Native Share API — declanșează sheet-ul system Android cu opțiuni de
 * partajare (WhatsApp, SMS, Bluetooth, Gmail, etc.).
 *
 * Suportat: Chrome Android, Samsung Internet, Safari iOS.
 * Fallback: copy URL în clipboard + arată toast.
 */
export async function nativeShare(opts: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<{ shared: boolean; method: "native" | "clipboard" | "none" }> {
  if (typeof navigator === "undefined") {
    return { shared: false, method: "none" };
  }
  if ("share" in navigator) {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
      });
      haptic("success");
      return { shared: true, method: "native" };
    } catch (e) {
      // User a anulat share sheet — NU e eroare reală
      if (e instanceof Error && e.name === "AbortError") {
        return { shared: false, method: "none" };
      }
    }
  }
  // Fallback: copy URL in clipboard
  if (opts.url && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(opts.url);
      haptic("tap");
      return { shared: true, method: "clipboard" };
    } catch {
      // Clipboard permission denied — fall through
    }
  }
  return { shared: false, method: "none" };
}

/**
 * Detect dacă rulăm în TWA (Trusted Web Activity) pe Android, NU în
 * Chrome browser. Util pentru a customiza UI: în app putem ascunde
 * link-uri „Download app" sau „Install PWA" (deja instalat).
 *
 * Cum: TWA setează referrer la „android-app://ro.civia.twa" în prima
 * navigare. Plus display-mode standalone + user-agent specific.
 */
export function isRunningInTwa(): boolean {
  if (typeof window === "undefined") return false;
  // Referrer la primul pageview e cea mai fiabilă cale.
  const isFromAndroidApp = document.referrer.startsWith("android-app://");
  // Standalone display = PWA installed (poate fi TWA Android SAU iOS A2HS)
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  // UA detection — TWA Chrome pe Android folosește user agent normal Chrome,
  // dar adaugă „wv" sau referrer android-app://. Combinarea celor 2 e safe.
  return isFromAndroidApp || (isStandalone && /Android/.test(navigator.userAgent));
}

/**
 * Detect installed PWA (oricare context — TWA Android, iOS A2HS, etc.).
 */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // Standalone display match — cel mai fiabil pentru Android + iOS
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari folosește navigator.standalone instead of media query
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return false;
}
