import { REF_SELF_COOKIE } from "./code";

/**
 * Helpers client pentru referral — citesc codul propriu din cookie-ul
 * `civia_rc` (setat de /api/referral/self) și îl injectează pe URL-urile
 * de share. Pur client-side, fără dependențe de Node.
 */

/** Codul de referral al userului logat, din cookie. null dacă lipsește. */
export function selfRefCode(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)civia_rc=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * Adaugă `?ref={cod}` pe un URL ABSOLUT de share, dacă userul are cod și
 * URL-ul n-are deja `ref`. URL relativ / malformat → întors neschimbat.
 */
export function withRef(url: string): string {
  const code = selfRefCode();
  if (!code) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("ref")) u.searchParams.set("ref", code);
    return u.toString();
  } catch {
    return url;
  }
}

// Re-export pentru consumatori care vor doar numele cookie-ului.
export { REF_SELF_COOKIE };
