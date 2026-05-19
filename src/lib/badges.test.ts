import { describe, it, expect } from "vitest";
import { computeBadges, BADGES, computeStreak } from "./badges";

const ZERO = { sesizari: 0, votes: 0, comments: 0, verifications: 0, resolved: 0 };

describe("computeBadges", () => {
  it("zero activity → no earned badges, but each category shows the first as next", () => {
    const r = computeBadges(ZERO);
    expect(r.earned).toEqual([]);
    expect(r.next).toHaveLength(5); // one per category
    expect(r.next.every((n) => n.current === 0)).toBe(true);
    expect(r.next.map((n) => n.badge.id)).toContain("first-sesizare");
  });

  it("just hit first threshold → first badge earned, second is next", () => {
    const r = computeBadges({ ...ZERO, sesizari: 1 });
    expect(r.earned.find((e) => e.badge.id === "first-sesizare")).toBeDefined();
    expect(r.next.find((n) => n.badge.id === "active-citizen")?.remaining).toBe(4);
  });

  it("hits multiple tiers in same category", () => {
    const r = computeBadges({ ...ZERO, sesizari: 25 });
    const earnedIds = r.earned.map((e) => e.badge.id);
    expect(earnedIds).toContain("first-sesizare");
    expect(earnedIds).toContain("active-citizen");
    expect(earnedIds).toContain("civic-leader");
    // 50 not yet — must surface as next
    expect(r.next.find((n) => n.badge.id === "hero-bucharest")?.remaining).toBe(25);
  });

  it("max-tier in a category → no 'next' for that category", () => {
    const r = computeBadges({ ...ZERO, sesizari: 999 });
    const sesizareNext = r.next.find((n) =>
      BADGES.sesizari.some((b) => b.id === n.badge.id),
    );
    expect(sesizareNext).toBeUndefined();
    expect(r.earned.filter((e) => BADGES.sesizari.some((b) => b.id === e.badge.id))).toHaveLength(4);
  });

  it("computes across all 5 categories independently", () => {
    const r = computeBadges({
      sesizari: 5,
      votes: 50,
      comments: 1,
      verifications: 0,
      resolved: 5,
    });
    const earnedIds = r.earned.map((e) => e.badge.id);
    expect(earnedIds).toContain("active-citizen");      // sesizari ≥5
    expect(earnedIds).toContain("regular-voter");       // votes ≥50
    expect(earnedIds).toContain("first-comment");       // comments ≥1
    expect(earnedIds).toContain("impact-maker");        // resolved ≥5
    expect(earnedIds).not.toContain("first-verify");    // verifications 0
  });

  it("'next' for a category shows ONE next badge (not all unearned)", () => {
    const r = computeBadges({ ...ZERO, sesizari: 0 });
    const sesizareNext = r.next.filter((n) =>
      BADGES.sesizari.some((b) => b.id === n.badge.id),
    );
    expect(sesizareNext).toHaveLength(1);
  });

  it("counts are returned with each earned badge", () => {
    const r = computeBadges({ ...ZERO, sesizari: 7 });
    const earned = r.earned.find((e) => e.badge.id === "active-citizen");
    expect(earned?.count).toBe(7);
  });

  it("`remaining` reflects gap to next threshold", () => {
    const r = computeBadges({ ...ZERO, sesizari: 18 });
    const next = r.next.find((n) => n.badge.id === "civic-leader");
    expect(next?.current).toBe(18);
    expect(next?.remaining).toBe(2); // threshold 20 - current 18
  });
});

describe("BADGES data integrity", () => {
  it("all categories have at least one badge", () => {
    const categories = ["sesizari", "votes", "comments", "verifications", "resolved"] as const;
    for (const cat of categories) {
      expect(BADGES[cat].length).toBeGreaterThan(0);
    }
  });

  it("thresholds are monotonically increasing within a category", () => {
    for (const [, badges] of Object.entries(BADGES)) {
      for (let i = 1; i < badges.length; i++) {
        const prev = badges[i - 1];
        const cur = badges[i];
        if (!prev || !cur) continue;
        expect(cur.threshold).toBeGreaterThan(prev.threshold);
      }
    }
  });

  it("all badge ids are unique across categories", () => {
    const allIds: string[] = [];
    for (const [, badges] of Object.entries(BADGES)) {
      for (const b of badges) allIds.push(b.id);
    }
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("computeStreak", () => {
  const today = () => new Date().toISOString();
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  it("returneaza 0 pentru array gol", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("returneaza 1 daca doar azi exista activitate", () => {
    expect(computeStreak([today()])).toBe(1);
  });

  it("returneaza 1 daca doar ieri exista activitate (azi inca nu a actionat)", () => {
    expect(computeStreak([daysAgo(1)])).toBe(1);
  });

  it("returneaza 0 daca cea mai recenta activitate e mai veche de ieri", () => {
    expect(computeStreak([daysAgo(2)])).toBe(0);
    expect(computeStreak([daysAgo(5)])).toBe(0);
  });

  it("calculeaza streak de 3 zile (azi + ieri + acum 2 zile)", () => {
    expect(computeStreak([today(), daysAgo(1), daysAgo(2)])).toBe(3);
  });

  it("calculeaza streak de 7 zile consecutive", () => {
    const ts = Array.from({ length: 7 }, (_, i) => daysAgo(i));
    expect(computeStreak(ts)).toBe(7);
  });

  it("se rupe streak-ul daca lipseste o zi", () => {
    const ts = [today(), daysAgo(1), daysAgo(3)];
    expect(computeStreak(ts)).toBe(2);
  });

  it("dedupe activitatile multiple in aceeasi zi", () => {
    const t = today();
    const ts = [t, t, t, daysAgo(1)];
    expect(computeStreak(ts)).toBe(2);
  });
});

describe("computeBadges cu streak", () => {
  it("acorda streak-7 cand streak >= 7", () => {
    const result = computeBadges({
      sesizari: 0, votes: 0, comments: 0, verifications: 0, resolved: 0,
      streak: 7,
    });
    const ids = result.earned.map((e) => e.badge.id);
    expect(ids).toContain("streak-3");
    expect(ids).toContain("streak-7");
    expect(ids).not.toContain("streak-30");
  });

  it("nu acorda streak-uri daca streak nu e furnizat (backward compat)", () => {
    const result = computeBadges({
      sesizari: 0, votes: 0, comments: 0, verifications: 0, resolved: 0,
    });
    const ids = result.earned.map((e) => e.badge.id);
    expect(ids.filter((id) => id.startsWith("streak"))).toHaveLength(0);
  });
});
