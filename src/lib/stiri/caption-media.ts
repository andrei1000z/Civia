/**
 * AI captions pentru media din articol — Groq Llama 4 Scout vision.
 *
 * Pentru fiecare imagine din `stiri_cache.media`, generăm un caption scurt
 * în română care descrie EXACT ce e în poză, dat fiind contextul articolului.
 * Eg. „Mette Frederiksen vorbește la conferința de presă din Copenhaga."
 *
 * Folosit:
 *   - inline când scrape RSS (pe cele 25 articole noi per run, optional)
 *   - batch backfill via scripts/caption-stire-media.ts
 *
 * Cost: ~$0.0002 per imagine. Pentru 100 stiri × 6 poze = ~$0.12.
 */

import { getGroqClient, GROQ_MODEL_VISION } from "@/lib/groq/client";
import type { MediaItem } from "./rss";

const SYSTEM_PROMPT = `Ești un editor de presă român care scrie subtitluri INFORMATIVE și SPECIFICE pentru poze din articole de știri.

OBIECTIV: cititorul citește subtitlul și înțelege CINE e în poză, UNDE a fost făcută, CE se întâmpla, când e relevant pentru articol.

REGULI:
1. Folosește contextul articolului pentru a identifica persoane/locuri/evenimente.
2. Descrie ACȚIUNEA, nu setting-ul. „X discută cu Y la Cluj" e mai bun decât „X într-o încăpere".
3. Lungime: 40-140 caractere. Mai scurt = mai puțin informativ; mai lung = banner copy.
4. Diacritice corecte (ă, â, î, ș, ț).
5. Fără șabloane („Imagine cu...", „Foto:", „Sursa:").
6. Nu repeta titlul articolului identic — adaugă context vizual nou.
7. DACĂ poza e prea generică (un obiect oarecare, o clădire neidentificabilă, un fundal abstract) și nu poți spune nimic util cu context, returnează exact: „SKIP".
8. NU inventa date care nu se văd ori nu sunt în context.

EXEMPLE BUNE (acțiune + identificare):
- „Mette Frederiksen susține un discurs în Folketing, parlamentul Danemarcei, după consultările cu regele"
- „Cristian Mungiu pe covorul roșu la Cannes 2026, alături de echipa filmului Fjord"
- „Bolojan și Frederiksen la o întâlnire bilaterală la sediul Guvernului din București"
- „Protestatari spanioli cu pancarte anti-Sánchez în piața Sol din Madrid"

EXEMPLE PROASTE:
- „Mette Frederiksen vorbind într-o încăpere cu lambriuri" (descrie doar setting-ul, niciun context)
- „O persoană la microfon" (prea generic)
- „Politica" (un cuvânt)
- Titlul articolului repetat identic

DACĂ NU POȚI fi specific, scrie „SKIP".`;

interface CaptionArgs {
  imageUrl: string;
  articleTitle: string;
  articleExcerpt?: string | null;
}

export async function captionImage(args: CaptionArgs): Promise<string | null> {
  try {
    const groq = getGroqClient();
    const userText = `ARTICOL: „${args.articleTitle}"

${args.articleExcerpt ? `CONTEXT FULL:\n${args.articleExcerpt.slice(0, 600)}\n\n` : ""}Scrie subtitlul pentru această poză din articol. Combinează ce vezi cu contextul. Dacă poza nu e specifică suficient ca să spui ceva util, scrie „SKIP".`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_VISION,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: args.imageUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 120,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    // Cleanup
    const cleaned = raw
      .replace(/^["„""']+|["„""']+$/g, "")
      .replace(/\n+/g, " ")
      .replace(/\.$/, "")
      .trim();
    // Skip semnal de la AI — nu putea fi specific
    if (/^skip$/i.test(cleaned)) return null;
    // Skip prea scurt sau prea lung
    if (cleaned.length < 25 || cleaned.length > 200) return null;
    // Skip generic patterns
    if (/^(?:imagine|foto|persoană|persoane|o persoană|un obiect|o clădire)\b/i.test(cleaned)) {
      return null;
    }
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Captionează un batch de media items. Skip items care DEJA au caption
 * meaningful (>10 chars, nu doar „Image"). Returnează items modificați.
 * Concurrency=3 ca să nu hammer-uim Groq rate-limit.
 */
export async function captionMediaBatch(
  items: MediaItem[],
  articleTitle: string,
  articleExcerpt?: string | null,
): Promise<MediaItem[]> {
  if (!items || items.length === 0) return items;

  const out: MediaItem[] = [...items];
  const queue: number[] = [];
  for (let i = 0; i < out.length; i++) {
    const m = out[i];
    if (!m) continue;
    if (m.type !== "image") continue;
    // Re-caption dacă caption-ul existent e gol sau prea scurt sau e altul
    // tipic gen „logo" / numele site-ului SAU dacă e copy-paste al titlului
    // SAU pattern generic „Imagine cu ...", „Foto:" etc.
    const existing = m.caption?.trim() ?? "";
    const titleTrim = articleTitle.trim();
    const looksLikeTitle =
      existing.length > 0 &&
      (existing === titleTrim ||
        existing.toLowerCase() === titleTrim.toLowerCase());
    const looksGeneric = /^(?:image|imagine|foto|persoană|persoane|o persoană|un obiect|o clădire|logo|icon|share|follow)(?:\b|$)/i.test(existing) ||
      /^(?:foto|imagine|sursă|sursa|credit|image)[:.\s]/i.test(existing);
    if (
      existing.length >= 15 &&
      !looksLikeTitle &&
      !looksGeneric
    ) {
      continue;
    }
    queue.push(i);
  }

  // Concurrency 3
  const concurrency = 3;
  let pos = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (pos < queue.length) {
        const idx = queue[pos++];
        if (idx === undefined) break;
        const m = out[idx];
        if (!m) continue;
        const caption = await captionImage({
          imageUrl: m.url,
          articleTitle,
          articleExcerpt,
        });
        if (caption) {
          out[idx] = { ...m, caption };
        }
      }
    }),
  );

  return out;
}
