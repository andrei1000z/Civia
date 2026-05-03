import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL_FAST,
  GEMINI_MODEL_BACKUPS,
} from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const inputSchema = z.object({
  // Ce știe deja admin-ul. Toate optionale — funcția caută să umple
  // golurile din ce există.
  title: z.string().trim().min(3).max(500),
  description: z.string().trim().max(20000).optional(),
  location_name: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  // Ce câmpuri vrea admin-ul completate. Default = toate cele AI-derivable.
  fields: z
    .array(
      z.enum([
        "subtitle",
        "cause",
        "demands",
        "tags",
        "hashtag",
        "color_theme",
      ]),
    )
    .optional(),
});

const SYSTEM_PROMPT = `Ești un asistent care extrage metadata structurată pentru proteste civice românești.

Primești titlul + (opțional) descrierea, locația, orașul. Returnezi DOAR JSON valid în formatul EXACT de mai jos. Răspunsul tău e folosit direct de admin pentru a publica protestul, deci precizia contează.

Schema de output JSON:
{
  "subtitle": "string — propoziție-două care explică ce e protestul (max 280 caractere). Dacă descrierea există, sintetizează din ea.",
  "cause": "string — cauza pe scurt în 3-8 cuvinte (ex: 'Poluarea din capitală', 'Justiție pentru victime'). Nu conține diacritice greșite.",
  "demands": ["array de string-uri — 2-5 revendicări concrete extrase din descriere/titlu. Fiecare propoziție scurtă, imperativ ('Demisia X', 'Anularea legii Y'). Dacă descrierea nu menționează revendicări specifice, ARRAY GOL."],
  "tags": ["array de 3-6 tag-uri scurte 1-2 cuvinte (ex: 'ecologie', 'anti-corupție', 'drepturi-femei', 'climatic'). Lowercase, cu cratimă în loc de spații."],
  "hashtag": "string — hashtag în PascalCase fără spații (ex: '#FaraCorupție', '#AerCurat'). Începe cu #. Max 60 caractere. Dacă e ambiguu, returnează șir gol.",
  "color_theme": "string — UNUL dintre: 'warning' (default proteste — alert/amber), 'primary' (civic-verde), 'petition' (cauze-purple), 'success' (pozitiv-teal), 'data' (informativ-blue), 'health' (sănătate-teal). Alege contextual: anti-poluare/sănătate=health; libertăți/drepturi=primary; ecologie=success; anti-corupție/protest critic=warning."
}

REGULI:
- TOTUL în română corectă cu diacritice (ă, â, î, ș, ț).
- NU inventa informații care nu sunt în input.
- NU adăuga text înainte/după JSON. NU folosi markdown. NU include alte câmpuri.
- Dacă un câmp nu poate fi derivat clar, returnează șir gol "" sau array gol [].
- Stilul tonului: ferm dar pașnic, cetățean conștient, NU inflamator/agresiv.`;

interface AiFill {
  subtitle?: string;
  cause?: string;
  demands?: string[];
  tags?: string[];
  hashtag?: string;
  color_theme?: string;
}

const VALID_THEMES = new Set([
  "warning", "primary", "petition", "news", "success", "data", "authority", "health",
]);

function sanitize(raw: unknown): AiFill {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const out: AiFill = {};

  if (typeof r.subtitle === "string" && r.subtitle.trim()) {
    out.subtitle = r.subtitle.trim().slice(0, 280);
  }
  if (typeof r.cause === "string" && r.cause.trim()) {
    out.cause = r.cause.trim().slice(0, 120);
  }
  if (Array.isArray(r.demands)) {
    out.demands = r.demands
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().slice(0, 500))
      .slice(0, 8);
  }
  if (Array.isArray(r.tags)) {
    out.tags = r.tags
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().toLowerCase().slice(0, 40))
      .slice(0, 8);
  }
  if (typeof r.hashtag === "string" && r.hashtag.trim()) {
    let h = r.hashtag.trim().slice(0, 60);
    if (!h.startsWith("#")) h = `#${h}`;
    out.hashtag = h;
  }
  if (typeof r.color_theme === "string" && VALID_THEMES.has(r.color_theme)) {
    out.color_theme = r.color_theme;
  }
  return out;
}

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Auth required" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false as const, status: 403, error: "Admin only" };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY nu e configurat. Setează-l în env Vercel." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const parsed = inputSchema.parse(body);

    // Construim un context minimal pentru AI — doar ce avem.
    const userContext: string[] = [`TITLU: ${parsed.title}`];
    if (parsed.location_name) userContext.push(`LOCAȚIE: ${parsed.location_name}`);
    if (parsed.city) userContext.push(`ORAȘ: ${parsed.city}`);
    if (parsed.description) {
      userContext.push(`DESCRIERE:\n${parsed.description}`);
    }
    const userPrompt = userContext.join("\n\n");

    // Gemini Flash Lite e cel mai ieftin + rapid pentru extragere structurată
    // scurtă. Dacă cade, încercăm modelele backup (au quotă separată).
    const models = [GEMINI_MODEL_FAST, ...GEMINI_MODEL_BACKUPS];
    let raw: string | null = null;
    let lastErr: unknown = null;
    for (const model of models) {
      try {
        raw = await callGemini({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          model,
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: "json_object" },
        });
        if (raw) break;
      } catch (e) {
        lastErr = e;
        // Try next model on rate limit (429) or 5xx; bail early on auth errors.
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) break;
      }
    }

    if (!raw) {
      const msg = lastErr instanceof Error ? lastErr.message : "AI nu a răspuns";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI a returnat răspuns invalid (nu JSON)" },
        { status: 502 },
      );
    }
    const fill = sanitize(parsedJson);
    return NextResponse.json({ data: fill });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Date invalide" },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
