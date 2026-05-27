/**
 * Cloudflare Browser Rendering — screenshot oricărui URL.
 *
 * 2026-05-27 — Free tier pe Workers Free Plan: limited screenshots/zi.
 * REST API endpoint: /accounts/{id}/browser-rendering/screenshot
 *
 * Permisiune necesară pe CLOUDFLARE_API_TOKEN: „Browser Rendering Edit".
 * Pe dashboard: Account → API Tokens → token-ul tău → Edit → Add „Browser
 * Rendering: Edit" permission.
 *
 * Use cases:
 *   - Admin /admin/screenshot — văd cum arată orice pagină civia.ro
 *   - Visual regression testing (compar before/after deploy)
 *   - OG image generation server-side
 *   - PDF export al sesizărilor (endpoint /pdf)
 */

interface ScreenshotOptions {
  url: string;
  /** Width x Height. Default 1920x1080 (desktop). */
  viewport?: { width: number; height: number };
  /** "png" | "jpeg". Default png. */
  format?: "png" | "jpeg";
  /** Wait pentru selector să apară înainte de capture. */
  waitForSelector?: string;
  /** Wait timeout ms. Default 8000. */
  waitTimeout?: number;
  /** Full page sau doar viewport. Default false (viewport). */
  fullPage?: boolean;
}

export async function captureScreenshot(opts: ScreenshotOptions): Promise<{
  bytes: Uint8Array | null;
  error: string | null;
}> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    return { bytes: null, error: "Cloudflare Browser Rendering not configured" };
  }

  const body: Record<string, unknown> = {
    url: opts.url,
    screenshotOptions: {
      type: opts.format ?? "png",
      fullPage: opts.fullPage ?? false,
    },
    viewport: opts.viewport ?? { width: 1920, height: 1080 },
  };
  if (opts.waitForSelector) {
    body.waitForSelector = { selector: opts.waitForSelector, timeout: opts.waitTimeout ?? 8000 };
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { bytes: null, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const buffer = await res.arrayBuffer();
    return { bytes: new Uint8Array(buffer), error: null };
  } catch (e) {
    return { bytes: null, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
