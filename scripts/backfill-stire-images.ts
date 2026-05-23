/**
 * Backfill: pentru fiecare stire cu image_url broken (mp4/video) sau NULL,
 * re-fetch og:image de pe pagina sursei cu logica nouă (multi-selector +
 * looksLikeImageUrl validation).
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function looksLikeImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (/\.(mp4|webm|mov|m4v|mp3|wav|ogg|pdf|zip|svgz)(\?|$)/i.test(path)) {
      return false;
    }
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/i.test(path)) return true;
    return true;
  } catch {
    return false;
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro/about) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const selectors: RegExp[] = [
      /<meta[^>]+property=["']og:image(?::(?:url|secure_url))?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::(?:url|secure_url))?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
      /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|avif|gif))["']/i,
    ];
    for (const re of selectors) {
      const m = html.match(re);
      const found = m?.[1]?.trim();
      if (!found) continue;
      let abs: string;
      try {
        abs = new URL(found, url).toString();
      } catch {
        continue;
      }
      if (!looksLikeImageUrl(abs)) continue;
      return abs;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  // 1. Find broken ones: mp4/video extensions OR null
  const { data: broken } = await sa
    .from("stiri_cache")
    .select("id, title, source, url, image_url")
    .order("published_at", { ascending: false });

  if (!broken) {
    console.log("No data");
    return;
  }

  const toFix = broken.filter((s) => {
    if (!s.image_url) return true;
    return !looksLikeImageUrl(s.image_url as string);
  });

  console.log(`Found ${toFix.length} stiri with broken/null image_url`);
  let fixed = 0;
  let failed = 0;

  for (const s of toFix) {
    process.stdout.write(`  [${s.source}] ${(s.title as string).slice(0, 50)}... `);
    const img = await fetchOgImage(s.url as string);
    if (!img) {
      console.log("✗ (no image found)");
      failed += 1;
      continue;
    }
    const { error } = await sa
      .from("stiri_cache")
      .update({ image_url: img })
      .eq("id", s.id);
    if (error) {
      console.log("✗ DB error:", error.message);
      failed += 1;
      continue;
    }
    console.log("✓");
    fixed += 1;
  }

  console.log(`\nFixed: ${fixed}, Failed: ${failed}, Total: ${toFix.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
