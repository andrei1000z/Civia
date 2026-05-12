import { describe, it, expect } from "vitest";
import {
  capitalizeName,
  formatAddress,
  normalizeRoLocation,
  appendGdprClause,
  GDPR_CLAUSE,
  repairSesizareLeaks,
} from "./format-helpers";

describe("capitalizeName", () => {
  it("capitalizes single word", () => {
    expect(capitalizeName("ion")).toBe("Ion");
  });

  it("capitalizes multi-word names", () => {
    expect(capitalizeName("ion popescu")).toBe("Ion Popescu");
  });

  it("downcases ALL CAPS input", () => {
    expect(capitalizeName("ION POPESCU")).toBe("Ion Popescu");
  });

  it("collapses multiple spaces", () => {
    expect(capitalizeName("ion   popescu")).toBe("Ion Popescu");
  });

  it("trims surrounding whitespace", () => {
    expect(capitalizeName("  Ion  ")).toBe("Ion");
  });

  it("handles empty input", () => {
    expect(capitalizeName("")).toBe("");
  });

  it("preserves Romanian diacritics", () => {
    expect(capitalizeName("ștefan munteanu")).toBe("Ștefan Munteanu");
  });

  it("handles 3+ word names", () => {
    expect(capitalizeName("maria ileana popescu")).toBe("Maria Ileana Popescu");
  });
});

describe("formatAddress", () => {
  it("capitalizes first letter", () => {
    expect(formatAddress("strada matei voievod")).toBe("Strada matei voievod");
  });

  it("trims surrounding whitespace", () => {
    expect(formatAddress("  Strada Matei  ")).toBe("Strada Matei");
  });

  it("handles empty input", () => {
    expect(formatAddress("")).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(formatAddress("   ")).toBe("");
  });

  it("preserves rest of the string casing", () => {
    expect(formatAddress("strada IOAN nr. 12")).toBe("Strada IOAN nr. 12");
  });

  it("handles single character", () => {
    expect(formatAddress("a")).toBe("A");
  });
});

describe("normalizeRoLocation", () => {
  it("fixes the real-world Vasile Lascar case", () => {
    expect(
      normalizeRoLocation("strada Vasile Lascar in capat cu Bulevardul Stefan cel Mare"),
    ).toBe("Strada Vasile Lascar în capătul cu Bulevardul Ștefan cel Mare");
  });

  it("title-cases street types", () => {
    expect(normalizeRoLocation("strada matei voievod 12")).toBe("Strada matei voievod 12");
    expect(normalizeRoLocation("bulevardul magheru")).toBe("Bulevardul magheru");
    expect(normalizeRoLocation("calea victoriei")).toBe("Calea victoriei");
    expect(normalizeRoLocation("soseaua kiseleff")).toBe("Șoseaua kiseleff");
    expect(normalizeRoLocation("piata victoriei")).toBe("Piața victoriei");
  });

  it("adds diacritics to common Romanian intersection words", () => {
    expect(normalizeRoLocation("la intersectia cu strada X")).toBe(
      "La intersecția cu Strada X",
    );
    expect(normalizeRoLocation("colt cu calea Mosilor")).toBe("Colț cu Calea Mosilor");
    expect(normalizeRoLocation("in dreptul scolii")).toBe("În dreptul scolii");
    expect(normalizeRoLocation("pe langa parc")).toBe("Pe lângă parc");
  });

  it("fixes proper nouns", () => {
    expect(normalizeRoLocation("Strada Stefan cel Mare")).toBe("Strada Ștefan cel Mare");
    expect(normalizeRoLocation("Iasi, Bulevardul X")).toBe("Iași, Bulevardul X");
    expect(normalizeRoLocation("Targu Mures")).toBe("Târgu Mureș");
  });

  it("does not corrupt already-diacritic input", () => {
    expect(normalizeRoLocation("Strada Vasile Lascăr, în capătul cu Bulevardul Ștefan cel Mare")).toBe(
      "Strada Vasile Lascăr, în capătul cu Bulevardul Ștefan cel Mare",
    );
  });

  it("handles empty input", () => {
    expect(normalizeRoLocation("")).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeRoLocation("  strada Y  ")).toBe("Strada Y");
  });

  it("does not mangle standalone 'in' inside other words", () => {
    expect(normalizeRoLocation("Linus Pauling in capat")).toBe("Linus Pauling în capăt");
  });
});

