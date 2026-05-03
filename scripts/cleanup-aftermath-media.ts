/**
 * Curăță aftermath_images / aftermath_videos pentru proteste cu URL-uri
 * sparte în DB. Rulez o singură dată după ce am introdus filterValidMedia
 * în pipeline — recordurile existente pre-validare au „Foto 4", „Foto 5"
 * pe pagina publică pentru că poza nu mai există / hotlink-protect.
 *
 * Usage: npx tsx scripts/cleanup-aftermath-media.ts
 *
 * Idempotent: run-uri repetate nu strică nimic, doar re-validează.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { filterValidMedia } from "../src/lib/proteste/aftermath";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supa = createClient(url, key);

  const { data, error } = await supa
    .from("proteste")
    .select("id, slug, title, aftermath_images, aftermath_videos")
    .eq("aftermath_moderation_status", "approved");

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("Niciun aftermath approved în DB. Nimic de făcut.");
    return;
  }

  console.log(`Verific ${data.length} proteste cu aftermath approved...\n`);

  let totalImagesRemoved = 0;
  let totalVideosRemoved = 0;
  let recordsUpdated = 0;

  for (const row of data) {
    const r = row as {
      id: string;
      slug: string;
      title: string;
      aftermath_images: { url: string; credit?: string; caption?: string }[] | null;
      aftermath_videos: { url: string; title?: string; source?: string }[] | null;
    };
    const images = r.aftermath_images ?? [];
    const videos = r.aftermath_videos ?? [];
    if (images.length === 0 && videos.length === 0) continue;

    const t0 = Date.now();
    const { images: validImages, videos: validVideos } = await filterValidMedia(
      images,
      videos,
    );
    const ms = Date.now() - t0;

    const removedI = images.length - validImages.length;
    const removedV = videos.length - validVideos.length;

    if (removedI === 0 && removedV === 0) {
      console.log(`✓ ${r.slug} — toate ok (${images.length} poze, ${videos.length} video, ${ms}ms)`);
      continue;
    }

    console.log(
      `⚠ ${r.slug} — ${removedI}/${images.length} poze sparte, ${removedV}/${videos.length} video sparte (${ms}ms)`,
    );

    const { error: upErr } = await supa
      .from("proteste")
      .update({
        aftermath_images: validImages,
        aftermath_videos: validVideos,
      })
      .eq("id", r.id);

    if (upErr) {
      console.error(`  ✗ update failed: ${upErr.message}`);
      continue;
    }
    totalImagesRemoved += removedI;
    totalVideosRemoved += removedV;
    recordsUpdated++;
  }

  console.log(
    `\n✅ Cleanup terminat: ${recordsUpdated} record-uri actualizate, ` +
      `${totalImagesRemoved} poze sparte șterse, ${totalVideosRemoved} video sparte șterse.`,
  );
}

main().catch((e) => {
  console.error("Eroare neașteptată:", e);
  process.exit(1);
});
