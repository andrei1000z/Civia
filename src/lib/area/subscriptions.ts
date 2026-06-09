import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_COUNTIES } from "@/data/counties";

/**
 * „Urmărește zona" (Faza 2) — helpers pentru area_subscriptions.
 *
 * Aria = județ (id UPPERCASE din ALL_COUNTIES, ex „CJ") + localitate opțională
 * (text liber, ex „Cluj-Napoca" / „Sector 3"; NULL = tot județul) + categorie
 * opțională (SESIZARE_TIPURI.value; NULL = toate).
 */

/**
 * Normalizează inputul de județ (slug minuscul SAU id) la id-ul UPPERCASE
 * canonic. Întoarce null dacă nu e un județ real (validare contra sursei de
 * adevăr — data/counties.ts, nu tabelul counties din DB care poate lipsi).
 */
export function normalizeCounty(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim();
  if (v.length === 0) return null;
  const upper = v.toUpperCase();
  const lower = v.toLowerCase();
  const match = ALL_COUNTIES.find((c) => c.id === upper || c.slug === lower);
  return match ? match.id : null;
}

/** Numele județului din id (ex „CJ" → „Cluj"). */
export function countyName(countyId: string): string {
  return ALL_COUNTIES.find((c) => c.id === countyId)?.name ?? countyId;
}

/** Slug-ul județului din id (ex „CJ" → „cj") pentru URL-uri. */
export function countySlug(countyId: string): string {
  return ALL_COUNTIES.find((c) => c.id === countyId)?.slug ?? countyId.toLowerCase();
}

/**
 * Eticheta umană a unei arii: „Cluj-Napoca, Cluj" dacă există localitate,
 * altfel „județul Cluj" (sau „București" pentru capitală).
 */
export function areaLabel(area: { county: string; locality?: string | null }): string {
  const name = countyName(area.county);
  if (area.locality) {
    // Pentru București nu spunem „Sector 3, București, București".
    return area.county === "B" ? area.locality : `${area.locality}, ${name}`;
  }
  return area.county === "B" ? name : `județul ${name}`;
}

/**
 * Dacă localitatea e un sector București („Sector 3"), întoarce codul sectorului
 * („S3") pentru filtrare PRECISĂ pe sesizari.sector. Altfel null (se filtrează
 * fuzzy via ILIKE pe locatie).
 */
export function sectorFromLocality(locality: string | null | undefined): string | null {
  if (!locality) return null;
  const m = locality.match(/\bSector\s*([1-6])\b/i);
  return m ? `S${m[1]}` : null;
}

export interface AreaSubscriber {
  id: string;
  user_id: string;
  email: string;
  county: string;
  locality: string | null;
  category: string | null;
}

/**
 * Abonații email-activi pentru o arie (digest). Service-role (admin) — bypass RLS.
 * Filtrare pe county; localitatea se aplică în query-ul de conținut (fuzzy),
 * nu aici, ca să nu pierdem abonații „tot județul".
 */
export async function listAreaEmailSubscribers(
  admin: SupabaseClient,
): Promise<AreaSubscriber[]> {
  const { data, error } = await admin
    .from("area_subscriptions")
    .select("id, user_id, email, county, locality, category")
    .eq("email_optin", true);
  if (error || !data) return [];
  return data as AreaSubscriber[];
}
