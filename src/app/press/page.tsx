import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Download, Mail, Code2, ExternalLink, Image as ImageIcon, FileText, BarChart3 } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export const metadata: Metadata = {
  title: "Press kit — resurse pentru jurnaliști și parteneri | Civia",
  description:
    "Resurse oficiale Civia pentru jurnaliști, cercetători, NGO-uri: logo, screenshot-uri, statistici live, boilerplate, contact press, date deschise CC BY 4.0. Răspundem la întrebări în 48h.",
  alternates: { canonical: "/press" },
  keywords: [
    "civia press kit",
    "media kit civia",
    "logo civia",
    "boilerplate civia",
    "presa romania civic",
    "open data jurnalism",
  ],
};

export default function PressPage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Press kit", url: `${SITE_URL}/press` },
        ]}
      />

      <PageHero
        title="Press kit"
        icon={Newspaper}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Resurse oficiale pentru <strong>jurnaliști, cercetători, NGO-uri</strong>{" "}
            și parteneri. Logo, statistici live, citate verificate, contact press.
          </>
        }
        tagline="Răspundem la întrebări de presă în maxim 48h · press@civia.ro"
      />

      {/* Boilerplate */}
      <section aria-labelledby="boilerplate" className="mb-12">
        <h2 id="boilerplate" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2">
          <FileText size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          Boilerplate (text gata de copiat)
        </h2>
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <p className="text-sm leading-relaxed mb-4">
            <strong>Civia.ro</strong> este o platformă civică independentă din
            România care permite cetățenilor să trimită sesizări oficiale către
            autoritățile publice, să semneze petiții și să acceseze informații
            civice esențiale. Folosind inteligență artificială, Civia formalizează
            sesizarea în limbaj juridic, detectează autoritatea competentă și
            trimite emailul direct, respectând OG 27/2002 — care obligă
            autoritățile să răspundă în 30 de zile. Civia este open-source,
            independentă de partide politice și instituții publice, finanțată din
            donații și voluntariat. Misiunea: democratizarea informației civice
            în România.
          </p>
          <p className="text-sm leading-relaxed mb-4 text-[var(--color-text-muted)] italic">
            Versiune scurtă (1 propoziție):
          </p>
          <p className="text-sm leading-relaxed mb-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3">
            Civia.ro este platforma civică românească care folosește AI pentru a
            ajuta cetățenii să trimită sesizări oficiale către autorități în 90
            de secunde, gratuit, conform OG 27/2002.
          </p>
          <button
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
            data-copy-target="boilerplate-text"
            type="button"
          >
            📋 Copiază boilerplate
          </button>
        </div>
      </section>

      {/* Logo & assets */}
      <section aria-labelledby="assets" className="mb-12">
        <h2 id="assets" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2">
          <ImageIcon size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          Logo & screenshot-uri
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <h3 className="font-semibold mb-2">Logo Civia</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
              Logo principal SVG + PNG (192×192, 512×512). Folosește pe fundal
              alb sau deschis. Pentru fundal închis, vezi varianta inversă.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/apple-icon"
                download="civia-logo-180.png"
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
              >
                <Download size={12} aria-hidden="true" /> PNG 180
              </a>
              <a
                href="/icon"
                download="civia-icon-512.png"
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
              >
                <Download size={12} aria-hidden="true" /> PNG 512
              </a>
            </div>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <h3 className="font-semibold mb-2">Screenshot-uri produse</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
              Capturi din platformă pentru articole. Hi-res, gata pentru tipar.
              Toate sub licență CC BY 4.0.
            </p>
            <a
              href="mailto:press@civia.ro?subject=Cerere screenshot-uri Civia"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              <Mail size={14} aria-hidden="true" /> Cere screenshot-uri
            </a>
          </div>
        </div>
      </section>

      {/* Citate / fapte verificabile */}
      <section aria-labelledby="fapte" className="mb-12">
        <h2 id="fapte" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          Fapte verificabile despre Civia
        </h2>
        <div className="space-y-3">
          {[
            { fapt: "Civia funcționează de la", val: "ianuarie 2026" },
            { fapt: "Acoperire județe", val: "42 + București (6 sectoare)" },
            { fapt: "Acoperire orașe", val: "220+ municipii și orașe" },
            { fapt: "Autorități indexate", val: "1500+ primării, prefecturi, agenții" },
            { fapt: "Modele AI folosite", val: "Groq Llama 3.3-70b (text), Llama 4 Scout (vision)" },
            { fapt: "Servere", val: "Frankfurt (Vercel + Supabase EU)" },
            { fapt: "Licență date", val: "CC BY 4.0 (Open Data)" },
            { fapt: "Tehnologie", val: "Next.js 16 + React 19 + TypeScript + Supabase + Groq AI" },
            { fapt: "Finanțare", val: "Donații + voluntariat. Zero bani de la primării/partide/guvern" },
            { fapt: "Cost per sesizare", val: "~0.02 EUR (AI + email)" },
          ].map((f) => (
            <div
              key={f.fapt}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 flex items-start gap-3 flex-wrap"
            >
              <p className="text-sm font-medium flex-1 min-w-0">{f.fapt}</p>
              <p className="text-sm font-bold text-[var(--color-primary)]">{f.val}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-4 italic">
          Date live + verificabile la{" "}
          <Link href="/statistici-sesizari-romania" className="text-[var(--color-primary)] hover:underline">
            /statistici-sesizari-romania
          </Link>{" "}
          (CC BY 4.0).
        </p>
      </section>

      {/* Citate de la founder/echipă */}
      <section aria-labelledby="citate" className="mb-12">
        <h2 id="citate" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          💬 Citate gata de folosit
        </h2>
        <blockquote className="bg-[var(--color-surface)] border-l-4 border-[var(--color-primary)] rounded-[var(--radius-md)] p-5 mb-3">
          <p className="text-base italic leading-relaxed mb-2">
            „Civia transformă 2 ore de birocrație civică în 90 de secunde. AI-ul
            scrie limbajul juridic, găsește autoritatea, trimite emailul.
            Cetățeanul doar fotografiază problema."
          </p>
          <footer className="text-xs text-[var(--color-text-muted)]">
            — Echipa Civia
          </footer>
        </blockquote>
        <blockquote className="bg-[var(--color-surface)] border-l-4 border-[var(--color-primary)] rounded-[var(--radius-md)] p-5">
          <p className="text-base italic leading-relaxed mb-2">
            „România are 19 milioane de cetățeni cu drepturi civice clar
            definite în OG 27/2002, dar majoritatea nu știu cum să le folosească.
            Civia face acest drept utilizabil."
          </p>
          <footer className="text-xs text-[var(--color-text-muted)]">
            — Echipa Civia
          </footer>
        </blockquote>
      </section>

      {/* Contact press */}
      <section aria-labelledby="contact" className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-12">
        <h2 id="contact" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3 flex items-center gap-2">
          <Mail size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          Contact press
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
          Pentru interviuri, comentarii, acces la date, demo-uri și parteneriate
          media. Răspundem în maxim <strong>48h</strong>.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:press@civia.ro?subject=Cerere presa Civia"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Mail size={14} aria-hidden="true" />
            press@civia.ro
          </a>
        </div>
      </section>

      {/* Last note */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Civia este platformă independentă · Misiunea: democratizarea informației
        civice · Open-source pe GitHub · Conform OG 27/2002
      </p>
    </div>
  );
}
