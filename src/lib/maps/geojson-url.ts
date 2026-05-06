/**
 * Centralized GeoJSON URL builder. Lets us flip the source from
 * Vercel-hosted (`/geojson/*.json`) to an external CDN (Cloudflare R2,
 * Supabase Storage, etc.) by setting a single env var, without touching
 * a single layer file.
 *
 * Why this exists: Vercel Hobby caps Fast Origin Transfer at 10 GB/mo.
 * Static GeoJSON layers (~50 MB total) are the dominant consumer. By
 * setting NEXT_PUBLIC_GEOJSON_BASE_URL=https://r2.civia.ro (or any
 * public bucket URL with CORS), all geojson fetches go to that origin
 * instead. R2 has free unlimited egress; Supabase Storage has 5 GB/mo.
 *
 * Fallback: when the env var is unset, behaves identically to the old
 * `/geojson/...` pattern. Ship-safe with zero config.
 *
 * Usage in components:
 *   import { geojsonUrl } from "@/lib/maps/geojson-url";
 *   <GeoJsonLayer url={geojsonUrl("bicicleta-romania.json")} />
 */

const BASE_URL = process.env.NEXT_PUBLIC_GEOJSON_BASE_URL;

/**
 * Build the full URL for a GeoJSON asset.
 *
 * @param filename - basename including .json (e.g. "bicicleta-romania.json")
 * @returns absolute URL when NEXT_PUBLIC_GEOJSON_BASE_URL is set,
 *          otherwise the relative `/geojson/<filename>` path.
 */
export function geojsonUrl(filename: string): string {
  if (BASE_URL) {
    // Strip trailing slash from base + leading slash from filename to
    // avoid double slashes regardless of how the env var is configured.
    const base = BASE_URL.replace(/\/$/, "");
    const file = filename.replace(/^\//, "");
    return `${base}/${file}`;
  }
  return `/geojson/${filename}`;
}
