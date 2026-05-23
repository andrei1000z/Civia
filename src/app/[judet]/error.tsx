"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPinOff, RotateCcw, ArrowLeft } from "lucide-react";

export default function JudetError({ reset }: { error: Error; reset: () => void }) {
  const params = useParams<{ judet?: string }>();
  const slug = params?.judet ?? "";
  return (
    <div role="alert" aria-live="assertive" className="container-narrow py-16 md:py-24 max-w-lg text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <MapPinOff size={36} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
      </div>
      <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-2">
        Județul nu se poate încărca
      </h1>
      <p className="text-[var(--color-text-muted)] mb-6">
        {slug
          ? `Pagina pentru „${slug}" e momentan indisponibilă. Datele se reactualizează — încearcă din nou într-un minut.`
          : "Pagina e momentan indisponibilă. Încearcă din nou într-un minut."}
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reîncearcă
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Pagina principală
        </Link>
      </div>
    </div>
  );
}
