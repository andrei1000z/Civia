/**
 * Verificare MIME type via magic bytes (primii ~8 bytes din fișier).
 *
 * 2026-05-27 — Protecție anti MIME spoofing: un atacator poate să trimită
 * un .exe rebranded ca .pdf (content-type: application/pdf, filename:
 * virus.pdf). Header-ul HTTP / MIME nu garantează nimic.
 *
 * Verificăm primii bytes:
 *   - PDF: `%PDF-` (0x25 0x50 0x44 0x46 0x2D)
 *   - DOCX/ZIP: `PK\x03\x04` (0x50 0x4B 0x03 0x04) — DOCX e ZIP-based
 *   - JPEG: 0xFF 0xD8 0xFF
 *   - PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
 *   - WEBP: `RIFF....WEBP` (0x52 0x49 0x46 0x46, then 0x57 0x45 0x42 0x50 at offset 8)
 *
 * Returns: tipul detectat sau null dacă nu match. Folosit înainte de
 * extract pentru a respinge fișiere suspecte.
 */

export type DetectedFileType =
  | "pdf"
  | "docx"
  | "jpeg"
  | "png"
  | "webp"
  | "unknown";

export function detectFileTypeFromMagic(bytes: Uint8Array): DetectedFileType {
  if (bytes.length < 8) return "unknown";

  // PDF: %PDF-
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "pdf";
  }

  // DOCX (ZIP-based): PK\x03\x04
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return "docx";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return "unknown";
}

/**
 * Verifică dacă MIME-ul declarat se potrivește cu magic bytes.
 * Returns false dacă există MIME spoofing.
 */
export function verifyMimeType(
  declaredMime: string,
  bytes: Uint8Array,
): boolean {
  const detected = detectFileTypeFromMagic(bytes);
  const declared = declaredMime.toLowerCase();

  if (detected === "pdf") return declared.includes("pdf");
  if (detected === "docx") {
    return (
      declared.includes("wordprocessingml") ||
      declared.includes("docx") ||
      declared.includes("msword") ||
      declared.includes("zip") // legitimate DOCX may be reported as octet-stream
    );
  }
  if (detected === "jpeg") return declared.includes("jpeg") || declared.includes("jpg");
  if (detected === "png") return declared.includes("png");
  if (detected === "webp") return declared.includes("webp");
  return false;
}
