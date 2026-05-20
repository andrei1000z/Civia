import { describe, it, expect } from "vitest";
import { SESIZARI_TEMPLATES, TEMPLATE_CATEGORIES } from "./sesizari-templates";

describe("SESIZARI_TEMPLATES", () => {
  it("contine cel putin 10 templates", () => {
    expect(SESIZARI_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("toate template-urile au id unic", () => {
    const ids = SESIZARI_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toate template-urile au descriere min 50 chars", () => {
    for (const t of SESIZARI_TEMPLATES) {
      expect(t.descriere.length).toBeGreaterThanOrEqual(50);
    }
  });

  it("toate template-urile au category valid", () => {
    const validCategories = TEMPLATE_CATEGORIES.map((c) => c.id);
    for (const t of SESIZARI_TEMPLATES) {
      expect(validCategories).toContain(t.category);
    }
  });

  it("toate template-urile au emoji + label + tip", () => {
    for (const t of SESIZARI_TEMPLATES) {
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.tip.length).toBeGreaterThan(0);
    }
  });
});
