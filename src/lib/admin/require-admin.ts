import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Gate centralizat pentru endpoint-uri admin. Verifică:
 *   1. Există sesiune Supabase activă (cookie-aware server client)
 *   2. `profiles.role === 'admin'` pentru user-ul curent
 *
 * Returnează un discriminat union pe `ok` ca caller-ul să poată
 * propaga error + status fără try/catch. Folosit de toate
 * route-urile /api/admin/* să se asigure consistent că logica de
 * gating nu diverge între endpoint-uri (un bug aici e una dintre
 * cele mai serioase clase de probleme — orice scăpare expune
 * acțiunea privilegiată oricărui user logat).
 *
 * Returnează și `userId` ca rate-limit + audit log să poată
 * referi user-ul fără re-fetch.
 */
export type AdminGateResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: 401 | 403; error: string };

export async function requireAdmin(): Promise<AdminGateResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "Auth required" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, status: 403, error: "Admin only" };
  }
  return { ok: true, userId: user.id, email: user.email ?? null };
}
