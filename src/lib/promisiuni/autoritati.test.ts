import { describe, it, expect } from "vitest";
import { slugAutoritate, getAutoritati, getAutoritateBySlug } from "./autoritati";
import { PROMISIUNI } from "@/data/promisiuni";

describe("slugAutoritate", () => {
  it("diacritice + spații + caractere speciale", () => {
    expect(slugAutoritate("Rareș Hopincă")).toBe("rares-hopinca");
    expect(slugAutoritate("CNAIR / DRDP Cluj")).toBe("cnair-drdp-cluj");
    expect(slugAutoritate("Primăria Municipiului Iași")).toBe("primaria-municipiului-iasi");
    expect(slugAutoritate("Robert Negoiță")).toBe("robert-negoita");
  });

  it("slugurile tuturor autorităților din seed sunt unice și URL-safe", () => {
    const slugs = getAutoritati().map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("getAutoritati", () => {
  it("grupează corect + sortează după nr. promisiuni", () => {
    const auts = getAutoritati();
    expect(auts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < auts.length; i++) {
      expect(auts[i - 1]!.items.length).toBeGreaterThanOrEqual(auts[i]!.items.length);
    }
    // suma item-urilor = totalul promisiunilor
    expect(auts.reduce((s, a) => s + a.items.length, 0)).toBe(PROMISIUNI.length);
  });

  it("promisiunile fiecărui profil sunt sortate de la cele mai noi", () => {
    for (const a of getAutoritati()) {
      for (let i = 1; i < a.items.length; i++) {
        expect(a.items[i - 1]!.dataSursa >= a.items[i]!.dataSursa).toBe(true);
      }
    }
  });

  it("inițialele pentru persoane = prenume+nume; lookup pe slug merge", () => {
    const negoita = getAutoritateBySlug("robert-negoita");
    expect(negoita).not.toBeNull();
    expect(negoita!.initiale).toBe("RN");
    expect(getAutoritateBySlug("nu-exista")).toBeNull();
  });
});
