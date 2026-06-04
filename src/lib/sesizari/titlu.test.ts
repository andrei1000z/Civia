import { describe, it, expect } from "vitest";
import {
  isPlaceholderTitlu,
  deriveTitluFromDescriere,
  descriereContainsLocatie,
  safeTitlu,
} from "./titlu";

/**
 * Teste pentru helperii de titlu (bug 2026-06-04: titlul devenea
 * „Altele (categoria se creează automat din descriere)").
 *
 * NOTĂ: descrierile it()/describe() folosesc BACKTICK — text românesc cu
 * ghilimele curly „" închide string-ul JS dacă e între ASCII " (vezi AGENTS.md).
 */

describe("isPlaceholderTitlu", () => {
  it(`prinde placeholderul tip-picker „altele"`, () => {
    expect(
      isPlaceholderTitlu("Altele (categoria se creează automat din descriere)"),
    ).toBe(true);
  });

  it(`prinde orice text cu „(categoria se creează"`, () => {
    expect(isPlaceholderTitlu("Ceva (categoria se creează cumva)")).toBe(true);
  });

  it(`prinde fallback-ul generic „Sesizare civică"`, () => {
    expect(isPlaceholderTitlu("Sesizare civică")).toBe(true);
  });

  it(`prinde gol / prea scurt`, () => {
    expect(isPlaceholderTitlu("")).toBe(true);
    expect(isPlaceholderTitlu(null)).toBe(true);
    expect(isPlaceholderTitlu(undefined)).toBe(true);
    expect(isPlaceholderTitlu("ab")).toBe(true);
  });

  it(`prinde label-ul scurt al unui tip („Altele")`, () => {
    expect(isPlaceholderTitlu("Altele")).toBe(true);
  });

  it(`NU marchează un titlu real ca placeholder`, () => {
    expect(isPlaceholderTitlu("Mașini parcate pe trotuar pe Strada Zori de Zi")).toBe(false);
    expect(isPlaceholderTitlu("Groapă periculoasă pe Strada Lipscani")).toBe(false);
    expect(isPlaceholderTitlu("Iluminat public defect pe Calea Victoriei")).toBe(false);
  });
});

describe("deriveTitluFromDescriere", () => {
  it(`ia prima propoziție, capitalizată, cu diacritice restaurate`, () => {
    const t = deriveTitluFromDescriere(
      "sunt masini parcate pe trotuar. nu se poate trece deloc",
    );
    // „masini" → „mașini" (restaurare diacritice deterministă)
    expect(t).toBe("Sunt mașini parcate pe trotuar");
  });

  it(`taie la graniță de cuvânt sub 70 caractere`, () => {
    const long =
      "cosuri de gunoi amplasate pe stalpii de iluminat pe cetatea de balta rosia montana sector sase direct pe carosabil periculos";
    const t = deriveTitluFromDescriere(long);
    expect(t.length).toBeLessThanOrEqual(70);
    expect(t.endsWith(" ")).toBe(false);
    expect(t[0]).toBe(t[0]!.toUpperCase());
  });

  it(`scoate salutul de la început`, () => {
    const t = deriveTitluFromDescriere("Bună ziua, este o groapă mare pe stradă");
    expect(t.toLowerCase().startsWith("bună ziua")).toBe(false);
    expect(t).toContain("groapă");
  });

  it(`NU returnează niciodată placeholder pentru input gol`, () => {
    expect(deriveTitluFromDescriere("")).toBe("Sesizare civică");
    expect(deriveTitluFromDescriere(null)).toBe("Sesizare civică");
  });

  it(`output-ul derivat NU e marcat ca placeholder (când există descriere)`, () => {
    const t = deriveTitluFromDescriere("masini parcate pe trotuar pe strada x");
    expect(isPlaceholderTitlu(t)).toBe(false);
  });
});

describe("safeTitlu (read-side guard pentru rânduri vechi din DB)", () => {
  it(`întoarce un titlu real neschimbat`, () => {
    expect(
      safeTitlu("Mașini parcate pe trotuar pe Strada Zori de Zi", {
        descriere: "orice",
      }),
    ).toBe("Mașini parcate pe trotuar pe Strada Zori de Zi");
  });

  it(`înlocuiește placeholderul cu un titlu derivat din descriere`, () => {
    const out = safeTitlu("Altele (categoria se creează automat din descriere)", {
      descriere: "Coșuri de gunoi montate pe carosabil, periculos pentru pietoni",
    });
    expect(isPlaceholderTitlu(out)).toBe(false);
    expect(out.toLowerCase()).toContain("coșuri");
  });

  it(`nu întoarce NICIODATĂ un placeholder, chiar fără descriere`, () => {
    expect(safeTitlu("Altele (categoria se creează automat din descriere)")).toBe(
      "Sesizare civică",
    );
    expect(safeTitlu(null)).toBe("Sesizare civică");
    expect(safeTitlu("")).toBe("Sesizare civică");
  });

  it(`prinde variante: uppercase, whitespace, trunchiat`, () => {
    expect(
      isPlaceholderTitlu("ALTELE (CATEGORIA SE CREEAZĂ DIN DESCRIERE)"),
    ).toBe(true);
    expect(isPlaceholderTitlu("   Altele   ")).toBe(true);
    expect(isPlaceholderTitlu("ceva (categ")).toBe(true);
  });
});

describe("descriereContainsLocatie", () => {
  it(`detectează numele străzii când apare în descriere`, () => {
    expect(
      descriereContainsLocatie(
        "Pe strada Zori de Zi sunt parcate mai multe mașini pe trotuar",
        "Strada Zori de Zi, Sector 6, București",
      ),
    ).toBe(true);
  });

  it(`e insensibil la diacritice și capitalizare`, () => {
    expect(
      descriereContainsLocatie(
        "cosuri de gunoi pe cetatea de balta in sectorul 6",
        "Strada Cetatea de Baltă nr. 11-39, Sector 6, București",
      ),
    ).toBe(true);
  });

  it(`returnează false când descrierea NU menționează strada`, () => {
    expect(
      descriereContainsLocatie(
        "este o groapă foarte mare în carosabil aici",
        "Bulevardul Unirii nr. 5, Sector 3",
      ),
    ).toBe(false);
  });

  it(`ignoră cuvintele generice de adresă (Strada, Sector, București)`, () => {
    // locatie doar din cuvinte generice → niciun token semnificativ → false
    expect(
      descriereContainsLocatie("o problemă în sectorul meu", "Sector 1, București"),
    ).toBe(false);
  });
});
