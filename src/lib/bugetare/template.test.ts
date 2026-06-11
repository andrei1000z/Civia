import { describe, it, expect } from "vitest";
import { buildCerereBP } from "./template";
import { PROGRAME_BP } from "@/data/bugetare-programe";
import { ALL_COUNTIES } from "@/data/counties";

const base = {
  oras: "Ploiești",
  primarie: "Primăria Municipiului Ploiești",
  numeSolicitant: "Ion Popescu",
  emailSolicitant: "ion@exemplu.ro",
  data: "11 iunie 2026",
};

describe("buildCerereBP", () => {
  it("conține temeiul legal (OG 27/2002 art. 8 + Legea 52/2003) + GDPR", () => {
    const t = buildCerereBP(base);
    expect(t).toContain("OG nr. 27/2002");
    expect(t).toContain("art. 8");
    expect(t).toContain("30 de zile");
    expect(t).toContain("Legea nr. 52/2003");
    expect(t).toContain("2016/679");
  });

  it("include orașul, primăria, numele și emailul", () => {
    const t = buildCerereBP(base);
    for (const v of ["Ploiești", "Primăria Municipiului Ploiești", "Ion Popescu", "ion@exemplu.ro", "11 iunie 2026"]) {
      expect(t).toContain(v);
    }
  });

  it("câmpurile goale devin substituenți vizibili", () => {
    const t = buildCerereBP({ oras: "", primarie: "", numeSolicitant: "", emailSolicitant: "", data: "azi" });
    expect(t).toContain("[denumirea primăriei]");
    expect(t).toContain("[orașul dumneavoastră]");
    expect(t).toContain("[numele dumneavoastră]");
  });
});

describe("date PROGRAME_BP", () => {
  it("id-uri unice, URL-uri https, county valid", () => {
    const ids = PROGRAME_BP.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PROGRAME_BP) {
      expect(p.platformaUrl).toMatch(/^https:\/\//);
      expect(ALL_COUNTIES.some((c) => c.id === p.county), `${p.id}: county`).toBe(true);
      expect(p.verificatLa).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
