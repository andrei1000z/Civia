import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  AFTERMATH_SYSTEM_PROMPT,
  sanitizeAiResponse,
  scrapeMultiple,
} from "@/lib/proteste/aftermath";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
  GEMINI_MODEL_BACKUPS,
} from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const inputSchema = z.object({
  // 1-10 link-uri către articole de presă scrise după protest.
  source_urls: z
    .array(z.string().url().max(2000))
    .min(1, "Adaugă cel puțin un link.")
    .max(10, "Maxim 10 link-uri."),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(req);

  // Rate limit agresiv — scrape-ul e scump (10 fetch-uri externe + 1 AI call).
  // 3 încercări / 10 min / IP e suficient pentru un user real.
  const rl = await rateLimitAsync(`proteste-aftermath-scrape:${ip}`, {
    limit: 3,
    windowMs: 10 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe încercări. Încearcă din nou peste câteva minute." },
      { status: 429 },
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "AI nu e configurat momentan. Completează manual câmpurile." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid (nu JSON)." }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide." },
      { status: 400 },
    );
  }

  // Verifică că protestul există + e public + s-a desfășurat (start_at în trecut).
  const admin = createSupabaseAdmin();
  const { data: protest } = await admin
    .from("proteste")
    .select("id, title, start_at, visibility, moderation_status")
    .eq("slug", slug)
    .maybeSingle();

  if (!protest) {
    return NextResponse.json({ error: "Protest inexistent." }, { status: 404 });
  }
  const p = protest as {
    id: string;
    title: string;
    start_at: string;
    visibility: string;
    moderation_status: string;
  };
  if (p.visibility !== "publica" || p.moderation_status !== "approved") {
    return NextResponse.json({ error: "Protestul nu e public." }, { status: 403 });
  }
  // Permitem scrape doar pentru proteste care s-au întâmplat deja.
  if (new Date(p.start_at).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "Protestul nu a avut loc încă. Aftermath se poate adăuga doar după." },
      { status: 400 },
    );
  }

  // 1. Scrape URL-urile în paralel.
  const scraped = await scrapeMultiple(parsed.data.source_urls);
  const okScraped = scraped.filter((s) => s.ok && s.body && s.body.length > 200);
  if (okScraped.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nu am putut citi conținutul niciunui link. Verifică că URL-urile sunt accesibile public.",
        scraped,
      },
      { status: 422 },
    );
  }

  // 2. Construiește prompt-ul user pentru AI.
  const protestDate = new Date(p.start_at).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
  const articles = okScraped
    .map((s, i) => {
      const head = `## Articol ${i + 1}\nURL: ${s.url}\nTitlu: ${s.title ?? "(n/a)"}\nPublicație: ${s.publication ?? "(n/a)"}\n\n`;
      // Trim body — AI context budget. 2000 chars per article × 10 = 20k.
      const body = (s.body ?? "").slice(0, 2500);
      return head + body;
    })
    .join("\n\n---\n\n");

  const userPrompt = `PROTESTUL: "${p.title}"\nDATA: ${protestDate}\n\nARTICOLELE DE PRESĂ:\n\n${articles}\n\nReturnează DOAR JSON conform schemei.`;

  // 3. Chemă Gemini, cu fallback la modele backup.
  const models = [GEMINI_MODEL, ...GEMINI_MODEL_BACKUPS];
  let raw: string | null = null;
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      raw = await callGemini({
        messages: [
          { role: "system", content: AFTERMATH_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        model,
        temperature: 0.4,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      });
      if (raw) break;
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status === 401 || status === 403) break;
    }
  }

  if (!raw) {
    const msg = lastErr instanceof Error ? lastErr.message : "AI nu a răspuns.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "AI a returnat răspuns invalid (nu JSON)." },
      { status: 502 },
    );
  }

  const aftermath = sanitizeAiResponse(parsedJson, scraped);

  return NextResponse.json({
    data: aftermath,
    scraped_summary: {
      total: scraped.length,
      ok: okScraped.length,
      failed: scraped.length - okScraped.length,
    },
  });
}
