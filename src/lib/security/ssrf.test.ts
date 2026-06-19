import { describe, it, expect } from "vitest";
import { isSafePublicUrl } from "./ssrf";

describe("isSafePublicUrl", () => {
  it("permite URL-uri publice https/http", () => {
    expect(isSafePublicUrl("https://www.facebook.com/events/123")).toBe(true);
    expect(isSafePublicUrl("http://declic.ro/petitie")).toBe(true);
    expect(isSafePublicUrl("https://8.8.8.8/x")).toBe(true);
  });

  it("blochează loopback / localhost", () => {
    expect(isSafePublicUrl("http://localhost/admin")).toBe(false);
    expect(isSafePublicUrl("http://127.0.0.1/")).toBe(false);
    expect(isSafePublicUrl("http://0.0.0.0/")).toBe(false);
    expect(isSafePublicUrl("http://service.local/")).toBe(false);
    expect(isSafePublicUrl("http://api.internal/")).toBe(false);
  });

  it("blochează rețele private + cloud metadata", () => {
    expect(isSafePublicUrl("http://10.0.0.5/")).toBe(false);
    expect(isSafePublicUrl("http://172.16.0.1/")).toBe(false);
    expect(isSafePublicUrl("http://172.31.255.255/")).toBe(false);
    expect(isSafePublicUrl("http://192.168.1.1/")).toBe(false);
    expect(isSafePublicUrl("http://169.254.169.254/latest/meta-data/")).toBe(false); // AWS/GCP metadata
  });

  it("permite 172.x publice (în afara 16-31)", () => {
    expect(isSafePublicUrl("http://172.15.0.1/")).toBe(true);
    expect(isSafePublicUrl("http://172.32.0.1/")).toBe(true);
  });

  it("blochează ORICE literal IPv6 + multicast/rezervat", () => {
    expect(isSafePublicUrl("http://[::1]/")).toBe(false);
    expect(isSafePublicUrl("http://[fe80::1]/")).toBe(false);
    expect(isSafePublicUrl("http://[::ffff:127.0.0.1]/")).toBe(false);
    expect(isSafePublicUrl("http://224.0.0.1/")).toBe(false);
  });

  it("blochează scheme non-http(s) + URL-uri invalide", () => {
    expect(isSafePublicUrl("file:///etc/passwd")).toBe(false);
    expect(isSafePublicUrl("ftp://example.com/")).toBe(false);
    expect(isSafePublicUrl("gopher://x/")).toBe(false);
    expect(isSafePublicUrl("not a url")).toBe(false);
    expect(isSafePublicUrl("")).toBe(false);
  });
});
