import { describe, it, expect } from "vitest";
import { detectCountyFromLocatie } from "./county-from-locatie";

/**
 * 2026-05-26 — Acoperă top 15 orașe + variante cu/fără diacritice.
 * Bug context: sesizare 00049 (Cluj-Napoca) avea county=null → routing
 * default București. Detectorul ăsta închide gap-ul.
 */
describe("detectCountyFromLocatie — top 15 orase", () => {
  // [locatie input, expected county code]
  const cases: Array<[string, string]> = [
    // Bucuresti
    ["Strada Lipscani 1, București", "B"],
    ["Bdul Magheru, Bucuresti", "B"],

    // Cluj-Napoca (bug 00049)
    ["Strada Fabricii, Cluj-Napoca, ...", "CJ"],
    ["str. Fabricii 1-5, cluj napoca", "CJ"], // user typed lowercase
    ["Cluj-Napoca, str. Horea", "CJ"],
    ["Piața Unirii, Cluj", "CJ"],

    // Iași
    ["Bdul Independenței, Iași", "IS"],
    ["str Palat, iasi", "IS"],

    // Timișoara
    ["Piața Victoriei, Timișoara", "TM"],
    ["bdul revolutiei, timisoara", "TM"],

    // Constanța
    ["Bdul Mamaia 124, Constanța", "CT"],
    ["constanta, str Tomis", "CT"],

    // Brașov
    ["Piața Sfatului, Brașov", "BV"],
    ["str Republicii, brasov", "BV"],

    // Craiova
    ["Bdul Carol I, Craiova", "DJ"],

    // Galați
    ["Bdul Galați, Galați", "GL"],
    ["str Domnească, galati", "GL"],

    // Ploiești
    ["str Republicii, Ploiești", "PH"],
    ["ploiesti, bdul independentei", "PH"],

    // Oradea
    ["str Aurel Lazăr, Oradea", "BH"],

    // Brăila
    ["str Mihai Eminescu, Brăila", "BR"],
    ["braila, calea Galati", "BR"],

    // Arad
    ["Bdul Revoluției, Arad", "AR"],

    // Pitești
    ["str Victoriei, Pitești", "AG"],
    ["pitesti, bdul republicii", "AG"],

    // Sibiu
    ["Piața Mare, Sibiu", "SB"],

    // Bacău
    ["str Mărășești, Bacău", "BC"],
    ["bacau, str 9 mai", "BC"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(detectCountyFromLocatie(input)).toBe(expected);
    });
  }
});

describe("detectCountyFromLocatie — edge cases", () => {
  it("returnează null pe string gol", () => {
    expect(detectCountyFromLocatie("")).toBeNull();
    expect(detectCountyFromLocatie(null)).toBeNull();
    expect(detectCountyFromLocatie(undefined)).toBeNull();
    expect(detectCountyFromLocatie("   ")).toBeNull();
  });

  it("returnează null pe text fără oraș/județ", () => {
    expect(detectCountyFromLocatie("Strada X")).toBeNull();
    expect(detectCountyFromLocatie("12345 zip")).toBeNull();
  });

  // 2026-06-10 — regresie: nume de oraș în nume de STRADĂ ≠ localitate.
  // Bug raportat (Mihai, Craiova): „Calea București, Craiova" pleca la PMB.
  it("nu confundă numele orașului din numele străzii cu localitatea", () => {
    // „Calea București" e o stradă din Craiova → DJ, nu B.
    expect(detectCountyFromLocatie("Calea București, Craiova, Dolj")).toBe("DJ");
    expect(detectCountyFromLocatie("Bulevardul București nr. 10, Craiova")).toBe("DJ");
    // „Calea Galați" în Brăila → BR, nu GL.
    expect(detectCountyFromLocatie("Strada Mihai Eminescu, Calea Galați, Brăila")).toBe("BR");
    // București real (precedat de virgulă/sector, nu de prefix de stradă) rămâne B.
    expect(detectCountyFromLocatie("Sector 1, București")).toBe("B");
    expect(detectCountyFromLocatie("Bdul Magheru, București")).toBe("B");
  });

  it("nu match partial — word boundary respectat", () => {
    // „arad\" exact → match
    expect(detectCountyFromLocatie("str X, arad")).toBe("AR");
    // „aradului" — NU match „arad" (word boundary previne)
    expect(detectCountyFromLocatie("strada aradului")).toBeNull();
    expect(detectCountyFromLocatie("aradul mare")).toBeNull();
  });

  it("preferință cuvântul mai lung — „cluj-napoca\" înaintea „cluj\"", () => {
    // Ambele match CJ deci output identic, dar sorted-by-length asigurat.
    expect(detectCountyFromLocatie("Cluj-Napoca, str X")).toBe("CJ");
    expect(detectCountyFromLocatie("Cluj")).toBe("CJ");
  });

  it("acceptă „jud. Cluj\" sau „județul Cluj\"", () => {
    expect(detectCountyFromLocatie("comuna Floreşti, jud. Cluj")).toBe("CJ");
    expect(detectCountyFromLocatie("județul Iași")).toBe("IS");
  });

  it("case-insensitive complet", () => {
    expect(detectCountyFromLocatie("CLUJ-NAPOCA")).toBe("CJ");
    expect(detectCountyFromLocatie("cluj-napoca")).toBe("CJ");
    expect(detectCountyFromLocatie("Cluj-Napoca")).toBe("CJ");
  });

  it("diacritice ignored", () => {
    expect(detectCountyFromLocatie("Iași")).toBe("IS");
    expect(detectCountyFromLocatie("Iasi")).toBe("IS");
    expect(detectCountyFromLocatie("Brașov")).toBe("BV");
    expect(detectCountyFromLocatie("Brasov")).toBe("BV");
    expect(detectCountyFromLocatie("Pitești")).toBe("AG");
    expect(detectCountyFromLocatie("Pitesti")).toBe("AG");
  });
});
