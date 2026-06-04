import { describe, it, expect } from "vitest";
import { computeStatusUpdate } from "./status-from-reply";

const AT = "2026-06-05T00:00:00.000Z";

describe("computeStatusUpdate", () => {
  it(`setează „inregistrata" și FĂRĂ nr (bug 00060/00061)`, () => {
    const u = computeStatusUpdate({ currentStatus: "trimis", aiStatus: "inregistrata", at: AT });
    expect(u?.status).toBe("inregistrata");
    expect(u?.nr_inregistrare).toBeUndefined();
  });

  it("include nr când există", () => {
    const u = computeStatusUpdate({ currentStatus: "trimis", aiStatus: "inregistrata", nrInregistrare: "18994", at: AT });
    expect(u?.nr_inregistrare).toBe("18994");
  });

  it(`FORWARD-ONLY: nu regresează „rezolvat" → „inregistrata"`, () => {
    expect(computeStatusUpdate({ currentStatus: "rezolvat", aiStatus: "inregistrata", at: AT })).toBeNull();
  });

  it(`FORWARD-ONLY: nu regresează „in-lucru" → „inregistrata"`, () => {
    expect(computeStatusUpdate({ currentStatus: "in-lucru", aiStatus: "inregistrata", at: AT })).toBeNull();
  });

  it(`avansează „trimis" → „rezolvat" + official_response substanțial`, () => {
    const u = computeStatusUpdate({
      currentStatus: "trimis",
      aiStatus: "rezolvat",
      summary: "Problema a fost remediată, stâlpișorii au fost montați pe trotuar.",
      at: AT,
    });
    expect(u?.status).toBe("rezolvat");
    expect(u?.official_response).toContain("remediată");
    expect(u?.official_response_at).toBe(AT);
  });

  it("nu pune official_response pentru ack pur de înregistrare", () => {
    const u = computeStatusUpdate({ currentStatus: "trimis", aiStatus: "inregistrata", summary: "Înregistrată.", at: AT });
    expect(u?.official_response).toBeUndefined();
  });

  it("status nerelevant (necunoscut/respins) → null", () => {
    expect(computeStatusUpdate({ currentStatus: "trimis", aiStatus: "necunoscut", at: AT })).toBeNull();
    expect(computeStatusUpdate({ currentStatus: "trimis", aiStatus: "respins", at: AT })).toBeNull();
  });

  it("status egal → null (idempotent)", () => {
    expect(computeStatusUpdate({ currentStatus: "inregistrata", aiStatus: "inregistrata", at: AT })).toBeNull();
  });
});
