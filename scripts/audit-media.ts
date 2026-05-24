/**
 * Audit toate stirile pentru probleme cunoscute:
 *  - URL-uri cu template placeholders (%title%, %media%, {{...}})
 *  - URL-uri cu dimensiuni mici care au scăpat filtrul
 *  - Caption-uri identice cu titlul
 *  - Caption-uri foarte scurte / generice
 *  - Imagini cross-domain care au scăpat
 *  - Duplicate detectate pe filename
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface MediaItem {
  type: string;
  url: string;
  caption?: string;
}

async function main() {
  const { data } = await sa
    .from("stiri_cache")
    .select("id, url, title, media")
    .order("published_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    url: string;
    title: string;
    media: MediaItem[] | null;
  }>;

  const issues = {
    templatePlaceholders: [] as Array<{ id: string; title: string; bad: string }>,
    smallCdnDims: [] as Array<{ id: string; title: string; bad: string }>,
    captionEqualsTitle: [] as Array<{ id: string; title: string }>,
    duplicateByFilename: [] as Array<{ id: string; title: string; count: number }>,
    crossDomain: [] as Array<{ id: string; title: string; bad: string }>,
    noMedia: [] as Array<{ id: string; title: string }>,
    captionGeneric: [] as Array<{ id: string; title: string; cap: string }>,
  };

  for (const row of rows) {
    if (!row.media || !Array.isArray(row.media) || row.media.length === 0) {
      issues.noMedia.push({ id: row.id, title: row.title });
      continue;
    }

    const articleOrigin = (() => {
      try {
        return new URL(row.url).hostname.replace(/^www\./, "").split(".").slice(-2).join(".");
      } catch {
        return "";
      }
    })();

    const fnSeen = new Map<string, number>();
    for (const m of row.media) {
      // Template placeholders
      if (/%[a-z_]+%|\{\{[^}]+\}\}|\{[a-z_]+\}/i.test(m.url) || (m.caption && /%[a-z_]+%|\{\{[^}]+\}\}|\{[a-z_]+\}/i.test(m.caption))) {
        issues.templatePlaceholders.push({ id: row.id, title: row.title, bad: m.url });
      }
      // Small CDN dimensions (slipped through)
      const cdnSize = m.url.match(/\/(\d{2,4})x(\d{2,4})\//);
      if (cdnSize && parseInt(cdnSize[1] ?? "0", 10) < 400) {
        issues.smallCdnDims.push({ id: row.id, title: row.title, bad: m.url });
      }
      // Caption == title
      if (m.caption && m.caption.trim() === row.title.trim()) {
        issues.captionEqualsTitle.push({ id: row.id, title: row.title });
      }
      // Cross-domain check
      if (articleOrigin) {
        try {
          const imgHost = new URL(m.url).hostname.replace(/^www\./, "");
          const imgRoot = imgHost.split(".").slice(-2).join(".");
          if (imgRoot !== articleOrigin) {
            issues.crossDomain.push({ id: row.id, title: row.title, bad: m.url });
          }
        } catch {}
      }
      // Duplicate by filename (normalize resize)
      const fnMatch = m.url.match(/([a-z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|gif))(?:\?|$)/i);
      if (fnMatch?.[1]) {
        const norm = fnMatch[1]
          .toLowerCase()
          .replace(/-(?:\d{2,4}x\d{2,4}|scaled|cropped|thumb)\.([a-z]+)$/i, ".$1");
        fnSeen.set(norm, (fnSeen.get(norm) ?? 0) + 1);
      }
      // Generic caption
      if (m.caption && /^(?:imagine|foto|persoană|persoane|o persoană)\b/i.test(m.caption)) {
        issues.captionGeneric.push({ id: row.id, title: row.title, cap: m.caption });
      }
    }
    const dupes = [...fnSeen.values()].filter((c) => c > 1).length;
    if (dupes > 0) {
      issues.duplicateByFilename.push({
        id: row.id,
        title: row.title,
        count: dupes,
      });
    }
  }

  console.log(`Total stiri scanned: ${rows.length}\n`);
  console.log(`Template placeholders (%title%, %media%): ${issues.templatePlaceholders.length}`);
  issues.templatePlaceholders.slice(0, 5).forEach((i) => {
    console.log(`  [${i.id.slice(0, 8)}] ${i.title.slice(0, 50)}... → ${i.bad.slice(0, 80)}`);
  });
  console.log(`\nCross-domain images: ${issues.crossDomain.length}`);
  issues.crossDomain.slice(0, 5).forEach((i) => {
    console.log(`  [${i.id.slice(0, 8)}] ${i.title.slice(0, 50)}... → ${i.bad.slice(0, 80)}`);
  });
  console.log(`\nSmall CDN dims: ${issues.smallCdnDims.length}`);
  issues.smallCdnDims.slice(0, 3).forEach((i) => {
    console.log(`  ${i.bad.slice(0, 80)}`);
  });
  console.log(`\nCaption == title: ${issues.captionEqualsTitle.length}`);
  console.log(`Duplicate by filename: ${issues.duplicateByFilename.length}`);
  console.log(`Generic captions: ${issues.captionGeneric.length}`);
  console.log(`Stiri fără media (carousel hidden): ${issues.noMedia.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
