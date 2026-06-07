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
import { geminiKeys } from "@/lib/ai/gemini";
import {
  type AttachmentExtractionInput,
  type AttachmentExtractionResult,
  truncateExtracted,
  PDF_TEXT_NATIVE_MIN_CHARS,
} from "./types";

const PDF_OCR_PROMPT = `Extrage TOT textul din acest document PDF în română.
Păstrează:
- Structura (paragrafe, liste numerotate, tabele ca text plain)
- Numerele de înregistrare, datele, semnăturile vizibile
- Anteturile/footerele autorității (Primăria X, ANAF, etc.)

NU adăuga comentarii / interpretări. NU traduce. Returnează DOAR textul
extras, ca și cum ai copia-paste din document. Dacă vezi text scanat
neclear, semnalează cu [neclar] dar continuă restul textului.`;

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
  // 2026-06-07: ROTAȚIE multi-cheie pe 429. Cota Gemini e per-proiect Google,
  // deci GEMINI_API_KEY_2/_3 (din alte proiecte) = cote separate → triplăm cota
  // gratuită. Înainte: 1 cheie → 429 → „failed" → răspunsul autorității din PDF
  // scanat rămânea invizibil → sesizarea bloca la „înregistrată".
  const keys = geminiKeys();
  if (keys.length === 0) {
    return {
      extracted_text: null,
      extraction_method: "failed",
      extraction_ms: Date.now() - t0,
      extraction_error: "GEMINI_API_KEY missing — cannot OCR scanned PDF",
    };
  }

  const base64 = Buffer.from(input.bytes).toString("base64");
  let lastErr = "";
  for (const key of keys) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([
        { inlineData: { mimeType: "application/pdf", data: base64 } },
        { text: PDF_OCR_PROMPT },
      ]);
      const text = result.response.text().trim();
      return {
        extracted_text: text ? truncateExtracted(text) : null,
        extraction_method: "gemini-vision-pdf",
        extraction_ms: Date.now() - t0,
        extraction_error: text ? null : "Gemini returned empty",
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Gemini Vision failed";
      // Doar pe 429/quota încercăm următoarea cheie; erorile hard (403, parse,
      // PDF corupt) nu se rezolvă cu altă cheie → ieșim.
      if (!/429|quota|Too Many Requests|RESOURCE_EXHAUSTED/i.test(lastErr)) break;
    }
  }

  return {
    extracted_text: null,
    extraction_method: "failed",
    extraction_ms: Date.now() - t0,
    extraction_error: lastErr || "all Gemini keys exhausted",
  };
}
