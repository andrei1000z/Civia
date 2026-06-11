import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, BookOpen, Users, Download, Mail, Sparkles } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Civia pentru școli — Civic literacy kit • Civia",
  description:
    "Kit gratuit pentru profesori liceu: civic literacy, lecții despre OG 27/2002, exerciții practice cu Civia. Pentru clase de educație civică și consiliere.",
  alternates: { canonical: `${SITE_URL}/scoala` },
};

export const revalidate = 86400;

export default function ScoalaPage() {
  return (
    // container-narrow pe TOT (incl. hero) — pattern-ul canonic (/sesizari).
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Civia pentru școli"
        icon={GraduationCap}
        gradient={HERO_GRADIENT.health}
        description={
          <>
            Kit <strong>gratuit</strong> pentru profesori liceu: 5 lecții despre civic
            engagement, exerciții practice, materiale ready-to-use.
          </>
        }
        tagline="Educație civică reală — nu doar teorie"
      />

      <div className="space-y-6 pb-16 max-w-3xl">
        <Section title="🎯 Pentru cine">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Profesori liceu</strong> — clase de Educație Antreprenorială, Cultură Civică, Consiliere</li>
            <li><strong>Ore de dirigenție</strong> — workshop civic engagement</li>
            <li><strong>ONG-uri educaționale</strong> — sesiuni civic-tech cu elevii</li>
            <li><strong>Universități</strong> — cursuri Drept administrativ, Studii media</li>
          </ul>
        </Section>

        <Section title="📚 Cele 5 lecții">
          <div className="space-y-3">
            <Lesson
              num={1}
              title="Drepturile mele de cetățean"
              duration="45 min"
              summary="Constituția art. 51 (petiționare), OG 27/2002, Legea 544/2001 (acces info publice). Cu exemple concrete."
            />
            <Lesson
              num={2}
              title="Cum scriu o sesizare bună"
              duration="45 min"
              summary={`Formal vs informal. Ce face o sesizare „să meargă". Exercițiu: scrie 1 sesizare reală pe o problemă din cartier.`}
            />
            <Lesson
              num={3}
              title="Cum funcționează primăria"
              duration="45 min"
              summary="Structură: primar, viceprimari, consiliu local, direcții. Cine pe ce decide. Buget local. Hărți responsabilități."
            />
            <Lesson
              num={4}
              title="Petiții civice vs sesizări vs proteste"
              duration="45 min"
              summary="Diferențe legale + practice. Când folosești ce. Studiu caz: 3 victorii civice recente din România."
            />
            <Lesson
              num={5}
              title="Proiect: schimb-mi cartierul"
              duration="2× 45 min"
              summary="Elevii identifică o problemă reală + propun rezolvare + depun sesizare pe Civia. Follow-up peste 30 zile."
            />
          </div>
        </Section>

        <Section title="📦 Ce primești în kit">
          <ul className="list-disc list-inside space-y-1">
            <li>5 prezentări <strong>PowerPoint editabile</strong> (în pregătire — lansare 2026 Q4)</li>
            <li>Fișe de lucru elevi (PDF)</li>
            <li>Manual profesor cu sugestii adaptive (răspunsuri elevi tipice + cum reacționezi)</li>
            <li>Acces gratuit la Civia API pentru proiecte de clasă</li>
            <li>Posibilitate workshop online cu echipa Civia (1× pe semestru)</li>
          </ul>
        </Section>

        <Section title="📊 Statistici utile pentru predare">
          <p className="mb-3">
            Cifre live pe care le poți folosi în clasă:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <Link href="/impact" className="text-[var(--color-primary)] hover:underline">/impact</Link>
              {" "}— număr sesizări depuse, % rezolvate, top județe active
            </li>
            <li>
              Răspuns mediu primării: 30 zile legal (OG 27/2002)
            </li>
            <li>
              <Link href="/clasament" className="text-[var(--color-primary)] hover:underline">/clasament</Link>
              {" "}— ranking primării după rata răspuns
            </li>
            <li>
              Constituția art. 51: petiționare = drept fundamental
            </li>
          </ul>
        </Section>

        <Section title="🧪 Proiecte de clasă reușite">
          <p className="mb-3">
            (Se populează pe măsură ce profesorii ne trimit experiențe.)
          </p>
          <div className="rounded-[var(--radius-xs)] border border-dashed border-[var(--color-border)] p-4 bg-[var(--color-surface-2)]">
            <p className="text-sm italic text-[var(--color-text-muted)]">
              „Elevii clasei a XI-a B Liceu X au identificat 12 probleme în cartier și au depus
              sesizări. 7 au fost rezolvate în 60 zile. Cea mai bună lecție de civic engagement
              din anul ăsta." — exemplu fictiv, devine real cu primul partener.
            </p>
          </div>
        </Section>

        <Section title="🤝 Cum colaborăm">
          <ol className="list-decimal list-inside space-y-2">
            <li>Scrii la <a href="mailto:scoala@civia.ro" className="text-[var(--color-primary)] hover:underline">scoala@civia.ro</a> cu numele școlii + clase + profesor coordonator</li>
            <li>Primești kit complet (PDF + acces dashboard analytics elevi)</li>
            <li>Faci 5 lecții la propriul ritm (1 pe săptămână recomandat)</li>
            <li>Proiect final cu sesizări reale</li>
            <li>Civia oferă feedback pe rezultate + raport vizibil în comunitate</li>
          </ol>
          <div className="mt-4">
            <a
              href="mailto:scoala@civia.ro?subject=Cerere%20kit%20Civia%20%C8%99coal%C4%83"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Mail size={16} aria-hidden="true" />
              Cere kit gratuit
            </a>
          </div>
        </Section>

        <Section title="🇪🇺 Parteneri & Susținere">
          <p>
            Programul Civia Schools e parte din misiunea noastră non-profit. Vrem să formăm
            generații care înțeleg drepturile civice — și știu cum să le folosească.
          </p>
          <p className="mt-3">
            Pentru sponsori interesați să susțină programul (granturi, materiale tipărite,
            cheltuieli logistice): <a href="mailto:parteneri@civia.ro" className="text-[var(--color-primary)] hover:underline">parteneri@civia.ro</a>
          </p>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          <Sparkles size={12} className="inline mr-1 text-[var(--color-primary)]" aria-hidden="true" />
          Program în lansare. Kit complet PDF disponibil din 2026 Q4. Earlier access:{" "}
          <a href="mailto:scoala@civia.ro" className="text-[var(--color-primary)] hover:underline">
            scoala@civia.ro
          </a>
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3">{title}</h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Lesson({
  num,
  title,
  duration,
  summary,
}: {
  num: number;
  title: string;
  duration: string;
  summary: string;
}) {
  return (
    <div className="flex gap-3 rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)] text-white text-sm font-bold inline-flex items-center justify-center">
        {num}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-[10px] text-[var(--color-text-muted)]">· {duration}</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{summary}</p>
      </div>
    </div>
  );
}
