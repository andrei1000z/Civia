import { describe, it, expect } from "vitest";
import { generateFormalText, formatDateRo, getSupportedTipuri } from "./formal-template";
import { scrubFormalTextForPublic } from "./scrub-public";

/**
 * Teste pentru template-ul DETERMINIST de text formal.
 *
 * Acoperă:
 *   1. Cele 3 ramuri ale intro-ului (nume+adresa / doar nume / nimic)
 *   2. Paragrafe obligatorii (măsuri, OG 27/2002, mulțumiri, GDPR, semnătură)
 *   3. Bloc opțional pentru poze
 *   4. Toate tipurile suportate au date valide
 *   5. Output-ul nu conține placeholder-uri ne-substituite
 *   6. Public scrub redactează numele și adresa pentru orice variantă
 *   7. Determinism: aceeași input → același output
 *
 * NOTA: titlurile it() folosesc backtick pentru a evita issue-ul cu
 * ghilimele drepte vs curly în șiruri JS (AGENTS.md menționează).
 */

describe("generateFormalText — structură obligatorie", () => {
  const baseArgs = {
    tip: "parcare",
    locatie: "Strada Test nr. 1, Sector 1, București",
    nume: "Ion Popescu",
    adresa: "Strada Florilor 12, Sector 5, București",
    hasPhotos: false,
    date: new Date("2026-05-24"),
  };

  it(`începe cu "Bună ziua,"`, () => {
    const text = generateFormalText(baseArgs);
    expect(text.startsWith("Bună ziua,")).toBe(true);
  });

  it(`include "Mă numesc X, locuiesc în Y" când avem ambele`, () => {
    const text = generateFormalText(baseArgs);
    expect(text).toContain("Mă numesc Ion Popescu, locuiesc în Strada Florilor 12, Sector 5, București");
  });

  it(`include doar "Mă numesc X" când lipsește adresa`, () => {
    const text = generateFormalText({ ...baseArgs, adresa: null });
    expect(text).toContain("Mă numesc Ion Popescu și doresc");
    expect(text).not.toContain("locuiesc în");
  });

  it(`începe cu "Doresc..." când lipsesc ȘI numele ȘI adresa`, () => {
    const text = generateFormalText({ ...baseArgs, nume: null, adresa: null });
    expect(text).toContain("Doresc să vă aduc la cunoștință");
    expect(text).not.toContain("Mă numesc");
  });

  it(`include lista numerotată de măsuri`, () => {
    const text = generateFormalText(baseArgs);
    expect(text).toMatch(/Pentru a rezolva această situație, vă solicit respectuos să luați următoarele măsuri:/);
    expect(text).toMatch(/^1\.\s+/m);
  });

  it(`include paragraf cu poze DOAR când hasPhotos=true`, () => {
    const cu = generateFormalText({ ...baseArgs, hasPhotos: true });
    const fara = generateFormalText({ ...baseArgs, hasPhotos: false });
    expect(cu).toContain("am atașat imagini");
    expect(fara).not.toContain("am atașat imagini");
  });

  it(`include cererea de număr de înregistrare cu referință OG 27/2002`, () => {
    const text = generateFormalText(baseArgs);
    expect(text).toContain("număr de înregistrare");
    expect(text).toContain("OG 27/2002");
    expect(text).toContain("30 de zile");
  });

  it(`include paragraful de mulțumiri`, () => {
    const text = generateFormalText(baseArgs);
    expect(text).toContain("Vă mulțumesc anticipat");
  });

  it(`include clauza GDPR completă cu trimitere la Regulament UE 2016/679, art. 5`, () => {
    const text = generateFormalText(baseArgs);
    expect(text).toContain("Regulamentului (UE) 2016/679");
    expect(text).toContain("art. 5");
    expect(text).toContain("limitarea scopului");
    expect(text).toContain("minimizarea datelor");
    expect(text).toContain("confidențialitatea");
    expect(text).toContain("să nu fie divulgate");
  });

  it(`se termină cu semnătura "Cu stimă, {nume}, {data}"`, () => {
    const text = generateFormalText(baseArgs);
    expect(text).toMatch(/Cu stimă,\nIon Popescu\n24 mai 2026$/);
  });

  it(`când lipsește numele, semnătura conține doar data`, () => {
    const text = generateFormalText({ ...baseArgs, nume: null });
    expect(text).toMatch(/Cu stimă,\n24 mai 2026$/);
  });
});

