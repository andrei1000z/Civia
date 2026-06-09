import { describe, it, expect } from "vitest";
import { isWinbackEligible } from "./winback";

describe("isWinbackEligible — chaser a-doua-acțiune (48h)", () => {
  const fresh = { sesizari: 1, comments: 0, cosigners: 0 };

  it("eligibil: o singură sesizare, zero alte acțiuni, consimțit", () => {
    expect(isWinbackEligible(fresh, true)).toBe(true);
  });

  it("NU trimitem fără consimțământ (GDPR), oricât de inactiv ar fi", () => {
    expect(isWinbackEligible(fresh, false)).toBe(false);
  });

  it("NU trimitem dacă a comentat (a doua acțiune deja făcută)", () => {
    expect(isWinbackEligible({ sesizari: 1, comments: 1, cosigners: 0 }, true)).toBe(false);
  });

  it("NU trimitem dacă a co-semnat altă sesizare", () => {
    expect(isWinbackEligible({ sesizari: 1, comments: 0, cosigners: 1 }, true)).toBe(false);
  });

  it("NU trimitem dacă are 2+ sesizări (deja e activ)", () => {
    expect(isWinbackEligible({ sesizari: 2, comments: 0, cosigners: 0 }, true)).toBe(false);
  });

  it("caz absurd 0 sesizări (nu ar trebui să ajungă aici) → nu eligibil", () => {
    expect(isWinbackEligible({ sesizari: 0, comments: 0, cosigners: 0 }, true)).toBe(false);
  });
});
