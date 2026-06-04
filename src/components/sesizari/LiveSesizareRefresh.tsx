"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * 2026-06-05 — Update LIVE al statusului pe pagina sesizării.
 *
 * Când o autoritate răspunde, webhook-ul de inbox actualizează automat
 * `sesizari.status` / `official_response` / `nr_inregistrare`. Acest component
 * ascultă realtime UPDATE pe rândul sesizării și face `router.refresh()` —
 * pagina e `force-dynamic`, deci re-fetch-ul server-side afișează statusul nou
 * FĂRĂ reload manual. Degradare grațioasă dacă realtime e offline (statusul
 * apare oricum la următorul refresh, fiind force-dynamic).
 */
export function LiveSesizareRefresh({ sesizareId }: { sesizareId: string }) {
  const router = useRouter();
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowser>["channel"]> | null = null;
    try {
      const supabase = createSupabaseBrowser();
      channel = supabase
        .channel(`sesizare-live-${sesizareId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "sesizari", filter: `id=eq.${sesizareId}` },
          () => router.refresh(),
        )
        .subscribe();
    } catch {
      /* realtime offline — degradare grațioasă */
    }
    return () => {
      if (channel) {
        try {
          createSupabaseBrowser().removeChannel(channel);
        } catch {
          /* silent */
        }
      }
    };
  }, [sesizareId, router]);

  return null;
}
