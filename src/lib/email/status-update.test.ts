import { describe, it, expect } from "vitest";
import { buildStatusUpdateEmail, buildVictoryEmail } from "./status-update";
import { darkenHex, emailBeforeAfter, emailPhotoBlock } from "./resend";
import { SESIZARE_STATUS_META } from "@/lib/sesizari/status";

const BEFORE = ["https://cdn.civia.ro/a/before1.jpg", "https://cdn.civia.ro/a/before2.jpg"];
const AFTER = ["https://cdn.civia.ro/a/after1.jpg"];

describe("darkenHex", () => {
  it("întunecă un hex valid", () => {
    expect(darkenHex("#059669", 0.22)).toMatch(/^#[0-9a-f]{6}$/);
    expect(darkenHex("#ffffff", 0.5)).toBe("#808080");
    expect(darkenHex("#ffffff", 0)).toBe("#ffffff");
  });
  it("input invalid → întors neschimbat", () => {
    expect(darkenHex("nu-e-hex", 0.3)).toBe("nu-e-hex");
  });
});

describe("emailBeforeAfter", () => {
  it("ambele laturi → Înainte + După + ambele URL-uri", () => {
    const html = emailBeforeAfter({ before: BEFORE, after: AFTER });
    expect(html).toContain("Înainte");
    expect(html).toContain("După");
    expect(html).toContain(BEFORE[0]!);
    expect(html).toContain(AFTER[0]!);
  });
  it("doar înainte → o singură imagine etichetată Înainte", () => {
    const html = emailBeforeAfter({ before: BEFORE, after: null });
    expect(html).toContain("Înainte");
    expect(html).not.toContain("După");
  });
  it("nimic → string gol", () => {
    expect(emailBeforeAfter({ before: [], after: null })).toBe("");
  });
});

describe("emailPhotoBlock", () => {
  it("limitează la max + escapează", () => {
    const html = emailPhotoBlock({ images: BEFORE, label: "Ce ai raportat", max: 1 });
    expect(html).toContain("Ce ai raportat");
    expect(html).toContain(BEFORE[0]!);
    expect(html).not.toContain(BEFORE[1]!); // tăiat de max:1
  });
  it("gol → string gol", () => {
    expect(emailPhotoBlock({ images: [] })).toBe("");
  });
});

describe("buildStatusUpdateEmail", () => {
  it("rezolvat: accent verde + poze inainte/dupa + CTA Vezi rezultatul", () => {
    const { subject, html } = buildStatusUpdateEmail({
      code: "00044",
      titlu: "Semafor defect",
      newStatus: "rezolvat",
      imagini: BEFORE,
      resolvedPhotos: AFTER,
    });
    expect(subject).toContain("Rezolvat");
    expect(subject).toContain("00044");
    expect(html).toContain(SESIZARE_STATUS_META.rezolvat.color); // accent semantic
    expect(html).toContain("Înainte");
    expect(html).toContain("După");
    expect(html).toContain("Vezi rezultatul");
  });

  it("respins: accent NU e verde-festiv, CTA Vezi sesizarea", () => {
    const { subject, html } = buildStatusUpdateEmail({
      code: "00050",
      titlu: "Test",
      newStatus: "respins",
    });
    expect(subject).toContain(SESIZARE_STATUS_META.respins.label);
    // hero-ul folosește culoarea de respins, nu verdele de rezolvat
    expect(html).toContain(SESIZARE_STATUS_META.respins.color);
    expect(html).toContain("Vezi sesizarea");
  });

  it("non-rezolvat cu poze -> blocul Ce ai raportat (nu before/after)", () => {
    const { html } = buildStatusUpdateEmail({
      code: "00050",
      titlu: "Test",
      newStatus: "in-lucru",
      imagini: BEFORE,
    });
    expect(html).toContain("Ce ai raportat");
    expect(html).not.toContain("După");
  });

  it("escapează titlul (XSS)", () => {
    const { html } = buildStatusUpdateEmail({
      code: "00050",
      titlu: '<script>alert(1)</script>',
      newStatus: "in-lucru",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildVictoryEmail", () => {
  it("subiect festiv + poze după + accent verde", () => {
    const { subject, html } = buildVictoryEmail({
      code: "00044",
      titlu: "Semafor defect",
      imagini: BEFORE,
      resolvedPhotos: AFTER,
    });
    expect(subject).toContain("Victorie");
    expect(html).toContain("Înainte");
    expect(html).toContain("După");
    expect(html).toContain(SESIZARE_STATUS_META.rezolvat.color);
  });
});