describe("generateFormalText — toate tipurile au date valide", () => {
  const tipuri = getSupportedTipuri();

  it(`are cel puțin 20 tipuri suportate`, () => {
    expect(tipuri.length).toBeGreaterThanOrEqual(20);
  });

  for (const tip of getSupportedTipuri()) {
    it(`tip="${tip}" produce text valid și complet`, () => {
      const text = generateFormalText({
        tip,
        locatie: "Strada Test 1",
        nume: "Test Name",
        adresa: "Strada Adresa 1",
        hasPhotos: true,
        date: new Date("2026-01-01"),
      });
      // Lungime rezonabilă (template-ul minim are ~900 chars)
      expect(text.length).toBeGreaterThan(800);
      expect(text.length).toBeLessThan(3000);

      // Sectiuni obligatorii
      expect(text).toContain("Bună ziua,");
      expect(text).toContain("Mă numesc Test Name");
      expect(text).toContain("Pentru a rezolva");
      expect(text).toContain("OG 27/2002");
      expect(text).toContain("Cu stimă,");

      // Numerotare actiuni
      expect(text).toMatch(/^1\.\s+\S/m);

      // Fără placeholder-uri ne-substituite
      expect(text).not.toMatch(/\{[A-Z_]+\}/);  // {NUMELE}, {LOCATIA}, etc.
      expect(text).not.toMatch(/%[A-Z_]+%/);   // %title%, etc.
      expect(text).not.toMatch(/\[nume\]|\[adresa\]/);  // doar la scrub, nu la gen
    });
  }
});

describe("generateFormalText — determinism (același input → același output)", () => {
  it(`două apeluri cu aceeași dată produc texte identice`, () => {
    const args = {
      tip: "stalpisori",
      locatie: "Bulevardul Mihai Bravu nr. 100, Sector 3, București",
      nume: "Maria Ionescu",
      adresa: "Strada Sperantei 5, București",
      hasPhotos: false,
      date: new Date("2026-05-24"),
    };
    const t1 = generateFormalText(args);
    const t2 = generateFormalText(args);
    expect(t1).toBe(t2);
  });

  it(`schimbarea unui input strict produce text diferit (determinist pe input)`, () => {
    const a = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      nume: "Ana",
      adresa: "Adresa A",
      hasPhotos: false,
      date: new Date("2026-05-24"),
    });
    const b = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      nume: "Ana",
      adresa: "Adresa B",  // schimbat
      hasPhotos: false,
      date: new Date("2026-05-24"),
    });
    expect(a).not.toBe(b);
    expect(a).toContain("Adresa A");
    expect(b).toContain("Adresa B");
  });
});

describe("generateFormalText — folosește descrierea cetățeanului (bug fix 2026-05-25)", () => {
  it(`include descrierea EXACT cum a scris-o cetățeanul`, () => {
    const text = generateFormalText({
      tip: "transport",
      locatie: "linia 5 de tramvai",
      descriere:
        "Există un gard despărțitor pe linia 5 de tramvai, care ar putea fi instalat pentru a fluidiza șina de tramvai.",
      nume: "Andrei",
      adresa: "București",
      hasPhotos: true,
      date: new Date("2026-05-25"),
    });
    expect(text).toContain("Există un gard despărțitor pe linia 5 de tramvai");
    expect(text).toContain("fluidiza șina de tramvai");
  });

  it(`NU halucinează conținut de tip când descrierea contrazice tip-ul`, () => {
    // Bug 2026-05-25 — chiar dacă tip-ul e „stalpisori" (clasificare greșită),
    // descrierea reală a cetățeanului trebuie să apară. Nu mai apare boilerplate
    // hardcoded despre trotuar/stâlpișori/pietoni dacă user-ul nu menționează.
    const text = generateFormalText({
      tip: "stalpisori",
      locatie: "Strada Barbu Văcărescu",
      descriere:
        "Există un gard despărțitor pe linia 5 de tramvai care ar putea fi instalat pentru a fluidiza șina.",
      nume: "Test",
      adresa: "Adresa Test",
      hasPhotos: true,
      date: new Date("2026-05-25"),
    });
    // Descrierea cetățeanului apare literal
    expect(text).toContain("gard despărțitor pe linia 5 de tramvai");
    // NU apare boilerplate-ul de stalpisori în declarația problemei
    expect(text).not.toContain("lipsa elementelor de protecție");
    expect(text).not.toContain("permite parcarea pe trotuar și pune în pericol pietonii");
  });

  it(`fallback la boilerplate tip când descrierea lipsește sau e prea scurtă`, () => {
    const fara = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      nume: "Ana",
      adresa: "Adresa A",
      hasPhotos: false,
      date: new Date("2026-05-25"),
    });
    expect(fara).toContain("siguranța pietonilor");
    expect(fara).toContain("autovehicule sunt parcate ilegal");

    const scurtFoarte = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      descriere: "rip",
      nume: "Ana",
      adresa: "Adresa A",
      hasPhotos: false,
      date: new Date("2026-05-25"),
    });
    expect(scurtFoarte).toContain("autovehicule sunt parcate ilegal");
  });

  it(`paragraful poze e neutru când există descriere reală`, () => {
    const text = generateFormalText({
      tip: "transport",
      locatie: "linia 5",
      descriere: "Există un gard despărțitor pe linia 5 de tramvai care lipsește.",
      nume: "Ana",
      adresa: "Adresa",
      hasPhotos: true,
      date: new Date("2026-05-25"),
    });
    expect(text).toContain("am atașat imagini care ilustrează situația descrisă mai sus");
    // NU mai apare „evidențiază starea transportului public" boilerplate
    expect(text).not.toContain("Acestea evidențiază starea transportului public");
  });
});

