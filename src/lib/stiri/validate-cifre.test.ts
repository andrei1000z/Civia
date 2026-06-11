import { describe, it, expect } from "vitest";
import { stripInventedCifre } from "./validate-cifre";

// Cazul REAL din producție (articol Gândul despre Ciucu, 11 iunie 2026):
// modelul a inventat „0", „1" și „2024" — niciunul nu apare în articol.
const SOURCE_CIUCU = `Ciprian Ciucu, primarul general al Capitalei, a refuzat oferta premierului desemnat Eugen Tomac de a conduce Ministerul Dezvoltării. Într-un mesaj publicat pe Facebook, Ciucu a transmis că nu intenționează să părăsească Primăria Capitalei, deoarece funcția pe care o ocupă este cea pentru care a muncit ani la rând și că obiectivul său e să confirme încrederea primită din partea alegătorilor.`;

const SUMMARY_CIUCU = `Pe scurt:
Ciprian Ciucu a refuzat oferta de a conduce Ministerul Dezvoltării.

Cifre cheie:
- **0**: Numărul de funcții administrative pe care Ciprian Ciucu dorește să le părăsească.
- **1**: Numărul de ani de muncă pe care Ciprian Ciucu a lucrat pentru a câștiga funcția de primar general.
- **2024**: Anul în care se va desfășura alegerile locale.

Context:
Ciucu a fost invitat de premierul desemnat Eugen Tomac să facă parte din Executiv.`;

describe("stripInventedCifre", () => {
  it("CAZUL REAL: taie toate bullet-urile inventate + scoate secțiunea goală", () => {
    const out = stripInventedCifre(SUMMARY_CIUCU, SOURCE_CIUCU);
    expect(out).not.toContain("Cifre cheie:");
    expect(out).not.toContain("2024");
    expect(out).not.toContain("Numărul de funcții");
    // restul secțiunilor rămân intacte
    expect(out).toContain("Pe scurt:");
    expect(out).toContain("Context:");
    expect(out).not.toMatch(/\n{3,}/); // fără goluri urâte
  });

  it("păstrează bullet-urile cu cifre REALE din sursă", () => {
    const source = "Primăria a alocat 45 de milioane de lei pentru 12 școli, până în 2027.";
    const summary = `Cifre cheie:
- **45 de milioane lei** — bugetul alocat.
- **12** școli incluse în program.
- **99** de blocuri renovate.

Context:
Text.`;
    const out = stripInventedCifre(summary, source);
    expect(out).toContain("45 de milioane");
    expect(out).toContain("12");
    expect(out).not.toContain("99"); // inventat → tăiat
    expect(out).toContain("Cifre cheie:"); // secțiunea rămâne (are supraviețuitori)
  });

  it("nu validează numere prin sub-secvențe („1' nu trece prin „2014')", () => {
    const source = "Evenimentul a avut loc în 2014.";
    const summary = `Cifre cheie:
- **1**: ceva inventat.

Context:
Text.`;
    const out = stripInventedCifre(summary, source);
    expect(out).not.toContain("ceva inventat");
  });

  it("tolerează separatori de mii diferiți (1.000 în sumar vs 1000 în sursă)", () => {
    const source = "Au fost plantați 1000 de copaci.";
    const summary = `Cifre cheie:
- **1.000** de copaci plantați.

Context:
Text.`;
    const out = stripInventedCifre(summary, source);
    expect(out).toContain("1.000");
  });

  it("păstrează bullet-urile fără cifre (nume/termeni legali)", () => {
    const source = "Consiliul a aprobat proiectul.";
    const summary = `Cifre cheie:
- **OG 27/2002** — temeiul legal invocat.

Context:
Text.`;
    // OG 27/2002 are cifre care NU-s în sursă → bullet tăiat; secțiunea dispare
    const out = stripInventedCifre(summary, source);
    expect(out).not.toContain("Cifre cheie:");
    // dar un bullet PUR nominal (fără cifre) supraviețuiește
    const out2 = stripInventedCifre(
      `Cifre cheie:\n- **Eugen Tomac** — premierul desemnat.\n\nContext:\nEugen Tomac e premierul desemnat.`,
      "Eugen Tomac e premierul desemnat.",
    );
    expect(out2).toContain("Eugen Tomac");
  });

  it("sumare fără secțiunea de cifre trec neatinse", () => {
    const summary = `Pe scurt:\nText.\n\nContext:\nAlt text.`;
    expect(stripInventedCifre(summary, "sursă")).toBe(summary);
  });

  it("acoperă și varianta petiții „Cifre & date cheie:'", () => {
    const summary = `Cifre & date cheie:
- **5.000** de semnături strânse.

De ce contează:
Text.`;
    const out = stripInventedCifre(summary, "Petiția a strâns 5.000 de semnături.");
    expect(out).toContain("5.000");
    const out2 = stripInventedCifre(summary, "Petiția a strâns multe semnături.");
    expect(out2).not.toContain("Cifre & date cheie:");
  });
});
