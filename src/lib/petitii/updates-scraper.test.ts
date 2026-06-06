import { describe, it, expect } from "vitest";
import { extractSignatureCount, canScrapeUpdates } from "./updates-scraper";

describe("extractSignatureCount", () => {
  it("extrage din structura reală Declic (.petition-signatures plus .number)", () => {
    // Structura reală: numărul curent în .number, target în .strong.
    const html = `
      <div class="petition-signatures">
        <span class="number">14.113</span>
        din
        <span class="strong">15.000</span>
        Semnături
      </div>`;
    // Trebuie să ia 14.113 (curent), NU 15.000 (target).
    expect(extractSignatureCount(html)).toBe(14113);
  });

  it("extrage numar urmat de cuvantul semnaturi, cu separator de mii RO", () => {
    expect(extractSignatureCount("<p>8.452 de semnături strânse</p>")).toBe(8452);
    expect(extractSignatureCount("Au fost strânse 1.234 semnături.")).toBe(1234);
  });

  it("extrage sustinatori", () => {
    expect(extractSignatureCount("<span>2.500 de susținători</span>")).toBe(2500);
  });

  it("extrage numar oameni au semnat", () => {
    expect(extractSignatureCount("<p>3.001 de oameni au semnat petiția</p>")).toBe(3001);
  });

  it("extrage formatul englez signatures", () => {
    expect(extractSignatureCount('<div class="signatures"> <span class="number">9.876</span></div>')).toBe(9876);
  });

  it("returneaza null cand nu exista numar relevant", () => {
    expect(extractSignatureCount("<p>fără cifre relevante aici</p>")).toBeNull();
    expect(extractSignatureCount("")).toBeNull();
  });

  it("ignora numere prea mici (sub 100, probabil zgomot/anul)", () => {
    expect(extractSignatureCount("<p>12 semnături</p>")).toBeNull();
  });
});

describe("canScrapeUpdates", () => {
  it("accepta doar domenii Declic", () => {
    expect(canScrapeUpdates("https://campaniamea.declic.ro/efforts/x")).toBe(true);
    expect(canScrapeUpdates("https://www.declic.ro/p/y")).toBe(true);
    expect(canScrapeUpdates("https://secure.avaaz.org/z")).toBe(false);
    expect(canScrapeUpdates(null)).toBe(false);
    expect(canScrapeUpdates("")).toBe(false);
  });
});
