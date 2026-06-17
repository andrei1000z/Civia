import { describe, it, expect } from "vitest";
import { bestTextColor } from "./constants";

/**
 * bestTextColor must return the higher-contrast of black/white for a solid
 * bg hex — fixing the real a11y gap where mid-tone status colors (sky, amber,
 * emerald) were painted with hardcoded white text/icons below WCAG contrast.
 */

// Independent WCAG contrast-ratio implementation for assertions.
function relLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const lin = (n: number) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = lin(parseInt(c.slice(0, 2), 16));
  const g = lin(parseInt(c.slice(2, 4), 16));
  const b = lin(parseInt(c.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

describe("bestTextColor", () => {
  it("picks dark text on light / mid-tone backgrounds", () => {
    expect(bestTextColor("#0EA5E9")).toBe("#0A0A0A"); // sky-500 (was white → ~2.5:1)
    expect(bestTextColor("#F59E0B")).toBe("#0A0A0A"); // amber-500 (was white → ~1.6:1)
    expect(bestTextColor("#059669")).toBe("#0A0A0A"); // emerald-600
    expect(bestTextColor("#0891B2")).toBe("#0A0A0A"); // cyan-600 (trimis)
    expect(bestTextColor("#FFFFFF")).toBe("#0A0A0A");
  });

  it("picks white text on dark backgrounds", () => {
    expect(bestTextColor("#7C3AED")).toBe("#ffffff"); // violet (inregistrata)
    expect(bestTextColor("#991B1B")).toBe("#ffffff"); // dark red (ignorat)
    expect(bestTextColor("#6B7280")).toBe("#ffffff"); // gray-500 (respins)
    expect(bestTextColor("#000000")).toBe("#ffffff");
  });

  it("chosen color always beats the alternative on contrast", () => {
    for (const bg of ["#0EA5E9", "#F59E0B", "#059669", "#7C3AED", "#DC2626", "#C2410C"]) {
      const chosen = bestTextColor(bg);
      const other = chosen === "#0A0A0A" ? "#ffffff" : "#0A0A0A";
      expect(contrast(bg, chosen)).toBeGreaterThanOrEqual(contrast(bg, other));
    }
  });

  it("falls back to white for malformed input", () => {
    expect(bestTextColor("#abc")).toBe("#ffffff");
    expect(bestTextColor("nope")).toBe("#ffffff");
  });
});
