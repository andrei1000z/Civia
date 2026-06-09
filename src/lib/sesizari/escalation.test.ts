import { describe, it, expect } from "vitest";
import { evaluateAvpEligibility, AVP_ESCALATION_DAYS } from "./escalation";

const NOW = new Date("2026-06-09T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("evaluateAvpEligibility — gate legal AVP (OG 27/2002)", () => {
  it("CRITIC: 2 zile + 50 co-semnături nu contează => NOT eligible (too-early)", () => {
    // Co-semnăturile NU sunt nici măcar parametru — interdicția e structurală.
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(2), status: "in-lucru", official_response_at: null },
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("too-early");
    expect(r.daysUntilEligible).toBe(AVP_ESCALATION_DAYS - 2);
  });

  it("46 zile fără răspuns => eligible (time-expired)", () => {
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(46), status: "in-lucru", official_response_at: null },
      NOW,
    );
    expect(r.eligible).toBe(true);
    expect(r.reason).toBe("time-expired");
    expect(r.daysUntilEligible).toBe(0);
  });

  it("status ignorat la orice vârstă => eligible (override admin)", () => {
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(3), status: "ignorat", official_response_at: null },
      NOW,
    );
    expect(r.eligible).toBe(true);
    expect(r.reason).toBe("ignorat");
  });

  it("status rezolvat la 90 zile => NOT eligible (resolved)", () => {
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(90), status: "rezolvat", official_response_at: null },
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("resolved");
  });

  it("status respins la 120 zile => NOT eligible (resolved)", () => {
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(120), status: "respins", official_response_at: null },
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("resolved");
  });

  it("official_response_at setat la 60 zile, status in-lucru => NOT eligible (responded)", () => {
    // Răspunsul oficial dovedește că termenul a fost respectat, deși problema
    // nu e închisă — nu reclamăm „ignorare" la AVP.
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(60), status: "in-lucru", official_response_at: daysAgo(20) },
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("responded");
  });

  it("edge legacy: ignorat DAR cu official_response_at setat => responded castiga (NOT eligible)", () => {
    const r = evaluateAvpEligibility(
      { created_at: daysAgo(70), status: "ignorat", official_response_at: daysAgo(10) },
      NOW,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("responded");
  });

  it("granița exactă: 44 zile NOT eligible, 45 zile eligible", () => {
    expect(
      evaluateAvpEligibility({ created_at: daysAgo(44), status: "in-lucru", official_response_at: null }, NOW).eligible,
    ).toBe(false);
    expect(
      evaluateAvpEligibility({ created_at: daysAgo(45), status: "in-lucru", official_response_at: null }, NOW).eligible,
    ).toBe(true);
  });
});
