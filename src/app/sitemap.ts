import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";
import { ghiduri } from "@/data/ghiduri";
import { evenimente } from "@/data/evenimente";
import { getAllInterruptions } from "@/data/intreruperi";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// 2026-05-19: 1h → 12h. Sitemap-ul are MII de URL-uri (42 judete × ~10 rute
// + 200+ sesizari + 50 outages + 100+ stiri). Regenerarea era cel mai mare
// outage de bandwidth (sitemap.xml era >2MB). Google crawl-uieste o data/zi
// oricum, 12h e mai mult decat suficient.
export const revalidate = 43200;

// Toate sub-page-urile per județ. Trebuie să rămână sincronizat cu
// `src/app/[judet]/<slug>/page.tsx`. La adăugarea unui nou sub-page,
// adaugă slug-ul aici (altfel Google nu-l indexează automat).
const COUNTY_PAGES = [
  "", "/sesizari", "/stiri", "/ghiduri",
  "/autoritati", "/evenimente", "/istoric",
  // 2026-05-19: /intreruperi mutat la /intreruperi/[county-slug]
  // (vezi countyIntreruperiRoutes mai jos). Vechiul /{slug}/intreruperi
  // 308-redirecteaza, deci scos din sitemap ca sa nu indexam redirect-uri.
  // Sub-pages pentru date publice — au fost adăugate ca pagini per-județ
  // în refactor-ul național dar lipseau din sitemap.
  // 2026-05-19: scoase /educatie /sanatate /siguranta — pagini ghost, sterse.
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base = SITE_URL;

  // Static global pages
  const globalRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/judete`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    // Action surfaces — main page-uri user-facing.
    { url: `${base}/sesizari`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/petitii`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/petitii/initiaza`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/petitii/propune`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // High-traffic sesizare views that were missing from the sitemap.
    // /sesizari-publice and /sesizari-rezolvate are the two main
    // discovery surfaces after the form itself; /urmareste is the
    // code-lookup page that users search for by name.
    { url: `${base}/sesizari-publice`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/sesizari-rezolvate`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/urmareste`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/legal/confidentialitate`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/termeni`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // 2026-05-19: scoase /siguranta /educatie /sanatate.
    { url: `${base}/clasament-primarii`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${base}/autoritati`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/intreruperi`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/proteste`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/embed`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    // Pagini noi din sprint-ul recent (2026-05): clasament, dezvoltatori,
    // alegeri, stickers. Toate sunt national-only (NU per-judet).
    { url: `${base}/clasament`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/dezvoltatori`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/alegeri`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/stickers`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Per-county pages: 42 counties × 8 pages = 336 URLs
  const countyRoutes: MetadataRoute.Sitemap = ALL_COUNTIES.flatMap((c) =>
    COUNTY_PAGES.map((page) => ({
      url: `${base}/${c.slug}${page}`,
      lastModified: now,
      changeFrequency: (page === "" ? "daily" : "weekly") as "daily" | "weekly",
      priority: page === "" ? 0.9 : 0.7,
    }))
  );

  // Legacy pages that still exist
  const legacyRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/sesizari`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/stiri`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/ghiduri`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/evenimente`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  // Ghiduri
  const ghiduriRoutes: MetadataRoute.Sitemap = ghiduri.map((g) => ({
    url: `${base}/ghiduri/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Evenimente
  const evenimenteRoutes: MetadataRoute.Sitemap = evenimente.map((e) => ({
    url: `${base}/evenimente/${e.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Intreruperi detail pages — toate entry-urile (seed + scrape-uite)
  const allIntreruperi = await getAllInterruptions();
  const intreruperiRoutes: MetadataRoute.Sitemap = allIntreruperi.map((i) => ({
    url: `${base}/intreruperi/${i.id}`,
    lastModified: new Date(i.endAt) > now ? now : new Date(i.endAt),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  // Intreruperi per-county pages — /intreruperi/[county-slug]. 42 routes.
  const countyIntreruperiRoutes: MetadataRoute.Sitemap = ALL_COUNTIES.map((c) => ({
    url: `${base}/intreruperi/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.65,
  }));

  // Dynamic sesizari + stiri + proteste (all pulled in parallel)
  let sesizariRoutes: MetadataRoute.Sitemap = [];
  let stiriRoutes: MetadataRoute.Sitemap = [];
  let protesteRoutes: MetadataRoute.Sitemap = [];
  try {
    const admin = createSupabaseAdmin();
    const [sesResp, stiriResp, protesteResp] = await Promise.all([
      admin
        .from("sesizari")
        .select("code, updated_at")
        .eq("publica", true)
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("stiri_cache")
        .select("id, published_at, fetched_at")
        .order("published_at", { ascending: false })
        .limit(200),
      admin
        .from("proteste")
        .select("slug, updated_at, start_at")
        .eq("visibility", "publica")
        .order("start_at", { ascending: false })
        .limit(200),
    ]);
    if (sesResp.data) {
      sesizariRoutes = (sesResp.data as { code: string; updated_at: string }[])
        .filter((s) => s.updated_at && !isNaN(new Date(s.updated_at).getTime()))
        .map((s) => ({
          url: `${base}/sesizari/${s.code}`,
          lastModified: new Date(s.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.5,
        }));
    }
    if (stiriResp.data) {
      stiriRoutes = (stiriResp.data as { id: string; published_at: string; fetched_at: string }[])
        .map((s) => {
          const dt = s.published_at ?? s.fetched_at;
          const parsed = dt ? new Date(dt) : now;
          return {
            url: `${base}/stiri/${s.id}`,
            lastModified: isNaN(parsed.getTime()) ? now : parsed,
            changeFrequency: "monthly" as const,
            priority: 0.4,
          };
        });
    }
    if (protesteResp.data) {
      protesteRoutes = (protesteResp.data as { slug: string; updated_at: string; start_at: string }[])
        .map((p) => ({
          url: `${base}/proteste/${p.slug}`,
          lastModified: new Date(p.updated_at ?? p.start_at),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }));
    }
  } catch {}

  return [
    ...globalRoutes,
    ...countyRoutes,
    ...legacyRoutes,
    ...ghiduriRoutes,
    ...evenimenteRoutes,
    ...intreruperiRoutes,
    ...countyIntreruperiRoutes,
    ...sesizariRoutes,
    ...stiriRoutes,
    ...protesteRoutes,
  ];
}
