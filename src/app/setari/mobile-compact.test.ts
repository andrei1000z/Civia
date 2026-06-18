import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test pentru compactitatea /setari pe mobil (fost /cont).
 *
 * 2026-06-18 — pagina rescrisă în stil „Setări de telefon" (iOS Settings):
 * o singură coloană centrată (max-w-2xl), grupuri stivuite, profilul ca rând
 * compact (NU hero cu avatar 80px + h1 24px care părea „tăiat" pe ecran mic
 * cu text-zoom). Testul păzește invarianții care țin pagina ne-overflow.
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
    // iOS Settings = single column, NU dashboard 2-col care se înghesuie pe mobil.
    expect(source).toMatch(/max-w-2xl mx-auto/);
    // Grila 2-coloane veche a dispărut definitiv.
    expect(source).not.toMatch(/lg:grid-cols-\[400px/);
  });

  it("titlul paginii folosește fontul Sora", () => {
    const h1Match = source.match(/<h1 className="([^"]+)">Setări<\/h1>/);
    expect(h1Match).not.toBeNull();
    expect(h1Match?.[1] ?? "").toContain("font-[family-name:var(--font-sora)]");
  });

  it("profilul e un rând iOS compact, nu hero cu avatar mare", () => {
    // Vechiul hero „Salut, {nume}!" + avatarul de 80px au fost eliminate.
    expect(source).not.toContain("Salut, ");
    // Emailul apare ca sublabel pe rândul de profil (SettingsRow).
    expect(source).toMatch(/sublabel=\{profile\?\.email\}/);
  });

  it("folosește primitivele iOS (SettingsGroup + SettingsRow)", () => {
    expect(source).toContain("SettingsGroup");
    expect(source).toContain("SettingsRow");
  });
});
