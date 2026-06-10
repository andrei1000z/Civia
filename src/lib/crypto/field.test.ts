import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptField, decryptField, isEncrypted } from "./field";

// cheie de test (32 bytes base64)
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("field encryption", () => {
  beforeEach(() => { process.env.FIELD_ENCRYPTION_KEY = TEST_KEY; });
  afterEach(() => { delete process.env.FIELD_ENCRYPTION_KEY; });

  it("round-trip: encrypt → decrypt întoarce originalul", () => {
    const plain = "Strada Mihai Bravu 122, Sector 2, București";
    const enc = encryptField(plain)!;
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("Mihai Bravu"); // textul nu apare în cifru
    expect(decryptField(enc)).toBe(plain);
  });

  it("diacritice UTF-8 corecte", () => {
    const plain = "Șoseaua Ștefan cel Mare nr. 1, Iași";
    expect(decryptField(encryptField(plain))).toBe(plain);
  });

  it("două criptări ale aceluiași text diferă (IV aleator)", () => {
    const a = encryptField("test")!;
    const b = encryptField("test")!;
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe(decryptField(b));
  });

  it("null/empty → passthrough, nu se criptează", () => {
    expect(encryptField(null)).toBe(null);
    expect(encryptField("")).toBe(null);
    expect(decryptField(null)).toBe(null);
  });

  it("idempotent: nu re-criptează un text deja criptat", () => {
    const enc = encryptField("x")!;
    expect(encryptField(enc)).toBe(enc);
  });

  it("text simplu legacy (fără prefix) → passthrough la decrypt", () => {
    expect(decryptField("adresă veche necriptată")).toBe("adresă veche necriptată");
  });

  it("date manipulate/corupte → null (GCM detectează)", () => {
    const enc = encryptField("secret")!;
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(decryptField(tampered)).toBe(null);
  });

  it("fără cheie: encrypt e passthrough (rollout gradual)", () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(encryptField("adresa")).toBe("adresa");
  });

  it("fără cheie: date criptate → null (nu aruncă)", () => {
    const enc = encryptField("secret")!; // cu cheie
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(decryptField(enc)).toBe(null);
  });

  it("cheie de lungime greșită → tratată ca lipsă (passthrough)", () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(encryptField("adresa")).toBe("adresa");
  });
});
