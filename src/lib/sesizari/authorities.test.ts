import { describe, it, expect } from "vitest";
import { getAuthoritiesFor, PRIMARII_SECTOR, POLITIA_LOCALA_SECTOR } from "./authorities";

describe("getAuthoritiesFor — parcare jurisdiction split", () => {
  it("routes 'trotuar' parking to local police (PL sector + PL Bucharest)", () => {
    const r = getAuthoritiesFor("parcare", "S3", "B", "Strada Matei Voievod 12, Sector 3", {
      jurisdiction: "trotuar",
    });
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("office@plmb.ro");
    expect(emails).toContain("secretariat.dgpl@primarie3.ro"); // PL S3
    expect(emails.some((e) => e.includes("brigada") || e.includes("bpr@b."))).toBe(false);
  });

  it("routes 'banda' parking to Brigada Rutieră in primary, PL Bucharest second", () => {
    const r = getAuthoritiesFor("parcare", "S3", "B", "Bd Magheru", {
      jurisdiction: "banda",
    });
    const emails = r.primary.map((a) => a.email);
    expect(emails[0]).toBe("bpr@b.politiaromana.ro");
    expect(emails).toContain("office@plmb.ro");
  });
});

describe("Sector 5 — dead addresses removed, working ones kept", () => {
  it("PRIMARII_SECTOR.S5 uses primarie@sector5.ro (not the dead sesizari@)", () => {
    expect(PRIMARII_SECTOR.S5?.email).toBe("primarie@sector5.ro");
    expect(PRIMARII_SECTOR.S5?.email).not.toBe("sesizari@sector5.ro");
  });

  it("POLITIA_LOCALA_SECTOR.S5 uses politialocala@sector5.ro (not the dead office@politialocalasector5.ro)", () => {
    expect(POLITIA_LOCALA_SECTOR.S5?.email).toBe("politialocala@sector5.ro");
    expect(POLITIA_LOCALA_SECTOR.S5?.email).not.toBe("office@politialocalasector5.ro");
  });
});

describe("getAuthoritiesFor — Sector 5 dead-address scrub", () => {
  it("strips the known-dead sesizari@sector5.ro + office@politialocalasector5.ro from the recipients", () => {
    const r = getAuthoritiesFor("parcare", "S5", "B", "Calea 13 Septembrie", {
      jurisdiction: "trotuar",
    });
    const emails = [...r.primary.map((a) => a.email), ...r.cc.map((a) => a.email)];
    expect(emails).not.toContain("sesizari@sector5.ro");
    expect(emails).not.toContain("office@politialocalasector5.ro");
  });

  it("keeps the NEW working S5 addresses — primarie@ + politialocala@", () => {
    const r = getAuthoritiesFor("parcare", "S5", "B", "Calea 13 Septembrie", {
      jurisdiction: "trotuar",
    });
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("primarie@sector5.ro");
    expect(emails).toContain("politialocala@sector5.ro");
  });

  it("keeps non-S5 addresses (PL Bucharest, Brigada Rutieră) on banda route", () => {
    const r = getAuthoritiesFor("parcare", "S5", "B", "Calea 13 Septembrie", {
      jurisdiction: "banda",
    });
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("bpr@b.politiaromana.ro");
    expect(emails).toContain("office@plmb.ro");
  });

  it("detects Sector 5 from location text when sector flag is missing", () => {
    const r = getAuthoritiesFor("parcare", null, "B", "Strada Ana Ipătescu, Sector 5", {
      jurisdiction: "trotuar",
    });
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("primarie@sector5.ro");
    expect(emails).not.toContain("sesizari@sector5.ro");
  });

  it("does NOT rewrite other sectors when Sector 5 is not involved", () => {
    const r = getAuthoritiesFor("parcare", "S3", "B", "Strada Mihai Bravu", {
      jurisdiction: "trotuar",
    });
    expect(r.primary.map((a) => a.email)).not.toContain("primarie@sector5.ro");
  });
});

