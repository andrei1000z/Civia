/**
 * 2026-06-08 — OCR pe imagine cu cascadă rezilientă INDEPENDENTĂ de Gemini.
 *
 * Context: răspunsurile de fond ale autorităților vin ca PDF scanat/imagine.
 * Gemini Vision e cea mai bună, dar lovește 429 (quota free). Cloudflare Llama
 * 3.2 Vision e BLOCAT în UE (restricție Meta). Soluția: Groq Llama 4 Scout
 * (vision, quota SEPARATĂ de Gemini, puternic) → fallback Cloudflare LLaVA
 * (slab dar fără blocaj UE). Verificat live: Groq citește complet PDF-uri
 * scanate de la Poliția Locală.
 */
import { getGroqClient, GROQ_MODEL_VISION } from "@/lib/groq/client";
import { cloudflareAIVision } from "./cloudflare-ai";

const OCR_PROMPT_RO = `Extrage TOT textul vizibil din acest document oficial scanat (română). Păstrează diacriticele (ă â î ș ț), numerele de înregistrare, datele și anteturile autorității. NU traduce, NU comenta. Returnează DOAR textul.`;
const OCR_PROMPT_EN = `Extract all visible text from this scanned Romanian official document, including registration numbers, dates, signatures and headers. Preserve diacritics (ă â î ș ț). Return ONLY the extracted text.`;

export interface VisionOcrResult {
  text: string | null;
  method: "groq-vision" | "cloudflare-llava" | "failed";
  error: string | null;
}

/**
 * OCR pe o imagine (PNG/JPEG bytes): Groq Llama 4 Scout → Cloudflare LLaVA.
 */
export async function visionOcr(
  imageBytes: Uint8Array,
  mimeType = "image/png",
): Promise<VisionOcrResult> {
  let lastErr = "";

  // 1. Groq Llama 4 Scout (vision) — quota separată de Gemini.
  try {
    const groq = getGroqClient();
    if (groq) {
      const dataUrl = `data:${mimeType};base64,${Buffer.from(imageBytes).toString("base64")}`;
      const r = await groq.chat.completions.create({
        model: GROQ_MODEL_VISION,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT_RO },
              { type: "image_url", image_url: { url: dataUrl } },
            ] as never,
          },
        ],
        temperature: 0,
        max_tokens: 1500,
      });
      const text = r.choices[0]?.message?.content?.trim();
      if (text) return { text, method: "groq-vision", error: null };
      lastErr = "groq returned empty";
    } else {
      lastErr = "groq not configured";
    }
  } catch (e) {
    lastErr = e instanceof Error ? e.message : "groq vision failed";
  }

  // 2. Cloudflare LLaVA — fără blocaj UE (slab, last resort).
  const cf = await cloudflareAIVision({ imageBytes, prompt: OCR_PROMPT_EN });
  if (cf.text) return { text: cf.text, method: "cloudflare-llava", error: null };

  return { text: null, method: "failed", error: `groq: ${lastErr} | cf: ${cf.error}` };
}
