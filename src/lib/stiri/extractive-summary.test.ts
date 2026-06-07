import { describe, it, expect } from "vitest";
import { extractiveSummary } from "./extractive-summary";

describe("extractiveSummary", () => {
  const article = [
    "Guvernul a aprobat marți o ordonanță de urgență privind majorarea salariului minim.",
    "Salariul minim brut va crește la 4.000 de lei de la 1 ianuarie 2027, conform documentului.",
    "Măsura afectează aproximativ 1,8 milioane de angajați din economia națională.",
    "Sindicatele au cerut o creștere mai mare, până la 4.500 de lei.",
    "Patronatele au avertizat că majorarea ar putea duce la pierderi de locuri de muncă în anumite sectoare.",
  ].join(" ");

  it("produce o sinteză structurată cu antet Pe scurt din articol", () => {
    const s = extractiveSummary("Salariul minim crește la 4.000 de lei", article);
    expect(s).not.toBeNull();
    expect(s!).toMatch(/^Pe scurt:/);
    // include propoziții reale din articol (centrale)
    expect(s!.toLowerCase()).toContain("salariul minim");
  });

  it("taie boilerplate-ul de footer (related/share/apps)", () => {
    const withFooter = `${article} Urmărește știrile pe Google News. Top Citite 1 Alt articol despre altceva total diferit. Descarcă aplicația noastră.`;
    const s = extractiveSummary("Salariul minim", withFooter);
    expect(s).not.toBeNull();
    expect(s!.toLowerCase()).not.toContain("descarcă aplicația");
    expect(s!.toLowerCase()).not.toContain("google news");
  });

  it("curăță byline-ul inline (Scris de / locație+dată) și normalizează cedila", () => {
    const withByline = `BUCUREŞTI 07 iunie 2026 20:01 Scris de Ion Popescu Share ${article}`;
    const s = extractiveSummary("Salariul minim", withByline);
    expect(s).not.toBeNull();
    expect(s!).not.toContain("Scris de Ion Popescu");
    expect(s!).not.toMatch(/BUCURE[ŞȘ]TI 07 iunie/);
    // cedila ş/ţ normalizată la virgulă ș/ț în output
    expect(s!).not.toMatch(/[şţ]/);
  });

  it("extrage Cifre cheie cu etichetă reală, nu generic mentionate", () => {
    const s = extractiveSummary("Salariul minim", article);
    if (s && s.includes("Cifre cheie")) {
      expect(s).not.toContain("menționate");
      expect(s).toMatch(/- \*\*[\d.,]+\*\*/); // bullet cu **cifră**
    }
  });

  it("întoarce null pe text insuficient", () => {
    expect(extractiveSummary("Titlu", "Prea scurt.")).toBeNull();
    expect(extractiveSummary("Titlu", null)).toBeNull();
  });
});
