import { describe, it, expect } from "vitest";
import {
  buildFormalText,
  buildEmailPayload,
  buildOutlookLink,
  buildGmailLink,
  buildMailtoLink,
  buildGmailAndroidIntent,
  buildGmailIosLink,
  buildYahooLink,
} from "./mailto";

const BASE = {
  tip: "parcare",
  titlu: "T",
  locatie: "Șoseaua Pantelimon 292",
  descriere: "d",
  author_name: "Ion Andrei Popescu",
  author_address: "Strada Novaci 12, Sector 5",
};

describe("buildFormalText — identity rewrite", () => {
  it("does not duplicate the sector when address already contains a comma", () => {
    const aiText = `Bună ziua,

Mă numesc CineVrea Altcineva, locuiesc în Strada X 5, Sector 2, București și doresc să vă aduc la cunoștință o problemă.

Mulțumesc.

Cu stimă,
CineVrea Altcineva
20 martie 2024`;
    const out = buildFormalText({ ...BASE, formal_text: aiText });
    // Exactly one "Sector 5" — not "Sector 5, Sector 5"
    const matches = out.match(/Sector 5/g) ?? [];
    expect(matches.length).toBe(1);
    expect(out).toContain("Mă numesc Ion Andrei Popescu");
    expect(out).toContain("locuiesc în Strada Novaci 12, Sector 5");
    // Tail ("și doresc...") must survive
    expect(out).toMatch(/și\s+doresc/);
  });

  it("handles long multi-comma addresses without leaking commas", () => {
    const aiText = `Bună ziua,

Mă numesc Altcineva, locuiesc pe Str. A 1, bl. X, ap. 2, Sector 1 și doresc să vă aduc la cunoștință.

Cu stimă,
Altcineva
20 martie 2024`;
    const out = buildFormalText({
      ...BASE,
      author_address: "Bulevardul Lung nr. 44, bl. B12, sc. 2, ap. 15, Sector 3",
      formal_text: aiText,
    });
    // No trailing comma-cascade
    expect(out).not.toMatch(/Sector 1,\s*Sector 3/);
    expect(out).not.toMatch(/ap\. 2,\s*Bulevardul/);
    expect(out).toContain("locuiesc în Bulevardul Lung nr. 44, bl. B12, sc. 2, ap. 15, Sector 3");
  });

  it("rewrites legacy Subsemnatul opener into the new style", () => {
    const aiText = `Bună ziua,

Subsemnatul Altcineva, domiciliat în Str. Veche 8, Sector 4, vă adresez prezenta sesizare în temeiul OG 27/2002.

Cu respect,
Altcineva
20 martie 2024`;
    const out = buildFormalText({ ...BASE, formal_text: aiText });
    expect(out).not.toContain("Subsemnatul");
    expect(out).toContain("Mă numesc Ion Andrei Popescu");
    expect(out).toContain("Strada Novaci 12, Sector 5");
  });

  it("keeps punctuation when opener ends with a period instead of verb", () => {
    const aiText = `Bună ziua,

Mă numesc Altcineva, locuiesc în Str. Y 9, Sector 6.

În ultima perioadă am observat parcări ilegale.

Cu stimă,
Altcineva
20 martie 2024`;
    const out = buildFormalText({ ...BASE, formal_text: aiText });
    expect(out).toContain("locuiesc în Strada Novaci 12, Sector 5.");
    expect(out).toContain("În ultima perioadă am observat");
    expect(out).not.toMatch(/Sector 5,?\s*Sector 6/);
  });

  it("does not append a redundant 'Anexez N fotografii.' when AI text already mentions photos", () => {
    // AI commonly writes "am atașat imagini care ilustrează ..." —
    // the old regex only matched "Anexez N fotografii" literal, so
    // we were double-mentioning attachments.
    const aiText = `Bună ziua,

Mă numesc X, locuiesc în Y și doresc să vă aduc la cunoștință o problemă.

În sprijinul acestei sesizări, am atașat imagini care ilustrează situația actuală.

Cu stimă,
X
20 martie 2024`;
    // trotuar tip (non-parking) so it goes through the generic path
    const out = buildFormalText({
      ...BASE,
      tip: "trotuar",
      formal_text: aiText,
      imagini: ["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg", "https://x/4.jpg"],
    });
    // Count how many times "fotografi" appears — should stay at 0 (AI
    // used "imagini", we shouldn't add our "Anexez N fotografii" line).
    expect(out).not.toMatch(/Anexez\s+4\s+fotografi/i);
    expect(out).toMatch(/am atașat imagini/i);
  });

  it("still appends the evidence line when AI forgot to mention photos", () => {
    const aiText = `Bună ziua,

Mă numesc X, locuiesc în Y și doresc să vă aduc la cunoștință o problemă cu trotuarul.

Vă rog să verificați la fața locului.

Cu stimă,
X
20 martie 2024`;
    const out = buildFormalText({
      ...BASE,
      tip: "trotuar",
      formal_text: aiText,
      imagini: ["https://x/1.jpg", "https://x/2.jpg"],
    });
    expect(out).toMatch(/Anexez\s+2\s+fotografi/i);
  });
});

