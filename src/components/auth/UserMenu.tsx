"use client";

import Link from "next/link";
import { LogIn, Settings } from "lucide-react";
import { useAuth } from "./AuthProvider";

/**
 * 2026-06-18 — Iconița de profil ÎNLOCUITĂ cu o iconiță de SETĂRI (gear) → /setari.
 * /setari funcționează și LOGAT (cont + sesizări + notificări + GDPR) și NELOGAT
 * (aspect + accesibilitate device-level). Pentru nelogați păstrăm și butonul Login.
 */
export function UserMenu() {
  const { user, loading, openAuthModal } = useAuth();

  if (loading) {
    return <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-2">
      {!user && (
        <button
          type="button"
          onClick={openAuthModal}
          className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Autentificare"
        >
          <LogIn size={15} aria-hidden="true" />
          Login
        </button>
      )}
      <Link
        href="/setari"
        className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] flex items-center justify-center hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        aria-label="Setări"
        title="Setări"
      >
        <Settings size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
