import { describe, it, expect } from "vitest";
import { primari, consiliiGenerale } from "./primari";
import { evenimente } from "./evenimente";
import { evenimenteDetails } from "./evenimente-detail";
import { bilete, linii } from "./bilete";
import { ghiduri } from "./ghiduri";
import { DIRECTII, COMPANII, GLOSAR } from "./pmb-structura";
import { SURSE } from "./surse-statistici";

describe("Data integrity", () => {
  describe("primari", () => {
    it("has at least 8 mayors since 1990", () => {
      expect(primari.length).toBeGreaterThanOrEqual(8);
    });
    it("all have required fields", () => {
      for (const p of primari) {
        expect(p.id).toBeTruthy();
        expect(p.nume).toBeTruthy();
        expect(p.partid).toBeTruthy();
        expect(p.anInceput).toBeGreaterThan(1989);
        expect(p.rating).toBeGreaterThanOrEqual(0);
        expect(p.rating).toBeLessThanOrEqual(5);
      }
    });
    it("all have at least 1 realizare and 1 controversa", () => {
      for (const p of primari) {
        expect(p.realizari.length).toBeGreaterThan(0);
        expect(p.controverse.length).toBeGreaterThan(0);
      }
    });
  });

  describe("consiliiGenerale", () => {
    it("compositions sum to 100%", () => {
      for (const cg of consiliiGenerale) {
        const total = cg.compozitie.reduce((sum, c) => sum + c.procent, 0);
        expect(total).toBe(100);
      }
    });
  });

  describe("evenimente", () => {
    it("has at least 12 events", () => {
      expect(evenimente.length).toBeGreaterThanOrEqual(12);
    });
    it("all have unique slugs", () => {
      const slugs = new Set(evenimente.map((e) => e.slug));
      expect(slugs.size).toBe(evenimente.length);
    });
  });

  describe("evenimenteDetails", () => {
    it("has detail for major events", () => {
      expect(evenimenteDetails["rahova-2025"]).toBeDefined();
      expect(evenimenteDetails["colectiv-2015"]).toBeDefined();
      expect(evenimenteDetails["cutremur-1977"]).toBeDefined();
    });
    it("details have coords within Romania bounds", () => {
      for (const [, d] of Object.entries(evenimenteDetails)) {
        expect(d.coords[0]).toBeGreaterThan(43.5);
        expect(d.coords[0]).toBeLessThan(48.3);
        expect(d.coords[1]).toBeGreaterThan(20.2);
        expect(d.coords[1]).toBeLessThan(30.0);
      }
    });
  });

  describe("bilete", () => {
    it("has tickets for STB, Metrorex, Ilfov", () => {
      const operators = new Set(bilete.map((b) => b.operator));
      expect(operators.has("stb")).toBe(true);
      expect(operators.has("metrorex")).toBe(true);
      expect(operators.has("ilfov")).toBe(true);
    });
    it("has standard 3 lei single tickets", () => {
      const stbSingle = bilete.find((b) => b.operator === "stb" && b.pret === 3);
      expect(stbSingle).toBeDefined();
    });
  });

  describe("linii STB", () => {
    it("has at least 10 lines", () => {
      expect(linii.length).toBeGreaterThanOrEqual(10);
    });
    it("all have traseu with multiple stops", () => {
      for (const l of linii) {
        expect(l.traseu.length).toBeGreaterThan(1);
      }
    });
  });

  describe("ghiduri", () => {
    it("has at least 6 guides", () => {
      expect(ghiduri.length).toBeGreaterThanOrEqual(6);
    });
    it("all have unique slugs", () => {
      const slugs = new Set(ghiduri.map((g) => g.slug));
      expect(slugs.size).toBe(ghiduri.length);
    });
  });

  describe("PMB structure", () => {
    it("has at least 8 directions", () => {
      expect(DIRECTII.length).toBeGreaterThanOrEqual(8);
    });
    it("has municipal companies including STB", () => {
      expect(COMPANII.some((c) => c.name.includes("STB"))).toBe(true);
    });
    it("glosar has essential abbreviations", () => {
      const forms = GLOSAR.map((g) => g.shortForm);
      expect(forms).toContain("HCL");
      expect(forms).toContain("PUG");
    });
  });

  describe("sources", () => {
    it("has a source for each domain", () => {
      expect(SURSE["drpciv-accidente"]).toBeDefined();
      expect(SURSE["calitate-aer"]).toBeDefined();
      expect(SURSE["stb-raport"]).toBeDefined();
    });
    it("all sources have URL", () => {
      for (const [, s] of Object.entries(SURSE)) {
        expect(s.url).toBeTruthy();
        expect(s.publisher).toBeTruthy();
      }
    });
  });
});
