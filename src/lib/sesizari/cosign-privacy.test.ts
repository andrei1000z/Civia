/**
 * Privacy guard tests pentru pipeline-ul de cosigners.
 *
 * Bug raportat 5/19/2026: pagina publica afisa nume complet + adresa
 * pentru cosigners („Eduard Andrei Mușat · Strada Exemplu 12, Sector 5"),
 * leaked prin GET /api/sesizari/[code]/cosign.
 *
 * Fix in 2 straturi (defense-in-depth):
 *  1. extractLocality() — sterge strada/nr inainte de POST (client).
 *  2. publicAuthorName() — primul cuvant DOAR la GET (server).
 *
 * Aceste teste blocheaza regresia.
 */

import { describe, it, expect } from "vitest";
import { publicAuthorName } from "./display-name";
import { extractLocality } from "./extract-locality";

describe("cosign privacy guards (defense-in-depth)", () => {
  describe("publicAuthorName — server-side scrub", () => {
    it("CRITIC: nume complet → DOAR primul cuvant (bug 5/19/2026)", () => {
      expect(publicAuthorName({ author_name: "Eduard Andrei Mușat" })).toBe("Eduard");
      expect(publicAuthorName({ author_name: "Ion Popescu" })).toBe("Ion");
      expect(publicAuthorName({ author_name: "Maria-Elena Ionescu Stan" })).toBe("Maria-Elena");
    });

    it("display_name (din profil) ia prioritate fata de author_name", () => {
      expect(
        publicAuthorName({
          display_name: "Andrei",
          author_name: "Eduard Andrei Mușat",
        }),
      ).toBe("Andrei");
    });

    it("fallback la 'Cetățean' daca lipsesc ambele", () => {
      expect(publicAuthorName({})).toBe("Cetățean");
      expect(publicAuthorName({ author_name: null, display_name: null })).toBe("Cetățean");
      expect(publicAuthorName({ author_name: "" })).toBe("Cetățean");
    });
  });

  describe("extractLocality — client-side scrub inainte de POST", () => {
    it("CRITIC: strada + nr NU mai pleaca catre server", () => {
      // Inainte de fix, „city: data.address" trimitea adresa complet.
      // Acum extractLocality intoarce DOAR localitatea/sectorul.
      const safe = extractLocality("Strada Exemplu 12, Sector 5");
      expect(safe).not.toMatch(/Exemplu/i);
      expect(safe).not.toMatch(/\b12\b/);
      expect(safe).toBe("Sector 5");
    });

    it("CRITIC: input ambiguu (doar strada, fara oras) → null (nu inventeaza)", () => {
      expect(extractLocality("Aleea Florilor 22")).toBeNull();
      expect(extractLocality("Strada Necunoscuta 999")).toBeNull();
    });
  });

  describe("pipeline integrat (extract + publicAuthorName)", () => {
    it("CRITIC: scenariu exact bug 00041 → output curat", () => {
      const userInputName = "Eduard Andrei Mușat";
      const userInputAddress = "Strada Exemplu 12, Sector 5";
      // 1. Client filtreaza adresa inainte de POST
      const cityForServer = extractLocality(userInputAddress);
      // 2. Server intoarce la GET doar primul nume
      const displayName = publicAuthorName({ author_name: userInputName });
      // Verificam ca output-ul public NU contine niciun PII problematic.
      expect(displayName).toBe("Eduard");
      expect(cityForServer).toBe("Sector 5");
      // Asamblat — exact ce se afiseaza in CosignersBadge.
      const publicDisplay = `${displayName} · ${cityForServer ?? ""}`.trim();
      expect(publicDisplay).not.toMatch(/Andrei/);
      expect(publicDisplay).not.toMatch(/Mușat/);
      expect(publicDisplay).not.toMatch(/Exemplu/);
      expect(publicDisplay).not.toMatch(/\b12\b/);
      expect(publicDisplay).toBe("Eduard · Sector 5");
    });
  });
});
