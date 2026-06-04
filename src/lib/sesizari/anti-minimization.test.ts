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

  // Bug 5/22/2026: regex anterior cerea „suficient" intre „rămâne" si „spațiu",
  // dar AI a emis „rămânând spațiu de trecere pentru pietoni" — fara „suficient".
  it("inlocuieste 'ramanand spatiu de trecere pentru pietoni' (gerunziu, fara 'suficient')", () => {
    const input =
      "Astăzi am observat că pe trotuarul acestei străzi sunt parcate mai multe mașini, care ocupă o parte din lățimea trotuarului, rămânând spațiu de trecere pentru pietoni.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/r[ăa]m[âa]n[âa]nd\s+spa[țt]iu/i);
    expect(text).toContain("spațiul destinat pietonilor este restricționat");
  });

  it("inlocuieste 'ramane spatiu de trecere' (fara 'suficient')", () => {
    const input = "Mașinile parchează pe trotuar, dar rămâne spațiu de trecere pentru pietoni.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/r[ăa]m[âa]ne\s+spa[țt]iu/i);
    expect(text).toContain("spațiul destinat pietonilor este restricționat");
  });

  it("inlocuieste 'lasand spatiu de trecere' (gerunziu alternativ)", () => {
    const input = "Mașinile ocupă jumătate din trotuar, lăsând spațiu pentru pietoni.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/l[ăa]s[âa]nd\s+spa[țt]iu/i);
  });

  it("inlocuieste 'mai exista spatiu pentru pietoni' (variant ablativ)", () => {
    const input = "Mașinile parcate pe trotuar nu blochează complet, mai există spațiu pentru pietoni.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/mai\s+exist[ăa]\s+spa[țt]iu/i);
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

  it("CRITIC: pastreaza paragrafele (\\n\\n) — bug 5/19/2026 din productie 00041", () => {
    // Inainte de fix, regex-ul de cleanup `\s{2,} → " "` matchuia si
    // newline-urile si le colapsa. Asta a distrus toate paragrafele din
    // text. Fix: cleanup-ul nu mai matche-uieste newline.
    const input = [
      "Bună ziua,",
      "",
      "Mă numesc Andrei și sesizez că mașinile ocupă o parte din spațiul trotuarului.",
      "",
      "Pentru a rezolva, vă solicit stâlpișori.",
      "",
      "Cu stimă,",
      "Andrei",
    ].join("\n");
    const { text } = removeMinimization(input);
    // Paragrafele trebuie sa ramana intacte.
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(4);
    expect(text).toContain("Bună ziua,\n\nMă numesc");
    expect(text).toContain("\n\nPentru a rezolva");
    expect(text).toContain("\n\nCu stimă,");
  });

  it("CRITIC: spatii multiple intra-line sunt colapsate, dar newline-urile NU", () => {
    // Folosesc un text fara minimization match ca sa testam strict cleanup-ul.
    const input = "Bună ziua,\n\nAm  observat   o problemă pe stradă.";
    const { text } = removeMinimization(input);
    // Newline-urile pastrate
    expect(text).toMatch(/Bună ziua,\n\nAm /);
    // Spatii multiple intra-line colapsate
    expect(text).not.toMatch(/Am {2,}/);
    expect(text).not.toMatch(/observat {2,}/);
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

  it(`1-metru myth — „lăsând un metru liber pentru pietoni" e neutralizat`, () => {
    const input =
      "Mașinile sunt parcate pe trotuar, lăsând un metru liber pentru pietoni.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(true);
    expect(text).not.toMatch(/un metru liber/i);
    expect(text).toContain("spațiul destinat pietonilor este restricționat");
  });

  it(`1-metru myth — „rămâne cel puțin 1 metru de trecere" e neutralizat`, () => {
    const input = "Deși ocupă trotuarul, rămâne cel puțin 1 metru de trecere.";
    const { text } = removeMinimization(input);
    expect(text).not.toMatch(/1 metru de trecere/i);
    expect(text).toContain("spațiul destinat pietonilor este restricționat");
  });

  it(`1-metru — NU prinde context neutru („groapă de un metru adâncime")`, () => {
    const input = "Există o groapă de un metru adâncime în carosabil.";
    const { text, changed } = removeMinimization(input);
    expect(changed).toBe(false);
    expect(text).toBe(input);
  });
});
