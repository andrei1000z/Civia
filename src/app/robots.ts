import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  // Block indexing for preview / non-production environments
  if (process.env.NODE_ENV !== "production") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  // Private-by-default paths — blocked for EVERY crawler, including AI.
  const PRIVATE = [
    "/api/",
    "/auth",
    "/auth/",
    "/cont",
    "/cont/",
    "/admin",
    "/admin/",
    // Embed widget pages — sunt pentru iframe externe, nu pentru SEO
    // (ar dupica conținutul cu paginile principale).
    "/embed/",
  ];

  return {
    rules: [
      // Default policy — search engines + everything else can read the
      // public site, but nothing under /api/, /auth, /cont, /admin.
      { userAgent: "*", allow: "/", disallow: PRIVATE },

      // Explicitly allow major search crawlers (redundant but reassures
      // Googlebot / Bingbot when some hosting provider wildcards block).
      { userAgent: "Googlebot", allow: "/", disallow: PRIVATE },
      { userAgent: "Bingbot", allow: "/", disallow: PRIVATE },
      { userAgent: "DuckDuckBot", allow: "/", disallow: PRIVATE },

      // AI crawlers — allow them to index public civic content so the
      // site shows up in answers about Romanian transparency / local
      // government. Block the same private paths. If you later want to
      // opt out of AI training, flip these to `disallow: "/"`.
      { userAgent: "GPTBot", allow: "/", disallow: PRIVATE },
      { userAgent: "ClaudeBot", allow: "/", disallow: PRIVATE },
      { userAgent: "anthropic-ai", allow: "/", disallow: PRIVATE },
      { userAgent: "PerplexityBot", allow: "/", disallow: PRIVATE },
      { userAgent: "Google-Extended", allow: "/", disallow: PRIVATE },
      { userAgent: "CCBot", allow: "/", disallow: PRIVATE },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      // Google News sitemap — separate file scoped to articles from
      // the last 48h per Google's spec. Listed in robots so Googlebot-
      // News + Search Console pick it up automatically; Publisher
      // Center can also be pointed at this URL directly.
      `${SITE_URL}/news-sitemap.xml`,
    ],
    host: SITE_URL,
  };
}
