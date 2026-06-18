import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test pentru compactitatea /setari pe mobil (fost /cont).
 *
 * 2026-06-18 — pagina rescrisă în stil „Settings de telefon" (Samsung One UI):
 * o singură coloană centrată (max-w-2xl), carduri grupate cu iconițe CIRCULARE
 * colorate, card de profil sus (NU hero cu avatar 80px + „Salut"). Testul
 * păzește invarianții care țin pagina ne-overflow pe ecran mic cu text-zoom.
 */
describe("/setari mobile compact layout", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/setari/page.tsx"),
    "utf-8",
  );

  it("container exterior are padding redus pe mobil", () => {
    const returnIdx = source.indexOf("\n  return (");
    expect(returnIdx).toBeGreaterThan(0);
    const afterReturn = source.slice(returnIdx, returnIdx + 600);
    const containerMatch = afterReturn.match(
      /<div className="container-narrow ([^"]+)">/,
    );
    expect(containerMatch).not.toBeNull();
    const cls = containerMatch?.[1] ?? "";
    expect(cls).toMatch(/\bpy-[1-7]\b/);
    expect(cls).toMatch(/\bpx-[1-4]\b/);
    expect(cls).toMatch(/\bsm:py-[6-9]/);
  });

  it("conținutul e o singură coloană centrată (max-w-2xl mx-auto)", () => {
    expect(source).toMatch(/max-w-2xl mx-auto/);
    expect(source).not.toMatch(/lg:grid-cols-\[400px/);
  });

  it("titlul paginii folosește fontul Sora", () => {
    const h1Match = source.match(/<h1 className="([^"]+)">Setări<\/h1>/);
    expect(h1Match).not.toBeNull();
    expect(h1Match?.[1] ?? "").toContain("font-[family-name:var(--font-sora)]");
  });

  it("profilul e un card Samsung (nume + email), nu hero vechi cu Salut", () => {
    expect(source).not.toContain("Salut, ");
    expect(source).toContain("SettingsProfileCard");
    expect(source).toMatch(/sub=\{profile\?\.email\}/);
  });

  it("folosește primitivele + iconițe circulare colorate (fill solid)", () => {
    expect(source).toContain("SettingsGroup");
    expect(source).toContain("SettingsRow");
    expect(source).toMatch(/iconClass="bg-\w+-500 text-white"/);
  });
});
