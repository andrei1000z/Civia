import { describe, it, expect } from "vitest";
import { referrerSource } from "./referrer-source";

describe("referrerSource", () => {
  it("returns 'direct' pentru null/empty/direct", () => {
    expect(referrerSource(null)).toBe("direct");
    expect(referrerSource("")).toBe("direct");
    expect(referrerSource("direct")).toBe("direct");
    expect(referrerSource("(none)")).toBe("direct");
    expect(referrerSource(undefined)).toBe("direct");
  });

  it("recunoaste Reddit (URL plin sau hostname)", () => {
    expect(referrerSource("https://www.reddit.com/r/bucuresti/comments/x")).toBe("reddit");
    expect(referrerSource("reddit.com")).toBe("reddit");
    expect(referrerSource("old.reddit.com")).toBe("reddit");
    expect(referrerSource("m.reddit.com")).toBe("reddit");
  });

  it("recunoaste Google (search + ads)", () => {
    expect(referrerSource("https://www.google.com/search?q=civia")).toBe("google");
    expect(referrerSource("google.ro")).toBe("google");
  });

  it("recunoaste social: facebook/twitter/instagram", () => {
    expect(referrerSource("https://www.facebook.com/permalink")).toBe("facebook");
    expect(referrerSource("fb.me")).toBe("facebook");
    expect(referrerSource("t.co")).toBe("twitter");
    expect(referrerSource("x.com")).toBe("twitter");
    expect(referrerSource("instagram.com")).toBe("instagram");
    expect(referrerSource("tiktok.com")).toBe("tiktok");
  });

  it("recunoaste media RO ca un bucket consolidat", () => {
    expect(referrerSource("https://www.digi24.ro/articol")).toBe("media-ro");
    expect(referrerSource("hotnews.ro")).toBe("media-ro");
    expect(referrerSource("g4media.ro")).toBe("media-ro");
  });

  it("strip www. + m. + amp. prefixes", () => {
    expect(referrerSource("www.reddit.com")).toBe("reddit");
    expect(referrerSource("m.facebook.com")).toBe("facebook");
    expect(referrerSource("amp.reddit.com")).toBe("reddit");
  });

  it("returneaza 'other' pentru hostname-uri necunoscute", () => {
    expect(referrerSource("https://blog.unknown-site.com/post")).toBe("other");
    expect(referrerSource("random.io")).toBe("other");
  });

  it("self-referral civia → 'internal'", () => {
    expect(referrerSource("https://civia.ro/sesizari")).toBe("internal");
    expect(referrerSource("www.civia.ro")).toBe("internal");
  });
});
