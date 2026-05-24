import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Mail, AlertTriangle, CheckCircle2, Bug } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Securitate & Responsible Disclosure • Civia",
  description:
    "Politica Civia de responsible disclosure pentru vulnerabilități de securitate. Hall of Fame. Severity scale. Bug bounty program (recompense în pregătire).",
  alternates: { canonical: `${SITE_URL}/security` },
};

export const revalidate = 86400;

export default function SecurityPage() {
  return (
    <>
      <PageHero
        title="Securitate & Disclosure"
        icon={Shield}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Găsești o vulnerabilitate? <strong>Mulțumim că ne ajuți să fim mai sigure.</strong>{" "}
            Aici găsești politica noastră de responsible disclosure și severity scale.
          </>
        }
        tagline="security.txt + hall of fame"
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        <Section title="🚨 Raportează urgent">
          <p className="mb-3">
            Pentru vulnerabilități cu impact <strong>critical</strong> sau{" "}
            <strong>high</strong> (RCE, SQL injection, leak masiv PII, takeover cont):
          </p>
          <a
            href="mailto:security@civia.ro?subject=%5BSECURITY%5D%20"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
          >
            <Mail size={18} aria-hidden="true" />
            security@civia.ro
          </a>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Răspundem în <strong>maximum 24h</strong> (zile lucrătoare). Pentru raportări non-urgente,
            poți deschide și issue pe{" "}
            <a href="https://github.com/andrei1000z/Civia/security" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
              GitHub Security
            </a>.
          </p>
        </Section>

        <Section title="📜 Politică (Safe Harbor)">
          <p className="mb-3">
            Civia se angajează să nu inițieze acțiuni legale împotriva cercetătorilor de
            securitate care:
          </p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Fac descoperirea în <strong>good faith</strong></li>
            <li>NU exfiltrează / nu publică PII real al cetățenilor</li>
            <li>NU disruptează serviciul (DoS, race-condition exploits)</li>
            <li>NU folosesc credentialele altora</li>
            <li>Raportează prompt (NU vând la third party)</li>
            <li>Așteaptă fix-ul nostru înainte de publicare (90 zile coordinated disclosure)</li>
          </ul>
          <p className="mt-3 text-sm">
            Inspirat de <a href="https://disclose.io/" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">disclose.io</a> Safe Harbor template.
          </p>
        </Section>

        <Section title="🎯 Scope">
          <h3 className="font-semibold mb-2">În scope:</h3>
          <ul className="list-disc list-inside space-y-1 mb-4">
            <li><code>civia.ro</code> + subdomenii</li>
            <li><code>*.civia.ro</code> (status, api, etc.)</li>
            <li>API public (<code>/api/v1/*</code>, <code>/api/v2/*</code>)</li>
            <li>Open311 endpoints</li>
            <li>Cod open-source pe <a href="https://github.com/andrei1000z/Civia" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          </ul>
          <h3 className="font-semibold mb-2">Out of scope:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Self-hosted instanțe Civia (responsabilitatea host-ului)</li>
            <li>Servicii third-party (Supabase, Resend, Groq) — raportează direct la ei</li>
            <li>Rate limit „abuse" — designul nostru tolerează, nu e vulnerabilitate</li>
            <li>Email spoofing fără DMARC bypass (DMARC e activ)</li>
            <li>UX issues, typo-uri, dark mode contrast — folosește feedback general</li>
            <li>Lipsă HTTPS pe pagini publice statice fără cookies (nu există)</li>
          </ul>
        </Section>

        <Section title="📊 Severity Scale">
          <div className="space-y-3">
            <SeverityRow
              level="critical"
              examples="RCE, SQL injection cu data exfil, full DB dump, takeover admin"
              response="24h"
              reward="100 USD (în pregătire)"
            />
            <SeverityRow
              level="high"
              examples="XSS persistent admin, IDOR cu PII multi-user, privilege escalation"
              response="3 zile"
              reward="50 USD (în pregătire)"
            />
            <SeverityRow
              level="medium"
              examples="XSS stored user-self, CSRF, info disclosure non-PII, IDOR self"
              response="7 zile"
              reward="Mențiune Hall of Fame"
            />
            <SeverityRow
              level="low"
              examples="Open redirect, clickjacking minor, header misconfig"
              response="14 zile"
              reward="Mențiune Hall of Fame"
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-3">
            <strong>Reward program:</strong> În pregătire (lansare 2026 Q4). Civia e non-profit
            volunteer-run; bugurile critice până atunci primesc mențiune + opțional t-shirt Civia
            + scrisoare de recomandare.
          </p>
        </Section>

        <Section title="🏆 Hall of Fame">
          <p className="text-sm text-[var(--color-text-muted)]">
            Cercetători care au raportat responsabil vulnerabilități la Civia. (Lista se
            populează cu primele raportări — fii primul!)
          </p>
          <div className="mt-4 p-6 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-center">
            <Bug size={32} className="mx-auto mb-2 text-[var(--color-text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-text-muted)]">
              Lista goală. Vrei să fii primul în Hall of Fame?
            </p>
          </div>
        </Section>

        <Section title="🔐 Ce am implementat deja">
          <p className="mb-2 text-sm">
            Înainte să raportezi, vezi ce avem deja securizat:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>HSTS (max-age=63072000; includeSubDomains; preload)</li>
            <li>CSP cu nonce mode (în migrare de la unsafe-inline)</li>
            <li>Permissions-Policy: interest-cohort=() (FLoC opt-out)</li>
            <li>X-Content-Type-Options: nosniff</li>
            <li>Referrer-Policy: strict-origin-when-cross-origin</li>
            <li>Supabase RLS pe toate tabelele user-data</li>
            <li>Rate limiting Upstash Redis pe POST endpoints</li>
            <li>Honeypot fields pe forms publice</li>
            <li>Sentry PII scrubbing (emails, telefoane, sesizare codes)</li>
            <li>Webhook signatures (HMAC timing-safe verify)</li>
            <li>File upload — MIME + magic bytes + size cap</li>
            <li>Zod validation pe toate POST endpoints</li>
            <li>JsonLd HTML escape extended (U+2028, U+2029)</li>
            <li>Encryption at rest (Supabase AES-256)</li>
            <li>TLS 1.3 in transit</li>
            <li>2FA disponibil pe Supabase Auth</li>
          </ul>
        </Section>

        <Section title="📅 SLA & Comitamente">
          <ul className="list-disc list-inside space-y-1.5 text-sm">
            <li>Răspuns inițial: <strong>≤ 24h</strong> (zile lucrătoare)</li>
            <li>Triage + acknowledgment: <strong>≤ 3 zile</strong></li>
            <li>Fix critical: <strong>≤ 7 zile</strong></li>
            <li>Fix high: <strong>≤ 14 zile</strong></li>
            <li>Fix medium: <strong>≤ 30 zile</strong></li>
            <li>Fix low: <strong>≤ 90 zile</strong> sau prioritate următoare</li>
            <li>Public disclosure: cu acord, 30-90 zile după fix</li>
          </ul>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Vezi și <Link href="/.well-known/security.txt" className="text-[var(--color-primary)] hover:underline">security.txt</Link> pentru contact machine-readable (RFC 9116).
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

function SeverityRow({
  level,
  examples,
  response,
  reward,
}: {
  level: "critical" | "high" | "medium" | "low";
  examples: string;
  response: string;
  reward: string;
}) {
  const config = {
    critical: { Icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/30", label: "Critical" },
    high: { Icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "High" },
    medium: { Icon: AlertTriangle, color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-500/30", label: "Medium" },
    low: { Icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Low" },
  }[level];
  return (
    <div className={`flex flex-col sm:flex-row gap-3 sm:items-center rounded-[var(--radius-xs)] border ${config.bg} p-3`}>
      <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${config.color} sm:w-24 shrink-0`}>
        <config.Icon size={14} aria-hidden="true" />
        {config.label}
      </span>
      <div className="text-xs flex-1">
        <p className="text-[var(--color-text)]">{examples}</p>
        <p className="text-[var(--color-text-muted)] mt-1">
          SLA răspuns: <strong>{response}</strong> · Reward: <strong>{reward}</strong>
        </p>
      </div>
    </div>
  );
}
