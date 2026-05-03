"use client";

import { LogIn, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Apare în loc de form atunci când userul nu e autentificat. Loginul se
 * face cu magic-link via AuthModal — nu redirect, ca să nu pierdem state-ul
 * paginii (formularul completat parțial e oricum gol în acest moment).
 */
export function LoginRequiredCard() {
  const { openAuthModal } = useAuth();

  return (
    <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-indigo-500/10 border-2 border-purple-500/30 rounded-[var(--radius-lg)] p-6 md:p-8 text-center">
      <div
        className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/15 grid place-items-center"
        aria-hidden="true"
      >
        <LogIn size={26} className="text-purple-600 dark:text-purple-400" />
      </div>
      <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-lg md:text-xl mb-2">
        Conectează-te ca să inițiezi o petiție
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed mb-5">
        Ne ajută să verificăm că petițiile sunt reale (nu botii) și să te contactăm dacă
        avem întrebări la moderare. Login-ul e prin <strong>magic link pe email</strong> —
        fără parole de ținut minte.
      </p>
      <button
        type="button"
        onClick={() => openAuthModal()}
        className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-button)] bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
      >
        <Mail size={16} aria-hidden="true" />
        Conectează-te
      </button>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-4">
        Datele tale rămân private. Doar prenumele tău (din profil) apare ca autor după aprobare.
      </p>
    </div>
  );
}
