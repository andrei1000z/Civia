import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptare la nivel de CÂMP (application-level / envelope encryption) pentru
 * cele mai sensibile date personale stocate — în primul rând adresa de
 * domiciliu a cetățenilor. GDPR Art. 32(1)(a): „pseudonimizarea și criptarea
 * datelor cu caracter personal".
 *
 * NU e E2EE — serverul DEȚINE cheia (în env, SEPARAT de baza de date) și poate
 * decripta când are nevoie (ex: la trimiterea sesizării către autoritate).
 * Modelul de amenințare acoperit: o scurgere LOGICĂ a bazei (dump, backup
 * furat, SQL injection, bypass RLS) expune doar text cifrat, nu unde locuiesc
 * oamenii — pentru că cheia NU e în baza de date. Complementar cu criptarea
 * at-rest pe disc (Supabase/Vercel) care NU ajută la o scurgere logică.
 *
 * AES-256-GCM (criptare autentificată — detectează manipularea). Format stocat:
 *   enc:v1:<base64(iv[12] | tag[16] | ciphertext)>
 *
 * ROLLOUT GRADUAL & SIGUR (zero downtime, fără risc de rupere):
 *  • Fără cheie (FIELD_ENCRYPTION_KEY nesetat) → encrypt e PASSTHROUGH (stochează
 *    text simplu, ca înainte). Site-ul funcționează identic.
 *  • decrypt detectează prefixul: text cifrat → decriptează; text simplu legacy
 *    → îl întoarce ca atare. Deci datele vechi (necriptate) + cele noi (criptate)
 *    coexistă fără probleme. Backfill-ul le criptează pe cele vechi separat.
 *
 * Rulează DOAR pe Node runtime (node:crypto). Toate rutele care ating
 * author_address sunt Node.
 */

const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function isEncrypted(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIX);
}

/**
 * Criptează un câmp pentru stocare. null/„" → întoarce ca atare (nu cripta gol).
 * Deja criptat → idempotent (nu re-cripta). Fără cheie → passthrough (text simplu).
 */
export function encryptField(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  if (isEncrypted(plain)) return plain;
  const key = getKey();
  if (!key) return plain; // passthrough — rollout gradual, nimic nu se rupe
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/**
 * Decriptează un câmp citit din DB. Text simplu legacy (fără prefix) → întoarce
 * ca atare. Text cifrat fără cheie disponibilă, sau corupt/manipulat → null
 * (nu aruncă, nu rupe fluxul; loghează ca să detectăm pierderea cheii).
 */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!isEncrypted(stored)) return stored; // text simplu legacy
  const key = getKey();
  if (!key) {
    console.error("[crypto/field] date criptate dar FIELD_ENCRYPTION_KEY lipsește — imposibil de decriptat");
    return null;
  }
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = raw.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    console.error("[crypto/field] decriptare eșuată (cheie greșită sau date corupte)");
    return null;
  }
}
