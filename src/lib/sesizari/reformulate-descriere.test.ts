import { describe, it, expect } from "vitest";
import {
  scrubProfanity,
  cleanRegister,
  stripLeadingSolicitation,
  formalizeFallback,
  fallback,
  hasSolicitation,
  isPrimarilySolicitation,
  fallbackAddress,
} from "./reformulate-descriere";

describe("scrubProfanity", () => {
  it("scoate vulgaritățile uzuale", () => {
    expect(scrubProfanity("e plm de stricat")).toBe("e de stricat");
    expect(scrubProfanity("groapa asta wtf de mare")).toBe("groapa asta de mare");
  });

  it("NU atinge pronumele mă (regresie protejată)", () => {
    // PROFANITY_FILLER a fost ajustat să nu prindă „mă" pronume.
    expect(scrubProfanity("mă deranjează groapa")).toContain("mă deranjează");
  });
});

describe("cleanRegister", () => {
  it("normalizează ALL CAPS lung la litere mici", () => {
    expect(cleanRegister("GROAPA MARE PE CAROSABIL")).toBe("groapa mare pe carosabil");
  });

  it("NU strică un acronim scurt (sub pragul de 8 litere)", () => {
    // „SOS" (3 litere) nu e tratat ca strigăt → rămâne.
    expect(cleanRegister("SOS aici")).toContain("SOS");
  });

  it("transformă !!! / ??? în punct", () => {
    expect(cleanRegister("e stricat!!!")).toBe("e stricat.");
    expect(cleanRegister("de ce???")).toBe("de ce.");
  });

  it("mapează argou/colocvial + engleză la registru formal", () => {
    expect(cleanRegister("becu e praf")).toBe("becul este nefuncțional");
    expect(cleanRegister("am ratat bus")).toBe("am ratat autobuz");
  });

  it("e idempotent pe text deja formal", () => {
    const ok = "groapa pe carosabil este periculoasă";
    expect(cleanRegister(ok)).toBe(ok);
  });
});

describe("stripLeadingSolicitation", () => {
  it("păstrează problema de după conectorul cauzal deoarece", () => {
    const out = stripLeadingSolicitation(
      "Solicit montarea unui semafor deoarece mașinile circulă cu viteză mare prin intersecție",
    );
    expect(out).toBe("Mașinile circulă cu viteză mare prin intersecție");
  });

  it("lasă neatins un text care NU începe cu o cerere", () => {
    const desc = "Groapă mare pe carosabil, periculoasă pentru mașini";
    expect(stripLeadingSolicitation(desc)).toBe(desc);
  });
});

describe("hasSolicitation", () => {
  it("detectează cererile", () => {
    // forme ASCII (cetățean fără diacritice) — char-class-urile [ăa]/[țt] le prind
    expect(hasSolicitation("Solicitam interventia primariei")).toBe(true);
    expect(hasSolicitation("Cerem repararea trotuarului")).toBe(true);
    expect(hasSolicitation("Va rugam sa interveniti urgent")).toBe(true);
  });
  it("nu marchează o descriere pură", () => {
    expect(hasSolicitation("Groapă mare pe carosabil")).toBe(false);
  });
});

describe("isPrimarilySolicitation", () => {
  it("e TRUE pentru o cerere scurtă & pură", () => {
    expect(isPrimarilySolicitation("Solicit stâlpișori pe trotuar")).toBe(true);
    expect(isPrimarilySolicitation("Montați un limitator de viteză")).toBe(true);
  });

  it("e FALSE când există descriere de problemă (conector cauzal) — regresie 2026-06-06", () => {
    // Bug-ul: o cerere CU context era înlocuită cu boilerplate generic, pierzând
    // ce a scris cetățeanul. Conectorul cauzal => reformulare integrală, nu boilerplate.
    expect(
      isPrimarilySolicitation(
        "Solicit stâlpișori deoarece mașinile parchează pe trotuar și blochează pietonii",
      ),
    ).toBe(false);
  });

  it("e FALSE pentru text lung (peste 90 caractere)", () => {
    const lung =
      "Solicit montarea unor stâlpișori pe toată lungimea trotuarului de pe strada principală din cartier";
    expect(lung.length).toBeGreaterThan(90);
    expect(isPrimarilySolicitation(lung)).toBe(false);
  });

  it("e FALSE pentru o descriere de problemă", () => {
    expect(isPrimarilySolicitation("Groapă mare pe carosabil periculoasă")).toBe(false);
  });
});

describe("formalizeFallback", () => {
  it("taie cererea din față + scoate umplutura + curăță registrul", () => {
    const out = formalizeFallback("FACETI CEVA va rog, becu e praf!!!");
    // fără „faceți ceva", fără „vă rog", argou mapat, fără majuscule strigate
    expect(out.toLowerCase()).not.toContain("faceti ceva");
    expect(out.toLowerCase()).not.toContain("va rog");
    expect(out).not.toMatch(/!{2,}/);
  });
});

describe("fallback", () => {
  it("capitalizează prima literă + termină cu punct", () => {
    const out = fallback("groapa mare pe carosabil");
    expect(out[0]).toBe(out[0]?.toUpperCase());
    expect(out.endsWith(".")).toBe(true);
  });

  it("nu adaugă punct dublu dacă există deja terminație", () => {
    expect(fallback("este periculos!")).toMatch(/[.!?]$/);
    expect(fallback("este periculos!")).not.toMatch(/[.!?]{2,}$/);
  });

  it("string gol → string gol", () => {
    expect(fallback("")).toBe("");
  });
});

describe("fallbackAddress", () => {
  it("capitalizează numele proprii, păstrează conectorii mici", () => {
    const out = fallbackAddress("bulevardul mihai viteazul");
    expect(out.startsWith("Bulevardul")).toBe(true);
    expect(out).toContain("Mihai");
    expect(out).toContain("Viteazul");
  });

  it("primul cuvânt e mereu capitalizat chiar dacă e conector", () => {
    const out = fallbackAddress("la intersecția mare");
    expect(out[0]).toBe(out[0]?.toUpperCase());
  });
});
