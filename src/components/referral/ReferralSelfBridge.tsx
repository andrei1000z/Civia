"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { selfRefCode } from "@/lib/referral/client";

/**
 * Referral (Faza 1) — pentru userii logați, asigură o singură dată cookie-ul
 * `civia_rc` (codul propriu de referral) apelând /api/referral/self. ShareMenu
 * citește apoi cookie-ul și pune `?ref=` pe share-uri.
 *
 * Zero UI. Skip dacă userul e anonim sau cookie-ul există deja (evită un
 * fetch inutil la fiecare navigare).
 */
export function ReferralSelfBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (selfRefCode()) return; // deja setat
    const ctrl = new AbortController();
    fetch("/api/referral/self", { signal: ctrl.signal }).catch(() => {
      /* best-effort */
    });
    return () => ctrl.abort();
  }, [user]);

  return null;
}
