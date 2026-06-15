import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp, Megaphone, Send } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { LiveStatsBar } from "@/components/home/LiveStatsBar";
import { CountUp } from "@/components/ui/CountUp";
import { TopVotedWidget } from "@/components/home/TopVotedWidget";
import { IntreruperiWidget } from "@/components/home/IntreruperiWidget";
import { StiriWidget } from "@/components/home/StiriWidget";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { FaqJsonLd } from "@/components/FaqJsonLd";

/**
 * FAQ schema pentru homepage — Google rich results + AI parsing direct.
 * Catalog de Q&A pe care LLM-urile (ChatGPT, Claude, Perplexity) le pot
 * cita exact când utilizatorul intreaba „cum reclam la primarie?" sau
 * similar.
 */
const HOMEPAGE_FAQ = [
  {
    question: "Ce este Civia.ro?",
    answer:
      "Civia este o platformă civică independentă pentru România, gratuită, care permite cetățenilor să trimită sesizări formale către primării, să semneze petiții civice, să urmărească proteste programate și întreruperi de utilități, și să citească știri civice. Platforma acoperă toate cele 42 de județe, e open-source (MIT), și e construită cu Next.js + Supabase + AI Groq.",
  },
  {
    question: "Cum trimit o sesizare la primărie prin Civia?",
    answer:
      "Intri pe civia.ro/sesizari, descrii problema în 1-2 fraze, opțional adaugi 1-5 poze, alegi tipul (groapă, parcare, gunoi, etc.). AI-ul Civia generează automat o sesizare formală cu temei legal OG 27/2002 și detectează autoritatea competentă (primărie, prefectură, poliție locală). Tu apeși Trimite și se deschide aplicația ta de email cu totul completat. Primești un cod unic pentru urmărirea răspunsului.",
  },
  {
    question: "Care e temeiul legal pentru sesizările civice?",
    answer:
      "Ordonanța Guvernului nr. 27/2002 privind reglementarea activității de soluționare a petițiilor. Conform acestei legi, autoritățile publice (primării, prefecturi, ministere) sunt obligate să răspundă oricărei petiții/sesizări semnate de un cetățean în maxim 30 de zile calendaristice. Răspunsul oficial trebuie să conțină un număr de înregistrare. Lipsa răspunsului dă cetățeanului dreptul de a se plânge la Avocatul Poporului sau la instanța de contencios administrativ.",
  },
  {
    question: "Cât timp are primăria să răspundă la o sesizare?",
    answer:
      "Maxim 30 de zile calendaristice de la data înregistrării sesizării, conform art. 8 din OG 27/2002. Pentru petițiile care necesită consultarea altor autorități, termenul poate fi prelungit cu maxim 15 zile, dar cetățeanul trebuie notificat în scris despre prelungire. Dacă primăria nu răspunde, ai trei căi: plângere la Avocatul Poporului (gratuit), acțiune la instanța de contencios administrativ, sau marchează sesizarea ca fără răspuns pe Civia pentru a intra în statisticile publice.",
  },
  {
    question: "E gratis Civia? Trebuie cont?",
    answer:
      "Da, e gratuit pentru totdeauna. Nu trebuie cont pentru a trimite o sesizare — completezi anonim, datele tale sunt folosite doar pentru emailul către primărie. Contul îți permite să-ți vezi istoricul tuturor sesizărilor într-un loc și să primești notificări prin email.",
  },
  {
    question: "Ce face Civia cu datele mele personale?",
    answer:
      "Numele și adresa apar OBLIGATORIU în emailul către primărie (cerință legală — sesizările anonime sunt clasate fără răspuns). Pe site, sesizările publice apar cu numele anonimizat ca [nume] și adresa ca [adresa]. Datele se stochează pe servere în UE (Supabase EU region), conform GDPR. Poți exporta toate datele tale ca JSON sau șterge contul definitiv din /cont.",
  },
  {
    question: "Ce tipuri de sesizări pot trimite?",
    answer:
      "Groapă în asfalt, trotuar degradat, iluminat public defect, copac periculos, gunoi necolectat, parcare ilegală, stâlpișori anti-parcare, canalizare/inundație, semafor defect, traversare pietonală periculoasă, graffiti/vandalism, mobilier stradal stricat, zgomot excesiv, câini periculoși, problemă transport public, afișaj/publicitate ilegală. Pentru orice altceva există categoria Altele cu titlu personalizat.",
  },
  {
    question: "Cum diferă Civia de Declic sau Avaaz?",
    answer:
      "Declic și Avaaz colectează semnături pentru petiții politice naționale. Civia se concentrează pe sesizări CIVICE LOCALE către primării — probleme concrete în orașul tău (groapă, parcare ilegală, iluminat) care au temei legal OG 27/2002 obligatoriu de răspuns. Civia agregă și petițiile de pe Declic/Avaaz în catalogul propriu pentru cetățenii care vor să semneze ambele tipuri.",
  },
];

// 2026-06-10: 4h → 30min. La 4h, counter-ul de social-proof rămânea în urmă
// vizibil (arăta 69 când erau 71). 30min e un compromis bun: counter aproape
// la zi, fără presiune CPU. Sesizările noi apar oricum via on-demand revalidate.
export const revalidate = 1800;

/**
 * Fetch total approved sesizari count for the homepage social-proof line.
 * Stat ISR-cached (revalidate la 30 min), zero-impact pe Vercel CPU.
 * Fallback la null pe eroare — line se ascunde, nu rupe page-ul.
 */
