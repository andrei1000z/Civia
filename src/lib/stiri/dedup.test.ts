import { describe, it, expect } from "vitest";
import { dedupeArticles, __test } from "./dedup";

const { tokenize, jaccard } = __test;

describe("stiri dedup — tokenize", () => {
  it("normalizes diacritics, lowercase, strips punctuation, min 3 chars", () => {
    const t = tokenize("Eugen Tomac, iepurele scos din pălărie!");
    expect(t.has("eugen")).toBe(true);
    expect(t.has("tomac")).toBe(true);
    expect(t.has("iepurele")).toBe(true);
    expect(t.has("din")).toBe(true);
    expect(t.has("palarie")).toBe(true);
    // 2-char tokens excluded
    expect(t.has(",")).toBe(false);
  });

  it("handles empty title", () => {
    expect(tokenize("").size).toBe(0);
  });
});

describe("stiri dedup — jaccard", () => {
  it("identical sets = 1", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("disjoint sets = 0", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("half overlap", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBe(1 / 3);
  });

  it("Eugen Tomac near-duplicate case > 0.7 threshold", () => {
    const a = tokenize(
      'Eugen Tomac, iepurele scos din pălărie de Nicușor: „Țara are nevoie de guvern"',
    );
    const b = tokenize(
      'Eugen Tomac, primul mesaj după ce a fost vehiculat ca viitor premier: „Țara are nevoie de guvern"',
    );
    const score = jaccard(a, b);
    // Verifică doar că pragul 0.7 NU e atins (titlurile diferă semnificativ
    // pe tokens distincti: „iepurele/scos/pălărie/Nicușor" vs „primul/mesaj/
    // vehiculat/viitor/premier"). Fix-ul corect e dedup pe imagine din
    // aceeași sursă (same image_url), nu pe similaritate text.
    expect(score).toBeLessThan(0.7);
  });

  it("legit distinct same-topic articles do NOT trigger", () => {
    const a = tokenize("Bolojan anunță economia bugetară pentru 2026");
    const b = tokenize("Iohannis felicită echipa olimpică la Paris");
    expect(jaccard(a, b)).toBeLessThan(0.7);
  });
});

describe("stiri dedup — dedupeArticles", () => {
  it("removes same image_url + same source, keeps most recent", () => {
    const rows = [
      { title: "Articol vechi", source: "Gândul", image_url: "img1.jpg", published_at: "2026-05-27T10:00:00Z" },
      { title: "Articol nou despre același subiect", source: "Gândul", image_url: "img1.jpg", published_at: "2026-05-27T11:00:00Z" },
      { title: "Alt articol", source: "Gândul", image_url: "img2.jpg", published_at: "2026-05-27T12:00:00Z" },
    ];
    const result = dedupeArticles(rows);
    expect(result).toHaveLength(2);
    // Cel mai recent dintre cele 2 cu img1.jpg trebuie păstrat.
    expect(result.find((r) => r.image_url === "img1.jpg")?.title).toBe(
      "Articol nou despre același subiect",
    );
    expect(result.find((r) => r.image_url === "img2.jpg")?.title).toBe("Alt articol");
  });

  it("removes near-duplicate titles from same source", () => {
    const rows = [
      { title: "Bolojan anunță cresterea taxelor cu 5 procente pentru 2027", source: "G4Media", image_url: null, published_at: "2026-05-27T10:00:00Z" },
      { title: "Bolojan anunță cresterea taxelor cu 5 procente pentru 2027 imediat", source: "G4Media", image_url: null, published_at: "2026-05-27T11:00:00Z" },
    ];
    const result = dedupeArticles(rows);
    expect(result).toHaveLength(1);
    // Cel mai recent păstrat.
    expect(result[0]!.title).toContain("imediat");
  });

  it("keeps same image_url from DIFFERENT sources (perspective ≠ duplicate)", () => {
    const rows = [
      { title: "Versiune G4Media", source: "G4Media", image_url: "stock.jpg", published_at: "2026-05-27T10:00:00Z" },
      { title: "Versiune HotNews", source: "HotNews", image_url: "stock.jpg", published_at: "2026-05-27T11:00:00Z" },
    ];
    const result = dedupeArticles(rows);
    expect(result).toHaveLength(2);
  });

  it("keeps near-identical titles from DIFFERENT sources", () => {
    const rows = [
      { title: "Bolojan anunță economia bugetară pentru 2026", source: "G4Media", image_url: null, published_at: "2026-05-27T10:00:00Z" },
      { title: "Bolojan anunță economia bugetară pentru 2026", source: "HotNews", image_url: null, published_at: "2026-05-27T11:00:00Z" },
    ];
    const result = dedupeArticles(rows);
    expect(result).toHaveLength(2);
  });

  it("preserves order (input sorted desc by published_at returned same way)", () => {
    const rows = [
      { title: "Articol C", source: "A", image_url: null, published_at: "2026-05-27T12:00:00Z" },
      { title: "Articol B", source: "B", image_url: null, published_at: "2026-05-27T11:00:00Z" },
      { title: "Articol A", source: "C", image_url: null, published_at: "2026-05-27T10:00:00Z" },
    ];
    const result = dedupeArticles(rows);
    expect(result.map((r) => r.title)).toEqual(["Articol C", "Articol B", "Articol A"]);
  });

  it("handles empty input", () => {
    expect(dedupeArticles([])).toEqual([]);
  });

  it("handles single item", () => {
    const rows = [{ title: "Unic", source: "A", image_url: null, published_at: "2026-05-27T10:00:00Z" }];
    expect(dedupeArticles(rows)).toEqual(rows);
  });

  it("articles with null image_url don't match on image", () => {
    const rows = [
      { title: "Total diferit unul", source: "A", image_url: null, published_at: "2026-05-27T10:00:00Z" },
      { title: "Cu totul altceva doi", source: "A", image_url: null, published_at: "2026-05-27T11:00:00Z" },
    ];
    const result = dedupeArticles(rows);
    expect(result).toHaveLength(2);
  });
});
