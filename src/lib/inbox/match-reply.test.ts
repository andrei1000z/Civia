import { describe, it, expect } from "vitest";
import { makeReplyToken, verifyReplyToken, replyToAddress, extractReplyToken } from "./reply-token";
import {
  parseMessageIds, codeFromMessageIds, scoreCandidates, baseDom, toks,
  type Candidate,
} from "./match-reply";

describe("reply-token (Nivel 1)", () => {
  it("token e determinist + verificabil round-trip", () => {
    const t = makeReplyToken("00007");
    expect(t).toMatch(/^[a-f0-9]{10}$/);
    expect(makeReplyToken("00007")).toBe(t); // determinist
    expect(verifyReplyToken(t, "00007")).toBe(true);
    expect(verifyReplyToken(t, "00008")).toBe(false); // alt cod
  });

  it("coduri diferite → tokenuri diferite", () => {
    expect(makeReplyToken("00007")).not.toBe(makeReplyToken("00008"));
  });

  it("replyToAddress + extractReplyToken round-trip", () => {
    const addr = replyToAddress("00042");
    expect(addr).toMatch(/^sesizari\+[a-f0-9]{10}@civia\.ro$/);
    const tok = extractReplyToken(addr);
    expect(tok).toBe(makeReplyToken("00042"));
    expect(verifyReplyToken(tok!, "00042")).toBe(true);
  });

  it("extractReplyToken NU prinde codul brut vechi (sesizari+00007@)", () => {
    expect(extractReplyToken("sesizari+00007@civia.ro")).toBeNull(); // 00007 nu e 10 hex
    expect(extractReplyToken("sesizari@civia.ro")).toBeNull();
  });
});

describe("threading (Nivel 2)", () => {
  it("parseMessageIds sparge In-Reply-To + References în toate id-urile", () => {
    const ids = parseMessageIds("<a@x.ro>", "<b@y.ro> <sesizare-00007-abc@civia.ro>");
    expect(ids).toEqual(["<a@x.ro>", "<b@y.ro>", "<sesizare-00007-abc@civia.ro>"]);
  });

  it("codeFromMessageIds extrage codul din Message-ID-ul propriu Civia", () => {
    expect(codeFromMessageIds(["<x@y.ro>", "<sesizare-00007-abc123@civia.ro>"])).toBe("00007");
    expect(codeFromMessageIds(["<random@gmail.com>"])).toBeNull();
  });
});

describe("baseDom (Nivel 4a)", () => {
  it("normalizează subdomeniile de instituție la domeniul de bază", () => {
    expect(baseDom("registratura.primarias1.ro")).toBe("primarias1.ro");
    expect(baseDom("circulatie.rutiera.plmb.ro")).toBe("plmb.ro");
    expect(baseDom("primarie6.ro")).toBe("primarie6.ro");
  });
});

describe("scoreCandidates (Nivel 4b)", () => {
  const mk = (code: string, locatie: string, sent: string[] = []): Candidate => ({
    id: code, code, locatie, titlu: null, sent_to_emails: sent, sent_at: "2026-06-01", status: "trimis",
  });

  it("alege candidatul cu cele mai multe tokenuri de adresă (numărul = discriminant)", () => {
    const reply = toks("Calea 13 Septembrie nr 222-228 sector 5 autovehicule");
    const cands = [
      mk("00007", "Calea 13 Septembrie, nr. 222-228"),
      mk("00006", "Calea 13 Septembrie, între Panduri"),
      mk("00050", "Șoseaua Panduri nr. 33"),
    ];
    const scored = scoreCandidates(reply, "x.ro", cands);
    expect(scored[0]!.c.code).toBe("00007");
    expect(scored[0]!.score).toBeGreaterThanOrEqual(3); // septembrie + 222 + 228
    expect(scored[0]!.score).toBeGreaterThan(scored[1]!.score);
  });

  it("bonus +1 dacă reply-ul vine de la domeniul la care s-a trimis", () => {
    const reply = toks("Calea Griviței 208");
    const withDom = scoreCandidates(reply, "aspmb.ro", [mk("00001", "Calea Griviței nr. 208", ["office@aspmb.ro"])]);
    const noDom = scoreCandidates(reply, "alt.ro", [mk("00001", "Calea Griviței nr. 208", ["office@aspmb.ro"])]);
    expect(withDom[0]!.score).toBe(noDom[0]!.score + 1);
  });

  it("returnează gol când nu se suprapune nimic", () => {
    expect(scoreCandidates(toks("text irelevant"), "x.ro", [mk("00009", "Strada Inexistentă")])).toHaveLength(0);
  });
});
