import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Clock, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Știre arhivată — nu mai e disponibilă",
  description:
    "Civia păstrează știrile pentru 3 zile, apoi le arhivează. Citește articolul original pe site-ul sursei.",
  // Semnal foarte puternic de deindex pentru Google + bingbot:
  // robots index:false dezactivează indexarea, googleBot la fel,
  // alongside `nocache` pentru a împiedica păstrarea snapshot-urilor.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
    },
  },
  // Niciun OG/Twitter card — pagina nu trebuie să apară în nicio
  // previzualizare socială.
};

/**
 * Custom not-found pentru /stiri/[id] — apare când articolul a fost șters
 * după TTL-ul de 3 zile. Trimite semnale agresive de deindex (vezi
 * metadata.robots de mai sus) ca Google să o scoată din index cât mai
 * rapid (~3-7 zile cu acest mix de signal-uri vs ~14-30 cu doar 404 generic).
 *
 * Pentru Bing/Yandex/Seznam folosim IndexNow ping în cron-ul de cleanup
 * care notifică instant despre URL-urile șterse — vezi lib/seo/indexnow.ts.
 */
export default function StireNotFound() {
  return (
    <div className="container-narrow py-12 md:py-16 max-w-2xl">
      <div className="text-center">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-surface-2)] grid place-items-center"
          aria-hidden="true"
        >
          <Clock size={28} className="text-[var(--color-text-muted)]" />
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-3">
          Această știre nu mai e disponibilă pe Civia
        </h1>
        <p className="text-base text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-lg mx-auto">
          Civia păstrează știrile pentru <strong>3 zile</strong> de la
          publicare, apoi le arhivează automat. Asta ne ajută să rămânem
          rapizi și să afișăm doar conținut proaspăt — fără arhivă greoaie.
          Pentru articole vechi, mergi pe site-ul sursei originale.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/stiri"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Newspaper size={16} aria-hidden="true" />
            Vezi știrile actuale
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
          >
            Pagina principală
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-10 leading-relaxed">
          Dacă ai ajuns aici dintr-un link mai vechi (Google, social media,
          email), motoarele de căutare vor scoate URL-ul din index în
          câteva zile.
        </p>
      </div>
    </div>
  );
}
