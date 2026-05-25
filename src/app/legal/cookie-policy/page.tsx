import type { Metadata } from "next";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Politica de cookies • Civia",
  description:
    "Ce cookies folosește Civia, de ce, cât timp se păstrează. Conformitate ePrivacy + GDPR + Cookie Banner EU 2025 (Austria parity ruling).",
  alternates: { canonical: `${SITE_URL}/legal/cookie-policy` },
};

// 2026-05-25 OPTIMIZATION: text legal nu se schimbă. force-static = zero ISR writes.
export const dynamic = "force-static";

export default function CookiePolicyPage() {
  return (
    <>
      <PageHero
        title="Politica de cookies"
        icon={Cookie}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Folosim cookies <strong>strict necesare</strong> pentru autentificare și{" "}
            <strong>opt-in</strong> pentru analytics. Niciodată tracking publicitar.
          </>
        }
        tagline="Transparență ePrivacy + GDPR"
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        <Section title="1. Ce sunt cookies?">
          <p>
            Cookies sunt fișiere mici de text salvate pe dispozitivul tău când vizitezi
            un site. Permit site-ului să te recunoască la următoarea vizită (sesiune
            de autentificare) și să-și aducă aminte preferințele tale.
          </p>
        </Section>

        <Section title="2. Ce cookies folosim">
          <h3 className="font-semibold mt-3 mb-1">🔒 Strict necesare (fără opt-in)</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              <code>sb-access-token</code>, <code>sb-refresh-token</code> — autentificare
              Supabase. HttpOnly, Secure, SameSite=Lax. Durată: 1 oră (refresh 30 zile).
            </li>
            <li>
              <code>civic_cookie_consent</code> — preferințele tale de cookies. localStorage.
              Durată: 12 luni.
            </li>
            <li>
              <code>civic_county</code> — județul ales (sticky redirect homepage). 6 luni.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">📊 Opt-in: Analytics (anonim)</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              <code>civia_vid</code> — ID anonim hash pentru analytics intern (Plausible-style).
              Niciodată trimis la third-party. Durată: 30 zile.
            </li>
            <li>
              Plausible cookies (dacă activate prin Vercel Analytics) — pageviews
              anonimizate, fără fingerprinting, no cross-site tracking.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">❌ NU folosim</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>Cookies publicitare (Google Ads, Facebook Pixel, etc.)</li>
            <li>Cross-site tracking (cookies third-party)</li>
            <li>Fingerprinting (canvas, audio context)</li>
            <li>Heatmaps cu replay (Hotjar, FullStory)</li>
          </ul>
        </Section>

        <Section title="3. Conformitate juridică">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>ePrivacy Directive 2002/58/CE</strong> + Legea 506/2004 (RO) — consimțământ
              prealabil pentru cookies non-esențiale
            </li>
            <li>
              <strong>GDPR Reg. (UE) 2016/679</strong> — bază legală: consimțământ (art. 6(1)(a))
              pentru analytics; interes legitim (art. 6(1)(f)) pentru securitate
            </li>
            <li>
              <strong>EU Austria 2025 ruling</strong> — Accept și Respinge trebuie să aibă
              paritate vizuală. ✓ Implementat în CookieBanner cu butoane egale.
            </li>
            <li>
              <strong>EU Court of Justice C-673/17 Planet49</strong> — pre-bifare interzisă.
              ✓ Toate toggle-urile pornesc OFF.
            </li>
          </ul>
        </Section>

        <Section title="4. Cum modifici preferințele">
          <p className="mb-3">
            Click pe <strong>„Cookies"</strong> în footer ca să redeschizi banner-ul de
            preferințe oricând. Sau:
          </p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Browser → Setări → Privacy → Cookies → permite ștergerea manuală</li>
            <li>
              Pentru opt-out global Plausible:{" "}
              <a href="https://plausible.io/data-policy" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                plausible.io/data-policy
              </a>
            </li>
          </ul>
        </Section>

        <Section title="5. Contact">
          <p>
            Întrebări despre cookies? Scrie la{" "}
            <a href="mailto:gdpr@civia.ro" className="text-[var(--color-primary)] hover:underline">
              gdpr@civia.ro
            </a>{" "}
            sau consultă{" "}
            <Link href="/legal/confidentialitate" className="text-[var(--color-primary)] hover:underline">
              Politica de confidențialitate
            </Link>{" "}
            completă.
          </p>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Versiune: 2.0 · Ultima actualizare: 24 mai 2026
        </p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3">{title}</h2>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
