import Link from "next/link";
import Image from "next/image";
import { CookiePreferencesButton } from "./FooterClientLinks";
import { FooterFeedback } from "./FooterFeedback";
import { ThemeToggle } from "@/components/ThemeToggle";

const linkCls =
  "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors";

export function Footer() {
  return (
    <footer className="bg-[var(--color-surface-soft)] border-t border-[var(--color-border)] mt-auto">
      <div className="container-narrow py-12">
        {/* 2026-05-24: scoasă column 1 (Brand + GDPR badge) la cererea user-ului.
            Footer minimalist — doar Despre Civia + Urmărește. 2 coloane,
            simetric, mobile-stack 1-col. */}
        {/* 2026-05-24: items centrate orizontal (cerere user). 2 coloane
            inline, simetric, centrate sub h4 + items aliniate centrat în
            coloana proprie. Mobile stack 1-col centrat. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 justify-items-center text-center">
          {/* Column 1 — Despre Civia */}
          <div className="flex flex-col items-center">
            <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
              Despre Civia
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/confidentialitate" className={linkCls}>Confidențialitate și GDPR</Link></li>
              <li><Link href="/legal/termeni" className={linkCls}>Termenii de utilizare</Link></li>
              <li><Link href="/legal/cookie-policy" className={linkCls}>Politica de cookies</Link></li>
              <li><Link href="/legal/analiza-trafic" className={linkCls}>Cum măsurăm trafic</Link></li>
              <li><CookiePreferencesButton /></li>
            </ul>
          </div>

          {/* Column 2 — Urmărește Civia */}
          <div className="flex flex-col items-center">
            <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
              Urmărește Civia
            </h4>
            <ul className="flex flex-col gap-2 items-center">
              <li>
                <a
                  href="https://bsky.app/profile/civiaro.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Bluesky — @civiaro.bsky.social"
                  className="inline-flex items-center gap-2 h-11 sm:h-10 pl-1.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] w-fit"
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
                  className="inline-flex items-center gap-2 h-11 sm:h-10 pl-1.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] w-fit"
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

        {/* 5/22/2026 — scoase secțiunile „Județe & orașe" + „Acțiuni rapide"
            la cererea user-ului. API dezvoltatori mutat în „Despre Civia".
            Status site scos complet (pagina /status eliminată). */}

        {/* Feedback — centrat (cerut user 5/12/2026) */}
        <FooterFeedback />

        {/* Bottom bar — year derived dynamically so the footer doesn't
            need a yearly bump. ISR rebuilds capture the new year on
            their next regeneration cycle.
            5/22/2026 — sters „Făcut cu ❤️ în România" badge la cererea
            user-ului: redundant pe un site dedicat exclusiv Romaniei.
            2026-05-26 — adăugat ThemeToggle (compact pill) sub copyright. */}
        <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex flex-col items-center gap-4">
          <ThemeToggle variant="compact" />
          <p className="text-xs text-[var(--color-text-muted)] text-center" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Civia.ro · Toate drepturile rezervate
          </p>
        </div>
      </div>
    </footer>
  );
}
