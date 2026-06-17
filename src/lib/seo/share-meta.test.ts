import { describe, it, expect } from "vitest";
import { ogTitle, ogDescription } from "./share-meta";

describe("share-meta — trunchiere OG/Twitter", () => {
  it("titlu scurt → neschimbat", () => {
    expect(ogTitle("Lucrări la stradă")).toBe("Lucrări la stradă");
  });

  it("titlu lung → trunchiat la ~65 cu elipsă, la graniță de cuvânt", () => {
    const long =
      "Viteză excesivă a șoferilor la intersecția Bulevardului Uverturii cu Strada Ajustorului";
    const out = ogTitle(long);
    expect(out.length).toBeLessThanOrEqual(66); // 65 + „…"
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/); // fără spațiu înainte de elipsă
    expect(long.startsWith(out.slice(0, -1).trim())).toBe(true); // prefix din original
  });

  it("nu lasă punctuație lipită de elipsă", () => {
    const out = ogTitle("Cuvânt unu, cuvânt doi, cuvânt trei foarte foarte foarte foarte lung aici", 30);
    expect(out).not.toMatch(/[\s.,;:–—-]…$/);
  });

  it("descriere de 200 caractere → ≤156", () => {
    const d = "x".repeat(200);
    const out = ogDescription(d);
    expect(out.length).toBeLessThanOrEqual(156);
  });

  it("normalizează whitespace-ul", () => {
    expect(ogTitle("a   b\n\nc")).toBe("a b c");
  });

  it("limita exactă → fără elipsă", () => {
    const exactly = "a".repeat(65);
    expect(ogTitle(exactly)).toBe(exactly);
  });
});