async function getTotalSesizariCount(): Promise<number | null> {
  try {
    const admin = createSupabaseAdmin();
    // 2026-06-10 — numărăm public+approved (sesizările vizibile public), IDENTIC
    // cu /sesizari-publice, ca numărul să fie CONSISTENT peste tot. Înainte
    // număra doar `approved` (incl. private) → diferea de feed.
    const { count } = await admin
      .from("sesizari")
      .select("*", { count: "exact", head: true })
      .eq("moderation_status", "approved")
      .eq("publica", true);
    return count;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — Schimbă România prin sesizări și petiții civice` },
  description:
    "Fă o poză, descrie problema în câteva cuvinte, noi îți construim sesizarea formală. Plus petiții civice pe care le poți semna online. Gratuit, pentru toate județele.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const totalSesizari = await getTotalSesizariCount();

  return (
    <>
      <FaqJsonLd items={HOMEPAGE_FAQ} />
      {/* Preload hero background image — browserul începe să-l descarce
          în paralel cu HTML parsing, nu așteaptă să întâlnească CSS-ul
          care îl referă. ~200-500ms LCP improvement pe primul paint.
          Next 15+ hoistează automat <link> elements la <head>. */}
      {/* HERO — `lg:-mt-16` anulează pt-16 al body-ului DOAR pe desktop (unde
          navbarul fix h-16 plutește peste gradient). Pe mobil navbarul de sus nu
          mai există → fără -mt-16 (altfel hero-ul ar fi tras 64px în notch).
          5/22/2026 — scos imaginea de fundal hero-national.jpg. Doar gradient
          curat emerald → dark + 2 radiale subtle. -300ms LCP + look mai curat. */}
      <section className="relative overflow-hidden lg:-mt-16 text-[var(--color-text)] dark:text-white">
        {/* 5/23/2026 v7 — bg solid scos. Animated body::before/::after gradient
            blob-urile se văd PRIN secțiunea hero (Liquid Glass). Vignette-ul
            de contrast text e DARK-ONLY (în light mode bg-ul e deja deschis,
            nu ne trebuie întunecare suplimentară). */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-transparent to-[var(--color-bg)]/40 dark:from-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.07] pointer-events-none" />

        <div className="container-narrow relative z-10 pt-32 pb-16 md:pt-40 md:pb-24 lg:pt-48 lg:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-[family-name:var(--font-sora)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-5 sm:mb-6 leading-[1.05] tracking-tight break-words dark:drop-shadow-[0_2px_20px_rgba(0,0,0,0.4)] hero-enter-1">
              Ajută la schimbarea{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 dark:from-emerald-200 dark:via-cyan-100 dark:to-violet-200 bg-clip-text text-transparent">
                României.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-[var(--color-text)]/85 dark:text-white/90 mb-4 max-w-2xl mx-auto leading-relaxed dark:drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] hero-enter-2">
              <strong className="text-[var(--color-text)] dark:text-white">Faci o poză. Scrii câteva fraze. Apeși trimite.</strong>{" "}
              Restul facem noi — generăm sesizarea formală, o trimitem la primărie
              cu temei legal OG 27/2002 și te anunțăm de fiecare dată când răspund.
            </p>
            <p className="text-sm md:text-base text-[var(--color-text-muted)] dark:text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed dark:drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
              Plus: notificare la fiecare petiție nouă, la fiecare protest anunțat,
              la întreruperile programate din zona ta și știri civice agregate din presă —
              totul gratuit, fără cont obligatoriu.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 hero-enter-3">
              <Link
                href="/sesizari"
                className="lc-liquid lc-magnetic w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[var(--radius-full)] bg-gradient-to-br from-emerald-500 to-cyan-600 dark:from-emerald-400/95 dark:to-cyan-500/95 text-white font-semibold shadow-[var(--shadow-3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
              >
                <Send size={16} aria-hidden="true" />
                Fă o sesizare acum
              </Link>
              <Link
                href="/petitii"
                className="lc-liquid lc-liquid-violet lc-magnetic w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[var(--radius-full)] bg-[var(--color-surface)] dark:bg-white/10 border border-[var(--color-border)] dark:border-transparent text-[var(--color-text)] dark:text-white font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] dark:focus-visible:ring-white"
              >
                <Megaphone size={16} aria-hidden="true" />
                Semnează petiții
              </Link>
            </div>

            {/* Social proof — counter live cu numarul total de sesizari
                aprobate. Mai puternic decat „X cetateni" pt ca arata
                rezultate concrete, nu doar prezenta. Stat ISR-cached. */}
            {totalSesizari !== null && totalSesizari > 0 && (
              <p className="mt-6 text-sm text-[var(--color-primary)] dark:text-emerald-100/85 inline-flex items-center gap-2">
                <Megaphone size={14} aria-hidden="true" />
                <span>
                  <strong className="text-[var(--color-text)] dark:text-white">
                    <CountUp value={totalSesizari} />
                  </strong>{" "}
                  {totalSesizari === 1 ? "sesizare publică" : "sesizări publice"} pe Civia
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
      </section>

      {/* LIVE STATS BAR */}
      <LiveStatsBar />

      {/* TOP VOTED */}
      <section className="py-12 md:py-16">
        <div className="container-narrow">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold flex items-center gap-2">
              <TrendingUp size={22} className="text-[var(--color-primary)]" aria-hidden="true" />
              Ce semnalează cetățenii acum
            </h2>
            <Link
              href="/sesizari-publice"
              className="text-sm font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
            >
              Vezi toate <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <TopVotedWidget />
        </div>
      </section>

      {/* STIRI WIDGET — 6 most recent national articles */}
      <StiriWidget />

      {/* INTRERUPERI WIDGET */}
      <IntreruperiWidget />

      {/* 5/22/2026 — scoasă secțiunea „De la problemă la răspuns oficial
          — în 3 pași" + funcția Step la cererea user-ului. */}
    </>
  );
}
