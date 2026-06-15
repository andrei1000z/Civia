/**
 * 2026-06-08 — Matching automat reply→sesizare (defense-in-depth, 4 niveluri).
 * Research-driven (vezi workflow inbox-matching-research).
 *
 *   N1 TOKEN  (det, ~99%): token opac HMAC în Reply-To (sesizari+{token}@).
 *   N2 THREAD (det, ~98%): Message-ID propriu în In-Reply-To/References.
 *   N3 COD    (det, ~95%): cod în To/subiect/body (extractSesizareCode).
 *   N4 FUZZY  (gated):     domeniu unic → scor adresă → AI, DOAR pe candidați
 *                          ELIGIBILI (trimiși via Civia înainte de reply).
 *
 * Nivelurile deterministe (N1-N3) sunt autoritative (token/Message-ID/cod nu
 * coincid din întâmplare) → leagă exact sesizarea. Nivelul fuzzy (N4) e
 * constrâns la mulțimea eligibilă + cere câștigător clar; altfel rămâne nelegat
 * (review manual). Astfel AI-ul nu poate „inventa" — alege doar din eligibili.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractReplyToken } from "./reply-token";
import { groqText, GROQ_MODEL_FAST } from "@/lib/groq/client";

export type MatchMethod =
  | "token" | "threading" | "code" | "domain" | "content_score" | "ai" | null;
export type MatchConfidence = "high" | "medium" | null;

export interface MatchResult {
  sesizareId: string | null;
  code: string | null;
  method: MatchMethod;
  confidence: MatchConfidence;
}

export interface Candidate {
  id: string;
  code: string;
  locatie: string | null;
  titlu: string | null;
  sent_to_emails: string[] | null;
  sent_at: string | null;
  status: string;
  created_at?: string | null;
}

// ─── Pure helpers (testabile) ──────────────────────────────────────

export const dom = (e: string) => (e || "").split("@")[1]?.toLowerCase() || "";
export const baseDom = (d: string) =>
  d.replace(
    /^(www|registratura|noreply|no-reply|contact|secretariat|circulatie\.rutiera|circulatie|portal|noreply\.portal|noreply\.eps2|office|relatii|relatiicupublicul)\./,
    "",
  );
const STOP = new Set([
  "sector", "strada", "str", "calea", "cale", "bulevardul", "bdul", "soseaua", "sos",
  "nr", "numarul", "intre", "din", "fata", "aferent", "municipiul", "bucuresti",
  "trotuar", "trotuarul", "pe", "la", "si", "de", "cu",
]);
export const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export const toks = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t)));

/** Sparge In-Reply-To + References în toate Message-ID-urile (RFC 5322 §3.6.4). */
export function parseMessageIds(inReplyTo: string | null, references: string | null): string[] {
  const all = `${inReplyTo ?? ""} ${references ?? ""}`;
  return [...all.matchAll(/<[^>]+>/g)].map((m) => m[0].toLowerCase());
}

/** Extrage codul (5 cifre) dintr-un Message-ID propriu `<sesizare-CCCCC-...@civia.ro>`. */
export function codeFromMessageIds(ids: string[]): string | null {
  for (const id of ids) {
    const m = id.match(/sesizare[-_](\d{4,6})[-_@]/i);
    if (m && m[1]) return m[1];
  }
  return null;
}

/** Scor de adresă: token-overlap între textul reply-ului și `locatie` candidatului.
 *  +1 bonus dacă reply-ul vine de la domeniul la care s-a trimis sesizarea. */
