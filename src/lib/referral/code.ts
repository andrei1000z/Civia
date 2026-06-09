import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Referral attribution — Faza 1 (BIG BET creștere).
 *
 * Fluxul:
 *   1. Fiecare user are un `referral_code` scurt, stabil, public (lazy-gen aici).
 *   2. ShareMenu/SuccessScreen pun `?ref={code}` pe URL-urile partajate.
 *   3. proxy.ts captează `?ref=` la prima vizită → cookie `civia_ref` (first-touch).
 *   4. auth/callback citește cookie-ul la signup → setează `referred_by` o singură dată.
 *   5. Badge „ambasador" + linia „a activat N cetățeni" din count(referred_by).
 */

// Cookie first-touch pe vizitator (httpOnly, setat de proxy, citit de callback).
export const REF_VISITOR_COOKIE = "civia_ref";
// Cookie cu codul PROPRIU al userului logat (JS-readable, ca ShareMenu să-l pună pe share-uri).
export const REF_SELF_COOKIE = "civia_rc";

/** 8 hex chars — neambiguu, URL-safe, 4.3B spațiu. Aliniat cu backfill-ul SQL. */
export function generateReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toLowerCase();
}

/** Validare cod de referral primit din `?ref=` / cookie (nu trust input). */
export function isValidRefCode(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^[a-z0-9]{4,16}$/i.test(raw);
}

type AdminClient = SupabaseClient;

/**
 * Întoarce codul de referral al userului, generându-l LAZY dacă lipsește.
 * Retry pe coliziune unică (23505). Folosește clientul admin (service role).
 */
export async function ensureReferralCode(admin: AdminClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  const existing = (data as { referral_code: string | null } | null)?.referral_code;
  if (existing) return existing;

  // Generează + persistă, retry pe unique_violation (cod deja luat).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await admin
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId)
      .is("referral_code", null); // doar dacă încă e null (idempotent la curse)
    if (!error) {
      // Re-citește: dacă o cursă a setat alt cod între timp, întoarce-l pe ăla.
      const { data: after } = await admin
        .from("profiles")
        .select("referral_code")
        .eq("id", userId)
        .maybeSingle();
      return (after as { referral_code: string | null } | null)?.referral_code ?? code;
    }
    // 23505 = unique_violation pe referral_code → regenerează.
    if ((error as { code?: string }).code !== "23505") return null;
  }
  return null;
}
