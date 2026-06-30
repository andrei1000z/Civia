import { describe, it, expect } from "vitest";
import { tokenSimilarity, haversineMeters, isDuplicate, findDuplicate } from "./dedup";

// Texte reale din incidentul 2026-06-29 (parcare Știrbei Vodă, #98/#99/#100).
const STIRBEI = { lat: 44.4445, lng: 26.0827 };
const desc99 = "Lipsa amenajării parcării pe Strada Știrbei Vodă, între Calea Plevnei și Strada Berzei, afectează traficul și siguranța pietonilor.";
const desc100 = desc99; // clonă identică
const desc98 = "Este necesară amenajarea unei parcări pe Strada Știrbei Vodă 164 și pe tronsonul situat între Strada Berzei și Calea Plevnei, acolo unde este posibil.";

describe("tokenSimilarity", () => {
  it("identical text → 1", () => {
    expect(tokenSimilarity(desc99, desc100)).toBe(1);
  });
  it("texte fără legătură → mic", () => {
    expect(tokenSimilarity("groapă mare în asfalt", "câine fără stăpân în parc")).toBeLessThan(0.15);
  });
  it("gol → 0", () => {
    expect(tokenSimilarity("", "ceva")).toBe(0);
    expect(tokenSimilarity(null, undefined)).toBe(0);
  });
});

describe("haversineMeters", () => {
  it("același punct → 0", () => {
    expect(haversineMeters(STIRBEI.lat, STIRBEI.lng, STIRBEI.lat, STIRBEI.lng)).toBeCloseTo(0, 1);
  });
  it("~111m pe 0.001° latitudine", () => {
    const d = haversineMeters(44.444, 26.082, 44.445, 26.082);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe("isDuplicate", () => {
  const t99 = { ...STIRBEI, titlu: "Amenajare parcare pe Strada Știrbei Vodă", descriere: desc99 };

  it("CLONĂ identică (acel #99 vs #100) → blocat, chiar și fără coords", () => {
    expect(isDuplicate({ lat: null, lng: null, titlu: t99.titlu, descriere: desc99 }, { code: "00100", lat: null, lng: null, titlu: t99.titlu, descriere: desc100 })).toBe(true);
  });

  it("rescriere la aceeași adresă (#98 vs #99) → blocat (aproape + titlu similar)", () => {
    expect(isDuplicate(t99, { code: "00098", lat: STIRBEI.lat, lng: STIRBEI.lng, titlu: "Amenajare parcare pe Știrbei Vodă", descriere: desc98 })).toBe(true);
  });

  it("problemă DIFERITĂ în aceeași zonă, text diferit → NU blocat", () => {
    const altParcare = { code: "00200", lat: STIRBEI.lat, lng: STIRBEI.lng, titlu: "Mașini parcate pe trecerea de pietoni", descriere: "Autovehicule staționează constant pe trecerea de pietoni de lângă școală, blocând vizibilitatea copiilor." };
    expect(isDuplicate(t99, altParcare)).toBe(false);
  });

  it("text similar dar DEPARTE (>150m) și nu clonă → NU blocat", () => {
    const farSlightlySimilar = { code: "00300", lat: 44.460, lng: 26.060, titlu: "Parcare necesară pe altă stradă", descriere: "Ar trebui amenajate locuri de parcare pe o stradă din alt cartier, lângă piață." };
    expect(isDuplicate(t99, farSlightlySimilar)).toBe(false);
  });
});

describe("findDuplicate", () => {
  it("returnează codul primului duplicat", () => {
    const t = { lat: STIRBEI.lat, lng: STIRBEI.lng, titlu: "Amenajare parcare pe Strada Știrbei Vodă", descriere: desc99 };
    const code = findDuplicate(t, [
      { code: "00050", lat: 44.40, lng: 26.10, titlu: "Altceva", descriere: "groapă în asfalt pe bulevard" },
      { code: "00099", lat: STIRBEI.lat, lng: STIRBEI.lng, titlu: t.titlu, descriere: desc100 },
    ]);
    expect(code).toBe("00099");
  });
  it("listă fără duplicat → null", () => {
    expect(findDuplicate({ lat: STIRBEI.lat, lng: STIRBEI.lng, titlu: "X", descriere: "ceva unic complet diferit aici" }, [])).toBeNull();
  });
});
