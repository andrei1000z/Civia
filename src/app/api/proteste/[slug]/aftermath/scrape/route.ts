import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  AFTERMATH_SYSTEM_PROMPT,
  sanitizeAiResponse,
  scrapeMultiple,
} from "@/lib/proteste/aftermath";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
} from "@/lib/ai/gemini";
import { getGroqClient, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Trebuie să fii autentificat." };
  const { data: profile } = await supa
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false as const, status: 403, error: "Doar administratorii pot folosi această funcție." };
  }
  return { ok: true as const };
}

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

  // Admin-only — feature mutat din public în admin pentru a evita spam +
  // moderare manuală. Admin-ul publică direct ce trimite, fără queue.
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  // 3. AI call chain — Gemini Flash cu fallback la Groq.
  // SKIP gemma-3-27b-it: nu suportă „developer instructions" prin compat
  // layer (returnează 400 când messages include role:"system").
  const messages = [
    { role: "system" as const, content: AFTERMATH_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];

  type Candidate = { provider: string; model: string; run: () => Promise<string> };
  const candidates: Candidate[] = [
    {
      provider: "gemini",
      model: GEMINI_MODEL,
      run: async () => (await callGemini({ messages, model: GEMINI_MODEL, temperature: 0.4, max_tokens: 2500, response_format: { type: "json_object" } })) ?? "",
    },
    {
      provider: "gemini",
      model: "gemini-flash-latest",
      run: async () => (await callGemini({ messages, model: "gemini-flash-latest", temperature: 0.4, max_tokens: 2500, response_format: { type: "json_object" } })) ?? "",
    },
  ];

  // Adaugă Groq ca ultim fallback (independent quota).
  if (process.env.GROQ_API_KEY) {
    const groq = getGroqClient();
    const groqRun = (model: string) => async () => {
      const c = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      });
      return c.choices[0]?.message?.content?.trim() ?? "";
    };
    candidates.push(
      { provider: "groq", model: GROQ_MODEL, run: groqRun(GROQ_MODEL) },
      { provider: "groq", model: GROQ_MODEL_FAST, run: groqRun(GROQ_MODEL_FAST) },
    );
  }

  let raw: string | null = null;
  let lastErr: unknown = null;
  let lastModelTried = "n/a";
  for (const cand of candidates) {
    try {
      const out = await cand.run();
      if (out && out.length > 20) {
        raw = out;
        break;
      }
    } catch (e) {
      lastErr = e;
      lastModelTried = `${cand.provider}/${cand.model}`;
      const status = (e as { status?: number }).status;
      // 401/403 = key issue — bail on whole provider chain
      if (status === 401 || status === 403) {
        // skip remaining of same provider
        continue;
      }
    }
  }

  if (!raw) {
    const errMsg = lastErr instanceof Error ? lastErr.message : "AI nu a răspuns.";
    return NextResponse.json(
      { error: `AI eșec (ultimul model: ${lastModelTried}). ${errMsg}` },
      { status: 502 },
    );
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
