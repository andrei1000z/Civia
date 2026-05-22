/**
 * Repository pentru actualizari — fetch din DB (public read).
 *
 * Plan 5/23/2026 — DB-backed changelog. Admin poate adăuga/edita din
 * /admin/actualizari. Public read din /actualizari.
 *
 * Fallback: dacă DB e gol (înainte de migration aplicată) sau eroare,
 * folosim ACTUALIZARI hardcoded din src/data/actualizari.ts.
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ACTUALIZARI as ACTUALIZARI_FALLBACK,
  type Actualizare,
  type ActualizareCategorie,
  type ActualizareSchimbare,
} from "@/data/actualizari";

/**
 * Fetch toate actualizările published, sortate descrescător după dată.
 * Server-side only (folosește admin client).
 */
export async function listActualizari(): Promise<Actualizare[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("actualizari")
      .select("versiune, data, titlu, descriere, schimbari, major, minimalist, continut_markdown")
      .eq("published", true)
      .order("data", { ascending: false });
    if (error || !data || data.length === 0) {
      return ACTUALIZARI_FALLBACK;
    }
    return (data as Array<{
      versiune: string;
      data: string;
      titlu: string;
      descriere: string | null;
      schimbari: ActualizareSchimbare[];
      major: boolean;
      minimalist: boolean;
      continut_markdown: string | null;
    }>).map((r) => ({
      versiune: r.versiune,
      data: r.data,
      titlu: r.titlu,
      descriere: r.descriere ?? undefined,
      schimbari: Array.isArray(r.schimbari) ? r.schimbari : [],
      major: r.major,
      minimalist: r.minimalist,
      continutMarkdown: r.continut_markdown ?? undefined,
    }));
  } catch {
    return ACTUALIZARI_FALLBACK;
  }
}

/**
 * Fetch single actualizare după versiune (pentru admin edit form).
 */
export async function getActualizareByVersiune(versiune: string): Promise<{
  id: string;
  versiune: string;
  data: string;
  titlu: string;
  descriere: string | null;
  schimbari: ActualizareSchimbare[];
  major: boolean;
  minimalist: boolean;
  continut_markdown: string | null;
  published: boolean;
} | null> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("actualizari")
      .select("*")
      .eq("versiune", versiune)
      .maybeSingle();
    if (error || !data) return null;
    return data as {
      id: string;
      versiune: string;
      data: string;
      titlu: string;
      descriere: string | null;
      schimbari: ActualizareSchimbare[];
      major: boolean;
      minimalist: boolean;
      continut_markdown: string | null;
      published: boolean;
    };
  } catch {
    return null;
  }
}

export const ALL_CATEGORII: ActualizareCategorie[] = [
  "release",
  "feature",
  "fix",
  "ux",
  "perf",
  "security",
];