describe("formatDateRo", () => {
  it(`formatează corect în română`, () => {
    expect(formatDateRo(new Date("2026-01-15"))).toBe("15 ianuarie 2026");
    expect(formatDateRo(new Date("2026-05-24"))).toBe("24 mai 2026");
    expect(formatDateRo(new Date("2026-12-31"))).toBe("31 decembrie 2026");
  });
});

describe("Privacy: integrarea generateFormalText + scrubFormalTextForPublic", () => {
  it(`PUBLIC: nume + adresa sunt redactate pentru ne-owner`, () => {
    const text = generateFormalText({
      tip: "parcare",
      locatie: "Strada Problemei 1",
      nume: "Andreea Pohrib",
      adresa: "Str. Țintasului 17-19, ap 14",
      hasPhotos: false,
    });
    const scrubbed = scrubFormalTextForPublic(text, {
      authorName: "Andreea Pohrib",
      hideName: true,
    });
    // Adresa cetățeanului NU mai apare
    expect(scrubbed).not.toContain("Țintasului");
    expect(scrubbed).not.toContain("ap 14");
    expect(scrubbed).toContain("[adresa]");
    // Numele cetățeanului NU mai apare (nici în intro, nici în semnătură)
    expect(scrubbed).not.toContain("Andreea");
    expect(scrubbed).not.toContain("Pohrib");
    expect(scrubbed).toContain("[nume]");
    // Locația problemei RĂMÂNE vizibilă (e public, e relevantă civic)
    expect(scrubbed).toContain("Strada Problemei 1");
  });

  it(`PUBLIC: chiar și fără adresa, numele e redactat`, () => {
    const text = generateFormalText({
      tip: "stalpisori",
      locatie: "Strada X",
      nume: "Calapod Bogdan",
      adresa: null,
      hasPhotos: true,
    });
    const scrubbed = scrubFormalTextForPublic(text, {
      authorName: "Calapod Bogdan",
      hideName: true,
    });
    expect(scrubbed).not.toContain("Calapod");
    expect(scrubbed).not.toContain("Bogdan");
    expect(scrubbed).toContain("[nume]");
  });

  it(`PUBLIC: scrub-ul adaugă "locuiesc în [adresa]" pe public chiar dacă originalul n-avea adresa`, () => {
    const text = generateFormalText({
      tip: "groapa",
      locatie: "Calea Mare 10",
      nume: "Test User",
      adresa: null,
      hasPhotos: false,
    });
    const scrubbed = scrubFormalTextForPublic(text, {
      authorName: "Test User",
      hideName: true,
    });
    expect(scrubbed).toContain("[adresa]");
  });

  it(`OWNER (hideName=false): vede numele real dar tot redactăm adresa`, () => {
    const text = generateFormalText({
      tip: "iluminat",
      locatie: "Strada Lumii",
      nume: "Owner Name",
      adresa: "Adresa Owner 5",
      hasPhotos: false,
    });
    const scrubbed = scrubFormalTextForPublic(text, {
      authorName: "Owner Name",
      hideName: false,
    });
    // Adresa tot redactată (politică internă pe public display chiar și pt owner)
    expect(scrubbed).toContain("[adresa]");
    expect(scrubbed).not.toContain("Adresa Owner 5");
    // Numele păstrat când hideName=false
    expect(scrubbed).toContain("Owner Name");
  });
});

