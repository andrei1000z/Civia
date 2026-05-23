"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { useAuth } from "./AuthProvider";

/**
 * 5/23/2026 — Simplificat de la dropdown la link direct.
 * Click pe avatar → navighează direct la /cont (unde există deja
 * deconectare + toate setările). Reduce friction cu 1 click.
 */
export function UserMenu() {
  const { user, loading, openAuthModal } = useAuth();

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={openAuthModal}
        className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
        aria-label="Autentificare"
      >
        <LogIn size={15} aria-hidden="true" />
        Login
      </button>
    );
  }

  const initial = (user.email ?? "C").charAt(0).toUpperCase();

  return (
    <Link
      href="/cont"
      className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-semibold text-sm hover:brightness-110 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
      aria-label={`Contul tău (${user.email})`}
      title="Contul tău"
    >
      {initial}
    </Link>
  );
}