export function scoreCandidates(
  replyTok: Set<string>,
  fromDomain: string,
  candidates: Candidate[],
): Array<{ c: Candidate; score: number }> {
  return candidates
    .map((c) => {
      const sTok = toks(c.locatie || "");
      let score = 0;
      for (const t of sTok) if (replyTok.has(t)) score++;
      const inDom = (c.sent_to_emails || []).some((e) => baseDom(dom(e)) === fromDomain);
      if (inDom && score > 0) score += 1;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ─── Niveluri deterministe (autoritative, query DB punctual) ───────

async function findByToken(admin: SupabaseClient, to: string): Promise<Candidate | null> {
  const token = extractReplyToken(to);
  if (!token) return null;
  const { data } = await admin
    .from("sesizari")
    .select("id, code, locatie, titlu, sent_to_emails, sent_at, status")
    .eq("reply_token", token)
    .maybeSingle();
  return (data as Candidate | null) ?? null;
}

async function findByThreading(
  admin: SupabaseClient, inReplyTo: string | null, references: string | null,
): Promise<Candidate | null> {
  const ids = parseMessageIds(inReplyTo, references);
  if (ids.length === 0) return null;
  // a) Message-ID propriu persistat
  const { data } = await admin
    .from("sesizari")
    .select("id, code, locatie, titlu, sent_to_emails, sent_at, status")
    .in("outbound_message_id", ids)
    .limit(1);
  if (data && data.length) return data[0] as Candidate;
  // b) cod extras din pattern-ul id-ului (plasă pt. emailuri istorice)
  const code = codeFromMessageIds(ids);
  if (code) return findByCode(admin, code);
  return null;
}

async function findByCode(admin: SupabaseClient, code: string): Promise<Candidate | null> {
  const { data } = await admin
    .from("sesizari")
    .select("id, code, locatie, titlu, sent_to_emails, sent_at, status")
    .eq("code", code)
    .maybeSingle();
  return (data as Candidate | null) ?? null;
}

// ─── Nivel 4c: AI candidate-picker (gated, alege DOAR din listă) ───

async function aiPickCandidate(replyText: string, candidates: Candidate[]): Promise<{ code: string | null; confidence: number }> {
  if (candidates.length < 2 || candidates.length > 8) return { code: null, confidence: 0 };
  const list = candidates.map((c) => `- ${c.code}: ${c.locatie || c.titlu || "?"}`).join("\n");
  const prompt = `Un răspuns de la o autoritate publică trebuie legat de UNA dintre sesizările de mai jos (trimise de cetățean). Alege codul sesizării care se potrivește, STRICT din listă.

SESIZĂRI CANDIDATE:
${list}

TEXTUL RĂSPUNSULUI AUTORITĂȚII (poate conține adresa/locația):
${replyText.slice(0, 2500)}

Răspunde DOAR cu JSON: {"code":"<cod din listă sau null>","confidence":<0-100>}. Folosește adresa/locația ca discriminant. Dacă nu ești sigur, code=null.`;
  try {
    const raw = await groqText(
      { model: GROQ_MODEL_FAST, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0, max_tokens: 80 },
      { cache: false },
    );
    const parsed = JSON.parse(raw) as { code?: string; confidence?: number };
    const code = parsed.code && candidates.some((c) => c.code === parsed.code) ? parsed.code : null;
    return { code, confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)) };
  } catch {
    return { code: null, confidence: 0 };
  }
}

// ─── Orchestratorul ────────────────────────────────────────────────

export interface MatchInput {
  to: string;
  extractedCode: string | null; // din extractSesizareCode (subiect/to/body)
  inReplyTo: string | null;
  referencesChain: string | null;
  fromEmail: string;
  replyText: string; // subiect + body + OCR atașamente + nume fișiere
  receivedAt: string;
  admin: SupabaseClient;
}

export async function matchReply(input: MatchInput): Promise<MatchResult> {
  const { admin } = input;

  // N1 — TOKEN în Reply-To (determinist, autoritativ).
  const byToken = await findByToken(admin, input.to);
  if (byToken) return { sesizareId: byToken.id, code: byToken.code, method: "token", confidence: "high" };

  // N2 — THREADING (Message-ID propriu) (determinist, autoritativ).
  const byThread = await findByThreading(admin, input.inReplyTo, input.referencesChain);
  if (byThread) return { sesizareId: byThread.id, code: byThread.code, method: "threading", confidence: "high" };

  // N3 — COD explicit (determinist, autoritativ).
  if (input.extractedCode) {
    const byCode = await findByCode(admin, input.extractedCode);
    if (byCode) return { sesizareId: byCode.id, code: byCode.code, method: "code", confidence: "high" };
  }

  // N4 — FUZZY, pe candidați ELIGIBILI = sesizări TRIMISE (status != "nou"),
  // fie via Civia, fie MANUAL. 2026-06-15: înainte filtram doar pe
  // sent_via_civia=true → răspunsurile la sesizările trimise manual (cele vechi,
  // dinainte de send-via-civia) rămâneau ORFANE. Acum includem și manualele;
  // time-gate-ul folosește sent_at, iar pentru manuale (sent_at null) cade pe
  // created_at (răspunsul autorității vine oricum DUPĂ ce userul a depus).
  const graceMs = 3600_000;
  const replyAt = new Date(input.receivedAt).getTime();
  const { data: elig } = await admin
    .from("sesizari")
    .select("id, code, locatie, titlu, sent_to_emails, sent_at, status, created_at")
    .neq("status", "nou");
  const eligible = ((elig as Candidate[]) || []).filter((s) => {
    const sentMs = new Date(s.sent_at ?? s.created_at ?? 0).getTime();
    return sentMs > 0 && sentMs <= replyAt + graceMs;
  });
  if (eligible.length === 0) return { sesizareId: null, code: null, method: null, confidence: null };

  const fromDomain = baseDom(dom(input.fromEmail));
  const replyTok = toks(input.replyText);

  // N4a — domeniu autoritate cu EXACT 1 candidat eligibil.
  const byDom = eligible.filter((s) => (s.sent_to_emails || []).some((e) => baseDom(dom(e)) === fromDomain));

  // N4b — scoring pe adresă.
  const scored = scoreCandidates(replyTok, fromDomain, eligible);
  const top = scored[0], second = scored[1];
  if (top && top.score >= 3 && (!second || top.score - second.score >= 2)) {
    return { sesizareId: top.c.id, code: top.c.code, method: "content_score", confidence: "high" };
  }
  if (byDom.length === 1 && (!top || top.score < 3)) {
    return { sesizareId: byDom[0]!.id, code: byDom[0]!.code, method: "domain", confidence: "high" };
  }
  if (top && top.score >= 2) {
    return { sesizareId: top.c.id, code: top.c.code, method: "content_score", confidence: "medium" };
  }

  // N4c — AI semantic, alege DOAR din candidații eligibili (shortlist).
  const shortlist = (byDom.length >= 2 && byDom.length <= 8 ? byDom : eligible).slice(0, 8);
  const ai = await aiPickCandidate(input.replyText, shortlist);
  if (ai.code && ai.confidence >= 85) {
    const c = shortlist.find((x) => x.code === ai.code)!;
    return { sesizareId: c.id, code: c.code, method: "ai", confidence: "medium" };
  }

  return { sesizareId: null, code: null, method: null, confidence: null };
}
