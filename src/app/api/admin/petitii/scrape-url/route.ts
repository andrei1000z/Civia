import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { PETITIE_CATEGORII } from "@/lib/constants";

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Download the og:image from the source site and re-upload it to our
 * Supabase Storage bucket. This sidesteps hot-link protection / CORS
 * problems on hosts like static.controlshift.app and gives the public
 * /petitii cards a stable URL we control.
 *
 * Returns the public Supabase URL on success, or `null` on any failure
 * (caller falls back to the original `rawImage` URL — that lets
 * preview keep working even when re-host fails).
 */
async function rehostImage(srcUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(srcUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro)",
        Accept: "image/jpeg,image/png,image/webp,image/gif,*/*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    const ext = ALLOWED_IMAGE_MIME[ct];
    if (!ext) return null;
    const arrayBuffer = await res.arrayBuffer();
    // Cap at 8 MB — anything bigger probably isn't a petition cover.
    if (arrayBuffer.byteLength > 8 * 1024 * 1024) return null;

    const supabase = await createSupabaseServer();
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const path = `public/petitii/${filename}`;
    const { error } = await supabase.storage
      .from("sesizari-photos")
      .upload(path, arrayBuffer, {
        contentType: ct,
        cacheControl: "3600",
      });
    if (error) return null;
    const { data } = supabase.storage.from("sesizari-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  url: z.string().url().max(500),
});

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${escaped}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return decodeEntities(m[1]).trim();
    }
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m && m[1] ? decodeEntities(m[1]).trim().slice(0, 300) : null;
}

