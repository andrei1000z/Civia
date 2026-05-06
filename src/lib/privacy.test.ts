import { describe, it, expect } from "vitest";
import { stripPrivateAddress, stripForPreview } from "./privacy";

describe("stripPrivateAddress", () => {
  it("redacts address between 'domiciliat în' and ', mă adresez'", () => {
    const input = "Subsemnatul Ion Popescu, domiciliat în Str. Țintașului 17, ap 14, mă adresez prin prezenta...";
    const r = stripPrivateAddress(input);
    expect(r).toContain("[adresă ascunsă]");
    expect(r).not.toContain("Țintașului");
    expect(r).not.toContain("17");
    // name redacted with hideName=true (defense-in-depth: page already passes
    // through repository scrub, which sets hideName=true for non-owners).
    expect(r).toContain("Cetățean anonim");
  });

  it("redacts feminine 'domiciliată'", () => {
    const r = stripPrivateAddress("Subsemnata Maria, domiciliată în Calea Victoriei 1, mă adresez...");
    expect(r).toContain("[adresă ascunsă]");
    expect(r).not.toContain("Victoriei");
  });

  it("handles 'domiciliat(ă)' with parentheses (gender-neutral)", () => {
    const r = stripPrivateAddress("Subsemnatul X, domiciliat(ă) în Str. Test 1, mă adresez...");
    expect(r).toContain("[adresă ascunsă]");
  });

  it("falls back to period-terminated pattern if 'mă adresez' missing", () => {
    const input = "Domiciliat în Str. Test 5, ap 2, București.";
    const r = stripPrivateAddress(input);
    expect(r).toContain("[adresă ascunsă]");
    expect(r).not.toContain("Test 5");
  });

  it("redacts Romanian phone numbers (+40, 07xx formats)", () => {
    expect(stripPrivateAddress("Sun-mă la +40 712 345 678 sau")).toContain("[telefon protejat]");
    expect(stripPrivateAddress("la 0712.345.678 vă rog")).toContain("[telefon protejat]");
    expect(stripPrivateAddress("la 0712-345-678 vă rog")).toContain("[telefon protejat]");
    expect(stripPrivateAddress("la 0712345678 vă rog")).toContain("[telefon protejat]");
  });

  it("redacts emails", () => {
    const r = stripPrivateAddress("Trimite la ion.popescu@example.com confirmare.");
    expect(r).toContain("[email protejat]");
    expect(r).not.toContain("ion.popescu@example.com");
  });

  it("redacts emails with plus sign and dots", () => {
    const r = stripPrivateAddress("user.name+tag@sub.example.co");
    expect(r).toContain("[email protejat]");
  });

  it("returns empty string for empty input", () => {
    expect(stripPrivateAddress("")).toBe("");
  });

  it("returns same text when no PII patterns match", () => {
    const text = "Acesta este un text fără date personale.";
    expect(stripPrivateAddress(text)).toBe(text);
  });

  it("redacts multiple emails in one text", () => {
    const r = stripPrivateAddress("Contact: a@a.ro și b@b.ro pentru info.");
    expect((r.match(/\[email protejat\]/g) ?? []).length).toBe(2);
  });
});

describe("stripForPreview", () => {
  it("extracts the 'Vă aduc la cunoștință' paragraph", () => {
    const formal = `Subsemnatul Ion, domiciliat în X, mă adresez:

Vă aduc la cunoștință că pe Strada Y există o groapă mare de aproximativ 2m.

Vă propun să trimiteți o echipă.

Cu respect,
Ion`;
    const r = stripForPreview(formal);
    expect(r).toContain("Vă aduc la cunoștință");
    expect(r).toContain("groapă");
    expect(r).not.toContain("Subsemnatul Ion");
    expect(r).not.toContain("Cu respect");
  });

  it("falls back to third paragraph when 'Vă aduc la cunoștință' missing", () => {
    const formal = `Subsemnatul.

Domiciliat.

Acesta e paragraful 3 cu detalii.`;
    const r = stripForPreview(formal);
    expect(r).toContain("paragraful 3");
  });

  it("ultimate fallback: strips PII from first 200 chars", () => {
    const r = stripForPreview("Single paragraph with email a@b.ro and phone 0712345678.");
    expect(r).toContain("[email protejat]");
    expect(r).toContain("[telefon protejat]");
  });

  it("returns empty string for empty input", () => {
    expect(stripForPreview("")).toBe("");
  });

  it("collapses multi-line text to single line in extracted paragraph", () => {
    const formal = `Vă aduc la cunoștință
că situația
e gravă.

Vă propun:`;
    const r = stripForPreview(formal);
    expect(r).not.toMatch(/\n/);
    expect(r).toContain("situația");
  });
});
