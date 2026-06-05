import { describe, it, expect } from "vitest";
import {
  unsubscribeToken,
  verifyUnsubscribeToken,
  newsletterUnsubscribeUrl,
  decodeUnsubscribeEmail,
} from "./newsletter-unsubscribe";

describe("newsletter unsubscribe (HMAC stateless)", () => {
  it("token e stabil pentru același email (case-insensitive)", () => {
    expect(unsubscribeToken("Ion@Example.com")).toBe(unsubscribeToken("ion@example.com "));
  });

  it("verify acceptă tokenul propriu, respinge altul", () => {
    const email = "ion@example.com";
    expect(verifyUnsubscribeToken(email, unsubscribeToken(email))).toBe(true);
    expect(verifyUnsubscribeToken(email, "0".repeat(32))).toBe(false);
    expect(verifyUnsubscribeToken(email, "scurt")).toBe(false);
  });

  it("URL conține emailul (base64url) + token; round-trip corect", () => {
    const url = newsletterUnsubscribeUrl("ana@civia.ro", "https://civia.ro");
    const u = new URL(url);
    const e = u.searchParams.get("e")!;
    const t = u.searchParams.get("t")!;
    expect(decodeUnsubscribeEmail(e)).toBe("ana@civia.ro");
    expect(verifyUnsubscribeToken("ana@civia.ro", t)).toBe(true);
  });

  it("decodeUnsubscribeEmail respinge gunoi", () => {
    expect(decodeUnsubscribeEmail("not-base64-@@@")).toBeNull();
  });
});
