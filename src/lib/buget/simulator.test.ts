import { describe, it, expect } from "vitest";
import { getCategoriiSimulator, compara, echilibreazaLa100, shareText } from "./simulator";

describe("getCategoriiSimulator", () => {
  it("procentele reale însumează 100", () => {
    const cats = getCategoriiSimulator();
    expect(cats.reduce((s, c) => s + c.realPct, 0)).toBe(100);
    expect(cats.length).toBeGreaterThanOrEqual(8);
  });
});

describe("compara", () => {
  it("alocare identică → similaritate 100, delta 0 peste tot", () => {
    const cats = getCategoriiSimulator();
    const user = Object.fromEntries(cats.map((c) => [c.key, c.realPct]));
    const r = compara(user, cats);
    expect(r.similaritate).toBe(100);
    expect(r.perCategorie.every((c) => c.delta === 0)).toBe(true);
  });

  it("alocare total opusă → similaritate scăzută + diferența maximă corectă", () => {
    const cats = getCategoriiSimulator();
    // totul pe sănătate (realPct 8) → delta uriaș
    const user = Object.fromEntries(cats.map((c) => [c.key, c.key === "sanatate" ? 100 : 0]));
    const r = compara(user, cats);
    expect(r.similaritate).toBeLessThan(20);
    expect(r.ceaMaiMareDiferenta?.key).toBe("sanatate");
    expect(r.ceaMaiMareDiferenta?.delta).toBe(92);
  });
});

describe("echilibreazaLa100", () => {
  const keys = ["a", "b", "c"];
  it("scalează proporțional la sumă exact 100", () => {
    const out = echilibreazaLa100({ a: 10, b: 30, c: 20 }, keys);
    expect(out.a! + out.b! + out.c!).toBe(100);
    expect(out.b).toBeGreaterThan(out.c!);
  });
  it("toate zero → distribuție uniformă cu suma 100", () => {
    const out = echilibreazaLa100({}, keys);
    expect(out.a! + out.b! + out.c!).toBe(100);
  });
});

describe("shareText", () => {
  it("conține diferența personală + link", () => {
    const cats = getCategoriiSimulator();
    const user = Object.fromEntries(cats.map((c) => [c.key, c.key === "invatamant" ? c.realPct + 20 : c.realPct]));
    const t = shareText(compara(user, cats));
    expect(t).toContain("învățământ");
    expect(t).toContain("civia.ro/bugetare-participativa/simulator");
  });
});
