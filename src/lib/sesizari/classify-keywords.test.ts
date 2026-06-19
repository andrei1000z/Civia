import { describe, it, expect } from "vitest";
import { deterministicTip } from "./classify-keywords";

describe("deterministicTip — override stâlpișori anti-parcare", () => {
  it("prinde cazul raportat (mașini pe trotuar + cerere stâlpișori) → stalpisori", () => {
    expect(
      deterministicTip(
        "masinile ocupa trotuarul, pietonii au foarte putin loc ramas si doar pe un singur trotuar de pe o parte a drumului, sa elibereze masinile si sa puna stalpisori",
      ),
    ).toBe("stalpisori");
  });

  it("prinde varianta cu diacritice + bolarzi", () => {
    expect(deterministicTip("Solicit montarea de stâlpișori anti-parcare pe trotuar")).toBe("stalpisori");
    expect(deterministicTip("e nevoie de bolarzi ca să nu mai parcheze pe trotuar")).toBe("stalpisori");
  });

  it("NU declanșează pe context de tramvai (→ rămâne pe AI)", () => {
    expect(deterministicTip("gard despărțitor pe linia de tramvai, să pună stâlpișori")).toBeNull();
    expect(deterministicTip("șine de tramvai blocate cu stâlpi")).toBeNull();
  });

  it("NU declanșează când nu se cer stâlpișori (→ AI: trotuar / parcare)", () => {
    expect(deterministicTip("trotuar degradat, plăci sparte și ridicate")).toBeNull();
    expect(deterministicTip("mașini parcate ilegal pe trotuar")).toBeNull();
  });
});

describe("deterministicTip — cerere semaforizare (semafor nou)", () => {
  it("prinde cererea de instalare/montare a unui semafor → semaforizare", () => {
    expect(deterministicTip("Este nevoie de instalarea unui semafor la intersecția X")).toBe("semaforizare");
    expect(deterministicTip("să se monteze un semafor unde nu există niciunul")).toBe("semaforizare");
    expect(deterministicTip("cerem amplasarea unui semafor pe drumul spre școală")).toBe("semaforizare");
  });

  it("prinde cuvantul semaforizare / semaforizarea unei treceri sau intersectii", () => {
    expect(deterministicTip("Cer semaforizarea trecerii de pietoni de pe strada Y")).toBe("semaforizare");
    expect(deterministicTip("e nevoie de semaforizarea intersecției")).toBe("semaforizare");
  });

  it("NU declanșează pentru un semafor EXISTENT defect (→ rămâne pe AI = semafor)", () => {
    expect(deterministicTip("semaforul de la intersecție e defect")).toBeNull();
    expect(deterministicTip("semaforul nu mai funcționează de o săptămână")).toBeNull();
  });

  it("NU declanșează pe cerere de zebră fără semafor (→ AI: trecere_pietoni)", () => {
    expect(deterministicTip("e nevoie de o trecere de pietoni cu marcaj aici")).toBeNull();
  });
});

describe("deterministicTip — loc de parcare trasat ilegal", () => {
  it("prinde marcaj de parcare trasat ILEGAL pe domeniul public → parcare_trasata", () => {
    expect(deterministicTip("loc de parcare trasat ilegal pe Calea Plevnei 29")).toBe("parcare_trasata");
    expect(deterministicTip("Ne trasăm singuri locuri de parcare pe stradă")).toBe("parcare_trasata");
    expect(deterministicTip("cineva și-a vopsit abuziv un loc de parcare privat pe carosabil")).toBe("parcare_trasata");
  });

  it("NU declanșează pentru o mașină parcată ilegal (→ AI: parcare)", () => {
    expect(deterministicTip("mașină parcată ilegal pe trotuar")).toBeNull();
    expect(deterministicTip("loc de parcare ocupat ilegal de o dubă")).toBeNull();
  });

  it("NU declanșează pentru o CERERE de amenajare/trasare (→ AI: amenajare_parcare)", () => {
    expect(deterministicTip("cer să se traseze locuri de parcare noi în cartier")).toBeNull();
  });
});
