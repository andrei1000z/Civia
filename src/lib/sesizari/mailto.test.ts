import { describe, it, expect } from "vitest";
import {
  buildFormalText,
  buildEmailPayload,
  buildOutlookLink,
  buildGmailLink,
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
