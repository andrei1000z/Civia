import { describe, it, expect } from "vitest";
import { removeMinimization } from "./anti-minimization";

describe("removeMinimization", () => {
  it("inlocuieste 'pietonilor li se asigura inca suficient spatiu pentru a circula' — bug-ul exact din productia 00041", () => {
    const input =
      "Din fotografiile atașate, se poate observa că mașinile ocupă o parte din spațiul trotuarului, însă pietonilor li se asigură încă suficient spațiu pentru a circula.";
    const { text, changed, replacements } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(replacements).toBeGreaterThanOrEqual(1);
    expect(text).not.toMatch(/pietonilor li se asigur/i);
    expect(text).toContain("circulația pietonilor este împiedicată");
  });

  it("inlocuieste 'ramane suficient spatiu de trecere'", () => {
    const input = "Mașinile sunt parcate ilegal, dar rămâne suficient spațiu de trecere.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/r[ăa]m[âa]ne.*suficient/i);
    expect(text).toContain("spațiul destinat pietonilor este restricționat");
  });

  it("inlocuieste 'pietonii pot inca circula normal'", () => {
    const input = "Există parcare ilegală, însă pietonii pot încă circula normal.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/pietonii pot.*circula/i);
  });

  it("inlocuieste 'nu reprezinta o problema majora'", () => {
    const input = "Aspectul este vizibil, nu reprezintă o problemă majoră, dar trebuie corectat.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/nu reprezint[ăa] o problem/i);
  });

  it("inlocuieste 'nu pune in pericol pietonii'", () => {
    const input = "Mașinile parchează pe trotuar, însă nu pune în pericol pietonii.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/nu pune [îi]n pericol/i);
  });

  it("inlocuieste 'masinile ocupa doar o parte'", () => {
    const input = "Se observă că mașinile ocupă doar o parte din trotuar.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/ma[șs]inile ocup[ăa] doar o parte/i);
  });

  it("nu modifica text fara minimizare", () => {
    const input =
      "Mașinile sunt parcate pe trotuar, iar pietonii sunt obligați să meargă pe stradă.";
    const { text, changed, replacements } = removeMinimization(input);
    expect(changed).toBe(false);
    expect(replacements).toBe(0);
    expect(text).toBe(input);
  });

  it("multiple minimizations in acelasi text — toate sunt prinse", () => {
    const input =
      "Mașinile ocupă doar o parte. Pietonii pot încă circula normal. Nu este o problemă urgentă.";
    const { changed, replacements } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(replacements).toBeGreaterThanOrEqual(2);
  });

  it("returneaza neschimbat pe input gol", () => {
    expect(removeMinimization("")).toEqual({
      text: "",
      changed: false,
      replacements: 0,
      matched: [],
    });
  });

  it("matched returneaza textul exact care a fost inlocuit", () => {
    const input = "Pietonii pot încă circula normal.";
    const { matched } = removeMinimization(input);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0]?.toLowerCase()).toContain("pot");
  });

  it("bug 00041 — fix complet, fara duplicare 'spațiul'", () => {
    // Cazul exact din productie: ambele reguli trebuie sa actioneze
    // si rezultatul nu trebuie sa contina „spațiul ... spațiul" duplicat.
    const input =
      "Din fotografiile atașate, se poate observa că mașinile ocupă o parte din spațiul trotuarului, însă pietonilor li se asigură încă suficient spațiu pentru a circula.";
    const { text } = removeMinimization(input);
    // Nu trebuie sa apara „spațiul ... spațiul" duplicat.
    const spatiulMatches = text.match(/spa[țt]iul/gi) ?? [];
    expect(spatiulMatches.length).toBeLessThanOrEqual(1);
    expect(text).toContain("mașinile ocupă trotuarul");
    expect(text).toContain("circulația pietonilor este împiedicată");
  });
});
