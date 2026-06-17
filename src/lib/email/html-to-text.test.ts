import { describe, it, expect } from "vitest";
import { htmlToText } from "./html-to-text";

describe("htmlToText — fallback text/plain pentru emailuri", () => {
  it("scoate tag-urile și păstrează textul", () => {
    expect(htmlToText("<p>Salut <strong>Ana</strong></p>")).toBe("Salut Ana");
  });

  it("link devine text (url)", () => {
    const out = htmlToText('<a href="https://civia.ro/sesizari/00007">Vezi sesizarea</a>');
    expect(out).toBe("Vezi sesizarea (https://civia.ro/sesizari/00007)");
  });

  it("link fără text → doar url-ul", () => {
    expect(htmlToText('<a href="https://civia.ro"></a>')).toBe("https://civia.ro");
  });

  it("block-uri + <br> → newline-uri", () => {
    const out = htmlToText("<h1>Titlu</h1><p>Rând 1<br>Rând 2</p>");
    expect(out).toBe("Titlu\nRând 1\nRând 2");
  });

  it("liste → bullets", () => {
    const out = htmlToText("<ul><li>unu</li><li>doi</li></ul>");
    expect(out).toContain("• unu");
    expect(out).toContain("• doi");
  });

  it("scoate <style>/<script> complet (CSS-ul din template nu e conținut)", () => {
    const out = htmlToText("<style>.x{color:red}</style><p>Conținut</p>");
    expect(out).toBe("Conținut");
    expect(out).not.toContain("color");
  });

  it("decodează entități comune", () => {
    expect(htmlToText("<p>A&nbsp;&amp;&nbsp;B &mdash; C</p>")).toBe("A & B — C");
  });

  it("normalizează whitespace (fără 3+ newline-uri consecutive)", () => {
    const out = htmlToText("<p>A</p><div></div><div></div><p>B</p>");
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).toContain("A");
    expect(out).toContain("B");
  });

  it("input gol → string gol (caller cade pe fallback-ul generic)", () => {
    expect(htmlToText("")).toBe("");
  });
});
