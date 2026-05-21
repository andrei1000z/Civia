import Link from "next/link";
import Image from "next/image";
import { SITE_NAME } from "@/lib/constants";
import { CookiePreferencesButton } from "./FooterClientLinks";
import { FooterFeedback } from "./FooterFeedback";

// Internal-linking block — top 10 jude prin populatie + actiuni
// principale. Imbunatateste PageRank flow (item #34 audit) + ofera
// quick discovery la noii vizitatori.
const TOP_COUNTIES = [
  { slug: "b", name: "București" },
  { slug: "cj", name: "Cluj" },
  { slug: "tm", name: "Timiș" },
  { slug: "is", name: "Iași" },
  { slug: "ct", name: "Constanța" },
  { slug: "bv", name: "Brașov" },
  { slug: "dj", name: "Dolj" },
  { slug: "gl", name: "Galați" },
  { slug: "pr", name: "Prahova" },
  { slug: "mh", name: "Mureș" },
];

const linkCls =
  "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors";

export function Footer() {
  return (
    <footer className="bg-[var(--color-surface-soft)] border-t border-[var(--color-border)] mt-auto">
      <div className="container-narrow py-12">
        {/* 3 columns: Brand · Despre Civia · Urmărește Civia.
            Tot pe același rând, simetric, mobile-stack 1-col. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Column 1 — Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <span
                aria-hidden="true"
                className="relative w-10 h-10 rounded-[var(--radius-button)] bg-gradient-to-br from-[var(--color-primary)] to-emerald-900 grid place-items-center shadow-[0_4px_14px_-2px_rgba(5,150,105,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] group-hover:scale-105 transition-transform"
              >
                <svg viewBox="0 0 32 32" className="w-7 h-7 -mt-px" aria-hidden="true">
                  <text
                    x="16"
                    y="22"
                    textAnchor="middle"
                    fontFamily="var(--font-sora), system-ui, sans-serif"
                    fontWeight="700"
                    fontSize="22"
                    fill="white"
                  >
                    C
                  </text>
                </svg>
              </span>
              <span className="font-[family-name:var(--font-sora)] font-bold text-lg">
                {SITE_NAME}
              </span>
            </Link>
            <p className="text-sm text-[var(--color-text-muted)] mb-3 max-w-xs leading-relaxed">
              Platformă civică independentă, gratuită.
              <br />
              Făcută cu <span className="text-rose-500" aria-label="dragoste">❤️</span> pentru o Românie ca afară.
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
              <span aria-hidden="true">🇪🇺</span>
              <span>Date stocate în UE · GDPR-compliant</span>
            </p>
          </div>

          {/* Column 2 — Despre Civia (legal only — API scos la cerere user 5/12/2026) */}
          <div>
            <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
              Despre Civia
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/clasament" className={linkCls}>Clasament Fix Score</Link></li>
              <li><Link href="/legal/confidentialitate" className={linkCls}>Confidențialitate și GDPR</Link></li>
              <li><Link href="/legal/termeni" className={linkCls}>Termenii de utilizare</Link></li>
              <li><CookiePreferencesButton /></li>
            </ul>
          </div>

          {/* Column 3 — Urmărește Civia (social media, una sub alta) */}
          <div>
            <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
              Urmărește Civia
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="https://bsky.app/profile/civiaro.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Bluesky — @civiaro.bsky.social"
                  className="inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] w-fit"
                >
                  <Image
                    src="/bluesky.png"
                    alt="Bluesky"
                    width={24}
                    height={24}
                    unoptimized
                    className="w-6 h-6 rounded-full object-contain bg-white"
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-[var(--color-text)]">Bluesky</span>
                    <span className="text-[var(--color-text-muted)]"> · @civiaro</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="https://eyou.social/u/civia"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="eYou — @civia"
                  className="inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] w-fit"
                >
                  <Image
                    src="/eyou.webp"
                    alt="eYou"
                    width={24}
                    height={24}
                    unoptimized
                    className="w-6 h-6 rounded-full object-contain bg-white"
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-[var(--color-text)]">eYou</span>
                    <span className="text-[var(--color-text-muted)]"> · @civia</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Top judete + actiuni principale — SEO internal linking.
            Bumps PageRank flow toward county pages (audit item #34). */}
        <div className="mt-10 pt-8 border-t border-[var(--color-border)]">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3">
            Județe & orașe
          </h4>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm mb-6">
            {TOP_COUNTIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} className={linkCls}>
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/judete" className={linkCls}>
                Toate cele 42 →
              </Link>
            </li>
          </ul>
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3">
            Acțiuni rapide
          </h4>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            <li><Link href="/sesizari" className={linkCls}>Fă o sesizare</Link></li>
            <li><Link href="/petitii" className={linkCls}>Semnează petiții</Link></li>
            <li><Link href="/stiri" className={linkCls}>Știri civice</Link></li>
            <li><Link href="/ghiduri" className={linkCls}>Ghiduri civice</Link></li>
            <li><Link href="/intreruperi" className={linkCls}>Întreruperi utilități</Link></li>
            <li><Link href="/autoritati" className={linkCls}>Autorități</Link></li>
            <li><Link href="/clasament-primarii" className={linkCls}>Clasament primării</Link></li>
            <li><Link href="/civic-quiz" className={linkCls}>Quiz civic</Link></li>
            <li><Link href="/dezvoltatori" className={linkCls}>API dezvoltatori</Link></li>
            <li><Link href="/status" className={linkCls}>Status site</Link></li>
          </ul>
        </div>

        {/* Feedback — centrat (cerut user 5/12/2026) */}
        <FooterFeedback />

        {/* Bottom bar — year derived dynamically so the footer doesn't
            need a yearly bump. ISR rebuilds capture the new year on
            their next regeneration cycle. */}
        <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
          <p className="text-xs text-[var(--color-text-muted)] text-center" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Civia.ro · Toate drepturile rezervate
          </p>
          {/* „Made in Romania" badge — semnal de identitate locală + GDPR-EU.
              Tricolor compact: 3 dungi verticale, accesibil cu aria-label. */}
          <span
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"
            aria-label="Realizat în România"
          >
            <span className="inline-flex h-3.5 rounded-[2px] overflow-hidden border border-[var(--color-border)]" aria-hidden="true">
              <span className="w-1.5 bg-[#002B7F]" />
              <span className="w-1.5 bg-[#FCD116]" />
              <span className="w-1.5 bg-[#CE1126]" />
            </span>
            <span>Făcut cu ❤️ în România</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
