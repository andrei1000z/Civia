import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getGroqClient, GROQ_MODEL } from "@/lib/groq/client";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * GET /api/sesizari/pattern-detection — cron AI care detectează systemic
 * issues: clustere de sesizări similare pe aceeași zonă, aceeași cauză.
 *
 * Inspirat SeeClickFix + CivicPlus clustering. Ex: „15 sesizări stâlpișori
 * Sector 5 pe 3 străzi paralele = systemic issue → email primar".
 *
 * Output: rânduri în sesizari_pattern_clusters + Sentry warning ca admin
 * să fie alertat.
 *
 * Cron weekly. Folosim Groq llama-3.3-70b pentru clustering (poate detecta
 * pattern semantic, nu doar geographic).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Doar luni (sau forced). Cron rulează zilnic dar handlerul scapă restul.
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  if (new Date().getUTCDay() !== 1 && !force) {
    return NextResponse.json({ ok: true, skipped: "not_monday" });
  }

  const admin = createSupabaseAdmin();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const { data: sesizari } = await admin
    .from("sesizari")
    .select("code, tip, county, sector, locatie, titlu, descriere, created_at")
    .eq("moderation_status", "approved")
    .gte("created_at", monthAgo)
    .limit(500);

  if (!sesizari || sesizari.length < 5) {
    return NextResponse.json({ ok: true, skipped: "insufficient_data", count: sesizari?.length ?? 0 });
  }

  // Grupare quick pe (tip, county, sector). Doar buckets cu >= 5 sesizări
  // ar fi candidate pentru cluster systemic.
  type Row = {
    code: string; tip: string; county: string | null; sector: string | null;
    locatie: string; titlu: string; descriere: string;
  };
  const buckets = new Map<string, Row[]>();
  for (const s of (sesizari as Row[])) {
    const key = `${s.tip}|${s.county ?? "??"}|${s.sector ?? "??"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }

  const candidates = [...buckets.entries()]
    .filter(([, rows]) => rows.length >= 5)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_clusters_above_threshold" });
  }

  // Pentru fiecare cluster candidate, cer Groq să confirme că-i un pattern
  // systemic (vs sesizări izolate care întâmplător au același tip+sector).
  const created: string[] = [];
  const groq = getGroqClient();

  for (const [key, rows] of candidates) {
    const [tip, county, sector] = key.split("|");
    // Skip dacă deja există un cluster în ultimele 30 zile pentru same key
    const { data: existing } = await admin
      .from("sesizari_pattern_clusters")
      .select("id")
      .eq("tip", tip!)
      .eq("county", county!)
      .eq("sector", sector!)
      .gte("detected_at", monthAgo)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    const sample = rows.slice(0, 15).map((r) => `[${r.code}] ${r.titlu} @ ${r.locatie}`).join("\n");
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "Ești analist civic. Primești o listă de sesizări depuse de cetățeni într-o zonă. Determini dacă reprezintă un pattern systemic (probleme repetate cu aceeași cauză rădăcină) sau sesizări izolate. Răspunzi în JSON.",
          },
          {
            role: "user",
            content: `Sesizări tip ${tip}, ${county ?? "(județ necunoscut)"} ${sector ?? "(sector necunoscut)"}:\n\n${sample}\n\nRăspunde JSON cu cheile:\n- "is_systemic": boolean\n- "summary": string (1-2 propoziții, ce-i comun la aceste sesizări)\n- "root_cause": string (cauza probabilă)\n- "recommendation": string (ce ar trebui să facă primăria)`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const text = completion.choices[0]?.message.content ?? "";
      const parsed = JSON.parse(text) as { is_systemic?: boolean; summary?: string; root_cause?: string; recommendation?: string };
      if (!parsed.is_systemic) continue;

      const codes = rows.map((r) => r.code);
      const label = `${tip} • ${county} ${sector ?? ""}`.trim();
      const summary = [parsed.summary, parsed.root_cause, parsed.recommendation].filter(Boolean).join("\n\n");

      const { data: row } = await admin
        .from("sesizari_pattern_clusters")
        .insert({
          cluster_label: label,
          county,
          sector,
          tip,
          sesizare_codes: codes,
          cluster_summary: summary,
        })
        .select("id")
        .maybeSingle();

      if (row?.id) {
        created.push(label);
        Sentry.captureMessage(`Systemic issue detected: ${label}`, {
          level: "warning",
          tags: { kind: "systemic_issue", county: county ?? "?", tip: tip ?? "?" },
          extra: { codes, summary },
        });
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { kind: "pattern_detection_fail" } });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates_checked: candidates.length,
    clusters_created: created.length,
    clusters: created,
  });
}
