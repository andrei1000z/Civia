import { describe, it, expect } from "vitest";
import { decodeMimeWords, repairMojibake, decodeEmailSubject } from "./decode-mime";

describe("decodeMimeWords (RFC 2047)", () => {
  it("decodează base64 (B) UTF-8", () => {
    expect(decodeMimeWords("=?utf-8?B?csSDc3B1bnMgc2VzaXphcmU=?=")).toBe("răspuns sesizare");
  });

  it("decodează quoted-printable (Q) UTF-8", () => {
    expect(
      decodeMimeWords("=?UTF-8?Q?Prim=C4=83ria_Sectorului_3?="),
    ).toBe("Primăria Sectorului 3");
  });

  it("colapsează spațiul dintre encoded-words adiacente (cat egoria → categoria)", () => {
    // două chunk-uri care rup cuvântul „categoria" la mijloc
    const input = "=?UTF-8?Q?cat?= =?UTF-8?Q?egoria?=";
    expect(decodeMimeWords(input)).toBe("categoria");
  });

  it("lasă textul neîncodat neatins", () => {
    expect(decodeMimeWords("Adresa 11691/2026")).toBe("Adresa 11691/2026");
  });
});

// Construiește mojibake EXACT (cu bytes de control) = UTF-8 citit ca Latin-1.
const toMojibake = (s: string) => Buffer.from(s, "utf8").toString("latin1");

describe("repairMojibake (UTF-8 citit ca Latin-1)", () => {
  it("repară body-ul corupt", () => {
    const original =
      "Bună ziua, Solicitarea a fost înregistrată de către Primăria Sectorului 2 cu numărul 101312";
    const out = repairMojibake(toMojibake(original));
    expect(out).toBe(original);
    expect(out).not.toMatch(/[ÃÄÈ]/);
  });

  it("NU atinge textul deja corect", () => {
    const ok = "Această stradă are o groapă mare în carosabil.";
    expect(repairMojibake(ok)).toBe(ok);
  });

  it("text fără markere de mojibake → neschimbat", () => {
    expect(repairMojibake("plain ascii text")).toBe("plain ascii text");
  });
});

describe("decodeEmailSubject", () => {
  it("preferă raw_headers.subject (RFC 2047 brut)", () => {
    const out = decodeEmailSubject("rÄspuns sesizare (corupt)", {
      subject: "=?utf-8?B?csSDc3B1bnMgc2VzaXphcmU=?=",
    });
    expect(out).toBe("răspuns sesizare");
  });

  it("repară subiectul pre-decodat când nu există header brut util", () => {
    const out = decodeEmailSubject(toMojibake("Primăria Sectorului 3"), {});
    expect(out).toBe("Primăria Sectorului 3");
  });
});
