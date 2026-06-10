import { describe, it, expect } from "vitest";
import { statusRank, isForwardTransition, isBlockedRegression } from "./state-machine";

describe("state-machine", () => {
  it("rangurile cresc pe progresia ciclului de viață", () => {
    expect(statusRank("nou")).toBeLessThan(statusRank("trimis"));
    expect(statusRank("trimis")).toBeLessThan(statusRank("inregistrata"));
    expect(statusRank("inregistrata")).toBeLessThan(statusRank("in-lucru"));
    expect(statusRank("in-lucru")).toBeLessThan(statusRank("rezolvat"));
  });

  it("isForwardTransition = strict mai avansat", () => {
    expect(isForwardTransition("nou", "trimis")).toBe(true);
    expect(isForwardTransition("trimis", "inregistrata")).toBe(true);
    expect(isForwardTransition("rezolvat", "inregistrata")).toBe(false);
    expect(isForwardTransition("in-lucru", "in-lucru")).toBe(false); // egal ≠ forward
  });

  it("blochează regresia periculoasă către nou/trimis din status avansat", () => {
    expect(isBlockedRegression("rezolvat", "nou")).toBe(true);
    expect(isBlockedRegression("rezolvat", "trimis")).toBe(true);
    expect(isBlockedRegression("inregistrata", "trimis")).toBe(true);
    expect(isBlockedRegression("in-lucru", "nou")).toBe(true);
    expect(isBlockedRegression("ignorat", "nou")).toBe(true);
  });

  it("NU blochează reopen-uri legitime sau progresii normale", () => {
    expect(isBlockedRegression("rezolvat", "in-lucru")).toBe(false); // redeschidere
    expect(isBlockedRegression("nou", "trimis")).toBe(false); // progresie
    expect(isBlockedRegression("trimis", "inregistrata")).toBe(false);
    expect(isBlockedRegression("inregistrata", "in-lucru")).toBe(false);
    expect(isBlockedRegression("nou", "nou")).toBe(false);
  });
});
