import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We re-import the module after env mutations to pick up the new BASE_URL,
// because the helper captures it at module load via top-level const.
async function loadFresh() {
  vi.resetModules();
  const mod = await import("./geojson-url");
  return mod.geojsonUrl;
}

describe("geojsonUrl", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GEOJSON_BASE_URL;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returnează path relativ /geojson/<file> când env e absent", async () => {
    const geojsonUrl = await loadFresh();
    expect(geojsonUrl("bucuresti-border.json")).toBe("/geojson/bucuresti-border.json");
  });

  it("folosește NEXT_PUBLIC_GEOJSON_BASE_URL dacă e setat", async () => {
    process.env.NEXT_PUBLIC_GEOJSON_BASE_URL = "https://r2.civia.ro";
    const geojsonUrl = await loadFresh();
    expect(geojsonUrl("file.json")).toBe("https://r2.civia.ro/file.json");
  });

  it("elimină slash-ul trailing din base URL (no double slash)", async () => {
    process.env.NEXT_PUBLIC_GEOJSON_BASE_URL = "https://cdn.civia.ro/";
    const geojsonUrl = await loadFresh();
    expect(geojsonUrl("a.json")).toBe("https://cdn.civia.ro/a.json");
    expect(geojsonUrl("a.json")).not.toContain("//a.json");
  });

  it("elimină leading slash din filename ca să evite double slash", async () => {
    process.env.NEXT_PUBLIC_GEOJSON_BASE_URL = "https://cdn.civia.ro";
    const geojsonUrl = await loadFresh();
    expect(geojsonUrl("/file.json")).toBe("https://cdn.civia.ro/file.json");
  });

  it("acceptă subpath în base URL", async () => {
    process.env.NEXT_PUBLIC_GEOJSON_BASE_URL = "https://cdn.example.com/civia";
    const geojsonUrl = await loadFresh();
    expect(geojsonUrl("romania-border.json")).toBe(
      "https://cdn.example.com/civia/romania-border.json",
    );
  });
});
