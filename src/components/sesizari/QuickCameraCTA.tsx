"use client";

import { Camera, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * F6 Quick Camera CTA — mobile-first entry point pe homepage.
 *
 * Buton mare „📷 Foto Sesizare" → /sesizari?camera=1 → form deschide cu
 * input file capture="environment" trigger automat. Combined cu F2
 * (vision auto-routing pe primul photo), userul ajunge la submit in 30s.
 *
 * Vizibil DOAR pe mobile (md:hidden). Pe desktop avem buton normal.
 */
export function QuickCameraCTA() {
  return (
    <Link
      href="/sesizari?camera=1"
      className="block md:hidden group relative overflow-hidden rounded-[var(--radius-lg)] p-5 bg-gradient-to-br from-[var(--civic-emerald-500)] via-[var(--civic-emerald-600)] to-[var(--civic-aqua-500)] text-white shadow-[var(--shadow-3)] active:scale-[0.98] transition-all lc-shine"
    >
      <div className="flex items-start gap-3 relative z-10">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Camera size={24} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} className="text-white/80" aria-hidden="true" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/85">
              AI Powered · 30 secunde
            </span>
          </div>
          <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-1 leading-tight">
            Vezi o problemă pe stradă?
          </h3>
          <p className="text-sm text-white/85 leading-snug">
            Fă o poză → AI completează tipul + autoritatea → tu doar apeși Trimite.
          </p>
        </div>
        <ArrowRight size={20} className="opacity-70 group-hover:translate-x-1 transition-transform shrink-0 mt-1" aria-hidden="true" />
      </div>
      {/* Decorative camera dots */}
      <div
        className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 blur-2xl pointer-events-none"
        aria-hidden="true"
      />
    </Link>
  );
}
