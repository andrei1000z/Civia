/**
 * Quick-sign repository — citește/scrie datele de prefill petiție din profile.
 * Folosit pe:
 *   - /petitii/[slug] (Server Component) — fetch + build URL prefilled
 *   - /cont (Server Component) — show current settings
 *   - /api/profile/quick-sign (route handler) — update
 */

import { createSupabaseServer } from "@/lib/supabase/server";
import type { QuickSignData } from "./declic-prefill";

export interface QuickSignFullData extends QuickSignData {
  enabled: boolean;
  updatedAt: string | null;
}

/**
 * Citește quick-sign data pentru user-ul logat. Întoarce null dacă user nu
 * e logat sau nu are nicio dată completată. Returns disabled state too.
 */
export async function getQuickSignDataForCurrentUser(): Promise<QuickSignFullData | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "quick_sign_first_name, quick_sign_last_name, quick_sign_email, quick_sign_county, quick_sign_phone, quick_sign_enabled, quick_sign_updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    quick_sign_first_name: string | null;
    quick_sign_last_name: string | null;
    quick_sign_email: string | null;
    quick_sign_county: string | null;
    quick_sign_phone: string | null;
    quick_sign_enabled: boolean | null;
    quick_sign_updated_at: string | null;
  };

  return {
    firstName: row.quick_sign_first_name,
    lastName: row.quick_sign_last_name,
    email: row.quick_sign_email,
    county: row.quick_sign_county,
    phone: row.quick_sign_phone,
    enabled: row.quick_sign_enabled === true,
    updatedAt: row.quick_sign_updated_at,
  };
}

/**
 * Întoarce DOAR datele de prefill dacă enabled === true, altfel null.
 * Util ca să gating-uim URL-ul prefilled în petition page.
 */
export async function getQuickSignDataIfEnabled(): Promise<QuickSignData | null> {
  const full = await getQuickSignDataForCurrentUser();
  if (!full || !full.enabled) return null;
  return {
    firstName: full.firstName,
    lastName: full.lastName,
    email: full.email,
    county: full.county,
    phone: full.phone,
  };
}