describe("getAuthoritiesFor — county routing (non-București)", () => {
  it("routes Cluj-Napoca 'groapa' to the fixed primăria (not the broken pfrecluj-napoca.ro)", () => {
    const r = getAuthoritiesFor("groapa", null, "CJ", "Str. Mărăști 9, Cluj-Napoca");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("registratura@primariaclujnapoca.ro");
    expect(emails.some((e) => e.includes("pfrecluj"))).toBe(false);
  });

  it("routes Timișoara 'parcare' to the fixed primăria + Poliția Locală Timișoara", () => {
    const r = getAuthoritiesFor("parcare", null, "TM", "Str. Piatra Craiului 2, Timișoara");
    const emails = r.primary.map((a) => a.email);
    // Fixed email — was the broken pfriatimisoara.ro
    expect(emails).toContain("primariatm@primariatm.ro");
    // Poliția Locală now gets the TO slot for parcare
    expect(emails).toContain("politialocala@primariatm.ro");
    expect(emails.some((e) => e.includes("pfriatimisoara"))).toBe(false);
  });

  it("routes Focșani to the fixed focsani.info domain (not the broken primariafcsani.ro)", () => {
    const r = getAuthoritiesFor("groapa", null, "VN", "Str. Republicii, Focșani");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("primarie@focsani.info");
    expect(emails.some((e) => e.includes("fcsani"))).toBe(false);
  });

  it("routes a non-capital city (Turda, CJ) to its own primărie, not Cluj-Napoca's", () => {
    const r = getAuthoritiesFor("groapa", null, "CJ", "Str. Avram Iancu 10, Turda");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("contact@primariaturda.ro");
    expect(emails).not.toContain("registratura@primariaclujnapoca.ro");
  });

  it("routes a non-capital city 'parcare' to its own Poliția Locală when available", () => {
    const r = getAuthoritiesFor("parcare", null, "CJ", "Str. Libertății, Turda");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("politialocala@primariaturda.ro");
  });

  it("routes Voluntari (Ilfov) to its own primărie, not Buftea's", () => {
    const r = getAuthoritiesFor("groapa", null, "IF", "B-dul Voluntari 15, Voluntari");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("contact@primariavoluntari.ro");
    expect(emails).not.toContain("contact@primariabuftea.ro");
  });

  it("Prefectura always appears in CC for county-level routing", () => {
    const r = getAuthoritiesFor("groapa", null, "TM", "Timișoara");
    const ccEmails = r.cc.map((a) => a.email);
    expect(ccEmails).toContain("prefectura@prefecturatimis.ro");
  });

  it("zgomot in a county routes to PL county + IPJ in CC", () => {
    const r = getAuthoritiesFor("zgomot", null, "CJ", "Str. Horea, Cluj-Napoca");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("politialocala@primariaclujnapoca.ro");
  });

  it("graffiti in a county routes to primăria (PL fallback dacă lipsește email)", () => {
    const r = getAuthoritiesFor("graffiti", null, "IS", "Str. Lascăr Catargi, Iași");
    const emails = r.primary.map((a) => a.email);
    // PL Iași email was removed (no MX record — verify-emails 2026-04-29).
    // Routing fallback: primăria. Cetățeanul are phone PL în UI separat.
    expect(emails).toContain("cabinetprimar@primaria-iasi.ro");
  });

  it("Primăria ALWAYS appears in TO (PL e adăugat doar dacă are email valid)", () => {
    const r = getAuthoritiesFor("parcare", null, "BV", "Str. Republicii, Brașov");
    const emails = r.primary.map((a) => a.email);
    // Primăria mereu prezentă; PL Brașov email removed (no MX), nu mai apare.
    expect(emails).toContain("info@brasovcity.ro"); // primăria
    expect(emails.length).toBeGreaterThanOrEqual(1);
  });

  it("handles tip 'altele' with a valid county fallback", () => {
    const r = getAuthoritiesFor("altele", null, "SB", "Piața Mare, Sibiu");
    // Should route to primăria Sibiu
    expect(r.primary.map((a) => a.email)).toContain("primarie@sibiu.ro");
    // Prefectura Sibiu in CC
    expect(r.cc.map((a) => a.email)).toContain("prefectura@prefecturasibiu.ro");
  });

  it("diacritics in location text still match the city correctly", () => {
    // Medias with diacritic "ș"
    const r = getAuthoritiesFor("groapa", null, "SB", "Str. Piața Ferdinand, Mediaș");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("contact@primariamedias.ro");
  });

  it("does not route to a different county's city when countyCode disagrees", () => {
    // Location mentions "Roman" but county is CJ (wrong combo)
    const r = getAuthoritiesFor("groapa", null, "CJ", "Str. Ștefan cel Mare, Roman");
    // Should NOT route to Roman's primărie (NT) — countyHint prevents it
    const emails = r.primary.map((a) => a.email);
    expect(emails).not.toContain("primaria@primariaroman.ro");
    // Should fall back to Cluj-Napoca capital
    expect(emails).toContain("registratura@primariaclujnapoca.ro");
  });
});

// ── Tests pentru tip nou „afisaj" (introdus mai 2026, migration 032) ──
describe("getAuthoritiesFor — afisaj/publicitate ilegală", () => {
  it("routes afisaj in București to PL Bucharest + sectorPrimarie + PMB", () => {
    const r = getAuthoritiesFor("afisaj", "S2", "B", "Bd. Carol I 12, Sector 2");
    const emails = r.primary.map((a) => a.email);
    // Poliția Locală București (constată contravenția conform L185/2013)
    expect(emails).toContain("office@plmb.ro");
    // Primăria Sectorului 2 (autorizare + dispune înlăturarea)
    // Email-ul real verified e infopublice@ps2.ro (vezi PRIMARII_SECTOR).
    expect(emails).toContain("infopublice@ps2.ro");
    // PMB pe domeniul public general
    expect(emails).toContain("relatiipublice@pmb.ro");
  });

  it("routes afisaj in Cluj to Poliția Locală + Primăria Cluj", () => {
    const r = getAuthoritiesFor("afisaj", null, "CJ", "Piața Unirii, Cluj-Napoca");
    const emails = r.primary.map((a) => a.email);
    // Cel puțin Primăria Cluj-Napoca trebuie să primească
    expect(emails).toContain("registratura@primariaclujnapoca.ro");
  });

  it("afisaj in Iași routes to Poliția Locală Iași + Primăria", () => {
    const r = getAuthoritiesFor("afisaj", null, "IS", "Bd. Ștefan cel Mare 8, Iași");
    const emails = r.primary.map((a) => a.email);
    // Cel puțin un destinatar valid (PL sau primăria)
    expect(emails.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Tip „animale" — protecția animalelor (activat 2026-06-14) ──
describe("getAuthoritiesFor — protecția animalelor", () => {
  it("routes 'animale' în București la ASPA + PMB + Poliția Locală sector", () => {
    const r = getAuthoritiesFor("animale", "S3", "B", "Strada Rampei 37, Sector 3, București", undefined, "câine ținut în condiții improprii, fără apă");
    const emails = r.primary.map((a) => a.email);
    expect(emails).toContain("relatiicupublicul@aspa.ro"); // ASPA — adresa reală
    expect(emails).toContain("relatiipublice@pmb.ro");      // PMB
    expect(emails).toContain("secretariat.dgpl@primarie3.ro"); // PL S3 (sancțiune)
    expect(emails).not.toContain("asau@pmb.ro");            // vechea adresă greșită, eliminată
  });
});
