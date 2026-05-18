import { describe, it, expect } from "vitest";
import { objectifyFormalText } from "./objectify";

describe("objectifyFormalText - sanitizare claims subjective", () => {
  it("inlocuieste 'in dreptul domiciliu meu' (gramatical gresit) cu locatia obiectiva", () => {
    const input = "Recent am observat că pe Șoseaua Pantelimon nr. 300, în dreptul domiciliu meu, există o problemă.";
    const { text, changed } = objectifyFormalText(input, {
      locatie: "Șoseaua Pantelimon nr. 300",
      adresaCetatean: "Strada Novaci 12, Sector 5",
    });
    expect(changed).toBe(true);
    expect(text).toContain("pe Șoseaua Pantelimon nr. 300");
    expect(text).not.toMatch(/domiciliu(?:lui)? meu/i);
  });

  it("inlocuieste 'in dreptul domiciliului meu' (gramatical corect dar subjective)", () => {
    const input = "Pe Bulevard X, în dreptul domiciliului meu, mașinile parchează ilegal.";
    const { text, changed } = objectifyFormalText(input, {
      locatie: "Bulevard X",
      adresaCetatean: "Strada Diferita 5",
    });
    expect(changed).toBe(true);
    expect(text).not.toMatch(/domiciliu/i);
  });

  it("inlocuieste 'in fata blocului meu' cu locatia obiectiva", () => {
    const input = "În fața blocului meu, parcarea e haotică.";
    const { text, changed } = objectifyFormalText(input, {
      locatie: "Strada Republicii nr. 42",
      adresaCetatean: "Alt loc",
    });
    expect(changed).toBe(true);
    expect(text).toContain("pe Strada Republicii nr. 42");
  });

  it("inlocuieste 'pe strada mea' si 'in cartierul meu'", () => {
    const input = "Pe strada mea sunt gropi. În cartierul meu lipsesc stâlpi.";
    const { text } = objectifyFormalText(input, {
      locatie: "Calea Victoriei 100",
      adresaCetatean: "Alt loc",
    });
    expect(text).not.toMatch(/pe strada mea/i);
    expect(text).not.toMatch(/în cartierul meu/i);
    expect(text).toContain("pe Calea Victoriei 100");
  });

  it("foloseste fallback 'in zona indicata' cand locatia lipseste", () => {
    const input = "În dreptul domiciliului meu e o problema.";
    const { text } = objectifyFormalText(input, {});
    expect(text).toContain("în zona indicată");
    expect(text).not.toMatch(/domiciliu/i);
  });

  it("NU schimba textul cand domiciliul cetateanului = locatia problemei (exceptie legitima)", () => {
    const input = "În fața blocului meu, mașinile blochează trotuarul.";
    const { text, changed, replacements } = objectifyFormalText(input, {
      locatie: "Strada Novaci 12, Sector 5",
      adresaCetatean: "Strada Novaci nr. 12, Sector 5",
    });
    expect(changed).toBe(false);
    expect(replacements).toBe(0);
    expect(text).toBe(input);
  });

  it("curata dubla prepozitie 'pe pe' dupa replace", () => {
    const input = "În fața blocului meu pe trotuar sunt mașini.";
    const { text } = objectifyFormalText(input, {
      locatie: "Strada X",
      adresaCetatean: "Alt loc",
    });
    expect(text).not.toMatch(/\bpe pe\b/i);
  });

  it("NU corrupte text care nu contine claim-uri subjective", () => {
    const input = "Mă numesc Ion Popescu, locuiesc pe Strada A. Pe Strada B sunt gropi.";
    const { text, changed } = objectifyFormalText(input, {
      locatie: "Strada B",
      adresaCetatean: "Strada A",
    });
    expect(changed).toBe(false);
    expect(text).toBe(input);
  });

  it("inlocuieste 'in dreptul meu domiciliu' (alt typo regex pattern)", () => {
    const input = "Pe Soseaua X, în dreptul meu domiciliu, problemă.";
    const { text, changed } = objectifyFormalText(input, {
      locatie: "Șoseaua X",
      adresaCetatean: "Strada Y",
    });
    expect(changed).toBe(true);
    expect(text).not.toMatch(/dreptul meu/i);
  });

  it("returneaza obj cu count de replacements", () => {
    const input = "În dreptul domiciliu meu și pe strada mea sunt gropi în cartierul meu.";
    const { replacements } = objectifyFormalText(input, {
      locatie: "Strada X",
      adresaCetatean: "Strada Y",
    });
    expect(replacements).toBeGreaterThanOrEqual(3);
  });

  it("returneaza neschimbat pe text gol", () => {
    const { text, changed } = objectifyFormalText("", {});
    expect(changed).toBe(false);
    expect(text).toBe("");
  });
});
