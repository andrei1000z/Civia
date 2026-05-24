import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, Mail } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_NAME } from "@/lib/constants";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: `Declarație de accesibilitate • ${SITE_NAME}`,
  description:
    "Civia respectă standardul WCAG 2.2 nivel AA și EN 301 549 — cerințele europene pentru accesibilitate digitală în sectorul public. Pentru toți cetățenii.",
  alternates: { canonical: `${SITE_URL}/legal/accesibilitate` },
  openGraph: {
    title: "Declarație de accesibilitate Civia",
    description: "Conformitate WCAG 2.2 AA + EN 301 549. Pentru toți cetățenii, fără excepție.",
    url: `${SITE_URL}/legal/accesibilitate`,
    type: "website",
    locale: "ro_RO",
  },
};

export const revalidate = 86400;

export default function AccesibilitatePage() {
  return (
    <>
      <PageHero
        title="Declarație de accesibilitate"
        icon={Accessibility}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Civia respectă standardul <strong>WCAG 2.2 nivel AA</strong> și{" "}
            <strong>EN 301 549 v3.2.1</strong> — cerințele europene pentru accesibilitate
            digitală în sectorul public.
          </>
        }
        tagline="Pentru toți cetățenii, fără excepție"
      />

      <div className="container-narrow space-y-8 pb-16 max-w-3xl">
        <Section title="1. Angajamentul nostru">
          <p>
            Credem că accesibilitatea civică e un drept fundamental, nu o opțiune. Toți
            cetățenii — inclusiv persoanele cu dizabilități motorii, vizuale, auditive sau
            cognitive — trebuie să poată raporta probleme, semna petiții și urmări răspunsul
            primăriilor pe Civia.
          </p>
        </Section>

        <Section title="2. Standardele aplicate">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>WCAG 2.2 nivel AA</strong> — Web Content Accessibility Guidelines (W3C).
            </li>
            <li>
              <strong>EN 301 549 v3.2.1</strong> — standardul european de accesibilitate ICT.
              În vigoare din 23 septembrie 2025 pentru sectorul (semi)public.
            </li>
            <li>
              <strong>European Accessibility Act (EAA)</strong> — Directiva 2019/882. În
              vigoare din 28 iunie 2025.
            </li>
            <li>
              <strong>Directiva 2016/2102/UE</strong> — Web Accessibility Directive pentru
              site-uri și aplicații mobile ale autorităților publice.
            </li>
          </ul>
        </Section>

        <Section title="3. Stadiul conformității">
          <p className="mb-3">
            Civia este <strong>parțial conformă</strong> cu WCAG 2.2 AA. Lucrăm continuu
            să eliminăm punctele de neconformitate identificate prin audit intern și
            feedback de la utilizatori cu dizabilități.
          </p>
          <p className="mb-3">Ce respectăm complet:</p>
          <ul className="list-disc list-inside space-y-1.5 mb-4">
            <li>Contrast ≥ 4.5:1 pentru text normal, ≥ 3:1 pentru text mare (1.4.3)</li>
            <li>Navigare completă cu tastatura — fără capcane (2.1.1, 2.1.2)</li>
            <li>Etichete pentru toate formularele și butoanele icon-only (2.4.6, 4.1.2)</li>
            <li>Limba paginii declarată ca română (3.1.1) și sub-limbi unde aplicabil</li>
            <li>Diacritice complete (ă, â, î, ș, ț) — pentru screen readers</li>
            <li>Atribute ARIA pe componente interactive (aria-label, aria-current, aria-expanded)</li>
            <li>Marcaje semantice (landmarks: header/main/nav/footer)</li>
            <li>Suport <code>prefers-reduced-motion</code> — animații dezactivate la cerere</li>
            <li>Focus vizibil pe toate elementele interactive (2.4.7)</li>
            <li>Touch targets ≥ 44×44 px pe mobile (2.5.8 WCAG 2.2 nou)</li>
            <li>Cookie banner cu paritate vizuală Accept/Respinge (Austria 2025 ruling)</li>
          </ul>
          <p className="mb-3">Ce mai avem de îmbunătățit (audit intern noiembrie 2026):</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Testing cu screen readers reale (JAWS, NVDA, VoiceOver, TalkBack) — în curs</li>
            <li>Suport pentru limbi minoritare (maghiară, germană) — roadmap 2026 Q3</li>
            <li>Mode forțat-contrast Windows — în lucru</li>
            <li>Subtitrări automate pentru orice video viitor</li>
          </ul>
        </Section>

        <Section title="4. Metode de testare">
          <ul className="list-disc list-inside space-y-1.5">
            <li>Audit automat lunar cu axe-core și Lighthouse Accessibility</li>
            <li>Testare manuală cu tastatura — toate fluxurile critice (sesizare,
              login, vot, semnare)</li>
            <li>Validare HTML semantic + ARIA cu Wave (WebAIM)</li>
            <li>Contrast checker pe toate combinațiile de culori din design tokens</li>
          </ul>
        </Section>

        <Section title="5. Tehnologii folosite">
          <ul className="list-disc list-inside space-y-1.5">
            <li>HTML5 semantic + ARIA 1.2</li>
            <li>CSS3 cu tokens responsive (Tailwind CSS v4)</li>
            <li>JavaScript progresiv (Next.js 16 + React 19) — funcționalitate de bază
              disponibilă și fără JS, prin Server Components</li>
          </ul>
        </Section>

        <Section title="6. Cum ne contactezi">
          <p className="mb-3">
            Dacă întâlnești o barieră de accesibilitate pe Civia, te rugăm să ne spui —
            răspundem în maximum 5 zile lucrătoare.
          </p>
          <a
            href="mailto:accesibilitate@civia.ro?subject=Problem%C4%83%20de%20accesibilitate"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Mail size={16} aria-hidden="true" />
            accesibilitate@civia.ro
          </a>
        </Section>

        <Section title="7. Procedură de plângere">
          <p className="mb-3">
            Dacă nu primești un răspuns satisfăcător de la noi, te poți adresa:
          </p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>Autoritatea Națională de Supraveghere a Prelucrării Datelor cu
              Caracter Personal (ANSPDCP)</strong> — pentru aspecte legate de GDPR și
              accesibilitate digitală a serviciilor publice
            </li>
            <li>
              <strong>Avocatul Poporului</strong> — pentru orice încălcare a drepturilor
              cetățenești de către o platformă civică
            </li>
            <li>
              <strong>Comisia Europeană — DG CONNECT</strong> — pentru raportarea
              violărilor EAA și EN 301 549
            </li>
          </ul>
        </Section>

        <Section title="8. Date de aprobare">
          <ul className="list-none space-y-1 text-sm">
            <li>
              <strong>Prima publicare:</strong> 24 mai 2026
            </li>
            <li>
              <strong>Ultimul audit intern:</strong> 24 mai 2026
            </li>
            <li>
              <strong>Următorul audit programat:</strong> noiembrie 2026
            </li>
            <li>
              <strong>Versiune declarație:</strong> 1.0
            </li>
          </ul>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Această declarație este publicată în conformitate cu cerințele{" "}
          <Link href="/legal/termeni" className="text-[var(--color-primary)] hover:underline">
            Termenilor de utilizare
          </Link>{" "}
          și ale{" "}
          <Link href="/legal/confidentialitate" className="text-[var(--color-primary)] hover:underline">
            Politicii de confidențialitate
          </Link>
          .
        </p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3 text-[var(--color-text)]">
        {title}
      </h2>
      <div className="text-sm text-[var(--color-text)] leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
