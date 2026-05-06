/**
 * Strip private info (address + name + phones + emails) from a formal
 * text for PUBLIC display.
 *
 * Defense-in-depth: this is called as a final barrier in pages even
 * though repository.ts already scrubs at fetch time. If anything skips
 * the repository scrub (cached row, alternate fetch path, future
 * regression), this catches it.
 *
 * Delegates address+name redaction to `scrubFormalTextForPublic` so
 * there's exactly ONE pattern source of truth. Adds phone/email scrub
 * on top.
 */

import { scrubFormalTextForPublic } from "./sesizari/scrub-public";

export function stripPrivateAddress(text: string, authorName?: string | null): string {
  if (!text) return text;

  // 1. Address + name redaction (handles both "Mă numesc X, locuiesc..."
  //    and legacy "Subsemnatul X, domiciliat în..." openers + signature).
  let result = scrubFormalTextForPublic(text, {
    authorName: authorName ?? null,
    hideName: true,
  });

  // 2. Strip phone numbers (Romanian format)
  result = result.replace(
    /(\+?40|0)\s*7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g,
    "[telefon protejat]"
  );

  // 3. Strip email addresses from body text (but not the signature name)
  result = result.replace(
    /[\w.+-]+@[\w.-]+\.\w{2,}/g,
    "[email protejat]"
  );

  return result;
}

/**
 * Strip private info for short preview (listing cards).
 * More aggressive — shows only the problem description paragraph.
 */
export function stripForPreview(formalText: string): string {
  if (!formalText) return "";

  // Extract the problem paragraph: "Vă aduc la cunoștință ... accidente."
  const match = formalText.match(/Vă aduc la cunoștință([\s\S]*?)(?=Vă propun|Vă mulțumesc|Cu respect|$)/);
  if (match) {
    return match[0].replace(/\n+/g, " ").trim();
  }

  // Fallback: skip first 2 paragraphs, show the rest
  const paragraphs = formalText.split(/\n\n+/);
  if (paragraphs.length > 2 && paragraphs[2]) {
    return paragraphs[2].replace(/\n+/g, " ").trim();
  }

  return stripPrivateAddress(formalText.replace(/\n+/g, " ").slice(0, 200));
}
