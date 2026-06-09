import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/web-push-client";
import { countyName, sectorFromLocality } from "./subscriptions";

/**
 * Push geo (Faza 1 deblocat de Faza 2) — la o sesizare nouă, notifică abonații
 * cu push_optin care urmăresc acea arie. Matching: county exact, apoi (dacă
 * abonarea are localitate) sector exact pentru București sau ILIKE pe locație,
 * apoi (dacă are categorie) tip exact. Best-effort, dublu opt-in (area push +
 * device push). Exclude autorul.
 */
export async function notifyAreaSubscribers(opts: {
  county: string;
  sector?: string | null;
  tip: string;
  locatie: string;
  code: string;
  titlu: string;
  excludeUserId?: string | null;
}): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("area_subscriptions")
      .select("user_id, locality, category")
      .eq("county", opts.county)
      .eq("push_optin", true);
    if (!data || data.length === 0) return;

    const loc = opts.locatie.toLowerCase();
    const userIds = new Set<string>();

    for (const row of data as Array<{ user_id: string; locality: string | null; category: string | null }>) {
      if (opts.excludeUserId && row.user_id === opts.excludeUserId) continue;
      // Filtru categorie (tip sesizare).
      if (row.category && row.category !== opts.tip) continue;
      // Filtru localitate.
      if (row.locality) {
        const subSector = sectorFromLocality(row.locality);
        if (subSector) {
          if (subSector !== opts.sector) continue; // sector București — match exact
        } else if (!loc.includes(row.locality.toLowerCase())) {
          continue; // localitate liberă — match fuzzy pe text
        }
      }
      userIds.add(row.user_id);
    }

    if (userIds.size === 0) return;

    await sendPushToUsers([...userIds], {
      title: `Sesizare nouă în ${countyName(opts.county)}`,
      body: opts.titlu,
      url: `/sesizari/${opts.code}`,
      tag: `area-${opts.county}`,
    });
  } catch {
    // best-effort — push-ul nu trebuie să afecteze crearea sesizării
  }
}
