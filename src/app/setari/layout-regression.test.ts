import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test pentru /setari layout pe mobil (fost /cont).
 *
 * Bug original: label-urile Field cu `uppercase tracking-wider` depășeau
 * viewport-ul pe Android cu display-zoom (label lung „NUME COMPLET (PENTRU
 * SESIZARI)" → scroll orizontal blocat). Fix: fără uppercase, break-words +
 * min-w-0. 2026-06-18 — pagina e acum single-column iOS; păstrăm garda pe
 * Field (încă folosit) + adăugăm garda pe noua structură (max-w-2xl + grupuri).
 */
describe("/setari layout — mobile regression guards", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/setari/page.tsx"),
    "utf-8",
  );

  it("Field labels nu folosesc uppercase + tracking-wider (cauza bug-ului)", () => {
    const fieldMatch = source.match(
      /function Field\([^)]*\)\s*\{[\s\S]*?<label([^>]*)className=\{?"([^"]+)"/,
    );
    expect(fieldMatch).not.toBeNull();
    const labelClasses = fieldMatch?.[2] ?? "";
    expect(labelClasses).not.toMatch(/\buppercase\b/);
    expect(labelClasses).not.toMatch(/\btracking-wider\b/);
    expect(labelClasses).not.toMatch(/\bwhitespace-nowrap\b/);
  });

  it("Field labels au break-words si min-w-0 pe wrap-ul parintelui", () => {
    const fieldMatch = source.match(
      /function Field\([^)]*\)\s*\{[\s\S]*?<div\s+className="([^"]*)"/,
    );
    expect(fieldMatch).not.toBeNull();
    expect(fieldMatch?.[1] ?? "").toContain("min-w-0");

    const labelMatch = source.match(/<label[^>]*\sclassName="([^"]+)">\s*\{label\}/);
    expect(labelMatch).not.toBeNull();
    expect(labelMatch?.[1] ?? "").toContain("break-words");
  });

  it("conținutul e încadrat în max-w-2xl (nu iese din viewport pe mobil)", () => {
    expect(source).toMatch(/max-w-2xl mx-auto/);
  });

  it("rândurile sunt grupate în carduri iOS (SettingsGroup, min. 3 grupuri)", () => {
    const groupCount = [...source.matchAll(/<SettingsGroup\b/g)].length;
    expect(groupCount).toBeGreaterThanOrEqual(3);
  });

  it("inputurile folosesc inputClass (h-11 WCAG + text-base anti-zoom iOS)", () => {
    expect(source).toMatch(/className=\{inputClass\}/);
    expect(source).toMatch(/const inputClass\s*=/);
  });
});
