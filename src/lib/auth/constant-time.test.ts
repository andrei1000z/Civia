import { describe, it, expect } from "vitest";
import { timingSafeEqualStr, verifyBearer } from "./constant-time";

describe("timingSafeEqualStr", () => {
  it("true pentru string-uri identice", () => {
    expect(timingSafeEqualStr("s3cr3t-token-abc", "s3cr3t-token-abc")).toBe(true);
  });
  it("false la conținut diferit de aceeași lungime", () => {
    expect(timingSafeEqualStr("aaaaaa", "aaaaab")).toBe(false);
  });
  it("false la lungimi diferite (fără throw)", () => {
    expect(timingSafeEqualStr("scurt", "mult-mai-lung")).toBe(false);
  });
  it("false pentru null/undefined", () => {
    expect(timingSafeEqualStr(null, "x")).toBe(false);
    expect(timingSafeEqualStr("x", undefined)).toBe(false);
    expect(timingSafeEqualStr(null, null)).toBe(false);
  });
  it("gestionează corect UTF-8 (diacritice)", () => {
    expect(timingSafeEqualStr("șțăî", "șțăî")).toBe(true);
    expect(timingSafeEqualStr("șțăî", "stai")).toBe(false);
  });
});

describe("verifyBearer", () => {
  const SECRET = "cron-secret-xyz-123";
  it("true pentru header Bearer corect", () => {
    expect(verifyBearer(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });
  it("false pentru secret greșit", () => {
    expect(verifyBearer("Bearer wrong", SECRET)).toBe(false);
  });
  it("false fără prefix Bearer", () => {
    expect(verifyBearer(SECRET, SECRET)).toBe(false);
    expect(verifyBearer(`Token ${SECRET}`, SECRET)).toBe(false);
  });
  it("false pentru header lipsă", () => {
    expect(verifyBearer(null, SECRET)).toBe(false);
    expect(verifyBearer(undefined, SECRET)).toBe(false);
  });
  it("false când secretul de pe server lipsește (niciodată autorizat implicit)", () => {
    expect(verifyBearer(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(verifyBearer("Bearer ", "")).toBe(false);
  });
  it("nu autorizează un prefix parțial al secretului", () => {
    expect(verifyBearer(`Bearer ${SECRET.slice(0, 5)}`, SECRET)).toBe(false);
  });
});
