import { describe, it, expect } from "vitest";
import {
  categorizePending,
  digestSignature,
  shouldSendDigest,
  buildDigestEmail,
  DIGEST_REMINDER_MS,
  type DigestReply,
  type DigestSesizare,
} from "./pending-digest";

const NOW = Date.parse("2026-06-12T12:00:00Z");
const recent = "2026-06-10T10:00:00Z";
const old = "2026-01-01T10:00:00Z";

function reply(p: Partial<DigestReply>): DigestReply {
  return {
    id: p.id ?? "r1",
    sesizare_id: p.sesizare_id ?? null,
    ai_status: p.ai_status ?? null,
    ai_confidence: p.ai_confidence ?? 90,
    ai_summary: p.ai_summary ?? "sumar",
    from_email: p.from_email ?? "office@primarie.ro",
    authority_name: p.authority_name ?? null,
    subject: p.subject ?? "subiect",
    received_at: p.received_at ?? recent,
    auto_applied: p.auto_applied ?? false,
    user_confirmed: p.user_confirmed ?? null,
    attachments: p.attachments,
  };
}

const SES: Record<string, DigestSesizare> = {
  s_inreg: { id: "s_inreg", code: "00010", status: "inregistrata", locatie: "Str. X" },
  s_ignorat: { id: "s_ignorat", code: "00001", status: "ignorat", locatie: "Str. Y" },
};

describe("categorizePending", () => {
  it("răspuns de progres care AR avansa sesizarea, neaplicat → progresNeaplicat", () => {
    const out = categorizePending(
      [reply({ id: "a", sesizare_id: "s_inreg", ai_status: "rezolvat", auto_applied: false })],
      SES,
      NOW,
    );
    expect(out.progresNeaplicat).toHaveLength(1);
    expect(out.progresNeaplicat[0]!.code).toBe("00010");
    expect(out.totalActionable).toBe(1);
  });

  it("status terminal (ignorat) cu răspuns de progres → flag (maschează un răspuns)", () => {
    const out = categorizePending(
      [reply({ id: "b", sesizare_id: "s_ignorat", ai_status: "in-lucru", auto_applied: false })],
      SES,
      NOW,
    );
    expect(out.progresNeaplicat).toHaveLength(1);
    expect(out.progresNeaplicat[0]!.motiv).toContain("ignorat");
  });

  it("redirectionata pe inregistrata (NU avansează, nu terminal) → ignorat", () => {
    const out = categorizePending(
      [reply({ id: "c", sesizare_id: "s_inreg", ai_status: "redirectionata", auto_applied: false })],
      SES,
      NOW,
    );
    expect(out.totalActionable).toBe(0);
  });

  it("răspuns deja auto-aplicat → NU intră", () => {
    const out = categorizePending(
      [reply({ id: "d", sesizare_id: "s_inreg", ai_status: "rezolvat", auto_applied: true })],
      SES,
      NOW,
    );
    expect(out.totalActionable).toBe(0);
  });

  it("orfan cu status de progres → orfaniProgres", () => {
    const out = categorizePending(
      [reply({ id: "e", sesizare_id: null, ai_status: "rezolvat" })],
      SES,
      NOW,
    );
    expect(out.orfaniProgres).toHaveLength(1);
    expect(out.totalActionable).toBe(1);
  });

  it("orfan inregistrata → doar NUMĂRAT, nu listat", () => {
    const out = categorizePending(
      [reply({ id: "f", sesizare_id: null, ai_status: "inregistrata" })],
      SES,
      NOW,
    );
    expect(out.orfaniInregistrareCount).toBe(1);
    expect(out.totalActionable).toBe(0);
  });

  it("OCR eșuat → ocrEsuat, fără să dubleze un element deja acționabil", () => {
    const failedAtt = [{ filename: "x.pdf", extraction_method: "failed" }];
    const out = categorizePending(
      [
        // already actionable (progres) AND has failed attachment → must NOT double
        reply({ id: "g", sesizare_id: "s_inreg", ai_status: "rezolvat", attachments: failedAtt }),
        // pure OCR failure (inregistrata, matched) → ocrEsuat
        reply({ id: "h", sesizare_id: "s_inreg", ai_status: "inregistrata", attachments: failedAtt }),
      ],
      SES,
      NOW,
    );
    expect(out.progresNeaplicat.map((i) => i.replyId)).toContain("g");
    expect(out.ocrEsuat.map((i) => i.replyId)).toEqual(["h"]);
    expect(out.ocrEsuat.map((i) => i.replyId)).not.toContain("g");
  });

  it("orfan vechi (peste maxAgeDays) → ignorat", () => {
    const out = categorizePending(
      [reply({ id: "i", sesizare_id: null, ai_status: "rezolvat", received_at: old })],
      SES,
      NOW,
    );
    expect(out.totalActionable).toBe(0);
  });
});

describe("digestSignature", () => {
  it("e deterministă (sortată) indiferent de ordine", () => {
    const a = categorizePending(
      [
        reply({ id: "z", sesizare_id: null, ai_status: "rezolvat" }),
        reply({ id: "a", sesizare_id: null, ai_status: "in-lucru" }),
      ],
      SES,
      NOW,
    );
    expect(digestSignature(a)).toBe("a,z");
  });
});

describe("shouldSendDigest", () => {
  const base = { signature: "a,b", lastSignature: "a,b", lastSentAtMs: NOW, nowMs: NOW };
  it("coadă goală → niciodată", () => {
    expect(shouldSendDigest({ ...base, totalActionable: 0 })).toBe(false);
  });
  it("set nou (semnătură schimbată) → trimite", () => {
    expect(shouldSendDigest({ ...base, totalActionable: 2, lastSignature: "a" })).toBe(true);
  });
  it("primul digest (lastSentAt null) → trimite", () => {
    expect(shouldSendDigest({ ...base, totalActionable: 2, lastSentAtMs: null })).toBe(true);
  });
  it("același set, sub 7 zile → NU trimite (fără spam)", () => {
    expect(shouldSendDigest({ ...base, totalActionable: 2, nowMs: NOW + 3 * 86_400_000 })).toBe(false);
  });
  it("același set, ≥7 zile → re-reminder", () => {
    expect(shouldSendDigest({ ...base, totalActionable: 2, nowMs: NOW + DIGEST_REMINDER_MS })).toBe(true);
  });
});

describe("buildDigestEmail", () => {
  it("subiect cu plural corect + link admin", () => {
    const sections = categorizePending(
      [
        reply({ id: "a", sesizare_id: "s_inreg", ai_status: "rezolvat" }),
        reply({ id: "b", sesizare_id: null, ai_status: "in-lucru" }),
      ],
      SES,
      NOW,
    );
    const { subject, html } = buildDigestEmail(sections, "https://civia.ro");
    expect(subject).toContain("2 răspunsuri");
    expect(html).toContain("https://civia.ro/admin/inbox/a");
    expect(html).toContain("/admin/inbox");
  });
  it("singular pentru 1 element", () => {
    const sections = categorizePending(
      [reply({ id: "a", sesizare_id: "s_inreg", ai_status: "rezolvat" })],
      SES,
      NOW,
    );
    expect(buildDigestEmail(sections, "https://civia.ro").subject).toContain("1 răspuns ");
  });
});