describe("appendGdprClause", () => {
  it("inserts GDPR clause before 'Cu stimă,' signature", () => {
    const input = `Bună ziua,

Mă numesc Ion Popescu și locuiesc pe strada X.

[corp sesizare...]

Vă mulțumesc anticipat.

Cu stimă,
Ion Popescu
4 mai 2026`;
    const out = appendGdprClause(input);
    // Clauza e prezentă
    expect(out).toContain(GDPR_CLAUSE);
    // E înainte de „Cu stimă"
    expect(out.indexOf(GDPR_CLAUSE)).toBeLessThan(out.indexOf("Cu stimă,"));
    // Semnătura + numele rămân după clauză, în ordinea originală
    expect(out.indexOf("Cu stimă,")).toBeLessThan(out.indexOf("Ion Popescu\n4 mai 2026"));
  });

  it("inserts before 'Cu respect,' variant", () => {
    const input = `Bună ziua,\n\nText...\n\nCu respect,\nNume\n4 mai 2026`;
    const out = appendGdprClause(input);
    expect(out).toContain(GDPR_CLAUSE);
    expect(out.indexOf(GDPR_CLAUSE)).toBeLessThan(out.indexOf("Cu respect,"));
  });

  it("appends at end if no signature found", () => {
    const input = "Bună ziua, problemă X.";
    const out = appendGdprClause(input);
    expect(out).toContain(GDPR_CLAUSE);
    expect(out.endsWith(GDPR_CLAUSE)).toBe(true);
  });

  it("is idempotent — does not duplicate clause on repeated calls", () => {
    const input = `Text\n\nCu stimă,\nNume`;
    const once = appendGdprClause(input);
    const twice = appendGdprClause(once);
    expect(twice).toBe(once);
    // Verify exact one occurrence
    const occurrences = once.split("Regulamentului (UE) 2016/679").length - 1;
    expect(occurrences).toBe(1);
  });

  it("handles empty/null-ish input safely", () => {
    expect(appendGdprClause("")).toBe("");
    expect(appendGdprClause("   ")).toContain("Regulamentului (UE) 2016/679");
  });

  it("preserves blank-line spacing around inserted clause", () => {
    const input = `Vă mulțumesc.\n\nCu stimă,\nNume`;
    const out = appendGdprClause(input);
    // Format expected: empty line, clause, empty line, signature
    const lines = out.split("\n");
    const clauseIdx = lines.findIndex((l) => l.startsWith("În temeiul Regulamentului"));
    expect(clauseIdx).toBeGreaterThan(0);
    expect(lines[clauseIdx - 1]).toBe(""); // blank before
    expect(lines[clauseIdx + 1]).toBe(""); // blank after
  });
});

describe("formatAddress", () => {
  it("trim + capitalize prima litera", () => {
    
    expect(formatAddress("  strada Florilor 12  ")).toBe("Strada Florilor 12");
  });

  it("strip Sector X. Y trailing duplicate", () => {
    
    expect(formatAddress("Strada Novaci 12, Sector 5. 12")).toBe("Strada Novaci 12, Sector 5");
  });

  it("nu modifica adresa fara artifact", () => {
    
    expect(formatAddress("Bulevardul Magheru 7")).toBe("Bulevardul Magheru 7");
  });

  it("empty input -> empty", () => {
    
    expect(formatAddress("")).toBe("");
    expect(formatAddress("   ")).toBe("");
  });

  it("Sector 5. 123 pastreaza forma cu 3-digit number", () => {
    
    // 3 digits inca prinde (max 1-3 cifre dupa punct)
    expect(formatAddress("Strada X, Sector 5. 999")).toBe("Strada X, Sector 5");
  });
});

