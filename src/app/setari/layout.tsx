import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setări",
  description: "Setările Civia: cont, notificări, aspect & accesibilitate, sesizările tale, export GDPR.",
  alternates: { canonical: "/setari" },
  robots: { index: false, follow: false },
};

/**
 * 2026-06-18 — Canvas „recessed" pentru /setari, stil Samsung One UI Settings.
 *
 * Fundalul devine --color-surface-soft (gri deschis în light, aproape negru
 * #0F0F10 în dark) — mai jos decât cardurile (--color-surface), ca grupurile să
 * PLUTEASCĂ deasupra în AMBELE teme. Opac → acoperă blob-urile animate globale
 * (body::before/::after), dând canvasul calm din referință. Restul aplicației
 * rămâne neatins (Civia își păstrează fundalul navy + gradient).
 */
export default function SetariLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="setari-canvas flex-1">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
