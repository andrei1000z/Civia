import { describe, it, expect } from "vitest";
import { pluralizeRO, pluralizeKey } from "./pluralize-ro";

describe("pluralizeRO", () => {
  it("returnează singular pentru 1", () => {
    expect(pluralizeRO(1, "sesizare", "sesizări")).toBe("1 sesizare");
  });

  it(`returnează paucal pentru 2-19 fără „de"`, () => {
    expect(pluralizeRO(2, "sesizare", "sesizări")).toBe("2 sesizări");
    expect(pluralizeRO(15, "sesizare", "sesizări")).toBe("15 sesizări");
    expect(pluralizeRO(19, "sesizare", "sesizări")).toBe("19 sesizări");
  });

  it(`inserează „de" pentru ≥ 20`, () => {
    expect(pluralizeRO(20, "sesizare", "sesizări")).toBe("20 de sesizări");
    expect(pluralizeRO(21, "sesizare", "sesizări")).toBe("21 de sesizări");
    expect(pluralizeRO(100, "sesizare", "sesizări")).toBe("100 de sesizări");
  });

  it("aplică regula pe ultimele 2 cifre pentru numere mari", () => {
    expect(pluralizeRO(101, "sesizare", "sesizări")).toBe("101 sesizări");
    expect(pluralizeRO(115, "sesizare", "sesizări")).toBe("115 sesizări");
    expect(pluralizeRO(119, "sesizare", "sesizări")).toBe("119 sesizări");
    expect(pluralizeRO(120, "sesizare", "sesizări")).toBe("120 de sesizări");
    expect(pluralizeRO(200, "sesizare", "sesizări")).toBe("200 de sesizări");
  });

  it("returnează zeroOverride când e furnizat", () => {
    expect(pluralizeRO(0, "sesizare", "sesizări", "nici o sesizare")).toBe("nici o sesizare");
  });

  it("returnează paucal pentru 0 fără override", () => {
    expect(pluralizeRO(0, "sesizare", "sesizări")).toBe("0 sesizări");
  });

  it("formatează numere mari cu separator ro-RO", () => {
    // Romanian Intl folosește punct ca thousands separator (1.000)
    const result = pluralizeRO(1000, "sesizare", "sesizări");
    expect(result).toContain("000 de sesizări");
    expect(result).toMatch(/^1/);
  });
});

describe("pluralizeKey", () => {
  it("foloseste cheile predefinite", () => {
    expect(pluralizeKey(1, "petitie")).toBe("1 petiție");
    expect(pluralizeKey(5, "petitie")).toBe("5 petiții");
    expect(pluralizeKey(30, "petitie")).toBe("30 de petiții");
  });

  it("acoperă toate cheile fără crash", () => {
    const keys = ["sesizare", "petitie", "protest", "stire", "vot", "zi", "ora", "comentariu"] as const;
    for (const k of keys) {
      expect(() => pluralizeKey(5, k)).not.toThrow();
    }
  });
});
