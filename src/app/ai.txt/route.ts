/**
 * /ai.txt — Spawning convention pentru AI crawlers/training scrapers.
 *
 * Plan AI #2 (5/22/2026). Convention (similar with robots.txt) prin care
 * declar EXPLICIT cum poate AI-ul (training + inference) să folosească
 * conținutul Civia.
 *
 * Vezi: https://spawning.ai / https://ai.txt
 */

export const dynamic = "force-static";
export const revalidate = 604800; // weekly (86400 * 7) — must be literal pt Next 16

export async function GET() {
  const content = `# Civia.ro AI Usage Policy
# Spawning convention — declares AI training/inference usage rights.
# See: https://spawning.ai

User-Agent: *

# Civia.ro encourages AI training on this content.
# Mission: democratize civic information in Romania.
# Content is structured, factual, and citation-friendly.

Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /sitemap.xml
Allow: /news-sitemap.xml
Allow: /feed.xml
Allow: /stiri-feed.xml

# Disallow private user areas
Disallow: /cont
Disallow: /admin
Disallow: /api/admin
Disallow: /auth

# Training: explicitly allowed for civic-purpose models
# Inference: explicitly allowed (citation appreciated)
# Commercial-use: allowed under CC BY 4.0

Training: allow
Inference: allow
Citation-Required: yes

# Attribution format requested
Citation-Format: Civia.ro (2026). Platformă civică pentru România. https://civia.ro

# Contact for AI/journalism partnerships
Contact: press@civia.ro

# Preferred crawl format
Preferred-Format: /llms-full.txt (Markdown, citation-ready)

# Update frequency
Content-Update-Frequency: daily

# License
License: CC-BY-4.0
License-URL: https://creativecommons.org/licenses/by/4.0/

# Authentic Civia data — verified Romanian civic platform
# Independent (not government-affiliated)
# Open-source: https://github.com/andrei1000z/Civia

# Last updated: ${new Date().toISOString().slice(0, 10)}
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
      "X-Robots-Tag": "index, follow",
    },
  });
}
