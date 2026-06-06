/**
 * Flag „ascunde numele" (hide-name). SURSA DE ADEVĂR: profiles.hide_name
 * (migrarea 015). Când e true, fiecare suprafață publică afișează „Cetățean".
 *
 * 2026-06-06 — MIGRAT de pe Upstash (SUSPENDAT billing) pe profiles direct.
 * Upstash era doar un INDEX al user-ilor cu hide_name=true; coloana din DB e
 * canonică → zero pierdere de date, zero dependență de Upstash. În prod citim/
 * scriem profiles via admin client; în dev/test (fără service key) folosim un
 * fallback in-memory. Toate funcțiile fail-open (DB outage → nu ascundem nimic;
 * feed-ul public oricum forțează anonimizarea pentru TOȚI ne-ownerii).
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";

// PROD = profiles (service key prezent); DEV/TEST = in-memory.
const useDb = !!(
  process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
);
const memoryFallback = new Set<string>();

/**
 * Setează flagul hide_name pe profil (sursa de adevăr). `email` e ignorat acum
 * (era doar pentru indexul Upstash pe emailuri).
 */
export async function setHideName(
  userId: string,
  hide: boolean,
  _email?: string | null,
): Promise<void> {
  if (!userId) return;
  if (!useDb) {
    if (hide) memoryFallback.add(userId);
    else memoryFallback.delete(userId);
    return;
  }
  // Best-effort: un eșec aici NU trebuie să rupă PUT /api/profile.
  try {
    const sb = createSupabaseAdmin();
    await sb.from("profiles").update({ hide_name: hide }).eq("id", userId);
  } catch {
    /* silent — celelalte profile updates trec OK */
  }
}

export async function getHideName(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (!useDb) return memoryFallback.has(userId);
  // Fail-open: DB outage → assume nu e hidden (preferabil la /cont blocat).
  try {
    const sb = createSupabaseAdmin();
    const { data } = await sb
      .from("profiles")
      .select("hide_name")
      .eq("id", userId)
      .maybeSingle();
    return !!(data as { hide_name?: boolean } | null)?.hide_name;
  } catch {
    return false;
  }
}

/**
 * Batch — întoarce subsetul de userIds cu hide_name=true, dintr-un singur query
 * (IN), pentru anonimizarea listelor (comentarii). Zero query-uri per rând.
 */
export async function getHiddenUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  if (!useDb) return new Set(userIds.filter((id) => memoryFallback.has(id)));
  // Fail-open: la outage nu ascundem nimic (preferabil unui 500 / blank page).
  try {
    const sb = createSupabaseAdmin();
    const { data } = await sb
      .from("profiles")
      .select("id")
      .in("id", userIds)
      .eq("hide_name", true);
    return new Set((data ?? []).map((r) => (r as { id: string }).id));
  } catch {
    return new Set();
  }
}

/**
 * DEPRECATED — `profiles` nu are coloană `email`, iar feed-ul public nu mai
 * apelează această funcție (anonimizarea e ON by default pentru toți
 * ne-ownerii). Păstrată ca no-op pentru compatibilitate de import. No-op.
 */
export async function getHiddenEmails(_emails: string[]): Promise<Set<string>> {
  return new Set<string>();
}
