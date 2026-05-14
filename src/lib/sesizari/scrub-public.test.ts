import { describe, it, expect } from "vitest";
import { scrubFormalTextForPublic } from "./scrub-public";

const NEW_OPENER = `Bună ziua,

Mă numesc Ion Andrei Popescu, locuiesc în Strada Novaci 12, Sector 5 și doresc să vă aduc la cunoștință o problemă care afectează siguranța pietonilor pe Calea 13 Septembrie.

În ultima perioadă, am observat că mașinile opresc și parchează pe trotuar.

Cu stimă,
Ion Andrei Popescu
20 martie 2024`;

const LEGACY_OPENER = `Bună ziua,

Subsemnatul Ion Andrei Popescu, domiciliat în Strada Novaci 12, Sector 5, vă adresez prezenta sesizare în temeiul OG 27/2002.

Cu respect,
Ion Andrei Popescu
20 martie 2024`;

describe("scrubFormalTextForPublic", () => {
  it("redacts address in new opener, keeps name when hideName=false", () => {
    const out = scrubFormalTextForPublic(NEW_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: false,
    });
    expect(out).not.toContain("Strada Novaci 12");
    expect(out).not.toContain("Sector 5 și doresc"); // address removed
    expect(out).toContain("[adresa]");
    expect(out).toContain("Ion Andrei Popescu"); // name kept
  });

  it("redacts both address and name when hideName=true", () => {
    const out = scrubFormalTextForPublic(NEW_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: true,
    });
    expect(out).not.toContain("Ion Andrei Popescu");
    expect(out).not.toContain("Strada Novaci 12");
    expect(out).toContain("[nume]");
    expect(out).toContain("[adresa]");
  });

  it("keeps the 'și doresc...' tail intact after opener scrub", () => {
    const out = scrubFormalTextForPublic(NEW_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: false,
    });
    expect(out).toContain("doresc să vă aduc la cunoștință");
  });

  it("redacts legacy 'Subsemnatul' opener address", () => {
    const out = scrubFormalTextForPublic(LEGACY_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: false,
    });
    expect(out).not.toContain("Strada Novaci 12");
    expect(out).toContain("[adresa]");
  });

  it("redacts legacy opener name when hidden", () => {
    const out = scrubFormalTextForPublic(LEGACY_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: true,
    });
    expect(out).not.toContain("Ion Andrei Popescu");
    expect(out).toContain("[nume]");
  });

  it("redacts signature when hideName=true", () => {
    const out = scrubFormalTextForPublic(NEW_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: true,
    });
    // Signature line should have the redacted name, not the real one
    const sigMatch = out.match(/Cu stim[ăa],\s*\n([^\n]+)/);
    expect(sigMatch?.[1]).toBe("[nume]");
  });

  it("handles empty text", () => {
    expect(scrubFormalTextForPublic("", { authorName: "x", hideName: false })).toBe("");
  });

  it("leaves non-identity content untouched", () => {
    const out = scrubFormalTextForPublic(NEW_OPENER, {
      authorName: "Ion Andrei Popescu",
      hideName: false,
    });
    expect(out).toContain("Calea 13 Septembrie"); // location of problem stays
    expect(out).toContain("mașinile opresc și parchează pe trotuar");
  });

  it("redacts standalone occurrences of the name when hideName=true", () => {
    const text = "Eu, Ion Andrei Popescu, confirm. Altă mențiune: Ion Andrei Popescu.";
    const out = scrubFormalTextForPublic(text, {
      authorName: "Ion Andrei Popescu",
      hideName: true,
    });
    expect(out).not.toContain("Ion Andrei Popescu");
    expect((out.match(/\[nume\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("captures full multi-comma address with Sector marker", () => {
    const text = `Mă numesc Ion Popescu, locuiesc în Strada Novaci 12, Sector 5, București și doresc să vă aduc la cunoștință.`;
    const out = scrubFormalTextForPublic(text, {
      authorName: "Ion Popescu",
      hideName: false,
    });
    expect(out).not.toContain("Strada Novaci");
    expect(out).not.toContain("Sector 5");
    expect(out).not.toContain("București și");
    expect(out).toContain("[adresa]");
  });

  it("handles address with Romanian abbreviations (Str., nr., bl., ap.)", () => {
    const text = `Mă numesc Maria Ionescu, locuiesc pe Str. Novaci nr. 12, bl. A3, sc. 1, ap. 15, Sector 5 și doresc să semnalez.`;
    const out = scrubFormalTextForPublic(text, {
      authorName: "Maria Ionescu",
      hideName: false,
    });
    expect(out).not.toContain("Novaci");
    expect(out).not.toContain("bl. A3");
    expect(out).not.toContain("ap. 15");
    expect(out).toContain("[adresa]");
    expect(out).toContain("doresc să semnalez");
  });

  it("scrubs address even when opener uses 'vă aduc' instead of 'și doresc'", () => {
    const text = `Mă numesc Dan Radu, locuiesc în Bulevardul Dinicu Golescu 30, Sector 1, București, vă aduc la cunoștință problema.`;
    const out = scrubFormalTextForPublic(text, {
      authorName: "Dan Radu",
      hideName: false,
    });
    expect(out).not.toContain("Dinicu Golescu 30");
    expect(out).not.toContain("Sector 1, București,");
    expect(out).toContain("[adresa]");
  });

  it("scrubs address when the clause ends at paragraph break (no 'și doresc')", () => {
    const text = `Mă numesc Ana Dobre, locuiesc în Aleea Teilor 5, Sector 3, București.

În ultima perioadă am observat...`;
    const out = scrubFormalTextForPublic(text, {
      authorName: "Ana Dobre",
      hideName: false,
    });
    expect(out).not.toContain("Aleea Teilor 5");
    expect(out).not.toContain("Sector 3, București");
    expect(out).toContain("[adresa]");
    expect(out).toContain("În ultima perioadă am observat");
  });

  // ─── REGRESSION GUARDS ─────────────────────────────────────────────
  // Aceste teste sunt cazuri reale raportate de useri. Fiecare a cauzat
  // un GDPR-leak in productie. Nu le sterge — daca cad, e regres serios.

  it("[regression 2026-05-14] scrubs PII when connector is 'și' instead of ','", () => {
    // Format AI „Mă numesc X și locuiesc în Y" (fara virgula intre nume
    // si verb) treceau nescrubate prin regex-ul vechi → numele + adresa
    // autorului original ramaneau publice in mailto-ul co-semnatarilor.
    // Pattern exact din raport user (sesizare 00031, 2026-05-14).
    const text = `Bună ziua,

Mă numesc Florin Răzvan Vărzaru și locuiesc în Strada Gheorghe Doja nr. 16C, Etaj 2, Apartament 7, Județul Ilfov, Comuna Dobroești. Doresc să vă aduc la cunoștință o problemă.

Cu stimă,
Florin Răzvan Vărzaru
14 mai 2026`;
    const out = scrubFormalTextForPublic(text, {
      authorName: "Florin Răzvan Vărzaru",
      hideName: true,
    });
    expect(out).not.toContain("Vărzaru și locuiesc");
    expect(out).not.toContain("Gheorghe Doja");
    expect(out).not.toContain("Apartament 7");
    expect(out).not.toContain("Dobroești");
    expect(out).not.toContain("Florin Răzvan Vărzaru");
    expect(out).toContain("[adresa]");
    expect(out).toContain("[nume]");
  });

  it("[regression 2026-05-14] same fix for 'și' connector but hideName=false (display flow)", () => {
    const text = `Mă numesc Florin Răzvan Vărzaru și locuiesc în Strada Gheorghe Doja nr. 16C, Județul Ilfov. Doresc să semnalez.`;
    const out = scrubFormalTextForPublic(text, {
      authorName: "Florin Răzvan Vărzaru",
      hideName: false,
    });
    expect(out).not.toContain("Gheorghe Doja");
    expect(out).not.toContain("Ilfov");
    expect(out).toContain("[adresa]");
    // Numele ramane afisat — owner-ul a ales sa il faca public.
    expect(out).toContain("Florin Răzvan Vărzaru");
  });
});
