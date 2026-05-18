import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT_FORMAL, SYSTEM_PROMPT_CLASSIFIER } from "./prompts";

describe("Groq system prompts", () => {
  it("SYSTEM_PROMPT_FORMAL is non-empty Romanian content", () => {
    expect(SYSTEM_PROMPT_FORMAL.length).toBeGreaterThan(200);
    expect(SYSTEM_PROMPT_FORMAL).toMatch(/român/i);
    expect(SYSTEM_PROMPT_FORMAL.toLowerCase()).toContain("sesizăr");
  });

  it("SYSTEM_PROMPT_FORMAL requests strict JSON format", () => {
    expect(SYSTEM_PROMPT_FORMAL).toContain("JSON");
    expect(SYSTEM_PROMPT_FORMAL).toContain("formal_text");
  });

  it("SYSTEM_PROMPT_FORMAL uses classic letter template", () => {
    expect(SYSTEM_PROMPT_FORMAL).toContain("Bună ziua");
    // Accept either the legacy "Cu respect" or the new warmer "Cu stimă"
    expect(SYSTEM_PROMPT_FORMAL).toMatch(/Cu (respect|stim[ăa])/);
    expect(SYSTEM_PROMPT_FORMAL).toContain("OG 27/2002");
    // New narrative opening
    expect(SYSTEM_PROMPT_FORMAL).toContain("Mă numesc");
  });

  it("SYSTEM_PROMPT_FORMAL requests 30-day response window per OG 27/2002", () => {
    // Cerință legală OG 27/2002 art. 8 — autoritatea trebuie să răspundă
    // în 30 de zile. Sesizările trebuie să conțină solicitarea explicită.
    expect(SYSTEM_PROMPT_FORMAL).toMatch(/30\s+de\s+zile/);
  });

  it("SYSTEM_PROMPT_FORMAL has context-aware opening variations", () => {
    // Deschiderea trebuie să se adapteze la context (acum / recent /
    // recurent), nu să folosească mereu „În ultima perioadă".
    expect(SYSTEM_PROMPT_FORMAL).toMatch(/Astăzi am observat/);
    expect(SYSTEM_PROMPT_FORMAL).toMatch(/De câteva zile/);
  });

  it("SYSTEM_PROMPT_CLASSIFIER lists all ACTIVE types (post 2026-05-18 cleanup)", () => {
    // pietonal, zgomot, animale au fost mutate la „deprecated" — nu apar
    // in classifier prompt (DB inca le accepta pentru sesizari vechi).
    const activeTypes = [
      "groapa", "trotuar", "iluminat", "copac", "gunoi", "parcare",
      "stalpisori", "canalizare", "semafor",
      "graffiti", "mobilier", "transport",
      "afisaj",
      // Tipuri noi
      "banda_transport", "trecere_pietoni", "rampa_acces", "colectare_selectiva",
      "altele",
    ];
    for (const t of activeTypes) {
      expect(SYSTEM_PROMPT_CLASSIFIER).toContain(t);
    }
  });

  it("SYSTEM_PROMPT_CLASSIFIER returns only tip, no sector", () => {
    // Classifier was simplified to return {"tip": "..."} only
    expect(SYSTEM_PROMPT_CLASSIFIER).toContain('"tip"');
    expect(SYSTEM_PROMPT_CLASSIFIER).not.toContain('"sector"');
  });
});
