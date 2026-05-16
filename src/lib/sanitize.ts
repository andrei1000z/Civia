// Lightweight HTML sanitizer — strips all tags + dangerous URL schemes

/** Escape HTML entities for safe interpolation into HTML templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeText(input: string, maxLength = 2000): string {
  if (!input) return "";
  return input
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, "") // Strip all HTML tags
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

// Verify PDF magic number — `%PDF-` followed by version digits.
export async function isValidPdf(file: File): Promise<boolean> {
  if (file.size === 0 || file.size > 15 * 1024 * 1024) return false;
  const buf = await file.slice(0, 5).arrayBuffer();
  const bytes = new Uint8Array(buf);
  // %PDF-  → 25 50 44 46 2D
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

// Verify image file magic numbers (first bytes)
// Hard upper bound: 12 MB pentru cazul AftermathForm care permite pre-compress
// pana la 10 MB. Server-side handlers verifica si limita MAX_UPLOAD_BYTES (5 MB)
// pentru sesizari, dar isValidImage e folosit si pe alte paths.
export async function isValidImage(file: File): Promise<boolean> {
  if (file.size === 0 || file.size > 12 * 1024 * 1024) return false;
  const buf = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buf);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return true;

  return false;
}
