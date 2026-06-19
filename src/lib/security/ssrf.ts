/**
 * 2026-06-19 (audit Major/Minor) — guard SSRF partajat.
 *
 * `isSafePublicUrl` validează DOAR URL-ul dat (host/IP literal). Problema găsită:
 * un `fetch(url, { redirect: "follow" })` putea sări peste guard printr-un 30x
 * către un IP intern (Location: http://169.254.169.254/...). `safeFetch` face
 * `redirect: "manual"` și RE-VALIDEAZĂ fiecare hop înainte de a-l urma.
 */

export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Blochează ORICE literal IPv6 (::1 / fe80 / ::ffff:127.0.0.1 sunt vectori SSRF).
  if (host.includes(":")) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return false; // any-local / loopback / privat
    if (a === 169 && b === 254) return false; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return false; // privat
    if (a === 192 && b === 168) return false; // privat
    if (a >= 224) return false; // multicast / rezervat
  }
  return true;
}

/**
 * fetch cu protecție SSRF la redirecturi: validează URL-ul inițial ȘI fiecare
 * Location de 30x înainte de a-l urma. Aruncă dacă vreun hop e nepermis sau dacă
 * se depășește `maxHops`. Restul semanticii = `fetch` (headers/signal/cache din `init`).
 */
export async function safeFetch(
  initialUrl: string,
  init: RequestInit = {},
  opts: { maxHops?: number } = {},
): Promise<Response> {
  const maxHops = opts.maxHops ?? 4;
  let url = initialUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    if (!isSafePublicUrl(url)) throw new Error("URL blocat (țintă internă/nepermisă)");
    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res; // 30x fără Location → întoarce cum e
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("Prea multe redirecturi");
}
