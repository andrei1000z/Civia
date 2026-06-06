import { describe, it, expect, beforeEach, vi } from "vitest";

// Force the module to use its in-memory fallback by stubbing env vars BEFORE
// importing — modulul citește useDb (service key) la import. 2026-06-06: sursa
// de adevăr e profiles.hide_name în prod; fără service key → fallback in-memory.
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

// Use dynamic import so stubs apply first.
const { setHideName, getHideName, getHiddenUserIds } = await import("./hidden-users");

describe("hidden-users (in-memory fallback)", () => {
  beforeEach(async () => {
    // Reset state between tests — unset anything the previous test may have set
    await setHideName("u-a", false);
    await setHideName("u-b", false);
    await setHideName("u-c", false);
  });

  it("starts with everyone visible", async () => {
    expect(await getHideName("u-a")).toBe(false);
  });

  it("setHideName(true) then getHideName returns true", async () => {
    await setHideName("u-a", true);
    expect(await getHideName("u-a")).toBe(true);
  });

  it("setHideName(false) reverts", async () => {
    await setHideName("u-a", true);
    await setHideName("u-a", false);
    expect(await getHideName("u-a")).toBe(false);
  });

  it("getHiddenUserIds batches lookup", async () => {
    await setHideName("u-a", true);
    await setHideName("u-c", true);
    const hidden = await getHiddenUserIds(["u-a", "u-b", "u-c", "u-d"]);
    expect(hidden.has("u-a")).toBe(true);
    expect(hidden.has("u-b")).toBe(false);
    expect(hidden.has("u-c")).toBe(true);
    expect(hidden.has("u-d")).toBe(false);
  });

  it("empty userIds list returns empty set (no throw)", async () => {
    const hidden = await getHiddenUserIds([]);
    expect(hidden.size).toBe(0);
  });

  it("ignores empty userId strings", async () => {
    await setHideName("", true);
    expect(await getHideName("")).toBe(false);
  });
});
