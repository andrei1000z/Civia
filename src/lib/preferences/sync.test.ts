import { describe, it, expect, beforeEach } from "vitest";
import {
  mergePreferences,
  readLocalPreferences,
  writeLocalPreferences,
  type UserPreferences,
} from "./sync";

function makePrefs(partial: Partial<UserPreferences>): UserPreferences {
  return {
    theme: null,
    cookie_consent: null,
    dismissed_prompts: null,
    updated_at: null,
    ...partial,
  };
}

describe("preferences/sync — mergePreferences", () => {
  it("daca remote e mai nou, remote castiga pe theme + cookie", () => {
    const local = makePrefs({
      theme: "light",
      updated_at: "2026-05-01T00:00:00Z",
    });
    const remote = makePrefs({
      theme: "dark",
      updated_at: "2026-05-10T00:00:00Z",
    });
    const merged = mergePreferences(local, remote);
    expect(merged.theme).toBe("dark");
  });

  it("daca local e mai nou, local castiga pe theme", () => {
    const local = makePrefs({
      theme: "dark",
      updated_at: "2026-05-15T00:00:00Z",
    });
    const remote = makePrefs({
      theme: "light",
      updated_at: "2026-05-10T00:00:00Z",
    });
    const merged = mergePreferences(local, remote);
    expect(merged.theme).toBe("dark");
  });

  it("dismissed_prompts e UNION peste local + remote (dismissed pe orice device ramane dismissed)", () => {
    const local = makePrefs({
      dismissed_prompts: { newsletter_nudge: "2026-05-01T00:00:00Z" },
    });
    const remote = makePrefs({
      dismissed_prompts: { install_prompt: "2026-05-05T00:00:00Z" },
    });
    const merged = mergePreferences(local, remote);
    expect(merged.dismissed_prompts).toEqual({
      newsletter_nudge: "2026-05-01T00:00:00Z",
      install_prompt: "2026-05-05T00:00:00Z",
    });
  });

  it("dismissed_prompts: pe acelasi key, timestamp-ul mai recent castiga", () => {
    const local = makePrefs({
      dismissed_prompts: { newsletter_nudge: "2026-05-01T00:00:00Z" },
    });
    const remote = makePrefs({
      dismissed_prompts: { newsletter_nudge: "2026-05-15T00:00:00Z" },
    });
    const merged = mergePreferences(local, remote);
    expect(merged.dismissed_prompts?.newsletter_nudge).toBe("2026-05-15T00:00:00Z");
  });

  it("daca local theme null si remote nu, remote castiga indiferent de timestamps", () => {
    const local = makePrefs({ theme: null, updated_at: "2026-06-01T00:00:00Z" });
    const remote = makePrefs({ theme: "dark", updated_at: "2026-05-01T00:00:00Z" });
    const merged = mergePreferences(local, remote);
    expect(merged.theme).toBe("dark");
  });

  it("cookie_consent: NULL local + NULL remote → NULL merged", () => {
    const local = makePrefs({});
    const remote = makePrefs({});
    const merged = mergePreferences(local, remote);
    expect(merged.cookie_consent).toBeNull();
  });

  it("cookie_consent: doar remote → remote castiga", () => {
    const consent = {
      essential: true,
      preferences: true,
      analytics: true,
      marketing: false,
      acceptedAt: "2026-05-10T00:00:00Z",
    };
    const local = makePrefs({});
    const remote = makePrefs({
      cookie_consent: consent,
      updated_at: "2026-05-10T00:00:00Z",
    });
    const merged = mergePreferences(local, remote);
    expect(merged.cookie_consent).toEqual(consent);
  });
});

describe("preferences/sync — local storage", () => {
  beforeEach(() => {
    // happy-dom oferă localStorage; resetam-l intre teste.
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("writeLocalPreferences si readLocalPreferences sunt round-trip", () => {
    writeLocalPreferences({
      theme: "dark",
      cookie_consent: {
        essential: true,
        preferences: true,
        analytics: false,
        marketing: false,
        acceptedAt: "2026-05-16T00:00:00Z",
      },
    });
    const read = readLocalPreferences();
    expect(read.theme).toBe("dark");
    expect(read.cookie_consent?.preferences).toBe(true);
    expect(read.cookie_consent?.analytics).toBe(false);
  });

  it("theme invalid in localStorage e ignorat", () => {
    localStorage.setItem("civia_theme", "purple"); // not in enum
    const read = readLocalPreferences();
    expect(read.theme).toBeNull();
  });

  it("cookie_consent corupt in localStorage nu crash-uieste readLocalPreferences", () => {
    localStorage.setItem("civia_cookie_consent_v2", "not json");
    const read = readLocalPreferences();
    expect(read.cookie_consent).toBeNull();
  });

  it("setarea null pe theme sterge cheia din localStorage", () => {
    writeLocalPreferences({ theme: "dark" });
    expect(localStorage.getItem("civia_theme")).toBe("dark");
    writeLocalPreferences({ theme: null });
    expect(localStorage.getItem("civia_theme")).toBeNull();
  });
});
