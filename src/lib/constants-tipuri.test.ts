import { describe, it, expect } from "vitest";
import { SESIZARE_TIPURI, SESIZARE_TIPURI_ACTIVE } from "./constants";

describe("SESIZARE_TIPURI", () => {
  it("contine altele ca fallback", () => {
    const altele = SESIZARE_TIPURI.find((t) => t.value === "altele");
    expect(altele).toBeDefined();
    expect(altele?.active).toBe(true);
  });

  it("contine noile tipuri propuse: banda_transport, trecere_pietoni, rampa_acces, colectare_selectiva", () => {
    const newTypes = ["banda_transport", "trecere_pietoni", "semaforizare", "parcare_trasata", "rampa_acces", "colectare_selectiva"];
    for (const t of newTypes) {
      const found = SESIZARE_TIPURI.find((x) => x.value === t);
      expect(found, `tip ${t} lipseste`).toBeDefined();
      expect(found?.active).toBe(true);
    }
  });

  it("pastreaza tipurile deprecated (pietonal, zgomot) pentru backwards-compat", () => {
    const legacy = ["pietonal", "zgomot"];
    for (const t of legacy) {
      const found = SESIZARE_TIPURI.find((x) => x.value === t);
      expect(found, `tip legacy ${t} lipseste din enum`).toBeDefined();
      expect(found?.active, `tip ${t} trebuie sa fie active:false`).toBe(false);
    }
    // 2026-06-14 — „animale" (protecția animalelor) a fost ACTIVAT, nu mai e deprecated.
    const animale = SESIZARE_TIPURI.find((x) => x.value === "animale");
    expect(animale?.active, "animale trebuie sa fie active:true acum").toBe(true);
  });

  it("SESIZARE_TIPURI_ACTIVE NU contine tipurile deprecated", () => {
    const legacy = ["pietonal", "zgomot"];
    for (const t of legacy) {
      const found = SESIZARE_TIPURI_ACTIVE.find((x) => x.value === t);
      expect(found, `tip deprecated ${t} apare in SESIZARE_TIPURI_ACTIVE!`).toBeUndefined();
    }
  });

  it("SESIZARE_TIPURI_ACTIVE contine noile tipuri", () => {
    const newTypes = ["banda_transport", "trecere_pietoni", "semaforizare", "parcare_trasata", "rampa_acces", "colectare_selectiva"];
    for (const t of newTypes) {
      const found = SESIZARE_TIPURI_ACTIVE.find((x) => x.value === t);
      expect(found, `tip ${t} lipseste din SESIZARE_TIPURI_ACTIVE`).toBeDefined();
    }
  });

  it("toate tipurile au icon + label + short", () => {
    for (const t of SESIZARE_TIPURI) {
      expect(t.icon).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.short).toBeTruthy();
      expect(t.value).toMatch(/^[a-z_]+$/);
    }
  });
});
