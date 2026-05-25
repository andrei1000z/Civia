import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ShieldCheck, EyeOff, Clock, Mail } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Analiza traficului • Civia",
  description:
    "Cum măsurăm trafic pe Civia: vizitatori anonimi prin daily-salt hash, zero cookie-uri, zero localStorage tracking, conform CNIL Sheet 16 + EDPB Guidelines 2/2023 + Legea 506/2004.",
  alternates: { canonical: `${SITE_URL}/legal/analiza-trafic` },
};

export const dynamic = "force-static";

export default function AnalizaTraficPage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <PageHero
        title="Cum măsurăm traficul"
        icon={BarChart3}
        gradient={HERO_GRADIENT.data}
        backHref="/"
        backLabel="Înapoi acasă"
        description={
          <>
            <strong>Zero cookie-uri</strong>, zero localStorage tracking,
            zero cross-site sharing. Doar contoare anonime care expiră în 24h.
          </>
        }
        tagline="Conformitate CNIL Sheet 16 + EDPB Guidelines 2/2023"
      />

      <div className="space-y-4 mt-6">
        <Section title="1. Ce nu folosim" icon={EyeOff}>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              <strong>Nu folosim cookie-uri</strong> pentru analytics (nici primary, nici third-party)
            </li>
            <li>
              <strong>Nu stocăm UUID persistent</strong> în localStorage / sessionStorage / IndexedDB
              pentru a urmări utilizatori cross-session
            </li>
            <li>
              <strong>Nu trimitem date</strong> către Google Analytics, Facebook Pixel, Mixpanel sau orice
              alt furnizor third-party de analytics
            </li>
            <li>
              <strong>Nu profilăm</strong> utilizatori cross-site (nu există tracking pixel embedabil)
            </li>
            <li>
              <strong>Nu păstrăm adresa IP raw</strong> niciodată în baza de date sau loguri
            </li>
            <li>
              <strong>Nu folosim fingerprinting</strong> (canvas, audio context, font enumeration, etc.)
            </li>
          </ul>
        </Section>

        <Section title="2. Cum derivăm vizitatorul anonim" icon={ShieldCheck}>
          <p className="mb-3">
            La fiecare cerere către <code>/api/analytics</code>, server-ul Civia calculează un identifier
            de vizitator anonim folosind formula:
          </p>
          <pre className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 text-xs overflow-x-auto font-mono">
{`visitor_id = sha256(daily_salt + host + ip + ua).slice(0, 16)`}
          </pre>
          <p className="mt-3">
            <strong>Salt-ul rotează la 24h</strong> și este șters automat din Redis după 26h.
            Odată ce salt-ul e șters, hash-ul devine matematic <strong>ireversibil</strong> — nu
            mai există nicio cale prin care să-ți reidentificăm sesiunea.
          </p>
          <p className="mt-3">
            Raw IP și User-Agent sunt folosite <strong>doar la momentul calculării hash-ului</strong>
            {" "}și aruncate imediat. Niciodată persistate.
          </p>
          <p className="mt-3 text-xs text-[var(--color-text-muted)] italic">
            Acest mecanism a fost validat juridic de Plausible Analytics (model de referință) și
            este aliniat cu interpretarea CNIL (Sheet 16) pentru excepția de la consimțământ.
          </p>
        </Section>

        <Section title="3. Ce câmpuri capturăm" icon={BarChart3}>
          <p className="mb-3">Date strict tehnice, aggregate ca contoare în Redis:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <Field label="Pathname" desc="ruta din URL (ex: /sesizari)" />
            <Field label="Referrer" desc="domeniul de unde vii (ex: google.com)" />
            <Field label="Țară" desc="derivată din IP, prin Vercel (RO/EU/etc.)" />
            <Field label="Oraș" desc="derivat din IP, doar EU (de ex. București)" />
            <Field label="Browser" desc="Chrome / Firefox / Safari / Edge" />
            <Field label="OS" desc="Windows / macOS / iOS / Android / Linux" />
            <Field label="Device" desc="desktop / mobile / tablet" />
            <Field label="Viewport" desc="bucket xs/sm/md/lg/xl/2xl" />
            <Field label="Limbă browser" desc="navigator.language (ex: ro-RO)" />
            <Field label="Color scheme" desc="dark/light preference" />
            <Field label="Connection" desc="2G/3G/4G/wifi (când e expus)" />
            <Field label="UTM params" desc="utm_source/medium/campaign/content/term" />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 italic">
            Niciun câmp listat aici NU permite reidentificarea ta. Aggregat la nivel de pagină
            sau county, nu individual.
          </p>
        </Section>

        <Section title="4. Cât timp păstrăm datele" icon={Clock}>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              <strong>Daily salt</strong> — 26h (TTL Redis), apoi șters automat → hash-ul devine ireversibil
            </li>
            <li>
              <strong>Counter-uri pageview / device</strong> — 90 zile rolling, șterse automat la rotația buckets
            </li>
            <li>
              <strong>Events stream (recent)</strong> — 7 zile, ștergere automată LTRIM + EXPIRE
            </li>
            <li>
              <strong>Web Vitals samples</strong> — 14 zile (reservoir sampling pentru percentile)
            </li>
            <li>
              <strong>Vizitatori recenți (admin /sessions)</strong> — 7 zile backstop, prune la 1000
            </li>
            <li>
              <strong>Daily Active Users counter</strong> — 90 zile (pentru cohort analysis)
            </li>
            <li>
              <strong>Monthly Active Users counter</strong> — 90 zile
            </li>
            <li>
              <strong>Aggregate trends (luni)</strong> — păstrate indefinit (zero PII după rollup)
            </li>
          </ul>
        </Section>

        <Section title="5. Filtre anti-bot și anti-spam" icon={ShieldCheck}>
          <p className="mb-3">
            Pentru a păstra metricile reale, server-ul Civia filtrează automat:
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
            <li>User-Agent care declară explicit „bot", „crawler", „spider", „scraper"</li>
            <li>Tooluri headless (Selenium, Playwright, Puppeteer, Phantom, curl, wget)</li>
            <li>Crawlere mari (Googlebot, Bingbot, AhrefsBot, etc.)</li>
            <li>Cereri fără header <code>Accept-Language</code> (real browsers îl trimit mereu)</li>
            <li>UA-uri suspect de scurte (sub 20 caractere)</li>
            <li>Pattern-uri behavioral suspecte (multi-events sub 200ms, semn de bot)</li>
          </ul>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 italic">
            Sursă: bot traffic în 2025 = 51% din internet total (Imperva Bad Bot Report).
          </p>
        </Section>

        <Section title="6. Opt-out — nu vreau să fiu numărat" icon={EyeOff}>
          <p className="mb-3">
            Poți să te excluzi complet din analytics. Două opțiuni:
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>
              <strong>Flag local (instantaneu, no signup)</strong>:
              <br />
              Deschide DevTools (F12) → Console și rulează:
              <pre className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-2 mt-2 text-xs font-mono inline-block">
{`localStorage.setItem("civia_exclude_tracking", "1")`}
              </pre>
              <br />
              Acest flag se setează DOAR de tine, nu de Civia — outside scope ePrivacy.
            </li>
            <li>
              <strong>Cere ștergere completă</strong> dacă ești user logat:
              <br />
              <Link
                href="/cont"
                className="text-[var(--color-primary)] hover:underline"
              >
                /cont → Datele mele → Șterge contul
              </Link>{" "}
              (cascadează automat și asupra analytics)
            </li>
          </ol>
        </Section>

        <Section title="7. Cadru legal" icon={ShieldCheck}>
          <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
            <li>
              <strong>ePrivacy Directive 2002/58/CE</strong> + <strong>Legea 506/2004</strong> (RO) art. 4(5) —
              consimțământ necesar DOAR pentru stocare pe terminal. Civia nu stochează nimic → exempt.
            </li>
            <li>
              <strong>GDPR Reg. (UE) 2016/679</strong> — hash-ul devine ireversibil după 24h → datele
              ies din scopul GDPR (nu mai sunt date cu caracter personal).
            </li>
            <li>
              <strong>EDPB Guidelines 2/2023</strong> (final Oct 2024) — confirmă că „cookieless" alone nu
              e suficient; Civia merge mai departe cu zero device storage.
            </li>
            <li>
              <strong>CNIL Sheet 16</strong> — Civia respectă toate cele 8 condiții pentru excepția de la
              consimțământ (audience measurement, no cross-dataset joining, IP truncation, ≤13 luni
              tracker lifetime, per-publisher isolation).
            </li>
            <li>
              <strong>ANSPDCP</strong> — autoritatea română de protecție a datelor. Civia poate justifica
              structural că nu există stocare pe terminal.
            </li>
          </ul>
        </Section>

        <Section title="8. Cum răspundem la cereri GDPR" icon={Mail}>
          <p className="mb-3">
            Scrie la{" "}
            <a href="mailto:gdpr@civia.ro" className="text-[var(--color-primary)] hover:underline">
              gdpr@civia.ro
            </a>{" "}
            pentru:
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
            <li>
              <strong>Dreptul la informare (Art. 13-14)</strong> — informații despre prelucrare
              (asta e pagina pe care o citești)
            </li>
            <li>
              <strong>Dreptul de acces (Art. 15)</strong> — ce date avem despre tine
              (răspuns &lt;30 zile; pentru analytics anonimizate, răspunsul e „nimic identificabil")
            </li>
            <li>
              <strong>Dreptul la ștergere (Art. 17)</strong> — purge analytics + cont. Procesat
              automat la cont delete, sau manual prin endpoint admin pentru utilizatori specifici.
            </li>
            <li>
              <strong>Dreptul la portabilitate (Art. 20)</strong> — export sesizările tale ca JSON.{" "}
              <Link
                href="/cont"
                className="text-[var(--color-primary)] hover:underline"
              >
                /cont → Export date
              </Link>
            </li>
            <li>
              <strong>Plângere la ANSPDCP</strong> —{" "}
              <a
                href="https://www.dataprotection.ro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] hover:underline"
              >
                dataprotection.ro
              </a>{" "}
              dacă crezi că Civia nu respectă GDPR
            </li>
          </ul>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Versiune: 1.0 · Ultima actualizare: 25 mai 2026
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3 inline-flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] grid place-items-center"
          aria-hidden="true"
        >
          <Icon size={14} />
        </span>
        {title}
      </h2>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] p-2">
      <p className="font-mono font-semibold text-[var(--color-text)]">{label}</p>
      <p className="text-[var(--color-text-muted)] mt-0.5">{desc}</p>
    </div>
  );
}
