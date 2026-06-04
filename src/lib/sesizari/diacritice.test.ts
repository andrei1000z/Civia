import { describe, it, expect } from "vitest";
import { restoreDiacritics } from "./diacritice";

describe("restoreDiacritics", () => {
  it("restaurează cuvintele civice frecvente (cazul 00061)", () => {
    const raw =
      "Cosuri de gunoi pe stalpii de iluminat, siguranta cetatenilor in pericol deoarece masinile circula cu viteza si nu incetinesc. Rugam relocarea.";
    const out = restoreDiacritics(raw);
    expect(out).toContain("Coșuri");
    expect(out).toContain("stâlpii");
    expect(out).toContain("siguranța");
    expect(out).toContain("cetățenilor");
    expect(out).toContain("mașinile");
    expect(out).toContain("circulă");
    expect(out).toContain("viteză");
    expect(out).toContain("încetinesc");
    expect(out).toContain("Rugăm");
    expect(out).toContain(" și ");
    expect(out).toContain(" în ");
  });

  it("păstrează capitalizarea", () => {
    expect(restoreDiacritics("Masina")).toBe("Mașina");
    expect(restoreDiacritics("masina")).toBe("mașina");
    expect(restoreDiacritics("MASINA")).toBe("MAȘINA");
  });

  it("nu re-procesează cuvinte care au deja diacritice", () => {
    expect(restoreDiacritics("mașină coșuri")).toBe("mașină coșuri");
  });

  it("NU atinge cuvintele ambigue excluse din dicționar", () => {
    // „peste" (deasupra) nu devine „pește"; „fata" nu devine „fată"; etc.
    const input = "fata se uita peste gard la masa din fata";
    const out = restoreDiacritics(input);
    expect(out).not.toContain("pește");
    expect(out).not.toContain("față");
    expect(out).not.toContain("masă");
  });

  it("nu schimbă cuvinte necunoscute", () => {
    expect(restoreDiacritics("Lipscani Bucuresti xyz")).toContain("Lipscani");
  });

  it("input gol → gol", () => {
    expect(restoreDiacritics("")).toBe("");
  });
});
