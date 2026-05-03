import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { ALL_COUNTIES } from "@/data/counties";

// Hourly ISR — feed readers poll once per hour typically; faster
// invalidation isn't needed and keeps origin cost low.
export const revalidate = 3600;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function countyLabel(slug: string | null): string | null {
  if (!slug) return null;
  return ALL_COUNTIES.find((c) => c.slug === slug)?.name ?? null;
}

export async function GET(req: Request) {
  // Rate-limit just like /feed.xml — protect Supabase from misconfigured
  // pollers hitting us in a tight loop.
  const rl = await rateLimitAsync(`feed-proteste:${getClientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const now = new Date().toUTCString();

  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("proteste")
      .select(
        "slug, title, subtitle, cause, location_name, city, county_slug, start_at, end_at, status, organizer, hashtag, created_at",
      )
      .eq("visibility", "publica")
      .eq("moderation_status", "approved")
      .order("start_at", { ascending: false })
      .limit(50);

    const rows = (data ?? []) as Array<{
      slug: string;
      title: string;
      subtitle: string | null;
      cause: string | null;
      location_name: string;
      city: string | null;
      county_slug: string | null;
      start_at: string;
      end_at: string | null;
      status: string;
      organizer: string | null;
      hashtag: string | null;
      created_at: string;
    }>;

    const items = rows
      .map((r) => {
        const county = countyLabel(r.county_slug);
        const locationFull = [r.location_name, r.city, county].filter(Boolean).join(", ");
        const startStr = new Date(r.start_at).toLocaleString("ro-RO", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Bucharest",
        });
        const desc = [
          r.subtitle ?? r.cause ?? r.title,
          `📍 ${locationFull}`,
          `🗓️ ${startStr}`,
          r.organizer ? `👥 Organizator: ${r.organizer}` : null,
          r.hashtag ? r.hashtag : null,
          `Status: ${r.status}`,
        ]
          .filter(Boolean)
          .join(" — ");
        return `    <item>
      <title>${escapeXml(r.title)}</title>
      <link>${SITE_URL}/proteste/${r.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/proteste/${r.slug}</guid>
      <pubDate>${new Date(r.created_at).toUTCString()}</pubDate>
      ${county ? `<category>${escapeXml(county)}</category>` : ""}
      <description>${escapeXml(desc)}</description>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Proteste programate</title>
    <link>${SITE_URL}/proteste</link>
    <description>Calendar civic cu protestele, mitingurile și marșurile anunțate în România.</description>
    <language>ro-RO</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/proteste/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch {
    // Empty-valid feed pe eroare — ca readers să nu marcheze feed-ul ca rupt
    // și să continue să poll-uiască. Same pattern as /feed.xml.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Proteste programate</title>
    <link>${SITE_URL}/proteste</link>
    <description>Calendar civic cu protestele anunțate în România.</description>
    <language>ro-RO</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/proteste/feed.xml" rel="self" type="application/rss+xml" />
  </channel>
</rss>`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }
}
