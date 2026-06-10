import { describe, it, expect } from "vitest";
import { PROVOCARI, getProvocareCurenta, monthBounds, monthLabel } from "./provocari";
import { SESIZARE_TIPURI } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";

const VALID_TIPURI = new Set<string>(SESIZARE_TIPURI.map((t) => t.value));
const VALID_COUNTIES = new Set<string>(ALL_COUNTIES.map((c) => c.id));

describe("PROVOCARI — integritate date (contract înghețat)", () => {
  it("fiecare provocare are tip ∈ SESIZARE_TIPURI (altfel count=0 permanent)", () => {
    for (const p of PROVOCARI) {
      expect(VALID_TIPURI.has(p.tip), `provocarea „${p.id}" are tip invalid „${p.tip}"`).toBe(true);
    }
  });

  it("fiecare provocare are county ∈ ALL_COUNTIES (UPPERCASE)", () => {
    for (const p of PROVOCARI) {
      expect(VALID_COUNTIES.has(p.county), `provocarea „${p.id}" are county invalid „${p.county}"`).toBe(true);
      expect(p.county).toBe(p.county.toUpperCase());
    }
  });

  it("month e format YYYY-MM, prag > 0, fără spații în tip/county", () => {
    for (const p of PROVOCARI) {
      expect(p.month).toMatch(/^\d{4}-\d{2}$/);
      expect(p.pragColectiv).toBeGreaterThan(0);
      expect(p.tip).toBe(p.tip.trim());
      expect(p.county).toBe(p.county.trim());
    }
  });

  it("id-urile și slug-urile sunt unice", () => {
    expect(new Set(PROVOCARI.map((p) => p.id)).size).toBe(PROVOCARI.length);
    expect(new Set(PROVOCARI.map((p) => p.slug)).size).toBe(PROVOCARI.length);
    expect(new Set(PROVOCARI.map((p) => p.badge.id)).size).toBe(PROVOCARI.length);
  });

  it("cel mult o provocare per lună (o singură activă)", () => {
    const months = PROVOCARI.map((p) => p.month);
    expect(new Set(months).size).toBe(months.length);
  });
});

describe("provocari — helpere", () => {
  it("getProvocareCurenta întoarce provocarea lunii sau null", () => {
    // Iunie 2026 — provocarea seed există.
    const p = getProvocareCurenta(new Date("2026-06-15T10:00:00Z"));
    expect(p?.month).toBe("2026-06");
    // O lună fără provocare → null.
    expect(getProvocareCurenta(new Date("2030-01-15T10:00:00Z"))).toBeNull();
  });

  it("monthBounds = interval half-open [start, urm.lună) în UTC", () => {
    const { startIso, endIso } = monthBounds("2026-06");
    expect(startIso).toBe("2026-06-01T00:00:00.000Z");
    expect(endIso).toBe("2026-07-01T00:00:00.000Z");
  });

  it("monthBounds trece corect peste anul nou", () => {
    expect(monthBounds("2026-12").endIso).toBe("2027-01-01T00:00:00.000Z");
  });

  it("monthLabel — etichetă RO", () => {
    expect(monthLabel("2026-06")).toContain("2026");
  });
});