describe("Sanity: textul generat NU conține formule INTERZISE din vechiul AI", () => {
  const text = generateFormalText({
    tip: "parcare",
    locatie: "Strada X",
    nume: "Test",
    adresa: "Adresa Test",
    hasPhotos: true,
  });

  it(`NU conține "Subsemnatul" / "Subsemnata"`, () => {
    expect(text).not.toMatch(/Subsemnat(?:ul|a)/);
  });

  it(`NU conține "Vă sesizez cu privire la"`, () => {
    expect(text).not.toContain("Vă sesizez");
  });

  it(`NU conține fraze de minimizare`, () => {
    expect(text).not.toContain("rămâne spațiu");
    expect(text).not.toContain("li se asigură");
    expect(text).not.toContain("pot încă circula");
    expect(text).not.toContain("nu reprezintă o problemă");
  });

  it(`NU conține referințe la "domiciliul meu" / "blocul meu"`, () => {
    expect(text).not.toContain("domiciliul meu");
    expect(text).not.toContain("blocul meu");
    expect(text).not.toContain("casa mea");
  });

  it(`NU conține markdown (bold, italic, heading, code)`, () => {
    expect(text).not.toMatch(/\*\*[^*]+\*\*/);
    expect(text).not.toMatch(/^#+\s/m);
    expect(text).not.toMatch(/`[^`]+`/);
  });

  it(`NU conține JavaScript leakage (new Date, expresii)`, () => {
    expect(text).not.toContain("new Date");
    expect(text).not.toMatch(/\$\{[^}]+\}/);
    expect(text).not.toContain("toLocaleDateString");
  });
});

describe("Privacy: defense-in-depth pentru display name", () => {
  // Display name (prenume / primul cuvânt) era exposed public pe carduri
  // chiar și cu hideName=true. User a cerut „SA NU DEZVALUI INFO" pe
  // 2026-05-24 — verificăm aici constanta + rezultatul final pe public.
  // Acoperirea pe repository.ts e structurală (vitest nu poate testa
  // direct repository fără Supabase mock setup) — test-ul ăsta e contract
  // pe ce ar trebui să vadă userii ne-owneri.

  it(`numele complet nu apare nicăieri în textul public scrubat`, () => {
    const text = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      nume: "Calapod Bogdan",
      adresa: "Adresa Mea 5",
      hasPhotos: true,
    });
    const scrubbed = scrubFormalTextForPublic(text, {
      authorName: "Calapod Bogdan",
      hideName: true,
    });
    // Atât numele complet cât și prenumele individual NU mai apar
    expect(scrubbed).not.toContain("Calapod Bogdan");
    expect(scrubbed).not.toContain("Calapod");
    expect(scrubbed).not.toContain("Bogdan");
  });

  it(`numele single-word e redactat (chiar și fără surname)`, () => {
    const text = generateFormalText({
      tip: "groapa",
      locatie: "Strada X",
      nume: "Andrei",
      adresa: null,
      hasPhotos: false,
    });
    const scrubbed = scrubFormalTextForPublic(text, {
      authorName: "Andrei",
      hideName: true,
    });
    expect(scrubbed).not.toContain("Andrei");
  });
});

describe("Sanity: structura paragrafelor", () => {
  it(`paragrafele sunt separate prin linie goală`, () => {
    const text = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      nume: "Test",
      adresa: "Adresa Test",
      hasPhotos: false,
    });
    // Trebuie să avem cel puțin 6 paragrafe (intro + măsuri + nr înreg + mulțumiri + GDPR + semnătură)
    const paragraphs = text.split(/\n\n+/);
    expect(paragraphs.length).toBeGreaterThanOrEqual(7);
  });

  it(`liniile numerotate (1., 2.) NU sunt separate prin linie goală între ele`, () => {
    const text = generateFormalText({
      tip: "parcare",
      locatie: "Strada X",
      nume: "Test",
      adresa: "Adresa Test",
      hasPhotos: false,
    });
    // Așteptăm "1. ... \n2. ..." nu "1. ...\n\n2. ..."
    expect(text).toMatch(/^1\.\s+[^\n]+\n2\.\s+/m);
  });
});