describe("capitalizeName", () => {
  it("transforma ALL CAPS in Title Case", () => {
    
    expect(capitalizeName("ION POPESCU")).toBe("Ion Popescu");
  });

  it("transforma lowercase in Title Case", () => {
    
    expect(capitalizeName("ion popescu")).toBe("Ion Popescu");
  });

  it("pastreaza nume deja capitalizate", () => {
    
    expect(capitalizeName("Ion Popescu")).toBe("Ion Popescu");
  });

  it("compacteaza spatii multiple", () => {
    
    expect(capitalizeName("ion    popescu")).toBe("Ion Popescu");
  });

  it("trim leading/trailing", () => {
    
    expect(capitalizeName("  ion popescu  ")).toBe("Ion Popescu");
  });
});

describe("normalizeRoLocation", () => {
  it("adauga diacritice la nume orase fara", () => {
    
    expect(normalizeRoLocation("Strada X, Bucuresti")).toContain("București");
    expect(normalizeRoLocation("Iasi")).toContain("Iași");
    expect(normalizeRoLocation("Constanta")).toContain("Constanța");
    expect(normalizeRoLocation("Timisoara")).toContain("Timișoara");
  });

  it("normalizeaza fraza-cheie 'in capatul cu' -> 'in capătul cu'", () => {
    
    const out = normalizeRoLocation("strada X in capatul cu strada Y");
    expect(out).toContain("în capătul cu");
  });

  it("normalizeaza 'la intersectia cu' -> 'la intersecția cu'", () => {
    
    expect(normalizeRoLocation("Calea Victoriei la intersectia cu Romana")).toContain("la intersecția cu");
  });

  it("'Stefan' -> 'Ștefan' (numele propriu)", () => {
    
    expect(normalizeRoLocation("Bd Stefan cel Mare")).toContain("Ștefan");
  });

  it("empty input -> empty", () => {
    
    expect(normalizeRoLocation("")).toBe("");
  });

  it("orase compus: Satu Mare, Baia Mare, Targu Mures", () => {
    
    expect(normalizeRoLocation("Strada Y, satu mare")).toContain("Satu Mare");
    expect(normalizeRoLocation("baia mare")).toContain("Baia Mare");
    expect(normalizeRoLocation("targu mures")).toContain("Târgu Mureș");
  });
});

