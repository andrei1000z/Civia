import { describe, it, expect } from "vitest";
import { normalizeCounty, countyName, countySlug, areaLabel, sectorFromLocality } from "./subscriptions";

describe("normalizeCounty — slug SAU id → id UPPERCASE canonic", () => {
  it("acceptă slug minuscul", () => {
    expect(normalizeCounty("cj")).toBe("CJ");
    expect(normalizeCounty("b")).toBe("B");
  });
  it("acceptă id uppercase deja canonic", () => {
    expect(normalizeCounty("CJ")).toBe("CJ");
    expect(normalizeCounty("TM")).toBe("TM");
  });
  it("acceptă mixt/spații", () => {
    expect(normalizeCounty("  Cj  ")).toBe("CJ");
  });
  it("respinge gunoi / județ inexistent", () => {
    expect(normalizeCounty("XX")).toBeNull();
    expect(normalizeCounty("")).toBeNull();
    expect(normalizeCounty(null)).toBeNull();
    expect(normalizeCounty("'; DROP")).toBeNull();
  });
});

describe("areaLabel — etichetă umană", () => {
  it("județ fără localitate", () => {
    expect(areaLabel({ county: "CJ" })).toBe("județul Cluj");
  });
  it("București fără localitate = numele capitalei, nu „județul București”", () => {
    expect(areaLabel({ county: "B" })).toBe("București");
  });
  it("localitate + județ", () => {
    expect(areaLabel({ county: "CJ", locality: "Cluj-Napoca" })).toBe("Cluj-Napoca, Cluj");
  });
  it("sector București nu se dublează cu „București”", () => {
    expect(areaLabel({ county: "B", locality: "Sector 3" })).toBe("Sector 3");
  });
});

describe("sectorFromLocality — filtrare precisă pe sector", () => {
  it("extrage codul sectorului", () => {
    expect(sectorFromLocality("Sector 3")).toBe("S3");
    expect(sectorFromLocality("sector 6")).toBe("S6");
  });
  it("null pentru localitate non-sector", () => {
    expect(sectorFromLocality("Cluj-Napoca")).toBeNull();
    expect(sectorFromLocality(null)).toBeNull();
  });
});

describe("countyName / countySlug", () => {
  it("mapează id la nume + slug", () => {
    expect(countyName("CJ")).toBe("Cluj");
    expect(countySlug("CJ")).toBe("cj");
    expect(countyName("B")).toBe("București");
  });
});
