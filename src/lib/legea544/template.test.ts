import { describe, it, expect } from "vitest";
import { buildCerere544, CATEGORII_544, TERMEN_544_ZILE } from "./template";

const base = {
  autoritate: "Primăria Municipiului București",
  informatie: "execuția bugetară pe anul 2026",
  numeSolicitant: "Ion Popescu",
  emailSolicitant: "ion@exemplu.ro",
  data: "10 iunie 2026",
};

describe("buildCerere544", () => {
  it("conține temeiul legal (art. 6 + 7 din Legea 544/2001)", () => {
    const t = buildCerere544(base);
    expect(t).toContain("art. 6 din Legea nr. 544/2001");
    expect(t).toContain("art. 7 din Legea nr. 544/2001");
    expect(t).toContain(`${TERMEN_544_ZILE} zile`);
  });

  it("include autoritatea, informația, numele și emailul", () => {
    const t = buildCerere544(base);
    expect(t).toContain("Primăria Municipiului București");
    expect(t).toContain("execuția bugetară pe anul 2026");
    expect(t).toContain("Ion Popescu");
    expect(t).toContain("ion@exemplu.ro");
    expect(t).toContain("10 iunie 2026");
  });

  it("câmpurile goale devin substituenți vizibili", () => {
    const t = buildCerere544({ autoritate: "", informatie: "", numeSolicitant: "", emailSolicitant: "", data: "azi" });
    expect(t).toContain("[denumirea autorității publice]");
    expect(t).toContain("[descrieți clar și precis informația solicitată]");
    expect(t).toContain("[numele dumneavoastră]");
  });

  it("format=hartie nu cere email electronic", () => {
    const t = buildCerere544({ ...base, format: "hartie" });
    expect(t).toContain("pe suport de hârtie");
    expect(t).not.toContain("ion@exemplu.ro");
  });

  it("menționează GDPR (limitarea scopului)", () => {
    expect(buildCerere544(base)).toContain("2016/679");
  });

  it("CATEGORII_544 au exemple ne-goale", () => {
    expect(CATEGORII_544.length).toBeGreaterThanOrEqual(5);
    for (const c of CATEGORII_544) expect(c.exemplu.length).toBeGreaterThan(10);
  });
});
