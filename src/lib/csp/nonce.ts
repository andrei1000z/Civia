import { headers } from "next/headers";

/**
 * Nonce-based CSP — audit item #18.
 *
 * Returns the request-scoped CSP nonce that proxy.ts attached to the
 * inbound headers. Server Components call `getCspNonce()` and pass it
 * to `<Script>` / inline `<script>` / `<style>` tags so they can be
 * whitelisted via `'nonce-{value}'` in script-src and style-src — no
 * more blanket `'unsafe-inline'`.
 *
 * Returns null when:
 *   - The CSP_NONCE_MODE env flag is OFF (default — soft rollout).
 *   - The request didn't pass through proxy.ts (e.g. unit tests).
 *
 * Callers MUST tolerate null and fall back to no `nonce={...}` prop.
 *
 * Usage:
 *   const nonce = await getCspNonce();
 *   <Script src="..." nonce={nonce ?? undefined} />
 */
export async function getCspNonce(): Promise<string | null> {
  if (process.env.CSP_NONCE_MODE !== "on") return null;
  try {
    const h = await headers();
    return h.get("x-csp-nonce");
  } catch {
    return null;
  }
}

/**
 * Generate a fresh 128-bit nonce as a base64 string. Used by proxy.ts
 * to attach per-request. The Web Crypto API is available in Edge
 * Runtime (where proxy.ts runs) so we use that directly.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Base64 — Edge Runtime has btoa but not Buffer.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Build the CSP header value with the given nonce mixed in. Called
 * from proxy.ts when CSP_NONCE_MODE is on; falls back to the static
 * CSP from next.config.ts otherwise.
 *
 * Differences from next.config.ts CSP:
 *   - script-src: replaces 'unsafe-inline' with 'nonce-${nonce}'
 *   - style-src: keeps 'unsafe-inline' (Tailwind injects inline style
 *     props that nonce can't cover without serious refactor)
 */
export function buildCspWithNonce(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://plausible.io https://cdn.jsdelivr.net https://unpkg.com https://analytics-seven-steel.vercel.app`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://api.open-meteo.com https://plausible.io https://api.openaq.org https://nominatim.openstreetmap.org https://www.seismicportal.eu https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://cdn.jsdelivr.net https://unpkg.com https://analytics-seven-steel.vercel.app",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' https: data: blob:",
    "frame-ancestors 'self'",
    "frame-src 'self' https://mail.google.com https://outlook.live.com https://compose.mail.yahoo.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
