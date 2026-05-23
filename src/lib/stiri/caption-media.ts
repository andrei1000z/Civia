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

const SYSTEM_PROMPT = `Ești un editor de presă român care scrie subtitluri scurte și informative pentru poze din articole de știri.

REGULI:
1. Scrie UN SINGUR rând în română, max 120 caractere.
2. Descrie EXACT ce vezi în poză + persoane/locuri identificate din context.
3. Nu folosi formule de șablon ("Imagine cu...", "Foto cu...").
4. Nu repeta titlul articolului — completează-l cu detalii vizuale.
5. Folosește diacritice corecte (ă, â, î, ș, ț).
6. Fără semne de punctuație finală decât dacă e o frază completă.
7. Dacă poza arată un obiect / scenă generică (clădire, hârtie, drum), descrie obiectul + contextul.

EXEMPLE BUNE:
- „Mette Frederiksen vorbește la o conferință de presă în Parlament"
- „Cristian Mungiu pe covorul roșu la Festivalul de la Cannes"
- „Sediul Guvernului României la Palatul Victoria, vedere frontală"
- „Document oficial cu antetul Casei Regale a Danemarcei"

NU bune:
- „Imagine din articol" (prea generic)
- „Politica" (un cuvânt)
- „Frederiksen [titlu repetat din articol]"`;

interface CaptionArgs {
  imageUrl: string;
  articleTitle: string;
  articleExcerpt?: string | null;
}

export async function captionImage(args: CaptionArgs): Promise<string | null> {
  try {
    const groq = getGroqClient();
    const userText = `Articol: „${args.articleTitle}"\n${
      args.articleExcerpt ? `Context: ${args.articleExcerpt.slice(0, 300)}\n` : ""
    }Scrie un subtitlu scurt (max 120 caractere, în română) care descrie EXACT ce e în această poză.`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_VISION,
      messages: [
        // Vision API: system MUST come first; image+text în user.
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: args.imageUrl } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 80,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    // Clean: scoate ghilimele din jur, line breaks, trailing dot
    const cleaned = raw
      .replace(/^["„""']+|["„""']+$/g, "")
      .replace(/\n+/g, " ")
      .replace(/\.$/, "")
      .trim();
    if (cleaned.length < 5 || cleaned.length > 200) return null;
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
    // tipic gen „logo" / numele site-ului
    const existing = m.caption?.trim() ?? "";
    if (
      existing.length >= 15 &&
      !/^(?:image|imagine|foto|logo|icon|share|follow)$/i.test(existing)
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
