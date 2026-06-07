/**
 * Image OCR via Gemini 2.5 Flash Vision.
 *
 * 2026-05-27 — Răspunsurile primăriilor uneori vin ca poză scanată
 * direct (JPG/PNG) — primăria fotografiază documentul cu telefonul.
 * Gemini Flash face OCR multilingv (română cu diacritice) la calitate
 * superioară Tesseract.
 *
 * Cost: ~$0.0001/imagine pe Gemini Flash ($0.30/M input tokens).
 * Latență: 2-5 secunde.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiKeys } from "@/lib/ai/gemini";
import {
  type AttachmentExtractionInput,
  type AttachmentExtractionResult,
  truncateExtracted,
} from "./types";
import { cloudflareAIVision } from "../cloudflare-ai";

const GEMINI_IMG_PROMPT = `Această poză e un document oficial scanat de la o autoritate
publică din România (primărie, ANAF, poliție, etc.). Extrage TOT textul
vizibil, păstrând:
- Antet (numele autorității, adresa, contact)
- Numere de înregistrare, date, semnături vizibile
- Conținutul mesajului cu paragrafe corecte
- Diacritice românești (ă, â, î, ș, ț)

NU adăuga interpretări. NU traduce. Returnează DOAR textul extras.
Dacă vezi text neclar / scris de mână, semnalează cu [neclar].`;

const CF_IMG_PROMPT = `Extract all visible text from this Romanian document image, including registration numbers, dates, signatures, headers. Preserve diacritics (ă, â, î, ș, ț). Return ONLY the extracted text.`;

export async function extractImage(
  input: AttachmentExtractionInput,
): Promise<AttachmentExtractionResult> {
  const t0 = Date.now();

  // Gemini acceptă image/jpeg, image/png, image/webp, image/heic, image/heif.
  const mimeType = normalizeImageMime(input.contentType);
  if (!mimeType) {
    return {
      extracted_text: null,
      extraction_method: "skipped",
      extraction_ms: Date.now() - t0,
      extraction_error: `Unsupported image MIME: ${input.contentType}`,
    };
  }

  // Step 1: Gemini Vision cu ROTAȚIE multi-cheie (cota e per-proiect Google →
  // GEMINI_API_KEY_2/_3 = cote separate). 2026-06-07: înainte 1 cheie → 429 →
  // „failed" → OCR-ul răspunsului scanat eșua → sesizarea bloca.
  const keys = geminiKeys();
  const base64 = Buffer.from(input.bytes).toString("base64");
  let lastErr = "";
  for (const key of keys) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64 } },
        { text: GEMINI_IMG_PROMPT },
      ]);
      const text = result.response.text().trim();
      if (text) {
        return {
          extracted_text: truncateExtracted(text),
          extraction_method: "gemini-vision-image",
          extraction_ms: Date.now() - t0,
          extraction_error: null,
        };
      }
      lastErr = "Gemini returned empty";
      break; // gol → încearcă CF mai jos
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Gemini Vision failed";
      if (!/429|quota|Too Many Requests|RESOURCE_EXHAUSTED/i.test(lastErr)) break;
    }
  }

  // Step 2: Fallback Cloudflare Workers AI Vision (Llama 3.2 11B, free 10k/zi) —
  // pe 429 Gemini, lipsă cheie, sau Gemini gol. Citește imaginea direct.
  const cf = await cloudflareAIVision({ imageBytes: input.bytes, prompt: CF_IMG_PROMPT });
  if (cf.text) {
    return {
      extracted_text: truncateExtracted(cf.text),
      extraction_method: "cloudflare-vision-image",
      extraction_ms: Date.now() - t0,
      extraction_error: null,
    };
  }

  return {
    extracted_text: null,
    extraction_method: "failed",
    extraction_ms: Date.now() - t0,
    extraction_error: `${keys.length ? `Gemini: ${lastErr}` : "GEMINI missing"} + CF: ${cf.error}`,
  };
}

function normalizeImageMime(contentType: string): string | null {
  const lower = contentType.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return "image/jpeg";
  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  if (lower.includes("heic")) return "image/heic";
  if (lower.includes("heif")) return "image/heif";
  return null;
}
