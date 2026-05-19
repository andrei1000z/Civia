import { describe, it, expect } from "vitest";
import { extractLocality } from "./extract-locality";

describe("extractLocality (PII guard pentru cosign address)", () => {
  it("extrage 'Sector N' din adrese București", () => {
    expect(extractLocality("Strada Novaci 12, Sector 5")).toBe("Sector 5");
    expect(extractLocality("Bd. Magheru 1, Sector 1, București")).toBe("Sector 1");
    expect(extractLocality("Aleea Florilor 22 Sector 3")).toBe("Sector 3");
    expect(extractLocality("sector 6")).toBe("Sector 6");
  });

  it("CRITIC: nu mai expune numele strazii sau numarul de imobil", () => {
    // „Sector N" e ok (1 cifra acceptabila, e localitate). Dar numele
    // strazii + nr de imobil nu trebuie sa apara.
    const out = extractLocality("Strada Novaci 12, Sector 5");
    expect(out).not.toMatch(/Novaci/i);
    expect(out).not.toMatch(/\b12\b/); // nr de imobil
    expect(out).toBe("Sector 5");
  });

  it("extrage orasul cunoscut din adresa", () => {
    expect(extractLocality("Str. Memorandumului 28, Cluj-Napoca")).toBe("Cluj-Napoca");
    expect(extractLocality("Bd Carol 14, Iași")).toBe("Iași");
    expect(extractLocality("Aleea X 5, Timișoara, Romania")).toBe("Timișoara");
  });

  it("tolereaza diacritice lipsa", () => {
    expect(extractLocality("Strada X, Cluj")).toBe("Cluj-Napoca");
    expect(extractLocality("Strada X 5, Timisoara")).toBe("Timișoara");
    expect(extractLocality("Bd Y, Iasi")).toBe("Iași");
  });

  it("daca ultimul segment dupa virgula nu e strada, il foloseste", () => {
    expect(extractLocality("Strada X 5, Mioveni")).toBe("Mioveni");
    expect(extractLocality("Str. Y 10, Voluntari")).toBe("Voluntari");
  });

  it("CRITIC: nu intoarce adresa STRADALA chiar daca e ultima", () => {
    // O singura linie cu strada + nr → fallback null (nu expune strada).
    expect(extractLocality("Strada Necunoscuta 12")).toBeNull();
    expect(extractLocality("Bd. X 5")).toBeNull();
  });

  it("input gol / null / undefined → null", () => {
    expect(extractLocality(null)).toBeNull();
    expect(extractLocality(undefined)).toBeNull();
    expect(extractLocality("")).toBeNull();
    expect(extractLocality("   ")).toBeNull();
  });

  it("input doar cu strada (fara oras dupa virgula) → null, nu expune", () => {
    expect(extractLocality("Aleea Florilor 22")).toBeNull();
    expect(extractLocality("Calea Victoriei 100")).toBeNull();
  });

  it("input cu sector + oras → prefera sector (mai specific pentru București)", () => {
    expect(extractLocality("Bd Magheru 1, Sector 1, București")).toBe("Sector 1");
  });

  it("nu match-uieste accidentally pe segmente prea lungi (>40 chars)", () => {
    // Daca cineva pune o descriere lunga ca address, nu o vom expune.
    expect(
      extractLocality(
        "Str X 5, aceasta este o descriere foarte lunga care nu e un oras dar are virgule",
      ),
    ).toBeNull();
  });
});
