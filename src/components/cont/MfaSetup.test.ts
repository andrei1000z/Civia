import { describe, it, expect } from "vitest";
import { qrToSrc } from "./MfaSetup";

describe("qrToSrc", () => {
  // Supabase prepend-uiește „data:image/svg+xml;utf-8,<SVG RAW>" la qr_code.
  const supabaseQr =
    'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#ffffff"/><path fill="#000000" d="M0 0h1v1H0z"/></svg>';

  it("re-encodează data-URL-ul Supabase (fără dublă-împachetare)", () => {
    const out = qrToSrc(supabaseQr);
    expect(out.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    // NU dublează prefixul „data:" (bugul vechi: data:...,data%3Aimage...)
    expect(out).not.toContain("data%3Aimage");
  });

  it("encodează diezul (#) din culori — cauza care rupea randarea ca fragment URL", () => {
    const out = qrToSrc(supabaseQr);
    expect(out).toContain("%23"); // # → %23
    expect(out).not.toContain("#");
  });

  it("data-URL-ul rezultat decodează înapoi la SVG valid", () => {
    const out = qrToSrc(supabaseQr);
    const body = decodeURIComponent(out.slice("data:image/svg+xml;charset=utf-8,".length));
    expect(body.startsWith("<svg")).toBe(true);
    expect(body.endsWith("</svg>")).toBe(true);
  });

  it("SVG brut (fără prefix Supabase) → encodat corect", () => {
    const out = qrToSrc("<svg><rect fill=\"#000\"/></svg>");
    expect(out.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    expect(out).toContain("%23");
  });

  it("data-URL binar (png base64) sau URL extern → folosit direct", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(qrToSrc(png)).toBe(png);
    expect(qrToSrc("https://ex.ro/qr.svg")).toBe("https://ex.ro/qr.svg");
  });
});
