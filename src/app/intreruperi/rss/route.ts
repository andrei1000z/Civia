import {
  getActiveInterruptions,
  TYPE_ICONS,
  TYPE_LABELS,
} from "@/data/intreruperi";
import { SITE_URL } from "@/lib/constants";

// 2026-05-19: 30min → 4h. RSS readers poll-uiesc 1x/h cel mult.
export const revalidate = 14400;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET() {
  const items = await getActiveInterruptions();
  const now = new Date().toUTCString();

  const body = items
    .map((i) => {
      const title = `${TYPE_ICONS[i.type]} ${TYPE_LABELS[i.type]} — ${i.addresses[0] ?? i.reason}`;
      const url = `${SITE_URL}/intreruperi/${i.id}`;
      const pubDate = new Date(i.startAt).toUTCString();
      const category = TYPE_LABELS[i.type];
      const description = [
        i.excerpt ?? i.reason,
        "",
        `Provider: ${i.provider}`,
        `Interval: ${new Date(i.startAt).toLocaleString("ro-RO")} — ${new Date(i.endAt).toLocaleString("ro-RO")}`,
        `Adrese: ${i.addresses.join("; ")}`,
      ].join("\n");
      return `    <item>
      <title>${esc(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${esc(category)}</category>
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Întreruperi programate — Civia</title>
    <link>${SITE_URL}/intreruperi</link>
    <atom:link href="${SITE_URL}/intreruperi/rss" rel="self" type="application/rss+xml" />
    <description>Apă, caldură, gaz, curent + lucrări de stradă. Agregat din surse oficiale.</description>
    <language>ro-RO</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>30</ttl>
${body}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
