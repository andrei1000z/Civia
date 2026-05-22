import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp, Megaphone, Send, Users } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { CountyPicker } from "./CountyPicker";
import { LiveStatsBar } from "@/components/home/LiveStatsBar";
import { QuickCameraCTA } from "@/components/sesizari/QuickCameraCTA";
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
      "Intri pe civia.ro/sesizari, descrii problema în 1-2 fraze, optional adaugi 1-5 poze, alegi tipul (groapă, parcare, gunoi, etc.). AI-ul Civia generează automat o sesizare formală cu temei legal OG 27/2002 și detectează autoritatea competentă (primărie, prefectură, poliție locală). Tu apeși Trimite și se deschide aplicația ta de email cu totul completat. Primești un cod unic pentru urmărirea răspunsului.",
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
      "Da, e gratuit pentru totdeauna și 100% open-source (licență MIT, cod pe github.com/andrei1000z/Civia). Nu trebuie cont pentru a trimite o sesizare — completezi anonim, datele tale sunt folosite doar pentru emailul către primărie. Contul îți permite să-ți vezi istoricul tuturor sesizărilor într-un loc și să primești notificări prin email.",
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

// 2026-05-19: 30min → 4h. Homepage are doar count-uri statice + features list.
// Counter-ul refresh-eaza la 4h, sesizarile noi apar via on-demand revalidate.
export const revalidate = 14400;

/**
 * Fetch total approved sesizari count for the homepage social-proof line.
 * Stat ISR-cached (revalidate la 30 min), zero-impact pe Vercel CPU.
 * Fallback la null pe eroare — line se ascunde, nu rupe page-ul.
 */
async function getTotalSesizariCount(): Promise<number | null> {
  try {
    const admin = createSupabaseAdmin();
    const { count } = await admin
      .from("sesizari")
      .select("*", { count: "exact", head: true })
      .eq("moderation_status", "approved");
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
      {/* HERO — `-mt-16` cancels body's pt-16 (compensare pentru navbar-ul
          fixed h-16 = 64px) ca gradient-ul să înceapă la y=0 viewport,
          iar navbar-ul să plutească pe el cu backdrop-blur.
          5/22/2026 — scos imaginea de fundal hero-national.jpg la cererea
          user-ului. Acum doar gradient curat emerald → dark + 2 radiale
          subtle pentru profunzime. -300ms LCP (no image fetch) + look
          mai curat. */}
      <section className="relative overflow-hidden -mt-16 bg-gradient-to-br from-[var(--color-primary)] via-emerald-800 to-[#0a0a0a] text-white">
        {/* Radial accents pentru profunzime — fara imagine, doar gradient layers. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_30%,rgba(56,189,248,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_20%_80%,rgba(16,185,129,0.20),transparent)]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/40 via-transparent to-transparent" />

        <div className="container-narrow relative z-10 pt-32 pb-16 md:pt-40 md:pb-24 lg:pt-48 lg:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-[family-name:var(--font-sora)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-5 sm:mb-6 leading-[1.05] tracking-tight break-words">
              Ajută la schimbarea{" "}
              <span className="bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                României.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-emerald-100/90 mb-10 max-w-2xl mx-auto leading-relaxed">
              Sesizări formale către primărie. Petiții civice cu impact.
              Întreruperi programate, proteste anunțate, știri locale și ghiduri
              practice pentru toate cele 42 de județe — într-un singur loc.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/sesizari"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[var(--radius-full)] bg-white text-[var(--color-primary)] font-semibold hover:bg-white/90 active:scale-[0.97] transition-all shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700"
              >
                <Send size={16} aria-hidden="true" />
                Fă o sesizare acum
              </Link>
              <Link
                href="/petitii"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-[var(--radius-full)] bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold hover:bg-white/20 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Megaphone size={16} aria-hidden="true" />
                Semnează petiții
              </Link>
            </div>

            {/* Social proof — counter live cu cetatenii care au folosit deja
                platforma. Ridica conversion-ul prin demonstrarea ca nu esti
                singur ("X cetateni s-au alaturat deja"). Stat ISR-cached. */}
            {totalSesizari !== null && totalSesizari > 0 && (
              <p className="mt-6 text-sm text-emerald-100/85 inline-flex items-center gap-2">
                <Users size={14} aria-hidden="true" />
                <span>
                  <strong className="text-white tabular-nums">
                    {totalSesizari.toLocaleString("ro-RO")}
                  </strong>{" "}
                  cetățeni{totalSesizari === 1 ? "" : ""} s-au alăturat deja
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
      </section>

      {/* LIVE STATS BAR */}
      <LiveStatsBar />

      {/* F6 Mobile Camera Quick CTA — vizibil DOAR pe mobile, sub stats */}
      <div className="container-narrow py-4 md:hidden">
        <QuickCameraCTA />
      </div>

      {/* COUNTY PICKER */}
      <section id="county-picker" className="py-12 md:py-16 bg-[var(--color-surface)]">
        <div className="container-narrow">
          <div className="text-center mb-6">
            <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold">
              Alege-ți județul
            </h2>
            <p className="text-[var(--color-text-muted)] mt-2">
              Sesizări, întreruperi, proteste, știri locale și date publice — filtrate pe județul tău.
            </p>
          </div>
        </div>
        <CountyPicker />
      </section>

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
