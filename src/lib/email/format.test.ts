import { describe, expect, test } from "vitest";
import { buildSalutation, formatRecipientName, sanitizeEmailDisplayName, buildFromHeader } from "./format";

describe("formatRecipientName", () => {
  test("returns first capitalized name when fullName is a real human name", () => {
    expect(formatRecipientName({ fullName: "Ion Popescu" })).toBe("Ion");
    expect(formatRecipientName({ fullName: "Maria-Elena Popescu" })).toBe("Maria-Elena");
  });

  test("normalizes case (ALL CAPS / lowercase → Title Case)", () => {
    expect(formatRecipientName({ fullName: "ION" })).toBe("Ion");
    expect(formatRecipientName({ fullName: "andrei" })).toBe("Andrei");
  });

  test("Romanian diacritics survive case normalization", () => {
    expect(formatRecipientName({ fullName: "ștefan" })).toBe("Ștefan");
    expect(formatRecipientName({ fullName: "țiganu Mihai" })).toBe("Țiganu");
  });

  test("returns null when displayName equals the email local part", () => {
    expect(
      formatRecipientName({
        displayName: "ion.popescu",
        email: "ion.popescu@example.com",
      }),
    ).toBeNull();
  });

  test("returns null when the only candidate has digits in it", () => {
    expect(formatRecipientName({ displayName: "user1000z" })).toBeNull();
    expect(formatRecipientName({ fullName: "user42" })).toBeNull();
  });

  test("returns null for placeholder values", () => {
    expect(formatRecipientName({ displayName: "Cetățean" })).toBeNull();
    expect(formatRecipientName({ fullName: "Cetățean anonim" })).toBeNull();
    expect(formatRecipientName({ displayName: "user" })).toBeNull();
  });

  test("prefers fullName over displayName", () => {
    expect(
      formatRecipientName({ fullName: "Ion Pop", displayName: "user1000z" }),
    ).toBe("Ion");
  });

  test("falls back to displayName when fullName is missing or rejected", () => {
    expect(formatRecipientName({ fullName: null, displayName: "Maria" })).toBe("Maria");
    expect(
      formatRecipientName({ fullName: "user42", displayName: "Andrei" }),
    ).toBe("Andrei");
  });

  test("rejects single-letter or oversized words", () => {
    expect(formatRecipientName({ fullName: "A" })).toBeNull();
    expect(formatRecipientName({ fullName: "x".repeat(35) })).toBeNull();
  });

  test("rejects names that look like emails or URLs (non-letter chars)", () => {
    expect(formatRecipientName({ fullName: "ion@example.com" })).toBeNull();
    expect(formatRecipientName({ fullName: "https://example.com" })).toBeNull();
  });

  test("returns null when both candidates are empty", () => {
    expect(formatRecipientName({})).toBeNull();
    expect(formatRecipientName({ fullName: "  ", displayName: "" })).toBeNull();
  });
});

describe("buildSalutation", () => {
  test('returns "Salut, Ion," with comma when a name is found', () => {
    expect(buildSalutation({ fullName: "Ion Pop" })).toBe("Salut, Ion,");
  });

  test("appends a wave emoji when withEmoji is set", () => {
    expect(buildSalutation({ fullName: "Ion", withEmoji: true })).toBe("Salut, Ion 👋");
  });

  test('returns "Bună!" when no clean name is available', () => {
    expect(
      buildSalutation({
        displayName: "ion.popescu",
        email: "ion.popescu@example.com",
      }),
    ).toBe("Bună!");
  });

  test("never emits Salut + email-local-part", () => {
    const out = buildSalutation({
      displayName: "user1000z",
      email: "user1000z@github.com",
    });
    expect(out).not.toContain("user1000z");
    expect(out).toBe("Bună!");
  });
});

describe("sanitizeEmailDisplayName (RFC 5322 / RFC 2047)", () => {
  test("nume ASCII simplu — neschimbat", () => {
    expect(sanitizeEmailDisplayName("Ion Popescu")).toBe("Ion Popescu");
  });

  test("diacritice → RFC 2047 encoded-word", () => {
    const out = sanitizeEmailDisplayName("Ștefan Mușat");
    expect(out).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(Buffer.from(out.replace(/^=\?UTF-8\?B\?|\?=$/g, ""), "base64").toString("utf8")).toBe("Ștefan Mușat");
  });

  test("anti header-injection: scoate CR/LF", () => {
    const out = sanitizeEmailDisplayName("Ion\r\nBcc: evil@x.com");
    expect(out).not.toMatch(/[\r\n]/);
  });

  test("specials RFC 5322 → quoted-string", () => {
    expect(sanitizeEmailDisplayName("Popescu, Ion")).toBe('"Popescu, Ion"');
  });

  test("buildFromHeader: nume gol → doar email", () => {
    expect(buildFromHeader("", "sesizari@civia.ro")).toBe("sesizari@civia.ro");
    expect(buildFromHeader("Ion", "sesizari@civia.ro")).toBe("Ion <sesizari@civia.ro>");
  });
});
