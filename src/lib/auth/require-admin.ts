/**
 * Helper unic pentru auth admin check pe API routes.
 *
 * Inainte: 17 routes `/api/admin/*` hand-roll role check copy-paste.
 * Drift garantat — una uită check → IDOR / privilege escalation.
 *
 * Acum:
 *   const guard = await requireAdmin();
 *   if (guard.error) return guard.error;
 *   // guard.user este profilul admin valid
 *
 * Usage in route handler:
 *
 *   export async function POST(req: Request) {
 *     const guard = await requireAdmin();
 *     if (guard.error) return guard.error;
 *
 *     const { user } = guard;
 *     // ... logica admin
 *   }
 */

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string | null;
  role: "admin";
}

export type AdminGuardResult =
  | { error: NextResponse; user?: never }
  | { error?: never; user: AdminUser };

/**
 * Verifica daca request-ul curent vine de la admin autentificat.
 *
 * Returns:
 *   - { error: NextResponse } daca nu autentificat (401) sau nu admin (403)
 *   - { user: AdminUser } cu profilul admin
 *
 * Usage: vezi exemplu in JSDoc-ul fisierului.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Autentificare necesara" },
        { status: 401 },
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Acces interzis" },
        { status: 403 },
      ),
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      role: "admin",
    },
  };
}

/**
 * Variantă defensivă pentru cazuri exceptionale (cron-uri, internal calls).
 * Verifica un secret bearer in loc de session — nu user context.
 */
export function requireAdminSecret(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") || "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }
  return null;
}
