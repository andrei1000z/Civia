import { describe, it, expect } from "vitest";
import { deterministicTip } from "./classify-keywords";

describe("deterministicTip — override stâlpișori anti-parcare", () => {
  it("prinde cazul raportat (mașini pe trotuar + cerere stâlpișori) → stalpisori", () => {
    expect(
      deterministicTip(
        "masinile ocupa trotuarul, pietonii au foarte putin loc ramas si doar pe un singur trotuar de pe o parte a drumului, sa elibereze masinile si sa puna stalpisori",
      ),
    ).toBe("stalpisori");
  });

  it("prinde varianta cu diacritice + bolarzi", () => {
    expect(deterministicTip("Solicit montarea de stâlpișori anti-parcare pe trotuar")).toBe("stalpisori");
    expect(deterministicTip("e nevoie de bolarzi ca să nu mai parcheze pe trotuar")).toBe("stalpisori");
  });

  it("NU declanșează pe context de tramvai (→ rămâne pe AI)", () => {
    expect(deterministicTip("gard despărțitor pe linia de tramvai, să pună stâlpișori")).toBeNull();
    expect(deterministicTip("șine de tramvai blocate cu stâlpi")).toBeNull();
  });

  it("NU declanșează când nu se cer stâlpișori (→ AI: trotuar / parcare)", () => {
    expect(deterministicTip("trotuar degradat, plăci sparte și ridicate")).toBeNull();
    expect(deterministicTip("mașini parcate ilegal pe trotuar")).toBeNull();
  });
});
