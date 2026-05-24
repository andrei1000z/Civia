import { describe, it, expect } from "vitest";
import { quickScore } from "./response-quality";

describe("quickScore — pattern detection rapid", () => {
  it("detectează acknowledgment scurt cu nr înregistrare", () => {
    const text = `Stimată doamnă,

Am înregistrat sesizarea dvs. nr. 12345/2026 din data de 21.05.2026.

Vă vom răspunde în termen legal.

Cu stimă,
Primăria Sector 5`;
    const r = quickScore(text);
    expect(r.quality).toBe("acknowledgment");
  });

  it("detectează redirect explicit", () => {
    const text = `Sesizarea dvs. nu intră în competența noastră, drept urmare am redirecționat-o către Poliția Locală.`;
    const r = quickScore(text);
    expect(r.quality).toBe("redirect");
  });

  it("detectează refuz cu motivare buget", () => {
    const text = `Vă comunicăm că nu putem da curs solicitării din cauza lipsei de fonduri în bugetul local pentru anul curent.`;
    const r = quickScore(text);
    expect(r.quality).toBe("refusal");
  });

  it("detectează boilerplate cu 3+ patterns", () => {
    const text = `Stimată doamnă/Stimate domn,

Am luat la cunoștință de sesizarea dvs. Vă mulțumim pentru mesaj. Vom analiza cu atenție aspectele semnalate, conform legislației în vigoare. Așa cum prevede legea, vă vom răspunde în termen.

Cu respect și considerație,
Primăria`;
    const r = quickScore(text);
    expect(r.quality).toBe("boilerplate");
    expect(r.boilerplateRegexHit).toBe(true);
  });

  it("returnează null pentru cazuri ambigue (AI fallback)", () => {
    const text = `Echipa noastră a verificat zona indicată și a constatat că este necesară intervenția pentru repararea trotuarului. Lucrările sunt programate pentru luna iunie 2026, conform planului de investiții aprobat. Costul estimat: 45.000 RON.`;
    const r = quickScore(text);
    // Substantive răspuns concret → quickScore returnează null (AI confirm)
    expect(r.quality).toBeNull();
  });
});