describe("buildEmailPayload — parcare legal template", () => {
  it("uses the OUG 195/2002 template + plate-in-subject when parking context is supplied", () => {
    const p = buildEmailPayload({
      tip: "parcare",
      titlu: "Parcare pe trotuar",
      locatie: "Strada Matei Voievod 10, Sector 2",
      sector: "S2",
      lat: 44.441,
      lng: 26.123,
      descriere: "Mașină parcată pe trotuar de o săptămână.",
      author_name: "Ion Andrei Popescu",
      author_address: "Strada Novaci 12, Sector 5",
      imagini: ["https://x/a.jpg", "https://x/b.jpg"],
      parking: { plate: "B 123 ABC", jurisdiction: "trotuar" },
    });
    expect(p.subject).toMatch(/B 123 ABC/);
    expect(p.body).toMatch(/OUG 195\/2002/);
    expect(p.body).toMatch(/art\. 39 din OUG 195\/2002/);
    expect(p.body).toMatch(/B 123 ABC/);
    // Bold markers must be stripped from the plain-text mail body.
    expect(p.body).not.toMatch(/\[\[BOLD]]/);
  });

  it("picks Brigada Rutieră as primary when jurisdiction=banda", () => {
    const p = buildEmailPayload({
      tip: "parcare",
      titlu: "Parcare pe bandă",
      locatie: "Bd Magheru",
      sector: "S1",
      descriere: "x",
      author_name: "A",
      author_address: "B",
      parking: { plate: "B 1 AAA", jurisdiction: "banda" },
    });
    expect(p.to[0]).toBe("bpr@b.politiaromana.ro");
  });

  it("uses the user-picked observedAt (datetime-local string) in the body, to the minute", () => {
    const p = buildEmailPayload({
      tip: "parcare",
      titlu: "x",
      locatie: "Strada A 1, Sector 3",
      sector: "S3",
      descriere: "x",
      author_name: "A",
      author_address: "B",
      parking: {
        plate: "B 7 BBB",
        jurisdiction: "trotuar",
        observedAt: "2026-04-22T14:37",
      },
    });
    expect(p.body).toMatch(/22 aprilie 2026/);
    expect(p.body).toMatch(/la ora 14:37/);
  });

  it("applies Sector 5 scrub — dead mailboxes removed, working ones survive", () => {
    const p = buildEmailPayload({
      tip: "parcare",
      titlu: "Parcare pe trotuar S5",
      locatie: "Calea 13 Septembrie 120, Sector 5",
      sector: "S5",
      descriere: "x",
      author_name: "A",
      author_address: "B",
      parking: { plate: "B 42 ABC", jurisdiction: "trotuar" },
    });
    // Working addresses stay
    expect(p.to).toContain("primarie@sector5.ro");
    expect(p.to).toContain("politialocala@sector5.ro");
    expect(p.to).toContain("office@plmb.ro");
    // Dead addresses that bounced on delivery are scrubbed
    expect(p.to).not.toContain("sesizari@sector5.ro");
    expect(p.to).not.toContain("office@politialocalasector5.ro");
    expect(p.cc).not.toContain("sesizari@sector5.ro");
    expect(p.cc).not.toContain("office@politialocalasector5.ro");
  });
});

