import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  AFTERMATH_SYSTEM_PROMPT,
  sanitizeAiResponse,
  scrapeMultiple,
  filterValidMedia,
} from "@/lib/proteste/aftermath";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
  GEMINI_MODEL_FAST,
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

const inputSchema = z
  .object({
    // 0-10 link-uri către articole de presă scrise după protest.
    // Acceptăm 0 pentru cazul când admin furnizează DOAR observații proprii
    // (vezi `notes` mai jos) — AI-ul sintetizează direct din text.
    source_urls: z.array(z.string().url().max(2000)).max(10).default([]),
    // Observații libere ale admin-ului — AI le folosește ca context
    // adițional la articolele scrape-uite (sau ca singură sursă dacă nu
    // există URL-uri).
    notes: z.string().trim().max(8000).optional(),
  })
  .refine(
    (d) => (d.source_urls && d.source_urls.length > 0) || (d.notes && d.notes.length >= 30),
    {
      message: "Adaugă fie link-uri, fie observații proprii (min. 30 caractere).",
    },
  );

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

  // 1. Scrape URL-urile în paralel (dacă există).
  const scraped =
    parsed.data.source_urls.length > 0
      ? await scrapeMultiple(parsed.data.source_urls)
      : [];
  // Acceptăm orice articol cu body >= 100 chars.
  const okScraped = scraped.filter((s) => s.ok && s.body && s.body.length >= 100);
  const adminNotes = (parsed.data.notes ?? "").trim();

  // Trebuie să avem măcar SOMETHING — fie articole scrape-uite cu succes,
  // fie observații substanțiale ale admin-ului. Schema garantează că
  // input-ul nu e gol, dar scrape-ul poate eșua complet pe URL-uri.
  if (okScraped.length === 0 && adminNotes.length < 30) {
    return NextResponse.json(
      {
        error:
          "Nu am putut citi conținutul niciunui link. Adaugă observații proprii sau verifică URL-urile.",
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
      const body = (s.body ?? "").slice(0, 2200);
      return head + body;
    })
    .join("\n\n---\n\n");

  // Prompt-ul include OBSERVAȚIILE ADMIN ca sursă PRIMARĂ când există
  // (admin-ul a fost prezent la protest sau are info first-hand).
  // Articolele de presă completează contextul. Dacă lipsesc URL-uri,
  // promptul folosește doar observațiile.
  const sections: string[] = [`PROTESTUL: "${p.title}"`, `DATA: ${protestDate}`];
  if (adminNotes) {
    sections.push(
      "OBSERVAȚII ADMINISTRATOR (sursă PRIMARĂ — admin-ul a fost prezent sau are info first-hand; tratează cu prioritate):",
      adminNotes.slice(0, 6000),
    );
  }
  if (articles) {
    sections.push("ARTICOLELE DE PRESĂ:", articles);
  }
  sections.push("Returnează DOAR JSON conform schemei.");
  const userPrompt = sections.join("\n\n");

  // 3. AI call chain — 7 candidați, fiecare cu quota separată.
  // Verificat empiric 5/3/2026 după ce user-ul a raportat „toate cotele
  // epuizate": Gemini Flash variants (4) returnează 429 pe payload-uri
  // de 5k+ tokens, dar gemma-3-27b-it și Groq aveau quota disponibilă
  // în același moment.
  //
  // gemma-3-27b-it: NU acceptă role:"system" (compat layer returnează
  // 400) și NU suportă response_format=json_object. Workaround:
  // flatten system+user într-un single user message + strip markdown
  // code fences din output (gemma wrappuiește uneori JSON în
  // ```json...```). Pus PRIMUL în chain — cel mai stabil sub load.
  //
  // Groq: TPD 500k/zi, quota separată complet de Google. Last resort.
  const messages = [
    { role: "system" as const, content: AFTERMATH_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];
  const flatPrompt = `${AFTERMATH_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;
  const max_tokens = 1800; // narativ ~3-6 paragrafe + restul câmpurilor încap

  type Candidate = { provider: string; model: string; run: () => Promise<string> };
  const geminiRun = (model: string) => async () =>
    (await callGemini({ messages, model, temperature: 0.4, max_tokens, response_format: { type: "json_object" } })) ?? "";
  // gemma nu acceptă system + nu suportă response_format=json_object
  // prin compat layer. Trebuie să cerem JSON în prompt + să curățăm fences.
  const gemmaRun = async () =>
    (await callGemini({
      messages: [{ role: "user" as const, content: flatPrompt }],
      model: "gemma-3-27b-it",
      temperature: 0.4,
      max_tokens,
    })) ?? "";
  const candidates: Candidate[] = [
    // gemma PRIMUL — quota separată, neepuizabilă în testare normală.
    { provider: "gemini", model: "gemma-3-27b-it", run: gemmaRun },
    { provider: "gemini", model: GEMINI_MODEL, run: geminiRun(GEMINI_MODEL) },
    { provider: "gemini", model: GEMINI_MODEL_FAST, run: geminiRun(GEMINI_MODEL_FAST) },
    { provider: "gemini", model: "gemini-flash-latest", run: geminiRun("gemini-flash-latest") },
    { provider: "gemini", model: "gemini-flash-lite-latest", run: geminiRun("gemini-flash-lite-latest") },
  ];

  // Adaugă Groq ca fallback (independent quota — TPD 500k/zi).
  if (process.env.GROQ_API_KEY) {
    const groq = getGroqClient();
    const groqRun = (model: string) => async () => {
      const c = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.4,
        max_tokens,
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
  let allRateLimited = candidates.length > 0;
  for (const cand of candidates) {
    try {
      const out = await cand.run();
      if (out && out.length > 20) {
        raw = out;
        allRateLimited = false;
        break;
      }
      // Răspuns gol / prea scurt — nu e rate limit, doar model gunoi.
      allRateLimited = false;
    } catch (e) {
      lastErr = e;
      lastModelTried = `${cand.provider}/${cand.model}`;
      const status = (e as { status?: number }).status;
      if (status !== 429) allRateLimited = false;
      // 401/403 = key issue — skip remaining candidates, surface fast.
      if (status === 401 || status === 403) break;
    }
  }

  if (!raw) {
    if (allRateLimited) {
      return NextResponse.json(
        {
          error:
            "Toate cotele AI (Gemini + Groq) sunt epuizate pentru azi. Încearcă din nou peste 15-20 minute, sau completează manual câmpurile.",
        },
        { status: 429 },
      );
    }
    const errMsg = lastErr instanceof Error ? lastErr.message : "AI nu a răspuns.";
    return NextResponse.json(
      { error: `AI eșec (ultimul model: ${lastModelTried}). ${errMsg}` },
      { status: 502 },
    );
  }

  // Strip markdown code fences — gemma-3-27b-it wrappuiește uneori JSON
  // în ```json ... ``` chiar dacă instruim explicit "doar JSON".
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "AI a returnat răspuns invalid (nu JSON)." },
      { status: 502 },
    );
  }

  const aftermath = sanitizeAiResponse(parsedJson, scraped);

  // Validare media URLs — drop poze/video-uri care 404 sau returnează HTML
  // în loc de imagine. AI poate halucina URL-uri (ex: video .mp4 inventat
  // pe baza titlului articolului). Mai bine 0 poze decât 12 broken links.
  const { images: validImages, videos: validVideos } = await filterValidMedia(
    aftermath.images,
    aftermath.videos,
  );
  aftermath.images = validImages;
  aftermath.videos = validVideos;

  return NextResponse.json({
    data: aftermath,
    scraped_summary: {
      total: scraped.length,
      ok: okScraped.length,
      failed: scraped.length - okScraped.length,
    },
    // Per-URL diagnostic — admin vede în UI exact care link a fost citit
    // și care a eșuat (cu motivul). Nu expun body-ul (poate fi mare).
    scraped_details: scraped.map((s) => ({
      url: s.url,
      ok: !!(s.ok && s.body && s.body.length >= 100),
      title: s.title ?? null,
      error: s.error,
    })),
  });
}
