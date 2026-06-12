import { describe, it, expect } from "vitest";
import { buildAdresaBP, MIN_PROPUNERI, MIN_VOTURI_TOTAL } from "./transmitere";

const TOP = [
  { titlu: "Piste de biciclete pe Bd. Basarabia", descriere: "Legătura lipsă între Titan și centru.", categorie: "mobilitate", votes_count: 14 },
  { titlu: "Parc nou în Pantelimon", descriere: "Zona n-are spațiu verde amenajat.", categorie: "spatii-verzi", votes_count: 9 },
  { titlu: "Treceri de pietoni iluminate", descriere: "Pe arterele mari, noaptea.", categorie: "siguranta", votes_count: 7 },
];

describe("buildAdresaBP", () => {
  it("conține temeiul legal + termenul de 30 de zile + transparența", () => {
    const t = buildAdresaBP({ primarie: "Primăria Municipiului București", oras: "București", top: TOP, totalVoturi: 30, data: "1 iulie 2026" });
    expect(t).toContain("OG nr. 27/2002");
    expect(t).toContain("art. 8");
    expect(t).toContain("30 de zile");
    expect(t).toContain("va fi publicat pe civia.ro");
  });

  it("listează topul numerotat cu voturi + categorii umane", () => {
    const t = buildAdresaBP({ primarie: "P", oras: "București", top: TOP, totalVoturi: 30, data: "azi" });
    expect(t).toContain("1. Piste de biciclete pe Bd. Basarabia (Mobilitate, 14 voturi)");
    expect(t).toContain("2. Parc nou în Pantelimon (Spații verzi, 9 voturi)");
    expect(t).toContain("3. Treceri de pietoni iluminate (Siguranță, 7 voturi)");
  });

  it("menționează regula de vot (max 3/utilizator) — onestitate metodologică", () => {
    const t = buildAdresaBP({ primarie: "P", oras: "X", top: TOP, totalVoturi: 30, data: "azi" });
    expect(t).toContain("maximum 3 voturi");
    expect(t).toContain("30 voturi exprimate");
  });

  it("pragurile anti-cameră-goală sunt rezonabile", () => {
    expect(MIN_PROPUNERI).toBeGreaterThanOrEqual(3);
    expect(MIN_VOTURI_TOTAL).toBeGreaterThanOrEqual(10);
  });
});
