import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, Mail, Shield, ArrowRight } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_NAME } from "@/lib/constants";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: `Pentru primării și autorități • ${SITE_NAME}`,
  description:
    "Civia oferă primăriilor un portal gratuit pentru a vedea sesizările cetățenilor, a răspunde direct și a marca rezolvarea. Fără cost. Cont oficial verificabil.",
  alternates: { canonical: `${SITE_URL}/autoritati` },
  openGraph: {
    title: "Portalul autorităților Civia",
    description: "Primării — vedeți și răspundeți la sesizările cetățenilor direct în Civia. Gratuit.",
    url: `${SITE_URL}/autoritati`,
    type: "website",
    locale: "ro_RO",
  },
};

export const revalidate = 86400;

export default function AutoritatiPage() {
  return (
    <>
      <PageHero
        title="Portal pentru autorități"
        icon={Building2}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Primării, prefecturi, poliție locală — vedeți sesizările cetățenilor din jurisdicția dvs.,
            răspundeți direct, marcați rezolvarea.{" "}
            <strong>Gratuit. Fără publicitate. Date deschise.</strong>
          </>
        }
        tagline="OG 27/2002 art. 8 — Răspunsul în 30 de zile devine simplu"
      />

      <div className="container-narrow space-y-10 pb-16">
        {/* CE OBȚII */}
        <section className="grid md:grid-cols-2 gap-4">
          <FeatureCard
            icon={Mail}
            title="Inbox cu sesizări din jurisdicția ta"
            text="Toate sesizările cetățenilor care vă privesc (după județ + sector + tip) într-o singură listă. Filtrabile pe status, dată, vot public."
          />
          <FeatureCard
            icon={CheckCircle2}
            title="Răspuns direct în 1-click"
            text={`Marchezi „în lucru", „rezolvat", „amânat" cu un click. Cetățeanul primește notificare automat. Răspuns conform OG 27/2002 art. 8.`}
          />
          <FeatureCard
            icon={Shield}
            title="Cont oficial verificabil"
            text={`Domeniu instituțional verificat (primarias3.ro, prefectura.ro, etc.). Insignă „Verificat de Civia" lângă răspunsurile dumneavoastră.`}
          />
          <FeatureCard
            icon={Building2}
            title="Statistici publice transparente"
            text="Rata răspuns, timpul mediu de rezolvare, sesizări soluționate — toate apar pe profilul autorității. Cetățenii văd, partidul vede, presa vede."
          />
        </section>

        {/* CUM FUNCȚIONEAZĂ */}
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-4">Cum primești cont</h2>
          <ol className="space-y-3 text-sm">
            <Step n={1} title="Cerere cont">
              Trimiteți o cerere pe pagina <Link href="/autoritati/inregistrare" className="text-[var(--color-primary)] underline hover:no-underline">/autoritati/inregistrare</Link> de pe emailul oficial (@primaria*.ro, @prefectura*.ro, etc.).
            </Step>
            <Step n={2} title="Verificare manuală Civia">
              Echipa Civia verifică emailul + autoritatea în maximum 48h.
              Confirmăm pe adresa oficială.
            </Step>
            <Step n={3} title="Acces la dashboard">
              Primiți un magic link. Logați-vă la <code className="text-xs bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">/admin/primarie</code> și vedeți toate sesizările din jurisdicția dumneavoastră.
            </Step>
            <Step n={4} title="Răspundeți și rezolvați">
              Inline status changes, upload poză rezolvare, comentariu către cetățean. Totul devine timeline public.
            </Step>
          </ol>
        </section>

        {/* CTA */}
        <section className="text-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-gradient-to-br from-emerald-500/10 via-[var(--color-surface)] to-cyan-500/5 p-7 md:p-10">
          <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-2">
            Începeți acum
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-6 max-w-xl mx-auto">
            Sesizările legale (OG 27/2002) trebuie răspunse în 30 de zile.
            Civia vă ajută să faceți asta eficient. Pentru cetățenii dumneavoastră.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/autoritati/inregistrare"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              Solicită cont oficial
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="mailto:autoritati@civia.ro?subject=Întrebare%20cont%20instituție"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-full)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold hover:bg-[var(--color-surface-2)] transition-colors"
            >
              Întreabă cu emailul
            </Link>
          </div>
        </section>

        <p className="text-xs text-[var(--color-text-muted)] text-center leading-relaxed">
          Civia e platformă civică INDEPENDENTĂ. Open-source, non-profit, fără capital de partid.
          Pentru întrebări: <a href="mailto:autoritati@civia.ro" className="text-[var(--color-primary)] hover:underline">autoritati@civia.ro</a>.
        </p>
      </div>
    </>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <Icon size={22} className="text-[var(--color-primary)] mb-3" aria-hidden="true" />
      <h3 className="font-semibold text-base mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold inline-flex items-center justify-center">
        {n}
      </span>
      <div>
        <p className="font-semibold text-sm mb-0.5">{title}</p>
        <p className="text-[var(--color-text-muted)] leading-relaxed text-sm">{children}</p>
      </div>
    </li>
  );
}
