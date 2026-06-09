import { describe, it, expect } from "vitest";
import { generateReferralCode, isValidRefCode, REF_VISITOR_COOKIE, REF_SELF_COOKIE } from "./code";

describe("referral/code — generare + validare", () => {
  it("generateReferralCode → 8 hex lowercase, URL-safe", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateReferralCode();
      expect(c).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("generateReferralCode → distinct (entropie suficientă)", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateReferralCode()));
    // 200 din 4.3B — practic imposibil să avem duplicate.
    expect(set.size).toBe(200);
  });

  it("isValidRefCode acceptă coduri plauzibile", () => {
    expect(isValidRefCode("a1b2c3d4")).toBe(true);
    expect(isValidRefCode("ABCD")).toBe(true);
    expect(isValidRefCode("deadbeef12")).toBe(true);
  });

  it("isValidRefCode respinge gunoi / injecție / lungimi greșite", () => {
    expect(isValidRefCode(null)).toBe(false);
    expect(isValidRefCode(undefined)).toBe(false);
    expect(isValidRefCode("")).toBe(false);
    expect(isValidRefCode("ab")).toBe(false); // prea scurt
    expect(isValidRefCode("a".repeat(17))).toBe(false); // prea lung
    expect(isValidRefCode("abc-123")).toBe(false); // caracter ilegal
    expect(isValidRefCode("'; DROP TABLE")).toBe(false);
    expect(isValidRefCode("../../etc")).toBe(false);
  });

  it("numele cookie-urilor sunt stabile (citite în proxy/callback/client)", () => {
    expect(REF_VISITOR_COOKIE).toBe("civia_ref");
    expect(REF_SELF_COOKIE).toBe("civia_rc");
  });
});
