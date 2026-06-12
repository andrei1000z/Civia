import { describe, it, expect } from "vitest";
import { dedupeConsecutiveEvents } from "./events";

type Row = { event_type: string; description: string | null; created_at?: string };

const GENERIC_INREG = "Status actualizat la: inregistrata";
const REAL_INREG = "Înregistrată sub nr. PMB 12345/2026";

function ev(event_type: string, created_at: string, description: string | null = null): Row {
  return { event_type, description, created_at };
}

describe("dedupeConsecutiveEvents", () => {
  it("doua inregistrata generice la 11 zile distanta -> UN rand, fara badge xN (bug 00044)", () => {
    const out = dedupeConsecutiveEvents([
      ev("inregistrata", "2026-05-24T20:47:00Z", GENERIC_INREG),
      ev("inregistrata", "2026-06-04T21:47:00Z", GENERIC_INREG),
    ]);
    expect(out).toHaveLength(1);
    // păstrăm rândul anterior (cel real, mai vechi) — fără contor înșelător „în 24h"
    expect(out[0]!.created_at).toBe("2026-05-24T20:47:00Z");
    expect((out[0] as { _collapsed_count?: number })._collapsed_count).toBeUndefined();
  });

  it("burst de confirmări generice <24h → UN rând cu _collapsed_count (caz Cluj 00049)", () => {
    const out = dedupeConsecutiveEvents([
      ev("inregistrata", "2026-06-04T10:00:00Z", GENERIC_INREG),
      ev("inregistrata", "2026-06-04T10:05:00Z", GENERIC_INREG),
      ev("inregistrata", "2026-06-04T10:20:00Z", GENERIC_INREG),
      ev("inregistrata", "2026-06-04T10:42:00Z", GENERIC_INREG),
    ]);
    expect(out).toHaveLength(1);
    expect((out[0] as { _collapsed_count?: number })._collapsed_count).toBe(4);
  });

  it("rând generic same-type DUPĂ unul cu descriere reală, în afara ferestrei → ascuns (păstrăm realul)", () => {
    const out = dedupeConsecutiveEvents([
      ev("inregistrata", "2026-05-24T20:47:00Z", REAL_INREG),
      ev("inregistrata", "2026-06-10T09:00:00Z", GENERIC_INREG),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.description).toBe(REAL_INREG);
  });

  it("rând cu descriere REALĂ după unul generic (în afara ferestrei) → AMBELE rămân (al doilea aduce info)", () => {
    const out = dedupeConsecutiveEvents([
      ev("inregistrata", "2026-05-24T20:47:00Z", GENERIC_INREG),
      ev("inregistrata", "2026-06-10T09:00:00Z", REAL_INREG),
    ]);
    expect(out).toHaveLength(2);
  });

  it("tipuri diferite consecutive → NU se colapsează", () => {
    const out = dedupeConsecutiveEvents([
      ev("trimis", "2026-05-21T08:17:00Z", "Status actualizat la: trimis"),
      ev("inregistrata", "2026-05-24T20:47:00Z", GENERIC_INREG),
    ]);
    expect(out).toHaveLength(2);
  });

  it("non-windowed same-type back-to-back generic → colapsat", () => {
    const out = dedupeConsecutiveEvents([
      ev("rezolvat", "2026-06-01T10:00:00Z", "Status actualizat la: rezolvat"),
      ev("rezolvat", "2026-06-08T10:00:00Z", "Status actualizat la: rezolvat"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("un singur rând → neschimbat", () => {
    const out = dedupeConsecutiveEvents([ev("depusa", "2026-05-21T07:45:00Z", "Sesizare depusă de cetățean")]);
    expect(out).toHaveLength(1);
  });

  it("timeline complet 00044 (depusa→trimis→inreg→inreg dup) → 3 rânduri", () => {
    const out = dedupeConsecutiveEvents([
      ev("depusa", "2026-05-21T07:45:00Z", "Sesizare depusă de cetățean"),
      ev("trimis", "2026-05-21T08:17:00Z", "Status actualizat la: trimis"),
      ev("inregistrata", "2026-05-24T20:47:00Z", GENERIC_INREG),
      ev("inregistrata", "2026-06-04T21:47:00Z", GENERIC_INREG),
    ]);
    expect(out.map((r) => r.event_type)).toEqual(["depusa", "trimis", "inregistrata"]);
  });
});
