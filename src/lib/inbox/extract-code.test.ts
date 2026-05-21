import { describe, it, expect } from "vitest";
import { extractSesizareCode } from "./extract-code";

describe("extractSesizareCode", () => {
  it("extrage din plus-addressing pe To:", () => {
    const r = extractSesizareCode({ to: "sesizari+00044@civia.ro" });
    expect(r.code).toBe("00044");
    expect(r.source).toBe("plus-address");
  });

  it("extrage din 'sesizari+CODE@civia.ro' chiar daca e amestecat", () => {
    const r = extractSesizareCode({
      to: '"Civia" <sesizari+AB12@civia.ro>',
    });
    expect(r.code).toBe("AB12");
    expect(r.source).toBe("plus-address");
  });

  it("extrage din subject 'Re: Sesizare ... — 00044'", () => {
    const r = extractSesizareCode({
      to: "sesizari@civia.ro",
      subject: "Re: Sesizare: Groapa pe trotuar — 00044",
    });
    expect(r.code).toBe("00044");
    expect(r.source).toBe("subject");
  });

  it("extrage din subject cu format 'Cod 12345'", () => {
    const r = extractSesizareCode({
      to: "x@x.ro",
      subject: "Răspuns oficial Cod 12345",
    });
    expect(r.code).toBe("12345");
    expect(r.source).toBe("subject");
  });

  it("extrage din body cu fraza 'codul sesizarii: 99999'", () => {
    const r = extractSesizareCode({
      to: "x@x.ro",
      subject: "Răspuns oficial",
      body: "Privind codul sesizarii: 99999, vă comunicăm că...",
    });
    expect(r.code).toBe("99999");
    expect(r.source).toBe("body");
  });

  it("extrage din URL civia.ro/sesizari/CODE", () => {
    const r = extractSesizareCode({
      to: "x@x.ro",
      subject: "Răspuns oficial",
      body: "Vă rugăm să accesați https://civia.ro/sesizari/AB12CD pentru detalii.",
    });
    expect(r.code).toBe("AB12CD");
    expect(r.source).toBe("body");
  });

  it("respinge ani (2026) ca fiind cod", () => {
    const r = extractSesizareCode({
      to: "x@x.ro",
      subject: "În luna mai 2026 am primit",
    });
    expect(r.code).toBe(null);
  });

  it("respinge acronime comune (HTTP, GDPR, OUG)", () => {
    const r = extractSesizareCode({
      to: "x@x.ro",
      subject: "Răspuns conform GDPR — OUG",
    });
    expect(r.code).toBe(null);
  });

  it("returneaza none pentru email fara informatii utile", () => {
    const r = extractSesizareCode({
      to: "info@primarie.ro",
      subject: "Bună ziua",
      body: "Vă mulțumim pentru email.",
    });
    expect(r.code).toBe(null);
    expect(r.source).toBe("none");
  });

  it("plus-addressing castiga peste subject conflictant", () => {
    const r = extractSesizareCode({
      to: "sesizari+11111@civia.ro",
      subject: "Re: 22222",
    });
    expect(r.code).toBe("11111");
    expect(r.source).toBe("plus-address");
  });
});
