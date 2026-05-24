import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Sparkles, Shield, Code2, Users } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Despre Civia • Platformă civică independentă",
  description:
    "Cine suntem, de ce facem Civia, cum funcționează. Open-source, gratuit, independent — pentru cetățenii României.",
  alternates: { canonical: `${SITE_URL}/despre` },
  openGraph: {
    title: "Despre Civia",
    description: "Platformă civică independentă, gratuită, open-source. Pentru cetățenii României.",
    url: `${SITE_URL}/despre`,
    locale: "ro_RO",
  },
};

export const revalidate = 86400;

export default function DesprePage() {
  return (
    <>
      <PageHero
        title="Despre Civia"
        icon={Heart}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            <strong>Civia</strong> e o platformă civică independentă pentru România. Gratuită.
            Open-source. Fără partid. Pentru cetățeni.
          </>
        }
        tagline="„Pentru o Românie ca afară"
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        <Section title="🌍 De ce Civia">
          <p>
            În România, depui o sesizare la primărie și aștepți 30 de zile. Conform{" "}
            <strong>OG 27/2002 art. 8</strong>, primăria e <em>obligată</em> să răspundă. În
            practică? Mulți cetățeni primesc tăcere. Sau răspunsuri boilerplate. Sau redirecționări
            la nesfârșit.
          </p>
          <p className="mt-3">
            Civia simplifică procesul: faci o poză, scrii câteva fraze, AI-ul nostru generează
            sesizarea oficială cu temei legal corect, iar noi o trimitem la primăria competentă.
            Apoi urmărim termenul de 30 zile, primim răspunsul (dacă vine), îți spunem. Dacă nu
            vine — generăm automat plângerea la Avocatul Poporului (conform <strong>Legea 35/1997</strong>).
          </p>
          <p className="mt-3">
            <strong>Asta e civic engagement la 2026: rapid, transparent, deschis.</strong>
          </p>
        </Section>

        <Section title="🛠️ Cum funcționează">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Tu raportezi</strong>: poză + descriere + locație. 2 minute.
            </li>
            <li>
              <strong>AI generează</strong> sesizarea formală cu temei legal (OG 27/2002, Cod Rutier,
              HG 1391/2006, etc.). Tu doar confirmi.
            </li>
            <li>
              <strong>Civia trimite</strong> emailul oficial la primărie + autorități competente
              (Poliția Locală, prefectură). Tu primești copie.
            </li>
            <li>
              <strong>Noi urmărim</strong> termenul de 30 zile. La 7/14/30 zile primești reminder.
            </li>
            <li>
              <strong>Răspunsul</strong> vine automat în inbox-ul tău și pe pagina sesizării. AI
              clasifică tipul (înregistrată / în lucru / rezolvat / refuz).
            </li>
            <li>
              <strong>La 60 zile fără răspuns</strong> → status „ignorat" + email AVP pre-completat.
              Apeși un buton, trimitem la Avocatul Poporului.
            </li>
          </ol>
        </Section>

        <Section title="💎 Valorile noastre">
          <div className="grid sm:grid-cols-2 gap-4">
            <Value icon={Shield} title="Privacy by design">
              Date stocate în UE (Supabase Ireland). PII scrubbing pe Sentry. Nu vindem date.
              Niciodată tracking publicitar.
            </Value>
            <Value icon={Code2} title="Open source MIT">
              Tot codul e public pe GitHub. Audit independent posibil. Self-host
              disponibil pentru altă țară.
            </Value>
            <Value icon={Sparkles} title="AI responsabil">
              AI clasifică, nu decide. Tu confirmi mereu. Disclosure transparent în
              fiecare email. Conformitate EU AI Act.
            </Value>
            <Value icon={Users} title="Independent civic">
              Fără capital de partid, fără publicitate, fără donatori politici. Susținut
              prin granturi NGO + contribuții voluntare.
            </Value>
          </div>
        </Section>

        <Section title="📜 Legal compliance">
          <ul className="list-disc list-inside space-y-1">
            <li>GDPR Reg. (UE) 2016/679 — full compliance, sub-processors listed</li>
            <li>EU AI Act — disclosure prominent, risc limitat</li>
            <li>WCAG 2.2 AA + EN 301 549 — accesibilitate digitală</li>
            <li>DSA Reg. (UE) 2022/2065 — transparență moderare</li>
            <li>Cookie Banner conform Austria 2025 ruling (parity vizuală)</li>
            <li>OG 27/2002 — legea petițiilor (temeiul nostru juridic)</li>
            <li>Legea 35/1997 — Avocatul Poporului (escaladare automată)</li>
            <li>Legea 544/2001 — acces la informații publice</li>
          </ul>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Vezi <Link href="/legal/termeni" className="text-[var(--color-primary)] hover:underline">Termenii</Link>,{" "}
            <Link href="/legal/confidentialitate" className="text-[var(--color-primary)] hover:underline">Confidențialitatea</Link>,{" "}
            <Link href="/legal/accesibilitate" className="text-[var(--color-primary)] hover:underline">Declarația de accesibilitate</Link>.
          </p>
        </Section>

        <Section title="📈 Stack tehnic">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Framework</strong>: Next.js 16 (App Router, Turbopack, RSC), React 19
            </li>
            <li>
              <strong>Database</strong>: Supabase (Postgres + Auth + Storage + Realtime), EU region
            </li>
            <li>
              <strong>AI</strong>: Groq Llama 3.3 70B (text) + Llama 4 Scout 17B Vision (poze)
            </li>
            <li>
              <strong>Email</strong>: Resend (transactional + inbound webhook)
            </li>
            <li>
              <strong>Cache</strong>: Upstash Redis (rate limit + ISR)
            </li>
            <li>
              <strong>Maps</strong>: Leaflet + OpenStreetMap (no Google tracking)
            </li>
            <li>
              <strong>Hosting</strong>: Vercel EU
            </li>
            <li>
              <strong>Monitoring</strong>: Sentry (PII scrubbing activ)
            </li>
            <li>
              <strong>License</strong>: MIT
            </li>
          </ul>
        </Section>

        <Section title="🤝 Echipa">
          <p>
            Civia e construit de un grup mic de developeri și activiști civici români. Nu suntem
            companie — suntem voluntari. Codul e maintainable de oricine cu chef.
          </p>
          <p className="mt-3">
            Vrei să contribui? Vezi{" "}
            <a href="https://github.com/andrei1000z/Civia" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{" "}
            sau scrie la{" "}
            <a href="mailto:contact@civia.ro" className="text-[var(--color-primary)] hover:underline">
              contact@civia.ro
            </a>.
          </p>
        </Section>

        <Section title="❤️ Susține Civia">
          <p>
            Civia e gratuit pentru cetățeni, pentru totdeauna. Costurile (hosting, AI tokens,
            domeniu) le acoperim din granturi NGO. Pentru a contribui:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-3">
            <li>
              <strong>Distribuie</strong> Civia prietenilor — cea mai bună susținere
            </li>
            <li>
              <strong>Folosește</strong> platforma activ — cu cât mai mulți cetățeni, cu atât
              mai mult presiune pe primării
            </li>
            <li>
              <strong>Contribuie cod</strong> open-source pe GitHub
            </li>
            <li>
              Pentru organizații, NGO-uri, jurnaliști: API gratuit pe{" "}
              <Link href="/dezvoltatori" className="text-[var(--color-primary)] hover:underline">
                /dezvoltatori
              </Link>
            </li>
          </ul>
        </Section>

        <div className="text-center pt-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Făcut cu <span className="text-rose-500">❤️</span> pentru o Românie ca afară.
          </p>
        </div>
      </div>
    </>
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

function Value({ icon: Icon, title, children }: { icon: typeof Heart; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <Icon size={20} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{children}</p>
    </div>
  );
}
