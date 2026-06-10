import { timingSafeEqual } from "node:crypto";

/**
 * Comparație de string-uri în TIMP CONSTANT — previne side-channel-uri de
 * timing când comparăm secrete (bearer tokens, webhook secrets). Un `===`
 * simplu scurtcircuitează la primul byte diferit, scurgând poziția acestuia
 * și permițând (teoretic) recuperarea secretului byte-cu-byte. ASVS L2 V2.10 +
 * igienă criptografică de bază (GDPR Art. 32 „măsuri tehnice adecvate").
 *
 * Rulează DOAR pe Node runtime (folosește node:crypto). Toate rutele care
 * compară CRON_SECRET / INBOX_WEBHOOK_SECRET sunt Node (folosesc Supabase
 * admin), deci e safe.
 */
export function timingSafeEqualStr(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual cere buffere de lungime egală. Dacă diferă lungimea,
  // facem o comparație dummy (ba cu sine) ca să nu scurtcircuităm pe lungime,
  // apoi returnăm false. Lungimea unui secret nu e ea însăși un secret util.
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * Verifică un header `Authorization: Bearer <secret>` în timp constant.
 * Returnează false dacă header-ul lipsește, nu începe cu „Bearer ", sau
 * secretul nu se potrivește. `expected` gol/null → false (server
 * misconfigurat — niciodată „autorizat" implicit).
 */
export function verifyBearer(
  authHeader: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected) return false;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) return false;
  return timingSafeEqualStr(authHeader.slice(7), expected);
}
