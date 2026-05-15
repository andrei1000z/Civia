import { describe, it, expect } from "vitest";
import { evaluateOverdue, isOverdue, OFFICIAL_RESPONSE_DAYS } from "./overdue";

const NOW = new Date("2026-05-15T12:00:00Z");
const dayAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("evaluateOverdue", () => {
  it("nu e overdue cand <30 zile de la depunere", () => {
    const r = evaluateOverdue(
      { created_at: dayAgo(15), status: "nou", official_response_at: null },
      NOW,
    );
    expect(r.isOverdue).toBe(false);
    expect(r.daysSinceFiled).toBe(15);
    expect(r.daysOverdue).toBe(-15);
  });

  it("e overdue cand >=31 zile fara raspuns oficial", () => {
    const r = evaluateOverdue(
      { created_at: dayAgo(31), status: "in-lucru", official_response_at: null },
      NOW,
    );
    expect(r.isOverdue).toBe(true);
    expect(r.daysOverdue).toBe(1);
  });

  it("NU e overdue daca official_response_at e setat", () => {
    const r = evaluateOverdue(
      {
        created_at: dayAgo(45),
        status: "in-lucru",
        official_response_at: dayAgo(10),
      },
      NOW,
    );
    expect(r.isOverdue).toBe(false);
  });

  it("NU e overdue daca status e rezolvat (final)", () => {
    const r = evaluateOverdue(
      { created_at: dayAgo(60), status: "rezolvat", official_response_at: null },
      NOW,
    );
    expect(r.isOverdue).toBe(false);
  });

  it("NU e overdue daca status e respins (final)", () => {
    const r = evaluateOverdue(
      { created_at: dayAgo(60), status: "respins", official_response_at: null },
      NOW,
    );
    expect(r.isOverdue).toBe(false);
  });

  it("boundary: exact 30 zile e inca in termen (zi 30 e ultima legala)", () => {
    const r = evaluateOverdue(
      { created_at: dayAgo(30), status: "nou", official_response_at: null },
      NOW,
    );
    expect(r.isOverdue).toBe(false);
    expect(r.daysOverdue).toBe(0);
  });

  it("OFFICIAL_RESPONSE_DAYS e 30 (OG 27/2002 art. 14)", () => {
    expect(OFFICIAL_RESPONSE_DAYS).toBe(30);
  });

  it("isOverdue() shortcut", () => {
    expect(
      isOverdue(
        { created_at: dayAgo(45), status: "nou", official_response_at: null },
        NOW,
      ),
    ).toBe(true);
  });

  it("acceptă Date object direct (nu doar string)", () => {
    const r = evaluateOverdue(
      {
        created_at: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000),
        status: "nou",
        official_response_at: null,
      },
      NOW,
    );
    expect(r.isOverdue).toBe(true);
    expect(r.daysOverdue).toBe(10);
  });
});
