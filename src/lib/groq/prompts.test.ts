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

  it("SYSTEM_PROMPT_CLASSIFIER lists all 16 types", () => {
    const types = [
      "groapa", "trotuar", "iluminat", "copac", "gunoi", "parcare",
      "stalpisori", "canalizare", "semafor", "pietonal",
      "graffiti", "mobilier", "zgomot", "animale", "transport", "altele",
    ];
    for (const t of types) {
      expect(SYSTEM_PROMPT_CLASSIFIER).toContain(t);
    }
  });

  it("SYSTEM_PROMPT_CLASSIFIER returns only tip, no sector", () => {
    // Classifier was simplified to return {"tip": "..."} only
    expect(SYSTEM_PROMPT_CLASSIFIER).toContain('"tip"');
    expect(SYSTEM_PROMPT_CLASSIFIER).not.toContain('"sector"');
  });
});