function extractMainText(html: string): string {
  // Strip script/style/nav/footer/header/aside blocks aggressively
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // Try to extract <article> first if present (often contains the petition body)
  const artMatch = cleaned.match(/<article[\s\S]*?<\/article>/i);
  if (artMatch) cleaned = artMatch[0];
  else {
    const mainMatch = cleaned.match(/<main[\s\S]*?<\/main>/i);
    if (mainMatch) cleaned = mainMatch[0];
  }

  // Strip remaining tags, collapse whitespace
  const text = cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decodeEntities(text);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function resolveUrl(maybeRel: string, base: string): string {
  try {
    return new URL(maybeRel, base).toString();
  } catch {
    return maybeRel;
  }
}

const CATEGORY_VALUES = PETITIE_CATEGORII.map((c) => c.value).join(", ");

const EXTRACT_PROMPT = (
  url: string,
  rawTitle: string | null,
  rawDescription: string | null,
  rawText: string,
) => `Ești un asistent care extrage metadata structurată dintr-o petiție civică românească găsită pe un site extern (Declic, Avaaz, Change.org, petitiononline.ro, etc).

URL: ${url}

TITLU SCRAPED: ${rawTitle ?? "(nu)"}
DESCRIERE SCRAPED: ${rawDescription ?? "(nu)"}

TEXT EXTRAS DIN PAGINĂ (primele 6000 caractere):
${rawText.slice(0, 6000)}

GENEREAZĂ un JSON valid cu următoarele câmpuri:

{
  "title": "Titlu curat al petiției — fără numele site-ului, fără emoji, max 150 caractere, prima literă mare",
  "summary": "Sumar 2-3 propoziții, 200-400 caractere — ce cere petiția + de ce contează. Limba română cu diacritice. Ton civic, factual.",
  "body": "Conținut complet curățat al petiției. Păstrează paragrafele cu \\n\\n între ele. Include argumentul, contextul, ce se cere. Elimină reclamă, footer, butoane de share, alte petiții recomandate. Min 200 caractere, max 4000.",
  "category": "Una dintre: ${CATEGORY_VALUES}. Alege cea mai potrivită bazat pe subiect. Dacă niciuna nu se potrivește, folosește 'Altele'.",
  "slug": "slug-url-fara-diacritice — max 70 caractere, doar lowercase ASCII + cratimă, esența titlului în 4-7 cuvinte",
  "county_code": "Cod județ ISO 2-litere (ex: B, CJ, IS, TM) DOAR dacă petiția e clar locală pentru un singur județ. Dacă e națională sau ambiguă, returnează empty string."
}

REGULI STRICTE:
- Răspunde DOAR cu JSON valid, fără markdown, fără ghilimele tip code-block, fără text înainte/după.
- Toate textele în limba română corectă cu diacritice (ă, â, î, ș, ț).
- Dacă o informație lipsește din pagină, derivă din context. Nu inventa fapte.
- Nu copia cuvânt cu cuvânt din site — rescrie natural pentru claritate.

Codurile de județ valide: AB, AR, AG, BC, BH, BN, BT, BV, BR, BZ, CS, CL, CJ, CT, CV, DB, DJ, GL, GR, GJ, HR, HD, IL, IS, IF, MM, MH, MS, NT, OT, PH, SM, SJ, SB, SV, TR, TM, TL, VS, VL, VN, B`;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const { url } = schema.parse(body);

    // 1) Fetch HTML with timeout
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 12_000);
    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        // HTTP headers must be ASCII-only — never use em-dash, smart quotes,
        // or non-breaking spaces here, or fetch() throws ByteString errors.
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro) civic-petition-scraper",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Site-ul a răspuns ${res.status} ${res.statusText}` },
          { status: 502 },
        );
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html") && !ct.includes("text")) {
        return NextResponse.json(
          { error: `URL-ul nu returnează HTML (content-type: ${ct})` },
          { status: 400 },
        );
      }
      html = await res.text();
    } catch (e) {
      const isAbort = e instanceof Error && e.name === "AbortError";
      return NextResponse.json(
        { error: isAbort ? "Timeout la fetch (>12s)" : `Fetch eșuat: ${e instanceof Error ? e.message : "necunoscut"}` },
        { status: 502 },
      );
    } finally {
      clearTimeout(tid);
    }

    // Cap HTML at ~500KB so we don't blow memory or context
    if (html.length > 500_000) html = html.slice(0, 500_000);

    // 2) Extract structured signals from HTML
    const ogTitle = extractMeta(html, ["og:title", "twitter:title"]);
    const ogDescription = extractMeta(html, ["og:description", "twitter:description", "description"]);
    const ogImage = extractMeta(html, ["og:image", "twitter:image", "twitter:image:src"]);
    const titleTag = extractTitle(html);
    const mainText = extractMainText(html);

    const rawTitle = ogTitle || titleTag;
    const sourceImage = ogImage ? resolveUrl(ogImage, url) : null;
    // Re-host the source image on our Supabase storage so the public
    // /petitii cards don't break when the origin (e.g. controlshift.app)
    // blocks hot-linking. Falls back to the original URL if re-host fails.
    const rehosted = sourceImage ? await rehostImage(sourceImage) : null;
    const rawImage = rehosted ?? sourceImage;

    if (!rawTitle && mainText.length < 100) {
      return NextResponse.json(
        { error: "Pagina nu conține metadata sau text suficient pentru extracție" },
        { status: 422 },
      );
    }

    // 3) Send to Groq for structured extraction
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        {
          role: "system",
          content:
            "Ești un asistent care extrage metadata structurată din petiții civice românești. Răspunzi DOAR cu JSON valid — fără markdown, fără text adițional.",
        },
        { role: "user", content: EXTRACT_PROMPT(url, rawTitle, ogDescription, mainText) },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: {
      title?: string;
      summary?: string;
      body?: string;
      category?: string;
      slug?: string;
      county_code?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to recover JSON from a code block
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json(
          { error: "AI a returnat răspuns malformed — încearcă din nou" },
          { status: 502 },
        );
      }
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return NextResponse.json(
          { error: "AI a returnat JSON invalid" },
          { status: 502 },
        );
      }
    }

    // 4) Sanitize + normalize
    const allowedCategories = new Set<string>(PETITIE_CATEGORII.map((c) => c.value));
    const validCounties = new Set([
      "AB", "AR", "AG", "BC", "BH", "BN", "BT", "BV", "BR", "BZ",
      "CS", "CL", "CJ", "CT", "CV", "DB", "DJ", "GL", "GR", "GJ",
      "HR", "HD", "IL", "IS", "IF", "MM", "MH", "MS", "NT", "OT",
      "PH", "SM", "SJ", "SB", "SV", "TR", "TM", "TL", "VS", "VL",
      "VN", "B",
    ]);

    const title = (parsed.title ?? rawTitle ?? "").trim().slice(0, 200);
    const summary = (parsed.summary ?? ogDescription ?? "").trim().slice(0, 500);
    const bodyText = (parsed.body ?? "").trim().slice(0, 8000);
    const category = parsed.category && allowedCategories.has(parsed.category) ? parsed.category : "";
    const slug = parsed.slug ? slugify(parsed.slug) : title ? slugify(title) : "";
    const county_code =
      parsed.county_code && validCounties.has(parsed.county_code.toUpperCase())
        ? parsed.county_code.toUpperCase()
        : "";

    return NextResponse.json({
      data: {
        title,
        summary,
        body: bodyText,
        category,
        slug,
        county_code,
        image_url: rawImage ?? "",
        external_url: url,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "URL invalid", details: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