describe("buildOutlookLink — modern deeplink format", () => {
  it("uses outlook.live.com /mail/0/deeplink/compose, not the dead /owa/ path", () => {
    const url = buildOutlookLink({
      tip: "parcare",
      titlu: "T",
      locatie: "L",
      descriere: "d",
      author_name: "A",
      author_address: "B",
    });
    expect(url).toContain("outlook.live.com/mail/0/deeplink/compose");
    expect(url).not.toContain("/owa/");
    expect(url).not.toContain("path=%2Fmail");
  });

  it("includes to / subject / body params in the query", () => {
    const url = buildOutlookLink({
      tip: "groapa",
      titlu: "Test groapa",
      locatie: "Strada X 1, Sector 2, București",
      sector: "S2",
      descriere: "Pe trotuar.",
      author_name: "Eduard",
      author_address: "Strada Y 3, Sector 5",
    });
    const u = new URL(url);
    expect(u.searchParams.get("subject")).toBeTruthy();
    expect(u.searchParams.get("body")?.length ?? 0).toBeGreaterThan(20);
    // Multiple recipients are CSV-joined per Outlook deep-link spec
    const to = u.searchParams.get("to") ?? "";
    expect(to.split(",").every((addr) => addr.includes("@"))).toBe(true);
  });

  it("encodes spaces as %20, not + (Outlook web nu decodeaza +)", () => {
    const url = buildOutlookLink({
      tip: "groapa",
      titlu: "Test cu spatii multiple",
      locatie: "Strada X 1, Sector 2, Bucuresti",
      descriere: "Multe cuvinte cu spatii intre ele aici.",
      author_name: "Ion Popescu",
      author_address: "Strada Y, Sector 5",
    });
    // Bug raportat user 5/9/2026 pe sesizare 00027: Outlook arata
    // „cuvant+cuvant+cuvant" in body in loc de spatii. URLSearchParams
    // foloseste form-encoding (space -> +); Outlook web NU decodeaza +
    // ca space. Fix: hand-build cu encodeURIComponent (space -> %20).
    // Verificam ca NU exista `+` ca separator de cuvinte in query.
    // Doar +-ul din `+40` (telefon) e ok daca exista, dar in body sunt
    // doar spatii.
    const queryPart = url.split("?")[1] ?? "";
    // Numara `+` urile — daca sunt prezente in valori encoded, e bug.
    // Acceptam %2B (`+` properly encoded) dar nu `+` raw ca separator.
    const plusCount = (queryPart.match(/\+/g) ?? []).length;
    const percent20Count = (queryPart.match(/%20/g) ?? []).length;
    expect(percent20Count).toBeGreaterThan(5); // multe spatii in body
    // `+` raw nu trebuie sa apara (form-encoding bug)
    expect(plusCount).toBe(0);
  });

  it("attaches CC only when there are CC recipients", () => {
    const noCc = buildOutlookLink({
      tip: "iluminat",
      titlu: "Felinar stricat",
      locatie: "Strada A 1, Sector 1, București",
      sector: "S1",
      descriere: "Felinarul nu mai funcționează.",
      author_name: "X",
      author_address: "Y",
    });
    // iluminat in S1 fans out only to TO (no CC); URL should omit cc=
    const u = new URL(noCc);
    if (u.searchParams.has("cc")) {
      expect(u.searchParams.get("cc")?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("buildGmailLink — sanity", () => {
  it("uses mail.google.com compose path", () => {
    const url = buildGmailLink({
      tip: "iluminat",
      titlu: "T",
      locatie: "L",
      descriere: "d",
      author_name: "A",
      author_address: "B",
    });
    expect(url).toContain("mail.google.com/mail/");
    expect(url).toContain("view=cm");
  });
});

describe("buildMailtoLink — diacritic safety pe clienti mobile (Yahoo bug 5/8/2026)", () => {
  it("foldeaza ș / ț / ă / â / î la ASCII in subject + body", () => {
    const url = buildMailtoLink({
      tip: "iluminat",
      titlu: "Felinar stricat pe Strada Țepeș Vodă",
      locatie: "București, Sector 3",
      descriere: "Pe strada Țepeș Vodă felinarul nu mai funcționează de o săptămână.",
      author_name: "Ștefan Cel Mare",
      author_address: "Bulevardul Ștefan, București",
    });

    // URL-decode subject + body ca să verificăm conținutul real
    // (după ce orice client de mail decodează URL).
    const decoded = decodeURIComponent(url);

    // Diacriticele NU mai apar nicăieri în URL după fold.
    expect(decoded).not.toMatch(/[ăâîșțĂÂÎȘȚşţŞŢ]/);

    // Versiunile ASCII sunt prezente.
    expect(decoded).toContain("Tepes Voda");
    expect(decoded).toContain("Bucuresti");
    expect(decoded).toContain("nu mai functioneaza");
  });

  it("decoded URL nu mai conține caractere multi-byte UTF-8 % sequence", () => {
    const url = buildMailtoLink({
      tip: "groapa",
      titlu: "Groapă în asfalt",
      locatie: "Str. Ștefăniță 5",
      descriere: "Pe strada Ștefăniță e o groapă mare.",
      author_name: "Ion",
      author_address: "B",
    });
    // Romanian diacritics encode to %C8%99 (ș), %C8%9B (ț), %C4%83 (ă), etc.
    // After ASCII fold, none of these multi-byte sequences appear.
    expect(url).not.toMatch(/%C[48]%[89AB][0-9A-F]/);
  });

  it("text fără diacritice rămâne neschimbat (numele autor)", () => {
    const url = buildMailtoLink({
      tip: "iluminat",
      titlu: "Lamp broken on Main Street",
      locatie: "Bucharest",
      descriere: "The lamp is broken since last week.",
      author_name: "John Smith",
      author_address: "5 Main St",
    });
    const decoded = decodeURIComponent(url);
    // Numele autor (fără diacritice) supraviețuiește în signature.
    expect(decoded).toContain("John Smith");
    // URL e well-formed (mailto: prefix + subject + body).
    expect(url.startsWith("mailto:")).toBe(true);
    expect(url).toContain("subject=");
    expect(url).toContain("body=");
  });
});

// ─── GDPR REGRESSION TESTS ──────────────────────────────────────────
//
// In 2026-05-14 un user a raportat ca a apasat „Trimite si tu" pe o
// sesizare publica si Gmail a deschis emailul cu numele + adresa
// autorului ORIGINAL (Florin Razvan Varzaru / Strada Gheorghe Doja)
// in body — nu cu datele lui (co-semnatar).
//
// Cauza: rewriteFormalText nu acoperea forma „Ma numesc X *si* locuiesc"
// (fara virgula) — doar „X, locuiesc". Pattern-ul scapa nescrubat.
//
// Aceste teste asigura ca PII-ul autorului original e SCOS COMPLET din
// emailul co-semnatarului in TOATE formatele de URL si pentru TOATE
// formele de connector intre nume si verb. Daca pica vreunul, e leak
// GDPR. NU sterge.

describe("GDPR co-sign: PII original author MUST NOT appear in any email URL", () => {
  // Formal text exact din raportul user-ului (sesizare 00031):
  const ORIGINAL_PII_LETTER = `Bună ziua,

Mă numesc Florin Răzvan Vărzaru și locuiesc în Strada Gheorghe Doja nr. 16C, Etaj 2, Apartament 7, Județul Ilfov, Comuna Dobroești. Doresc să vă aduc la cunoștință o problemă care afectează siguranța pietonilor pe Șoseaua Morarilor, Sector 2, București.

De câteva zile am observat că mașinile sunt parcate pe trotuar.

Cu stimă,
Florin Răzvan Vărzaru
14 mai 2026`;

  const COSIGNER = {
    tip: "stalpisori",
    titlu: "Mașini parcate pe trotuar",
    locatie: "Șoseaua Morarilor, Sector 2",
    sector: "Sector 2",
    descriere: "Mașini pe trotuar",
    formal_text: ORIGINAL_PII_LETTER,
    author_name: "Eduard Andrei Mușat",
    author_address: "Strada Mea 1, Sector 3, București",
  };

  // PII-ul original care NU TREBUIE sa apara nicaieri:
  const FORBIDDEN = [
    "Florin",
    "Răzvan",
    "Vărzaru",
    "Gheorghe Doja",
    "16C",
    "Apartament 7",
    "Dobroești",
    "Ilfov",
  ];

  // ASCII-fold echivalent (asa apare in mailto/Gmail Android URLs):
  const FORBIDDEN_ASCII = [
    "Razvan",
    "Varzaru",
    "Gheorghe Doja",
    "Dobroesti",
    "Apartament 7",
  ];

  function assertNoOriginalPII(decodedBody: string, asciiFolded: boolean) {
    const list = asciiFolded ? FORBIDDEN_ASCII : FORBIDDEN;
    for (const piece of list) {
      expect(decodedBody, `leak detected: '${piece}' in body`).not.toContain(piece);
    }
  }

  it("buildFormalText replaces original PII with co-signer data", () => {
    const out = buildFormalText(COSIGNER);
    for (const piece of FORBIDDEN) {
      expect(out, `leak '${piece}'`).not.toContain(piece);
    }
    expect(out).toContain("Eduard Andrei Mușat");
    expect(out).toContain("Strada Mea 1, Sector 3, București");
  });

  it("mailto: link does not contain original author PII", () => {
    const url = buildMailtoLink(COSIGNER);
    assertNoOriginalPII(decodeURIComponent(url), true);
  });

  it("Gmail web link does not contain original author PII", () => {
    const url = buildGmailLink(COSIGNER);
    assertNoOriginalPII(decodeURIComponent(url), false);
  });

  it("Gmail Android intent does not contain original author PII", () => {
    const url = buildGmailAndroidIntent(COSIGNER);
    assertNoOriginalPII(decodeURIComponent(url), true);
  });

  it("Gmail iOS link does not contain original author PII", () => {
    const url = buildGmailIosLink(COSIGNER);
    assertNoOriginalPII(decodeURIComponent(url), false);
  });

  it("Outlook web link does not contain original author PII", () => {
    const url = buildOutlookLink(COSIGNER);
    assertNoOriginalPII(decodeURIComponent(url), false);
  });

  it("Yahoo web link does not contain original author PII", () => {
    const url = buildYahooLink(COSIGNER);
    assertNoOriginalPII(decodeURIComponent(url), false);
  });

  it("Signature block has co-signer name + today's date, NOT original author", () => {
    const out = buildFormalText(COSIGNER);
    expect(out).toMatch(/Cu stim[ăa],\s*\n\s*Eduard Andrei Mușat/);
    expect(out).not.toMatch(/Cu stim[ăa],\s*\n\s*Florin/);
  });

  it("Works even when connector is comma instead of 'și' (legacy format)", () => {
    const legacyFormat = ORIGINAL_PII_LETTER.replace(
      "Florin Răzvan Vărzaru și locuiesc",
      "Florin Răzvan Vărzaru, locuiesc",
    );
    const out = buildFormalText({ ...COSIGNER, formal_text: legacyFormat });
    for (const piece of FORBIDDEN) {
      expect(out, `leak '${piece}'`).not.toContain(piece);
    }
    expect(out).toContain("Eduard Andrei Mușat");
  });

  it("Works with legacy 'Subsemnatul X, domiciliat în Y' opener", () => {
    const legacySubsemnatul = `Bună ziua,

Subsemnatul Florin Răzvan Vărzaru, domiciliat în Strada Gheorghe Doja nr. 16C, Județul Ilfov, vă adresez prezenta.

Cu respect,
Florin Răzvan Vărzaru
14 mai 2026`;
    const out = buildFormalText({ ...COSIGNER, formal_text: legacySubsemnatul });
    for (const piece of FORBIDDEN) {
      expect(out, `leak '${piece}'`).not.toContain(piece);
    }
    expect(out).toContain("Eduard Andrei Mușat");
  });

  it("Works with legacy 'Subsemnatul X și domiciliat' (și instead of comma)", () => {
    const legacyWithSi = `Subsemnatul Florin Răzvan Vărzaru și domiciliat în Strada Gheorghe Doja, Județul Ilfov, vă adresez.`;
    const out = buildFormalText({ ...COSIGNER, formal_text: legacyWithSi });
    for (const piece of FORBIDDEN) {
      expect(out, `leak '${piece}'`).not.toContain(piece);
    }
  });
});
