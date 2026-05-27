/**
 * DOCX text extraction via mammoth.
 *
 * 2026-05-27 — Rar dar uneori autoritățile trimit răspunsul direct ca
 * .docx (Word). mammoth e pure JS, fără dependențe native, lucrează în
 * serverless Vercel/Node.
 *
 * Latență: <500ms.
 */

import mammoth from "mammoth";
import {
  type AttachmentExtractionInput,
  type AttachmentExtractionResult,
  truncateExtracted,
} from "./types";

export async function extractDocx(
  input: AttachmentExtractionInput,
): Promise<AttachmentExtractionResult> {
  const t0 = Date.now();

  try {
    // mammoth.extractRawText acceptă { buffer: Buffer }. Convertim
    // Uint8Array → Buffer (Node-side, no client-side execution).
    const buffer = Buffer.from(input.bytes);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (!text) {
      return {
        extracted_text: null,
        extraction_method: "mammoth-docx",
        extraction_ms: Date.now() - t0,
        extraction_error: "DOCX empty after extraction",
      };
    }

    return {
      extracted_text: truncateExtracted(text),
      extraction_method: "mammoth-docx",
      extraction_ms: Date.now() - t0,
      extraction_error: null,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : "mammoth failed";
    return {
      extracted_text: null,
      extraction_method: "failed",
      extraction_ms: Date.now() - t0,
      extraction_error: err,
    };
  }
}
