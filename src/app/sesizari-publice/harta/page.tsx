import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, List } from "lucide-react";
import { SesizariMap } from "@/components/maps/SesizariMap";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Harta sesizărilor publice — Civia",
  description:
    "Vezi pe harta toate sesizările publice din România. Marker pe fiecare problemă raportată — apasă pentru detalii.",
  alternates: { canonical: "/sesizari-publice/harta" },
};

// 2026-05-20: ISR 1h. Marker-ele se updateaza prin Realtime client-side oricum.
export const revalidate = 3600;

export default function SesizariHartaPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        backHref="/sesizari-publice"
        backLabel="Lista sesizărilor"
        title="Harta sesizărilor publice"
        icon={MapPin}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Vezi pe harta României unde se concentrează sesizările cetățenilor.
            Click pe marker → detaliile sesizării. Updateaza in timp real.
          </>
        }
        tagline="Hot spots = unde primaria are de munca."
      />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)] inline-flex items-center gap-2">
          <MapPin size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
          Sesizări recente
        </h2>
        <Link
          href="/sesizari-publice"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          <List size={12} aria-hidden="true" />
          Vezi ca lista
        </Link>
      </div>

      <SesizariMap limit={500} height="600px" zoom={7} />

      <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
        Sesizări catalogate din ultimele 30 zile. Vizibile doar cele cu opțiunea
        „publică" activată de către cetățean.
      </p>
    </div>
  );
}
