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
import {
  type AttachmentExtractionInput,
  type AttachmentExtractionResult,
  truncateExtracted,
} from "./types";
import { cloudflareAIVision } from "../cloudflare-ai";

export async function extractImage(
  input: AttachmentExtractionInput,
): Promise<AttachmentExtractionResult> {
  const t0 = Date.now();

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    // Fallback Cloudflare Workers AI (free 10k neurons/zi).
    const cf = await cloudflareAIVision({
      imageBytes: input.bytes,
      prompt: `Extract all visible text from this Romanian document image, including registration numbers, dates, signatures, headers. Preserve diacritics (ă, â, î, ș, ț). Return ONLY the extracted text.`,
    });
    if (cf.text) {
      return {
        extracted_text: truncateExtracted(cf.text),
        extraction_method: "gemini-vision-image",
        extraction_ms: Date.now() - t0,
        extraction_error: null,
      };
    }
    return {
      extracted_text: null,
      extraction_method: "failed",
      extraction_ms: Date.now() - t0,
      extraction_error: `GEMINI missing + CF AI: ${cf.error}`,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Detect actual MIME from content_type (image/jpeg, image/png, image/webp).
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

    const base64 = Buffer.from(input.bytes).toString("base64");

    const result = await model.generateContent([
      {
        inlineData: { mimeType, data: base64 },
      },
      {
        text: `Această poză e un document oficial scanat de la o autoritate
publică din România (primărie, ANAF, poliție, etc.). Extrage TOT textul
vizibil, păstrând:
- Antet (numele autorității, adresa, contact)
- Numere de înregistrare, date, semnături vizibile
- Conținutul mesajului cu paragrafe corecte
- Diacritice românești (ă, â, î, ș, ț)

NU adăuga interpretări. NU traduce. Returnează DOAR textul extras.
Dacă vezi text neclar / scris de mână, semnalează cu [neclar].`,
      },
    ]);

    const text = result.response.text().trim();

    return {
      extracted_text: text ? truncateExtracted(text) : null,
      extraction_method: "gemini-vision-image",
      extraction_ms: Date.now() - t0,
      extraction_error: text ? null : "Gemini returned empty",
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : "Gemini Vision failed";
    return {
      extracted_text: null,
      extraction_method: "failed",
      extraction_ms: Date.now() - t0,
      extraction_error: err,
    };
  }
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
