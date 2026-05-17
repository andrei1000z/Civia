import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test pentru compactitatea /cont pe mobile.
 *
 * Bug raportat: pe Android cu accessibility text-zoom, hero-ul (avatar
 * 80px + h1 24px) si padding-urile generoase (py-10, p-6) faceau pagina
 * sa para „taiata" pe ecran mic. User-ul a trimis screenshot-uri cu
 * impresia de overflow.
 *
 * Fix: scalare progresiva — pe mobil totul mai mic (avatar 56px, h1 18px,
 * padding 12px); pe sm/md totul revine la dimensiunile originale.
 */
describe("/cont mobile compact layout", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/cont/page.tsx"),
    "utf-8",
  );

  it("container exterior are padding redus pe mobil", () => {
    // container-narrow py-4 sm:py-8 md:py-14 px-3 sm:px-6 — al primului
    // container din return statement, NU empty state divs din lista.
    // Caut linia exacta cu „return (" + următoarea <div>.
    const returnIdx = source.indexOf("\n  return (");
    expect(returnIdx).toBeGreaterThan(0);
    const afterReturn = source.slice(returnIdx, returnIdx + 500);
    const containerMatch = afterReturn.match(
      /<div className="container-narrow ([^"]+)">/,
    );
    expect(containerMatch).not.toBeNull();
    const cls = containerMatch?.[1] ?? "";
    expect(cls).toMatch(/\bpy-[1-7]\b/);
    expect(cls).toMatch(/\bpx-[1-4]\b/);
    expect(cls).toMatch(/\bsm:py-[6-9]/);
  });

  it("hero header are padding redus pe mobil (p-4 mobile, p-6 sm+)", () => {
    const headerMatch = source.match(
      /<header className="([^"]*overflow-hidden[^"]+)"/,
    );
    expect(headerMatch).not.toBeNull();
    const cls = headerMatch?.[1] ?? "";
    expect(cls).toContain("p-4");
    expect(cls).toMatch(/sm:p-[5-6]/);
  });

  it("avatar are dimensiune redusa pe mobil (w-14 mobile, w-20 sm+)", () => {
    // Verificam ca dim avatar pe mobil e <= w-16 (64px), nu w-20 (80px).
    // Cautam pattern de avatar (fallback initial-box).
    const avatarPattern = /w-1[2-6] h-1[2-6] sm:w-20 sm:h-20/;
    expect(avatarPattern.test(source)).toBe(true);
  });

  it("h1 hero are text-lg pe mobil (NU text-2xl)", () => {
    const h1Match = source.match(/<h1[^>]+className="([^"]+)">\s*Salut/);
    expect(h1Match).not.toBeNull();
    const cls = h1Match?.[1] ?? "";
    // Pe mobil: text-lg sau text-xl (NU text-2xl direct fara breakpoint)
    expect(cls).toMatch(/\btext-(lg|xl|base)\b/);
    expect(cls).toMatch(/\bsm:text-2xl\b/);
    expect(cls).toContain("break-words");
  });

  it("email user-ului in hero are truncate", () => {
    // Verifica ca elementul <p> ce afiseaza profile?.email in hero
    // ARE truncate ca sa nu sparga layout-ul.
    // Pattern: <p className="...truncate...">{profile?.email}</p>
    const heroEmailPattern = /<p className="[^"]*truncate[^"]*">\s*\{profile\?\.email\}/;
    expect(heroEmailPattern.test(source)).toBe(true);
  });

  it("Deconectare button: doar icon pe mobil (text hidden sm:inline)", () => {
    // Pe mobile, butonul nu trebuie sa contina textul „Deconectare" vizibil
    // (lazy/icon-only ca sa nu impinga layout-ul lateral).
    const decoIdx = source.indexOf("Deconectare");
    // Cele 2 apariții: aria-label si toast — verificăm ca <span hidden> e prezent.
    expect(source).toContain('hidden sm:inline">Deconectare');
  });

  it("Profile completion box: padding redus pe mobil", () => {
    // p-3 sm:p-4 pe completion box (era p-4 fixed).
    const completionMatch = source.match(
      /bg-\[var\(--color-surface\)\] border border-amber-500\/30 [^"]+/,
    );
    expect(completionMatch).not.toBeNull();
    const cls = completionMatch?.[0] ?? "";
    expect(cls).toContain("p-3");
    expect(cls).toMatch(/sm:p-4/);
  });
});
