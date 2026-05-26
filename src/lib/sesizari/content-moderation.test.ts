import { describe, it, expect } from "vitest";
import { moderateSesizareContent } from "./content-moderation";

/**
 * 2026-05-26 — Acoperă cazuri raportate pe Reddit (dkrandu) — concern că
 * Civia trimite acum server-side și cineva ar putea pune o amenințare în
 * câmpul nume. Bloc pe threats clare + profanity în nume. Sesizările
 * legitime dure (critică directă, sarcasm, frustrare) trec.
 */
describe("moderateSesizareContent — amenințări blocate", () => {
  const baseArgs = {
    author_name: "Ion Popescu",
    titlu: "Probleme cu primăria",
    descriere: "Trotuarele sunt stricate.",
    locatie: "Strada Lipscani 5",
  };

  const blockedThreats: Array<[string, string]> = [
    ["te omor pe tine si pe familia ta", "moartea"],
    ["o sa te omor primare", "moartea"],
    ["va omor pe toti", "moartea"],
    ["te ucid daca nu rezolvi", "moartea"],
    ["arunc cu bomba in primarie", "explozibili"],
    ["dau cu bomba aici", "explozibili"],
    ["pun o bomba la voi", "explozibili"],
    ["te impusc dobitocule", "arma"],
    ["te impuscam in cap", "arma"],
    ["te tai daca te prind", "violență"],
    ["te bat pana mori", "bătaia"],
    ["dau foc la primarie", "incendiere"],
    ["arunc benzina pe voi", "incendiere"],
    ["atac terorist la primarie", "terorism"],
    ["pregatesc atentat", "terorism"],
  ];

  for (const [text, expectedTag] of blockedThreats) {
    it(`blochează: "${text}"`, () => {
      const r = moderateSesizareContent({
        ...baseArgs,
        descriere: text,
      });
      expect(r.block).toBe(true);
      expect(r.reason).toContain(expectedTag);
    });
  }
});

describe("moderateSesizareContent — sesizări legitime dure trec", () => {
  const baseArgs = {
    author_name: "Ion Popescu",
    titlu: "Probleme",
    descriere: "",
    locatie: "Strada Lipscani 5",
  };

  const allowed = [
    "Primaria nu face nimic de 6 luni, e revoltator!",
    "Sunt obosit de tonele de gunoi neridicate, va rog rezolvati",
    "Aceasta strada este o ruşine — nu se poate trai aici",
    "Pietonii sunt forțați să meargă pe carosabil — situație periculoasă",
    "Mașini parcate pe trotuar, nicio sancțiune — sabotaj total",
    "Iluminatul public e mort de săptămâni — accidente iminente",
    "Va plângem la Avocatul Poporului si la instanta",
    "Vreau sa stiu cine raspunde pentru aceasta nenorocire",
    "Daca nu reparati, voi merge in instanta", // nu e amenintare fizica
    "Sunt cetatean si platesc taxe — am dreptul la raspuns",
  ];

  for (const text of allowed) {
    it(`permite: "${text}"`, () => {
      const r = moderateSesizareContent({ ...baseArgs, descriere: text });
      expect(r.block).toBe(false);
    });
  }
});

describe("moderateSesizareContent — profanity în nume", () => {
  const baseArgs = {
    titlu: "Test",
    descriere: "Strada e stricata.",
    locatie: "Strada X",
  };

  const blockedNames = [
    "Pula Mea",
    "Iohannis pula",
    "muie psd",
    "Cacat plm",
    "țigan împuțit",
    "Bozgor cu PSD",
    "poponar caca",
  ];

  for (const name of blockedNames) {
    it(`blochează numele: "${name}"`, () => {
      const r = moderateSesizareContent({ ...baseArgs, author_name: name });
      expect(r.block).toBe(true);
      expect(r.reason).toContain("nume");
    });
  }

  it("blochează numele cu prea multe caractere ciudate", () => {
    const r = moderateSesizareContent({
      ...baseArgs,
      author_name: "@@@$$$###%%%",
    });
    expect(r.block).toBe(true);
  });

  it("blochează numele repetitiv (test/spam)", () => {
    const r = moderateSesizareContent({
      ...baseArgs,
      author_name: "xxxxxxxxx",
    });
    expect(r.block).toBe(true);
  });

  it("permite nume cu diacritice + cratima", () => {
    const r = moderateSesizareContent({
      ...baseArgs,
      author_name: "Andrei-Mihai Țăranu",
    });
    expect(r.block).toBe(false);
  });

  it("permite nume cu apostrof (D'Albert)", () => {
    const r = moderateSesizareContent({
      ...baseArgs,
      author_name: "Maria D'Albert",
    });
    expect(r.block).toBe(false);
  });
});

describe("moderateSesizareContent — cosign skip text moderation", () => {
  it("la cosign verifică doar numele co-semnatarului, nu re-moderează descriere", () => {
    // Descrierea originală deja moderată; co-semnatarul nu o poate modifica
    const r = moderateSesizareContent({
      author_name: "Maria Popescu",
      descriere: "te omor primare", // pretindem că ar fi pasat oricum
      locatie: "Strada X",
      isCosign: true,
    });
    expect(r.block).toBe(false);
  });

  it("la cosign blochează numele cu profanity", () => {
    const r = moderateSesizareContent({
      author_name: "Pula Mea",
      descriere: "ceva normal",
      locatie: "Strada X",
      isCosign: true,
    });
    expect(r.block).toBe(true);
  });
});
