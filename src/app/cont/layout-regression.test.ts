import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test pentru /cont mobile layout.
 *
 * Bug: pe Android, label-urile Field aveau `text-[11px] uppercase tracking-wider`,
 * pe display zoom enabled de utilizator labelurile lungi „NUME COMPLET (PENTRU
 * SESIZARI)" depaseau viewport-ul si textul aparea „taiat" cu scroll orizontal
 * blocat. Fix-ul: scos uppercase + tracking-wider, plus min-w-0 + break-words
 * pe label + min-w-0 + overflow-hidden pe form parent.
 *
 * Acest test asigura ca nu reapare prin revert/refactor accidental.
 */
describe("/cont layout — mobile regression guards", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/cont/page.tsx"),
    "utf-8",
  );

  it("Field labels nu folosesc uppercase + tracking-wider (cauza bug-ului)", () => {
    // Cautam definitia Field component si verificam clasele label-ului.
    const fieldMatch = source.match(
      /function Field\([^)]*\)\s*\{[\s\S]*?<label([^>]*)className=\{?"([^"]+)"/,
    );
    expect(fieldMatch).not.toBeNull();
    const labelClasses = fieldMatch?.[2] ?? "";
    expect(labelClasses).not.toMatch(/\buppercase\b/);
    expect(labelClasses).not.toMatch(/\btracking-wider\b/);
    expect(labelClasses).not.toMatch(/\bwhitespace-nowrap\b/);
  });

  it("Field labels au break-words si min-w-0 wrap-ul parintelui", () => {
    const fieldMatch = source.match(
      /function Field\([^)]*\)\s*\{[\s\S]*?<div\s+className="([^"]*)"/,
    );
    expect(fieldMatch).not.toBeNull();
    const wrapperClasses = fieldMatch?.[1] ?? "";
    expect(wrapperClasses).toContain("min-w-0");

    // 2026-06-08: label-ul are acum și htmlFor (a11y) — regex flexibil la atribute.
    const labelMatch = source.match(/<label[^>]*\sclassName="([^"]+)">\s*\{label\}/);
    expect(labelMatch).not.toBeNull();
    const labelClasses = labelMatch?.[1] ?? "";
    expect(labelClasses).toContain("break-words");
  });

  it("Form-ul exterior are min-w-0 + overflow-hidden", () => {
    const formMatch = source.match(/<form\s+onSubmit=\{handleSave\}\s+className="([^"]+)"/);
    expect(formMatch).not.toBeNull();
    const formClasses = formMatch?.[1] ?? "";
    expect(formClasses).toContain("min-w-0");
    expect(formClasses).toContain("overflow-hidden");
  });

  it("Toate <section> din form au min-w-0", () => {
    const sectionMatches = [...source.matchAll(/<section\s+className="([^"]+)"/g)];
    // Cel putin un section trebuie sa existe (Date personale)
    expect(sectionMatches.length).toBeGreaterThanOrEqual(2);
    // Toate sectionurile din interiorul form-ului trebuie sa aiba min-w-0.
    // Permitem un section non-conform daca e clar in afara form-ului
    // (ex: layout-level container) — dar in pagina cont toate sunt in form.
    for (const m of sectionMatches) {
      const cls = m[1]!;
      // section-urile cu p-4/p-5 (form fields) trebuie sa aiba min-w-0
      if (/\bp-[45]\b/.test(cls) || /\bsm:p-5\b/.test(cls)) {
        expect(cls, `section "${cls}" missing min-w-0`).toContain("min-w-0");
      }
    }
  });

  it("SectionTitle nu mai foloseste uppercase tracking-wider", () => {
    const titleMatch = source.match(
      /function SectionTitle\([\s\S]*?<h2\s+className="([^"]+)"/,
    );
    expect(titleMatch).not.toBeNull();
    const titleClasses = titleMatch?.[1] ?? "";
    expect(titleClasses).not.toMatch(/\buppercase\b/);
    expect(titleClasses).not.toMatch(/\btracking-wider\b/);
    expect(titleClasses).toContain("break-words");
  });
});
