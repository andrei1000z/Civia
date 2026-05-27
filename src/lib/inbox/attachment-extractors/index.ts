/**
 * Router atașament → extractor specializat.
 *
 * 2026-05-27 — Pipeline complet: input bytes + content_type →
 * AttachmentExtractionResult. Verifică magic bytes contra MIME spoofing
 * înainte de a apela extractoarele.
 *
 * Suport curent:
 *   - PDF (text-native via unpdf, scanat via Gemini Vision fallback)
 *   - DOCX (mammoth)
 *   - Imagini JPG/PNG/WEBP (Gemini Vision OCR)
 *
 * Refuz explicit:
 *   - .exe, .scr, .bat, .com, .vbs (executabile)
 *   - .zip, .rar, .7z (containere — pot conține malware; iar autoritățile
 *     nu trimit zip-uri)
 *   - .heic/.heif (suport Gemini dar majoritatea autorităților nu le folosesc)
 *
 * Timeout per atașament: 30s. Pe expire returnăm "failed" cu message.
 */

import { extractPdf } from "./pdf";
import { extractImage } from "./image";
import { extractDocx } from "./docx";
import { detectFileTypeFromMagic, verifyMimeType } from "./magic-bytes";
import {
  type AttachmentExtractionInput,
  type AttachmentExtractionResult,
} from "./types";

export type { AttachmentExtractionResult, ExtractionMethod } from "./types";
export { MAX_EXTRACTED_TEXT_CHARS } from "./types";

const EXTRACTION_TIMEOUT_MS = 30_000;

/**
 * Extragere text din atașament. Routes by detected file type (magic bytes
 * > declared MIME), cu timeout 30s per atașament.
 *
 * IMPORTANT: rulează NUMAI server-side (Node.js / Vercel function).
 * Folosește Buffer, mammoth, @google/generative-ai care nu rulează
 * în Edge runtime.
 */
export async function extractAttachment(
  input: AttachmentExtractionInput,
): Promise<AttachmentExtractionResult> {
  const t0 = Date.now();

  // Step 1: detect type din magic bytes (NU trust content-type header).
  const detectedType = detectFileTypeFromMagic(input.bytes);

  // Step 2: verifică contra spoofing — dacă declarat ≠ actual, log warning
  // dar continue cu cel real.
  const mimeMatch = verifyMimeType(input.contentType, input.bytes);
  if (!mimeMatch && detectedType !== "unknown") {
    // Possible spoofing. Log Sentry breadcrumb dar continuă cu real type.
    // (Atac comun: .exe rebranded ca .pdf — atunci detectedType=unknown
    // și refuzăm jos.)
  }

  // Step 3: route pe tipul real.
  const promise = (async (): Promise<AttachmentExtractionResult> => {
    if (detectedType === "pdf") return extractPdf(input);
    if (detectedType === "docx") return extractDocx(input);
    if (detectedType === "jpeg" || detectedType === "png" || detectedType === "webp") {
      return extractImage(input);
    }
    // Unknown / unsupported / executable disguised as media → skip.
    return {
      extracted_text: null,
      extraction_method: "skipped",
      extraction_ms: Date.now() - t0,
      extraction_error: `Unsupported / unsafe file type (magic bytes: ${detectedType}, declared: ${input.contentType})`,
    };
  })();

  // Step 4: timeout protection.
  const timeout = new Promise<AttachmentExtractionResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          extracted_text: null,
          extraction_method: "failed",
          extraction_ms: EXTRACTION_TIMEOUT_MS,
          extraction_error: `Extraction timeout (${EXTRACTION_TIMEOUT_MS}ms)`,
        }),
      EXTRACTION_TIMEOUT_MS,
    ),
  );

  return Promise.race([promise, timeout]);
}
