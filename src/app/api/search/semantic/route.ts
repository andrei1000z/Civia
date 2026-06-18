/**
 * GET /api/search/semantic?q=...&type=sesizari|petitii&limit=10
 *
 * 🎁 MEDIUM #1 — Search semantic AI cu pgvector.
 *
 * Pipeline:
 *  1. Embed query cu Groq embeddings (sau Cloudflare AI fallback)
 *  2. Cosine similarity search in tabel (sesizari/petitii)
 *  3. Returneaza top N matches cu similarity score
 *
 * Cu fallback la ILIKE keyword search dacă pgvector nu disponibil (graceful).
 *
 * Rate limit: 20/min/IP (search e relativ scump).
 */

import { NextResponse } from "next/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

interface SearchResult {
  id: string;
  code?: string;
  slug?: string;
  titlu: string;
  excerpt?: string;
  similarity?: number;
  type: "sesizare" | "petitie";
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`search:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe căutări" }, { status: 429 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "sesizari") as "sesizari" | "petitii";
  const limit = Math.max(1, Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

  if (q.length < 3) {
    return NextResponse.json({ results: [], note: "Query prea scurt (min 3 chars)" });
  }

  const admin = createSupabaseAdmin();

  // Try semantic search first (pgvector + Groq embedding)
  try {
    const embedding = await generateEmbedding(q);
    if (embedding && type === "sesizari") {
      const { data } = await admin.rpc("similar_sesizari", {
        query_embedding: embedding,
        match_threshold: 0.65,
        match_count: limit,
      });
      const results = (data ?? []) as Array<{
        id: string;
        code: string;
        titlu: string;
        similarity: number;
      }>;
      if (results.length > 0) {
        return NextResponse.json({
          mode: "semantic",
          results: results.map((r) => ({ ...r, type: "sesizare" as const })),
        });
      }
    }
  } catch {
    // fallback la keyword search
  }

  // Fallback: ILIKE keyword search
  const sqlPattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  if (type === "sesizari") {
    const { data } = await admin
      .from("sesizari_feed")
      .select("id, code, titlu, descriere")
      .or(`titlu.ilike.${sqlPattern},descriere.ilike.${sqlPattern}`)
      .eq("publica", true)
      .eq("moderation_status", "approved")
      .limit(limit);
    return NextResponse.json({
      mode: "keyword",
      results: (data ?? []).map((r) => ({
        id: r.id,
        code: r.code,
        titlu: r.titlu,
        excerpt: (r.descriere as string)?.slice(0, 150),
        type: "sesizare" as const,
      })),
    });
  }

  if (type === "petitii") {
    const { data } = await admin
      .from("petitii")
      .select("id, slug, title, summary")
      .or(`title.ilike.${sqlPattern},summary.ilike.${sqlPattern}`)
      .limit(limit);
    return NextResponse.json({
      mode: "keyword",
      results: (data ?? []).map((r) => ({
        id: r.id,
        slug: r.slug,
        titlu: r.title,
        excerpt: r.summary,
        type: "petitie" as const,
      })),
    });
  }

  return NextResponse.json({ results: [] });
}

/**
 * Generate embedding 384-dim via Cloudflare Workers AI (free tier).
 * Foloseste @cf/baai/bge-small-en-v1.5 sau alternative.
 *
 * Returneaza null la failure → caller fallback la keyword search.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_AI_TOKEN;
  if (!cfAccountId || !cfToken) return null;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/baai/bge-small-en-v1.5`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.slice(0, 500) }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { data?: number[][] } };
    return data.result?.data?.[0] ?? null;
  } catch {
    return null;
  }
}
