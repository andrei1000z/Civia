/**
 * Integration test pentru pipeline-ul COMPLET de procesare formal_text:
 *
 *   blob_AI_output → objectify → removeMinimization → reformatFormalText
 *
 * Reguli locked-in (5/19/2026):
 *  1. Output-ul TREBUIE sa aiba paragrafe separate cu \n\n.
 *  2. Salutul „Bună ziua, Mă numesc..." e spart in 2 paragrafe.
 *  3. „Pentru a rezolva", „De asemenea", „În temeiul", „Cu stimă"
 *     incep paragraf nou.
 *  4. Numerotari „1. ... 2. ..." sunt pe linii separate.
 *  5. Semnatura „Cu stimă, NUME DATA" devine 3 randuri.
 *  6. Pipeline-ul e idempotent — rerularea pe output produs nu il
 *     strica.
 *
 * Test scope: bug 5/19/2026 productie 00041 — anti-minimizarea colapsa
 * paragrafele. NU vrem regresie.
 */

import { describe, it, expect } from "vitest";
import { objectifyFormalText } from "./objectify";
import { removeMinimization } from "./anti-minimization";
import { reformatFormalText } from "./format-paragraphs";

function runPipeline(input: string): string {
  const objectified = objectifyFormalText(input, { locatie: null, adresaCetatean: null }).text;
  const cleaned = removeMinimization(objectified).text;
  return reformatFormalText(cleaned);
}

// Blob exact ca cel produs de AI inainte de paragraf-break — toata
// scrisoarea pe un singur rand (cu doar \n inainte de semnatura).
const BLOB_AI_OUTPUT =
  "Bună ziua, Mă numesc Andrei, locuiesc în Strada X și doresc să vă aduc la cunoștință o problemă care afectează siguranța pietonilor pe Bulevardul Y. În ultima perioadă am observat că autoturismele parchează neregulamentar pe trotuar, afectând circulația pietonilor. Pentru a rezolva această situație, vă solicit respectuos să luați următoarele măsuri: 1. Montarea de stâlpișori. 2. Aplicarea de sancțiuni. De asemenea, vă rog să îmi furnizați un număr de înregistrare și un răspuns în 30 de zile conform OG 27/2002. Vă mulțumesc anticipat. În temeiul Regulamentului (UE) 2016/679 (GDPR), solicit confidențialitatea datelor. Cu stimă,\nAndrei\n19 mai 2026";

describe("formal-text pipeline (objectify → anti-min → reformat)", () => {
  it("blob AI produce minim 5 paragrafe la output", () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    const paragraphs = out.split(/\n\n+/);
    expect(paragraphs.length).toBeGreaterThanOrEqual(5);
  });

  it(`salut: 'Buna ziua,' si 'Ma numesc' sunt in paragrafe separate`, () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    expect(out).toMatch(/Bună ziua,\n\nMă numesc/);
  });

  it(`'Pentru a rezolva' incepe paragraf nou`, () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    // Regex tolerant: punct sau punct + spatiu, apoi \n\n.
    expect(out).toMatch(/\.\s?\n\nPentru a rezolva/);
  });

  it(`'De asemenea' incepe paragraf nou`, () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    expect(out).toMatch(/\n\nDe asemenea/);
  });

  it(`'In temeiul' (GDPR) incepe paragraf nou`, () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    expect(out).toMatch(/\n\nÎn temeiul/);
  });

  it(`'Cu stima' incepe paragraf nou`, () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    expect(out).toMatch(/\n\nCu stimă/);
  });

  it("numerotari 1. / 2. sunt pe linii proprii", () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    // Dupa „masuri:" e numerotarea
    expect(out).toMatch(/\n1\. Montarea/);
    expect(out).toMatch(/\n2\. Aplicarea/);
  });

  it(`semnatura: 'Cu stima,', nume, data - 3 randuri separate`, () => {
    const out = runPipeline(BLOB_AI_OUTPUT);
    expect(out).toMatch(/Cu stimă,\nAndrei\n19 mai 2026$/);
  });

  it("pipeline-ul e idempotent — rerularea produce acelasi output", () => {
    const out1 = runPipeline(BLOB_AI_OUTPUT);
    const out2 = runPipeline(out1);
    expect(out2).toBe(out1);
  });

  it("CRITIC: anti-minimization NU mai colapseaza paragrafele (regression test bug 00041)", () => {
    // Acest text are deja paragrafele corecte; orice pas din pipeline
    // ar trebui sa le pastreze, nu sa le colapse intr-un blob.
    const paragraphed = [
      "Bună ziua,",
      "",
      "Mă numesc Andrei și sesizez o problemă.",
      "",
      "Pentru a rezolva, vă solicit măsuri.",
      "",
      "Cu stimă,",
      "Andrei",
    ].join("\n");
    const out = runPipeline(paragraphed);
    expect(out.split("\n\n").length).toBeGreaterThanOrEqual(4);
    expect(out).toContain("Bună ziua,\n\nMă numesc");
  });

  it("CRITIC: pipeline NU mai strica paragrafele cand intra cu minimizare + paragrafe corecte", () => {
    // Cazul exact din bug 00041: paragrafe corecte + fraza de minimizare.
    // Inainte de fix: removeMinimization colapsa toate \n in spatii prin
    // regex-ul `\s{2,} → " "`. Acum trebuie sa pastreze.
    const input = [
      "Bună ziua,",
      "",
      "Mă numesc Andrei și sesizez că mașinile ocupă o parte din trotuar, însă pietonilor li se asigură încă suficient spațiu pentru a circula.",
      "",
      "Cu stimă,",
      "Andrei",
    ].join("\n");
    const out = runPipeline(input);
    // Trebuie sa mai existe minim 3 paragrafe (salut, body, semnatura).
    expect(out.split("\n\n").length).toBeGreaterThanOrEqual(3);
    // Si minimizarea trebuie inlocuita.
    expect(out).not.toMatch(/pietonilor li se asigur/i);
  });
});
