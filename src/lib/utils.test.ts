import { describe, it, expect } from "vitest";
import {
  cn,
  slugify,
  truncate,
  clamp,
  formatCurrency,
  formatNumber,
  formatDecimal,
  formatCompact,
  formatDate,
  formatDateTime,
  randomInt,
} from "./utils";

describe("cn (className merger)", () => {
  it("combines multiple classes", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });
  it("handles falsy values", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
  it("merges conflicting tailwind classes via twMerge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("respects conditional classes", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });
});

describe("slugify", () => {
  it("converts Romanian diacritics correctly", () => {
    expect(slugify("Bucureşti")).toBe("bucuresti");
    expect(slugify("București")).toBe("bucuresti");
    expect(slugify("Piața Victoriei")).toBe("piata-victoriei");
    expect(slugify("Şoseaua Ştefan")).toBe("soseaua-stefan");
  });
  it("handles punctuation and spaces", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  multiple   spaces  ")).toBe("multiple-spaces");
  });
  it("lowercases everything", () => {
    expect(slugify("UPPERCASE")).toBe("uppercase");
  });
  it("removes leading/trailing hyphens", () => {
    expect(slugify("---test---")).toBe("test");
  });
});

describe("truncate", () => {
  it("returns original when under limit", () => {
    expect(truncate("short", 20)).toBe("short");
  });
  it("truncates and adds ellipsis", () => {
    const result = truncate("this is a very long string", 10);
    expect(result).toBe("this is a…");
    expect(result.length).toBeLessThanOrEqual(11); // 10 chars + ellipsis
  });
  it("handles exact length", () => {
    expect(truncate("exact", 5)).toBe("exact");
  });
});

describe("clamp", () => {
  it("returns value in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("handles equal min and max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe("formatCurrency", () => {
  it("formats RON by default", () => {
    const result = formatCurrency(100);
    expect(result).toContain("100");
    expect(result.toLowerCase()).toMatch(/ron|lei/);
  });
  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });
});

describe("formatNumber", () => {
  it("adds separators for thousands (Romanian locale)", () => {
    const result = formatNumber(1234567);
    // Romanian uses "." as thousands separator
    expect(result.length).toBeGreaterThan(7);
    expect(result).toContain("1");
    expect(result).toContain("234");
  });
});

describe("formatDecimal", () => {
  it("uses Romanian comma separator", () => {
    expect(formatDecimal(596.5, 1)).toMatch(/596,5/);
    expect(formatDecimal(4.27, 2)).toMatch(/4,27/);
  });
  it("respects fractionDigits parameter", () => {
    expect(formatDecimal(1.5, 0)).toBe("2");
    expect(formatDecimal(1.5555, 3)).toMatch(/1,(556|555)/);
  });
  it("handles zero correctly", () => {
    expect(formatDecimal(0, 1)).toBe("0,0");
  });
});

describe("formatCompact", () => {
  it("formats small numbers as-is", () => {
    expect(formatCompact(42)).toBe("42");
    expect(formatCompact(999)).toBe("999");
  });
  it("formats thousands as 'mii'", () => {
    expect(formatCompact(1500)).toMatch(/2 mii|1 mii/);
    expect(formatCompact(125_000)).toContain("mii");
  });
  it("formats millions as 'mil'", () => {
    expect(formatCompact(3_400_000)).toContain("mil");
  });
  it("formats billions as 'mld'", () => {
    expect(formatCompact(1_200_000_000)).toContain("mld");
  });
});

describe("formatDate (SSR-safe)", () => {
  it("uses Europe/Bucharest timezone", () => {
    // 2024-01-15T22:00:00Z = 2024-01-16 00:00 in Bucharest (CET, UTC+1)
    // În UTC ar fi „15 ianuarie", în Bucharest „16 ianuarie".
    const d = new Date("2024-01-15T22:30:00Z");
    const result = formatDate(d);
    expect(result).toContain("16"); // ziua în Bucharest, nu UTC
    expect(result).toContain("ianuarie");
    expect(result).toContain("2024");
  });
  it("handles ISO string input", () => {
    const result = formatDate("2024-06-15T10:00:00Z");
    expect(result).toContain("15");
    expect(result).toContain("iunie");
  });
});

describe("formatDateTime (SSR-safe)", () => {
  it("includes hour and minute in Bucharest tz", () => {
    // 2024-06-15T10:00:00Z = 13:00 in Bucharest (DST, UTC+3)
    const result = formatDateTime("2024-06-15T10:00:00Z");
    expect(result).toContain("13:00");
  });
  it("uses Romanian locale", () => {
    const result = formatDateTime("2024-12-25T12:00:00Z");
    expect(result.toLowerCase()).toMatch(/dec|25/);
  });
});

describe("randomInt", () => {
  it("returns value in range", () => {
    for (let i = 0; i < 100; i++) {
      const result = randomInt(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    }
  });
  it("returns integer", () => {
    const result = randomInt(1, 100);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ── Edge cases pentru slugify (folosit pentru petiții + proteste) ──
describe("slugify — Civia edge cases", () => {
  it("handles empty string gracefully", () => {
    expect(slugify("")).toBe("");
  });
  it("handles only-punctuation input", () => {
    expect(slugify("!!!???")).toBe("");
  });
  it("collapses multiple consecutive spaces", () => {
    expect(slugify("Hello    World")).toBe("hello-world");
  });
  it("strips ALL Romanian diacritics in any combination", () => {
    expect(slugify("Tărâmul Înțelepților Cășcădărdarvedanței")).toBe(
      "taramul-inteleptilor-cascadardarvedantei",
    );
  });
  it("handles long titles by not breaking output", () => {
    const long = "Vrem ca primăria să demareze imediat lucrările de modernizare a infrastructurii de transport public din întregul oraș";
    const result = slugify(long);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/[^a-z0-9-]/);
  });
  it("handles emojis and unicode by stripping them", () => {
    expect(slugify("Cluj 🎉 cool 🌟")).toMatch(/^cluj-cool$|^cluj--cool$/);
  });
  it("handles real petiție titles end-to-end", () => {
    expect(slugify("„Vrem piste de bicicletă continue în Cluj-Napoca"))
      .toBe("vrem-piste-de-bicicleta-continue-in-cluj-napoca");
  });
  it("handles real protest titles end-to-end", () => {
    expect(slugify("Marș #FaraCorupție în Piața Victoriei"))
      .toBe("mars-faracoruptie-in-piata-victoriei");
  });
});
