import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeText, sanitizeSubject } from "./sanitize";

describe("escapeHtml", () => {
  it("escapes all HTML special characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("escapes ampersand FIRST (avoid double-encoding)", () => {
    expect(escapeHtml("a & b < c")).toBe("a &amp; b &lt; c");
    // Critical: dacă & se escape-uia după <, ai obține &amp;lt; (rupt).
    // Implementarea curentă apelează & primul. Verifică să rămână așa.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("handles single quotes (Romanian text)", () => {
    expect(escapeHtml("L'apostrophe")).toBe("L&#039;apostrophe");
  });

  it("preserves Romanian diacritics (no escape needed)", () => {
    expect(escapeHtml("Cetățean cu diacritice ăâîșț")).toBe("Cetățean cu diacritice ăâîșț");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes attribute-injection attempt", () => {
    const evil = '" onerror="alert(1)"';
    expect(escapeHtml(evil)).toBe("&quot; onerror=&quot;alert(1)&quot;");
  });
});

describe("sanitizeText", () => {
  it("strips all HTML tags", () => {
    expect(sanitizeText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("strips dangerous URL schemes", () => {
    expect(sanitizeText("Click javascript:alert(1)")).toBe("Click alert(1)");
    expect(sanitizeText("Look at vbscript:msgbox()")).toBe("Look at msgbox()");
    expect(sanitizeText("Visit data:text/html,<script>")).toBe("Visit ,");
  });

  it("strips control characters", () => {
    expect(sanitizeText("hello\x00\x07world")).toBe("helloworld");
    expect(sanitizeText("line1\x0Bline2")).toBe("line1line2");
  });

  it("preserves Romanian text and newlines", () => {
    expect(sanitizeText("Salut\nȘefule!")).toBe("Salut\nȘefule!");
  });

  it("trims leading/trailing whitespace", () => {
    expect(sanitizeText("   spațiu   ")).toBe("spațiu");
  });

  it("respects maxLength parameter", () => {
    expect(sanitizeText("a".repeat(100), 10)).toBe("aaaaaaaaaa");
  });

  it("default max is 2000 chars", () => {
    const long = "x".repeat(3000);
    expect(sanitizeText(long).length).toBe(2000);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeText("")).toBe("");
    expect(sanitizeText(null as unknown as string)).toBe("");
  });

  it("strips nested tags", () => {
    expect(sanitizeText("<div><script>alert(1)</script></div>")).toBe("alert(1)");
  });

  it("removes iframe injection", () => {
    expect(sanitizeText("Hello <iframe src=evil.com></iframe>")).toBe("Hello");
  });

  it("preserves emoji and unicode", () => {
    expect(sanitizeText("Hello 👋 🇷🇴 ✓")).toBe("Hello 👋 🇷🇴 ✓");
  });
});

describe("sanitizeSubject", () => {
  it("scoate CR/LF (anti header-injection) și colapsează spațiile", () => {
    expect(sanitizeSubject("Sesizare\r\nBcc: victima@x.ro")).toBe("Sesizare Bcc: victima@x.ro");
    expect(sanitizeSubject("a\n\n\nb")).toBe("a b");
  });

  it("scoate control chars dar păstrează emoji + diacritice", () => {
    expect(sanitizeSubject("✅ Sesizarea \x00ANR\x07-001 înregistrată")).toBe("✅ Sesizarea ANR-001 înregistrată");
    expect(sanitizeSubject("📨 Răspuns oficial — Cod 123")).toBe("📨 Răspuns oficial — Cod 123");
  });

  it("trimează și taie la 200 de caractere", () => {
    expect(sanitizeSubject("   spațiu   ")).toBe("spațiu");
    expect(sanitizeSubject("x".repeat(300)).length).toBe(200);
  });

  it("tratează input gol/null", () => {
    expect(sanitizeSubject("")).toBe("");
    expect(sanitizeSubject(null as unknown as string)).toBe("");
  });
});
