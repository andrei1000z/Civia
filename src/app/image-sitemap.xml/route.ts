import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";

/**
 * Image Sitemap (https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps).
 *
 * Plan SEO #6 (5/22/2026) — accelerates image indexing pentru:
 *   - sesizari publice cu poze (înainte/după)
 *   - proteste cu fotografii
 *
 * Per Google: maxim 1000 imagini per <url>, max 50.000 URL-uri per sitemap.
 *
 * Per page max 5 images here. Folosim caption + title pentru context.
 */

export const revalidate = 21600; // 6h

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface SesizareImg {
  code: string;
  titlu: string | null;
  photos: string[] | null;
  resolved_photo_url: string | null;
}

interface ProtestImg {
  slug: string;
  title: string;
  cover_image_url: string | null;
}

export async function GET() {
  const admin = createSupabaseAdmin();
  let sesizari: SesizareImg[] = [];
  let proteste: ProtestImg[] = [];

  try {
    const [sesResp, protResp] = await Promise.all([
      admin
        .from("sesizari")
        .select("code, titlu, photos, resolved_photo_url")
        .eq("publica", true)
        .eq("moderation_status", "approved")
        .or("photos.not.is.null,resolved_photo_url.not.is.null")
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("proteste")
        .select("slug, title, cover_image_url")
        .eq("visibility", "publica")
        .not("cover_image_url", "is", null)
        .order("start_at", { ascending: false })
        .limit(100),
    ]);
    sesizari = (sesResp.data as SesizareImg[] | null) ?? [];
    proteste = (protResp.data as ProtestImg[] | null) ?? [];
  } catch {
    // Continue with whatever we got
  }

  const urls: string[] = [];

  // Sesizari with photos
  for (const s of sesizari) {
    const pageUrl = `${SITE_URL}/sesizari/${s.code}`;
    const imgs: string[] = [];
    const photos = Array.isArray(s.photos) ? s.photos.slice(0, 4) : [];
    for (const p of photos) {
      if (typeof p === "string" && p.startsWith("http")) {
        imgs.push(
          `    <image:image>\n      <image:loc>${escapeXml(p)}</image:loc>\n      <image:caption>${escapeXml(s.titlu ?? "Sesizare civică")}</image:caption>\n    </image:image>`
        );
      }
    }
    if (s.resolved_photo_url && s.resolved_photo_url.startsWith("http")) {
      imgs.push(
        `    <image:image>\n      <image:loc>${escapeXml(s.resolved_photo_url)}</image:loc>\n      <image:caption>${escapeXml((s.titlu ?? "Sesizare") + " — rezolvată")}</image:caption>\n    </image:image>`
      );
    }
    if (imgs.length > 0) {
      urls.push(
        `  <url>\n    <loc>${escapeXml(pageUrl)}</loc>\n${imgs.join("\n")}\n  </url>`
      );
    }
  }

  // Proteste with cover_image_url
  for (const p of proteste) {
    if (!p.cover_image_url) continue;
    const pageUrl = `${SITE_URL}/proteste/${p.slug}`;
    urls.push(
      `  <url>\n    <loc>${escapeXml(pageUrl)}</loc>\n    <image:image>\n      <image:loc>${escapeXml(p.cover_image_url)}</image:loc>\n      <image:caption>${escapeXml(p.title)}</image:caption>\n    </image:image>\n  </url>`
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
