import { describe, it, expect } from "vitest";
import { SESIZARE_TIPURI, PETITIE_CATEGORII } from "@/lib/constants";
import {
  SESIZARE_TIP_TO_CATEGORIE,
  PETITIE_CATEGORIE_TO_SESIZARE,
  sesizareToPetitieCategorie,
  petitieToSesizareTip,
} from "./chaining";

const VALID_CATEGORII = new Set<string>(PETITIE_CATEGORII.map((c) => c.value));
const VALID_TIPURI = new Set<string>(SESIZARE_TIPURI.map((t) => t.value));

describe("chaining — acoperire completă (contract înghețat)", () => {
  it("fiecare tip din SESIZARE_TIPURI are o intrare în SESIZARE_TIP_TO_CATEGORIE", () => {
    for (const t of SESIZARE_TIPURI) {
      expect(SESIZARE_TIP_TO_CATEGORIE, `lipsește tipul „${t.value}”`).toHaveProperty(t.value);
    }
  });

  it("fiecare categorie din PETITIE_CATEGORII are o intrare în PETITIE_CATEGORIE_TO_SESIZARE", () => {
    for (const c of PETITIE_CATEGORII) {
      expect(PETITIE_CATEGORIE_TO_SESIZARE, `lipsește categoria „${c.value}”`).toHaveProperty(c.value);
    }
  });
});

describe("chaining — validitate referențială", () => {
  it("orice categorie mapată (non-null) e o PETITIE_CATEGORII validă", () => {
    for (const [tip, cat] of Object.entries(SESIZARE_TIP_TO_CATEGORIE)) {
      if (cat !== null) {
        expect(VALID_CATEGORII.has(cat), `tip „${tip}” → categorie inexistentă „${cat}”`).toBe(true);
      }
    }
  });

  it("orice tip mapat (non-null) e un SESIZARE_TIPURI valid", () => {
    for (const [cat, mapped] of Object.entries(PETITIE_CATEGORIE_TO_SESIZARE)) {
      if (mapped !== null) {
        expect(VALID_TIPURI.has(mapped.tip), `categorie „${cat}” → tip inexistent „${mapped.tip}”`).toBe(true);
      }
    }
  });

  it("pitch-urile sunt non-goale și plauzibile", () => {
    for (const mapped of Object.values(PETITIE_CATEGORIE_TO_SESIZARE)) {
      if (mapped !== null) {
        expect(mapped.pitch.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("chaining — helpere", () => {
  it("sesizareToPetitieCategorie mapează corect tipuri reale", () => {
    expect(sesizareToPetitieCategorie("copac")).toBe("Mediu");
    expect(sesizareToPetitieCategorie("rampa_acces")).toBe("Drepturi");
    expect(sesizareToPetitieCategorie("transport")).toBe("Transport");
  });

  it("sesizareToPetitieCategorie întoarce null pe „altele” și pe input gol", () => {
    expect(sesizareToPetitieCategorie("altele")).toBeNull();
    expect(sesizareToPetitieCategorie(null)).toBeNull();
    expect(sesizareToPetitieCategorie(undefined)).toBeNull();
    expect(sesizareToPetitieCategorie("inexistent_xyz")).toBeNull();
  });

  it("petitieToSesizareTip mapează categoriile cu acțiune locală", () => {
    expect(petitieToSesizareTip("Drepturi")?.tip).toBe("rampa_acces");
    expect(petitieToSesizareTip("Locuințe")?.tip).toBe("trotuar");
    expect(petitieToSesizareTip("Mediu")?.tip).toBe("copac");
  });

  it("petitieToSesizareTip ascunde temele pur naționale + input invalid", () => {
    expect(petitieToSesizareTip("Justiție")).toBeNull();
    expect(petitieToSesizareTip("Economie")).toBeNull();
    expect(petitieToSesizareTip("Educație")).toBeNull();
    expect(petitieToSesizareTip(null)).toBeNull();
    expect(petitieToSesizareTip("inexistent")).toBeNull();
  });

  it("regresie: „Drepturi” NU mai e ascunsă (era bug-ul — 38% petiții fără card)", () => {
    expect(petitieToSesizareTip("Drepturi")).not.toBeNull();
  });
});
