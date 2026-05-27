import { NextResponse } from "next/server";
import { analyticsRedis } from "@/lib/analytics/redis";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

interface FeedbackEntry {
  t: number;
  kind: "bug" | "idea" | "question" | "other";
  message: string;
  email: string | null;
  userId: string | null;
  ip: string | null;
  country: string | null;
  pathname: string | null;
}

/**
 * Admin-only: returnează mesajele de feedback persistate în Redis
 * (`civia:feedback:messages`). Sursa diferă de `feedback_submissions`
 * (SQL, scrise de /api/feedback/submit) — Redis ține mesajele scrise
 * via `/api/feedback` (FeedbackBox, ProposePetitieForm, etc.).
 *
 * Query params:
 *   - kind: filtru pe kind (bug/idea/question/other)
 *   - prefix: include doar mesaje al căror text începe cu acest prefix
 *     (e.g. "[Petiție propusă]" pentru tab-ul Petiții → Propuneri cetățeni)
 *   - limit: 1–500, default 50
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!analyticsRedis) {
    return NextResponse.json({ data: [] });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const prefix = searchParams.get("prefix");
  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Math.max(1, Math.min(500, isFinite(limitRaw) ? limitRaw : 50));

  // Citim ultimele `limit` mesaje. Trimite redis o singură rundă chiar
  // dacă filtrăm după kind/prefix — lista e capped la 500 oricum, deci
  // overhead-ul de transfer e minimal.
  // 2026-05-27 — defensive try/catch. Upstash outage → empty list în loc
  // de 500 spre admin dashboard.
  let raw: unknown[] = [];
  try {
    raw = await analyticsRedis.lrange("civia:feedback:messages", 0, limit - 1);
  } catch {
    return NextResponse.json({ data: [], redis: "degraded" });
  }
  const parsed: FeedbackEntry[] = [];
  for (const s of raw) {
    try {
      const entry = typeof s === "string" ? (JSON.parse(s) as FeedbackEntry) : (s as FeedbackEntry);
      if (kind && entry.kind !== kind) continue;
      if (prefix && !entry.message?.startsWith(prefix)) continue;
      parsed.push(entry);
    } catch {
      // skip malformed entries
    }
  }
  return NextResponse.json({ data: parsed });
}
