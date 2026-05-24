import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, Mail } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "DPA pentru autorități • Civia",
  description:
    "Acordul de prelucrare a datelor (Data Processing Agreement) Civia ↔ autorități publice. GDPR art. 28.",
  alternates: { canonical: `${SITE_URL}/legal/dpa-autoritati` },
};

export const revalidate = 86400;

export default function DpaPage() {
  return (
    <>
      <PageHero
        title="DPA — Autorități publice"
        icon={FileSignature}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Acord de prelucrare a datelor (DPA) între <strong>Civia</strong> și autoritatea
            publică, în baza <strong>GDPR art. 28</strong>.
          </>
        }
        tagline="Template legal pentru primării + prefecturi"
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        <Section title="Cadru juridic">
          <p>
            Acest Acord de Prelucrare a Datelor (în continuare „DPA") este încheiat în baza{" "}
            <strong>art. 28 din Regulamentul (UE) 2016/679 (GDPR)</strong>, care obligă operatorul
            de date (autoritatea publică) să încheie un contract scris cu fiecare împuternicit
            (Civia, în acest caz) care prelucrează date personale în numele său.
          </p>
        </Section>

        <Section title="1. Părțile">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Operatorul</strong>: Autoritatea publică care primește sesizări de la
              cetățeni prin Civia (primărie, prefectură, poliție locală, etc.)
            </li>
            <li>
              <strong>Împuternicitul</strong>: Civia.ro (platformă civică independentă, operată
              de echipa de voluntari)
            </li>
            <li>
              <strong>Persoanele vizate</strong>: Cetățenii care depun sesizări către Operator
              prin Civia
            </li>
          </ul>
        </Section>

        <Section title="2. Categoriile de date prelucrate">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Date de identificare</strong>: nume + adresă cetățean (obligatorii pentru
              sesizarea civică, conform OG 27/2002)
            </li>
            <li>
              <strong>Date de contact</strong>: email cetățean
            </li>
            <li>
              <strong>Date de localizare</strong>: lat/lng locație problemă, locație text
            </li>
            <li>
              <strong>Conținut sesizare</strong>: text descriere, poze atașate
            </li>
            <li>
              <strong>Date tehnice</strong>: timestamp depunere, cod sesizare unic
            </li>
          </ul>
        </Section>

        <Section title="3. Durata prelucrării">
          <p>
            Civia păstrează datele cât timp sesizarea este activă (status ≠ rezolvat / respins /
            ignorat). După închidere status: 3 ani (conform <strong>Legea 138/2024 — arhivare
            documentelor administrative</strong>). După 3 ani: anonimizare automată (PII șters,
            statistici aggregate rămân).
          </p>
        </Section>

        <Section title="4. Subîmputerniciții (sub-processors)">
          <p className="mb-3">
            Civia folosește următorii furnizori procesori (toți EU sau cu Standard Contractual
            Clauses post-Schrems II):
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Supabase (Ireland EU)</strong> — Postgres + Auth + Storage
            </li>
            <li>
              <strong>Vercel (Frankfurt + Dublin EU)</strong> — hosting + edge
            </li>
            <li>
              <strong>Resend (Dublin EU)</strong> — email transactional + inbound
            </li>
            <li>
              <strong>Groq (US, SCC contract)</strong> — AI inferență (text doar, fără PII)
            </li>
            <li>
              <strong>Upstash Redis (Frankfurt EU)</strong> — rate limit cache
            </li>
            <li>
              <strong>Sentry (US, SCC contract)</strong> — error tracking cu PII scrubbing
            </li>
            <li>
              <strong>OpenStreetMap (Germany EU)</strong> — geocoding + map tiles
            </li>
          </ul>
        </Section>

        <Section title="5. Măsuri de securitate (GDPR art. 32)">
          <ul className="list-disc list-inside space-y-1">
            <li>Encryption at rest (Supabase default AES-256)</li>
            <li>TLS 1.3 încrypted in transit</li>
            <li>Row-Level Security pe toate tabelele cu date personale</li>
            <li>PII scrubbing automatizat pe Sentry (emails, telefoane, coduri sesizari)</li>
            <li>Rate limiting pentru toate endpoint-urile sensibile</li>
            <li>Audit log (RLS policy logs) pentru acțiuni admin</li>
            <li>2FA disponibil opțional</li>
            <li>Bug bounty + responsible disclosure prin GitHub</li>
            <li>Backup zilnic + point-in-time recovery 7 zile</li>
            <li>Penetration test anual extern (planificat 2026 Q4)</li>
          </ul>
        </Section>

        <Section title="6. Drepturile persoanelor vizate">
          <p className="mb-3">
            Cetățenii pot exercita oricând:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Acces la date (art. 15 GDPR) — prin <Link href="/cont" className="text-[var(--color-primary)] hover:underline">/cont → Export JSON</Link>
            </li>
            <li>
              Rectificare (art. 16) — editare profil
            </li>
            <li>
              Ștergere (art. 17 „dreptul de a fi uitat") — /api/profile/delete cu cascade
            </li>
            <li>
              Restricția prelucrării (art. 18) — opt-out global din profil
            </li>
            <li>
              Portabilitate (art. 20) — export JSON full
            </li>
            <li>
              Opoziție (art. 21) — opt-out tracking + analytics
            </li>
            <li>
              Refuzul deciziilor automate (art. 22) — toate clasificările AI sunt confirmate
              de user; nicio decizie 100% automată
            </li>
          </ul>
        </Section>

        <Section title="7. Notificare incidente">
          <p>
            Civia notifică Operatorul în <strong>maxim 72 ore</strong> de la descoperirea unui
            incident de securitate (conform GDPR art. 33). Procedura documentată internă +
            template comunicat ANSPDCP.
          </p>
        </Section>

        <Section title="8. Audit + verificări">
          <p>
            Operatorul poate solicita audit independent o dată pe an, cu notificare 30 zile în
            avans. Civia furnizează raport SOC2 Type II echivalent (în pregătire 2026 Q4) +
            policy documentation.
          </p>
        </Section>

        <Section title="9. Semnare contract">
          <p className="mb-3">
            Acest template e baza. Pentru contract personalizat cu primaria dvs., contactați:
          </p>
          <a
            href="mailto:dpa@civia.ro?subject=Cerere%20DPA%20oficial"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Mail size={16} aria-hidden="true" />
            dpa@civia.ro
          </a>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Răspundem în 5 zile lucrătoare cu document PDF semnabil electronic (eIDAS).
          </p>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Versiune template: 1.0 · Conformitate: GDPR art. 28 + Legea 190/2018
        </p>
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