describe("appendGdprClause", () => {
  it("adauga clauza GDPR inainte de semnatura 'Cu stima'", () => {
    
    const input = "Bună ziua.\n\nMesaj.\n\nCu stimă,\nIon";
    const out = appendGdprClause(input);
    expect(out).toContain("Regulamentului (UE) 2016/679");
    expect(out.indexOf("Regulamentului")).toBeLessThan(out.indexOf("Cu stimă"));
  });

  it("idempotent: re-run pe text cu clauza nu o dubleaza", () => {
    
    const input = "Mesaj.\n\nCu stimă,\nIon";
    const once = appendGdprClause(input);
    const twice = appendGdprClause(once);
    // Aceeasi clauza nu apare de doua ori
    const matches = (twice.match(/Regulamentului \(UE\) 2016\/679/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it("fara semnatura: append la final", () => {
    
    const input = "Mesaj fara semnatura.";
    const out = appendGdprClause(input);
    expect(out).toContain("Regulamentului (UE) 2016/679");
    expect(out.endsWith(".")).toBe(true);
  });

  it("empty input -> empty", () => {
    
    expect(appendGdprClause("")).toBe("");
  });
});

describe("repairSesizareLeaks", () => {
  it("rescrie 'Subsemnatul X, domiciliat în Y' → 'Mă numesc X și locuiesc în Y'", () => {
    const input = "Bună ziua, Subsemnatul Ion Popescu, domiciliat în Strada Florilor, vă rog...";
    const out = repairSesizareLeaks(input);
    expect(out).not.toMatch(/Subsemnatul/i);
    expect(out).not.toMatch(/domiciliat în/i);
    expect(out).toContain("Mă numesc Ion Popescu și locuiesc în Strada Florilor");
  });

  it("rescrie 'Subsemnata X, domiciliată în Y' (feminin)", () => {
    const input = "Subsemnata Maria Popescu, domiciliată în București, vă rog...";
    const out = repairSesizareLeaks(input);
    expect(out).not.toMatch(/Subsemnata/i);
    expect(out).toContain("Mă numesc Maria Popescu și locuiesc în București");
  });

  it("rescrie 'Vă sesizez cu privire la X' (capitalized + lowercase)", () => {
    const input1 = "Vă sesizez cu privire la lipsa stâlpișorilor pe Bulevardul Decebal.";
    const input2 = "În acest sens, vă sesizez cu privire la gropi în asfalt.";
    const out1 = repairSesizareLeaks(input1);
    const out2 = repairSesizareLeaks(input2);
    expect(out1).toContain("doresc să vă aduc la cunoștință o problemă care afectează lipsa stâlpișorilor");
    expect(out2).toContain("doresc să vă aduc la cunoștință o problemă care afectează gropi");
    expect(out1 + out2).not.toMatch(/sesizez cu privire la/i);
  });

  it("strip-uiește placeholder-uri ne-substituite [ADRESA] / {NUMELE}", () => {
    const input = "Mă numesc Ion, locuiesc în [ADRESA], doresc să...";
    const out = repairSesizareLeaks(input);
    expect(out).not.toContain("[ADRESA]");
    // Cu strip-ul, structura devine „Mă numesc Ion, doresc să..."
    expect(out).toMatch(/Mă numesc Ion,?\s+doresc/);
  });

  it("strip-uiește placeholder generic { TOKEN } în corpul textului", () => {
    const input = "Pe {LOCAȚIA_PROBLEMEI} a apărut o groapă.";
    const out = repairSesizareLeaks(input);
    expect(out).not.toContain("{LOCAȚIA_PROBLEMEI}");
    expect(out).toContain("Pe");
    expect(out).toContain("a apărut o groapă");
  });

  it("strip-uieste minimizari AI: ramanand spatiu de trecere de X metri", () => {
    const input = "Masinile ocupa o parte din latimea trotuarului, rămânând spațiu de trecere de aproximativ 1-2 metri. Acest lucru pune in pericol pietonii.";
    const out = repairSesizareLeaks(input);
    expect(out).not.toContain("rămânând spațiu");
    expect(out).not.toContain("1-2 metri");
    expect(out).toContain("Masinile ocupa o parte din latimea trotuarului");
    expect(out).toContain("pune in pericol pietonii");
  });

  it("strip-uieste aproximativ N masini -> mai multe masini", () => {
    const input = "Astazi am constatat ca aproximativ 10 mașini ocupa trotuarul.";
    const out = repairSesizareLeaks(input);
    expect(out).not.toMatch(/aproximativ \d+ ma[șs]ini/i);
    expect(out).toContain("mai multe mașini");
  });

  it("strip-uieste masinile ocupa aproximativ X% din latime", () => {
    const input = "Observ ca mașinile ocupă aproximativ 60% din lățimea trotuarului in zona.";
    const out = repairSesizareLeaks(input);
    expect(out).not.toMatch(/aproximativ \d+\s*%/);
    expect(out).toContain("trotuarul este ocupat de mașini parcate");
  });

  it("este idempotent (re-run = no-op pe text deja reparat)", () => {
    const input = "Subsemnatul Ion, domiciliat în București, vă sesizez cu privire la gunoi.";
    const once = repairSesizareLeaks(input);
    const twice = repairSesizareLeaks(once);
    expect(twice).toBe(once);
  });

  it("nu strică text fără leaks", () => {
    const clean =
      "Bună ziua,\n\nMă numesc Ion și locuiesc pe strada Tei. Doresc să vă aduc la cunoștință o problemă.\n\nCu stimă,\nIon";
    expect(repairSesizareLeaks(clean)).toBe(clean);
  });

  it("curăță virgule duble / spații duble lăsate de strip-uri", () => {
    const input = "Mă numesc Ion, locuiesc în [ADRESA], doresc să raportez.";
    const out = repairSesizareLeaks(input);
    expect(out).not.toMatch(/,\s*,/);
    expect(out).not.toMatch(/  /);
  });
});
