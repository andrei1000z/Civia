import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test pentru /setari layout pe mobil (fost /cont), stil Samsung One UI.
 *
 * 2026-06-18 — câmpurile de profil sunt acum rânduri (SettingsRow) cu input +
 * aria-label (componenta Field a fost eliminată). Garda: input-urile au
 * aria-label (a11y), folosesc inputClass (h-11 WCAG + text-base anti-zoom iOS),
 * pagina e încadrată în max-w-2xl, iar rândurile sunt grupate în carduri cu
 * iconițe circulare colorate.
 */
describe("/setari layout — mobile regression guards", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/setari/page.tsx"),
    "utf-8",
  );

  it("inputurile au aria-label (a11y, fără componenta Field)", () => {
    expect(source).toMatch(/aria-label="Nume afișat"/);
    expect(source).toMatch(/aria-label="Telefon"/);
  });

  it("inputurile folosesc inputClass (h-11 WCAG + text-base anti-zoom iOS)", () => {
    expect(source).toMatch(/inputClass/);
    const def = source.match(/const inputClass\s*=\s*"([^"]+)"/);
    expect(def).not.toBeNull();
    const cls = def?.[1] ?? "";
    expect(cls).toContain("h-11");
    expect(cls).toMatch(/\btext-base\b/);
  });

  it("conținutul e încadrat în max-w-2xl (nu iese din viewport pe mobil)", () => {
    expect(source).toMatch(/max-w-2xl mx-auto/);
  });

  it("rândurile sunt grupate în carduri (SettingsGroup, min. 4 grupuri)", () => {
    const groupCount = [...source.matchAll(/<SettingsGroup\b/g)].length;
    expect(groupCount).toBeGreaterThanOrEqual(4);
  });

  it("iconițele sunt cercuri colorate cu glyph alb (stil Samsung)", () => {
    expect(source).toMatch(
      /iconClass="bg-(blue|indigo|emerald|teal|orange|amber|violet|cyan|red|sky|slate)-500 text-white"/,
    );
  });
});
