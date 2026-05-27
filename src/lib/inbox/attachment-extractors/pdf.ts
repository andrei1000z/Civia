/**
 * PDF text extraction — 2-step pipeline.
 *
 * Step 1: unpdf (free, fast, ~500ms) — extragere text-native. Funcționează
 * pe PDF-uri exportate din Word/Google Docs/etc. ~60% din răspunsurile
 * primăriilor sunt așa.
 *
 * Step 2: Gemini 2.5 Flash native PDF vision (~3-7s, ~$0.0001/PDF) —
 * fallback dacă unpdf returnează <100 chars (PDF scanat fără text layer).
 * Mai precis decât Tesseract pe text românesc cu diacritice, plus
 * preservă structura (tabele, liste).
 *
 * 2026-05-27 — Plug-in în /api/inbox/reply pentru a îmbogăți body_text
 * înainte de classifyReply.
 */

import { extractText } from "unpdf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  type AttachmentExtractionInput,
  type AttachmentExtractionResult,
  truncateExtracted,
  PDF_TEXT_NATIVE_MIN_CHARS,
} from "./types";

export async function extractPdf(
  input: AttachmentExtractionInput,
): Promise<AttachmentExtractionResult> {
  const t0 = Date.now();

  // Step 1: unpdf text-native (free, fast).
  try {
    const result = await extractText(input.bytes, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    const trimmed = text.trim();

    if (trimmed.length >= PDF_TEXT_NATIVE_MIN_CHARS) {
      return {
        extracted_text: truncateExtracted(trimmed),
        extraction_method: "unpdf",
        extraction_ms: Date.now() - t0,
        extraction_error: null,
      };
    }
    // <100 chars → PDF scanat sau imagini-only. Cădem la Gemini Vision.
  } catch (e) {
    // unpdf eșuează pe PDF-uri encrypted / corrupted. Tot fallback la Gemini.
    const err = e instanceof Error ? e.message : "unpdf failed";
    // dacă PDF e password-protected, Gemini Vision tot va eșua, dar
    // încercăm; eventual marchează „failed" cu err mesaj.
    console.warn(`[pdf-extract] unpdf failed for ${input.filename}: ${err}`);
  }

  // Step 2: Gemini Vision pe PDF direct (suportă PDF nativ + OCR scanate).
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return {
      extracted_text: null,
      extraction_method: "failed",
      extraction_ms: Date.now() - t0,
      extraction_error: "GEMINI_API_KEY missing — cannot OCR scanned PDF",
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Convert Uint8Array → base64 pentru Gemini API.
    const base64 = Buffer.from(input.bytes).toString("base64");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      {
        text: `Extrage TOT textul din acest document PDF în română.
Păstrează:
- Structura (paragrafe, liste numerotate, tabele ca text plain)
- Numerele de înregistrare, datele, semnăturile vizibile
- Anteturile/footerele autorității (Primăria X, ANAF, etc.)

NU adăuga comentarii / interpretări. NU traduce. Returnează DOAR textul
extras, ca și cum ai copia-paste din document. Dacă vezi text scanat
neclear, semnalează cu [neclar] dar continuă restul textului.`,
      },
    ]);

    const text = result.response.text().trim();

    return {
      extracted_text: text ? truncateExtracted(text) : null,
      extraction_method: "gemini-vision-pdf",
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
