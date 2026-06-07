/**
 * Tipuri shared pentru attachment text extraction pipeline.
 *
 * 2026-05-27 — Suport: PDF (text-native via unpdf, scanat via Gemini
 * Vision fallback), DOCX (mammoth), imagini (Gemini Vision OCR).
 */

export type ExtractionMethod =
  | "unpdf"
  | "gemini-vision-pdf"
  | "gemini-vision-image"
  | "cloudflare-vision-image"
  | "cloudflare-vision-pdf"
  | "mammoth-docx"
  | "skipped"
  | "failed";

export interface AttachmentExtractionInput {
  /** Conținutul atașamentului ca bytes (din R2 sau direct base64 decode). */
  bytes: Uint8Array;
  /** MIME type validat (verifică magic bytes, nu doar header). */
  contentType: string;
  /** Pentru context / logging Sentry. */
  filename: string;
}

export interface AttachmentExtractionResult {
  extracted_text: string | null;
  extraction_method: ExtractionMethod;
  extraction_ms: number;
  extraction_error: string | null;
}

/** Max text per atașament — protejează DB + AI token cost. */
export const MAX_EXTRACTED_TEXT_CHARS = 50_000;

/** Threshold sub care PDF-ul e considerat scanat (fără text layer). */
export const PDF_TEXT_NATIVE_MIN_CHARS = 100;

/**
 * Truncate text la max chars. Util la final de pipeline ca să nu
 * exceedăm coloane DB sau să umflam token cost la Groq classify.
 */
export function truncateExtracted(text: string): string {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) return text;
  return text.slice(0, MAX_EXTRACTED_TEXT_CHARS) + "\n\n[...text trunchiat]";
}
