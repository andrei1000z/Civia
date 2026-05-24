import type { Metadata } from "next";
import { ShieldAlert, Mail, Lock, AlertTriangle } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Whistleblower • Civia",
  description:
    "Canal sigur pentru raportare anonimă a abuzurilor instituționale, corupției, neregulilor administrative. Conform Legii 361/2022 transpunere Directiva UE 2019/1937.",
  alternates: { canonical: `${SITE_URL}/whistleblower` },
  robots: { index: true, follow: false },
};

export const revalidate = 86400;

export default function WhistleblowerPage() {
  return (
    <>
      <PageHero
        title="Whistleblower"
        icon={ShieldAlert}
        gradient={HERO_GRADIENT.warning}
        description={
          <>
            Canal <strong>sigur și anonim</strong> pentru raportarea abuzurilor instituționale,
            corupției, neregulilor administrative.
          </>
        }
        tagline="Conform Legii 361/2022 + Directiva UE 2019/1937"
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        <section className="rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/5 p-5 md:p-7">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-base mb-2">⚠️ Acesta NU e canal de urgență</h2>
              <p className="text-sm">
                Pentru <strong>pericol iminent</strong> (vieți, bunuri, mediu): sună <strong>112</strong>.
                Pentru <strong>vulnerabilități tehnice Civia</strong>: <a href="/security" className="text-[var(--color-primary)] hover:underline">/security</a>.
                Pentru <strong>încălcări cod conduită</strong> Civia: <a href="/legal/cod-de-conduita" className="text-[var(--color-primary)] hover:underline">/legal/cod-de-conduita</a>.
              </p>
            </div>
          </div>
        </section>

        <Section title="🎯 Ce poți raporta aici">
          <ul className="list-disc list-inside space-y-1">
            <li>Corupție / luare de mită în instituții publice</li>
            <li>Mită cerută de funcționari pentru servicii publice</li>
            <li>Falsificare documente publice</li>
            <li>Cheltuirea inadecvată a banilor publici</li>
            <li>Nereguli în procedurile de achiziții publice</li>
            <li>Conflicte de interese nedeclarate</li>
            <li>Discriminare sistemică la nivel instituțional</li>
            <li>Încălcări GDPR de către instituții publice</li>
            <li>Hărțuire sau abuz de putere</li>
          </ul>
        </Section>

        <Section title="🔒 Cum protejăm identitatea ta">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>Anonimitate completă opțională</strong> — NU cerem nume sau date contact
              dacă nu vrei
            </li>
            <li>
              <strong>Encryption</strong> — emailurile la <code>whistleblower@civia.ro</code> sunt
              criptate AES-256 la rest. Doar 2 administratori senior Civia au acces.
            </li>
            <li>
              <strong>Audit log</strong> — orice acces la raportare e logged
            </li>
            <li>
              <strong>Fără IP tracking</strong> — pe acest canal nu logăm IP-uri în Sentry
            </li>
            <li>
              <strong>Comunicare prin Tor</strong> (opțional) — vezi instrucțiuni mai jos
            </li>
            <li>
              <strong>Retenție</strong>: raportarea ta se șterge la 18 luni după închiderea cazului
            </li>
          </ul>
        </Section>

        <Section title="📜 Protecție legală (Legea 361/2022)">
          <p className="mb-3">
            Legea 361/2022 (transpunere Directiva UE 2019/1937) îți garantează:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Protecție împotriva represaliilor</strong>: nu poți fi concediat, retrogradat,
              sancționat pentru raportare de bună-credință
            </li>
            <li>
              <strong>Confidențialitate obligatorie</strong> a identității tale
            </li>
            <li>
              <strong>Dreptul de a primi feedback</strong> pe raportare în max 3 luni
            </li>
            <li>
              <strong>Drept de a face raportare</strong> direct la autoritățile competente
              (ANI, DNA, DIICOT, Poliție) sau prin canale interne (Civia)
            </li>
          </ul>
        </Section>

        <Section title="📧 Cum raportezi">
          <p className="mb-3">
            <strong>Email anonim recomandat:</strong>
          </p>
          <a
            href="mailto:whistleblower@civia.ro?subject=Raportare%20confiden%C8%9Bial%C4%83"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors mb-3"
          >
            <Mail size={18} aria-hidden="true" />
            whistleblower@civia.ro
          </a>
          <p className="text-sm text-[var(--color-text-muted)]">
            Pentru anonimitate maximă, folosește un email burner (ProtonMail anonim,{" "}
            <a href="https://tutanota.com" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">Tutanota</a>{" "}
            etc.) și conectează-te prin Tor browser sau VPN.
          </p>
        </Section>

        <Section title="📝 Ce să incluzi în raportare">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Ce s-a întâmplat</strong> — fapte concrete, fără speculații
            </li>
            <li>
              <strong>Cine</strong> e implicat (nume + funcție, dacă știi)
            </li>
            <li>
              <strong>Unde + când</strong> — locație + perioadă
            </li>
            <li>
              <strong>Dovezi</strong> — documente, poze, capturi de ecran, mesaje (anonimizate
              dacă conțin PII al tău)
            </li>
            <li>
              <strong>Martori</strong> (dacă există)
            </li>
            <li>
              <strong>Cum vrei să te contactăm</strong> (alias email, sau nu deloc)
            </li>
          </ul>
        </Section>

        <Section title="🚨 Ce facem cu raportarea ta">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Primim + criptăm imediat</li>
            <li>Triage în 48h de 2 administratori senior</li>
            <li>Investigăm intern OR redirecționăm către autoritate competentă:
              <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                <li><strong>ANI</strong> — Agenția Națională de Integritate (conflicte interese)</li>
                <li><strong>DNA</strong> — Direcția Națională Anticorupție</li>
                <li><strong>DIICOT</strong> — Direcția de Investigare a Infracțiunilor de Criminalitate Organizată</li>
                <li><strong>Poliția</strong> — pentru infracțiuni mai mici</li>
                <li><strong>ANSPDCP</strong> — pentru încălcări GDPR</li>
              </ul>
            </li>
            <li>Răspuns către tine (alias email) în max 3 luni cu update</li>
            <li>Civia poate face follow-up public, anonimizat, dacă există interes public major</li>
          </ol>
        </Section>

        <Section title="🌐 Alte canale oficiale">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <a href="https://www.ani.integritate.eu" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                ANI — Agenția Națională de Integritate
              </a>
            </li>
            <li>
              <a href="https://www.pna.ro" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                DNA — Direcția Națională Anticorupție
              </a>
            </li>
            <li>
              <a href="https://avp.ro" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                Avocatul Poporului
              </a>
            </li>
            <li>
              <a href="https://www.dataprotection.ro" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                ANSPDCP (GDPR)
              </a>
            </li>
          </ul>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6 flex items-center justify-center gap-2">
          <Lock size={12} aria-hidden="true" />
          Civia respectă confidențialitatea ta. Suntem independenți, nu există presiuni politice.
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
