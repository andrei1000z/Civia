import { describe, it, expect } from "vitest";
import { wilsonLowerBound } from "./wilson";

describe("wilsonLowerBound", () => {
  it("returnează 0 pentru total 0 (fără date)", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("eșantion mic cu rate mare e penalizat sub eșantion mare cu rate ușor mai mic", () => {
    // 2/3 = 67% brut vs 44/80 = 55% brut. Wilson trebuie să-l pună pe cel mare mai sus.
    const small = wilsonLowerBound(2, 3); // 67% din 3
    const big = wilsonLowerBound(44, 80); // 55% din 80
    expect(big).toBeGreaterThan(small);
  });

  it("crește monoton cu N la același rate (mai multă încredere)", () => {
    const lo = wilsonLowerBound(6, 10); // 60% din 10
    const hi = wilsonLowerBound(60, 100); // 60% din 100
    expect(hi).toBeGreaterThan(lo);
  });

  it("e mărginit în [0,1]", () => {
    expect(wilsonLowerBound(100, 100)).toBeLessThanOrEqual(1);
    expect(wilsonLowerBound(100, 100)).toBeGreaterThan(0.9);
    expect(wilsonLowerBound(0, 50)).toBeGreaterThanOrEqual(0);
    expect(wilsonLowerBound(0, 50)).toBeLessThan(0.1);
  });

  it("clampuiește input invalid (positive > total)", () => {
    expect(wilsonLowerBound(5, 3)).toBe(wilsonLowerBound(3, 3));
    expect(wilsonLowerBound(-2, 10)).toBe(wilsonLowerBound(0, 10));
  });
});
