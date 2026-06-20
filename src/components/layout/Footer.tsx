import Link from "next/link";
import Image from "next/image";
import { CookiePreferencesButton } from "./FooterClientLinks";
import { FooterFeedback } from "./FooterFeedback";

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
                  href="https://www.instagram.com/civia.ro"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram — @civia.ro"
                  className="inline-flex items-center gap-2 h-11 sm:h-10 pl-1.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] w-fit"
                >
                  <Image
                    src="/instagram.png"
                    alt="Instagram"
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-[7px] object-cover shrink-0"
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-[var(--color-text)]">Instagram</span>
                    <span className="text-[var(--color-text-muted)]"> · @civia.ro</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="https://bsky.app/profile/civiaro.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Bluesky — @civiaro.bsky.social"
                  className="inline-flex items-center gap-2 h-11 sm:h-10 pl-1.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] w-fit"
                >
                  {/* Fluture Bluesky ca SVG inline (alb pe cerc albastru). PNG-ul
                      era full-bleed și non-pătrat (1280×1131) → se tăia în cerc.
                      SVG-ul are padding intern → nu se taie niciodată. */}
                  <span className="w-6 h-6 rounded-full bg-[#1185fe] grid place-items-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 568 501" className="w-3.5 h-3.5" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
                      <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C353.473 576.312 301.061 422.461 287.631 383.039C285.169 375.812 284.017 372.431 284 375.306C283.983 372.431 282.831 375.812 280.369 383.039C266.939 422.461 214.527 576.312 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0535 296.954 15.7778 224.501C9.94525 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1335 -1.61183 123.121 33.6637Z"/>
                    </svg>
                  </span>
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
                    className="w-6 h-6 rounded-full object-contain bg-white shrink-0"
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
            2026-06-18 — ThemeToggle MUTAT în /cont → „Aspect & accesibilitate"
            (la cererea user-ului). Footer-ul rămâne doar cu copyright. */}
        <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex flex-col items-center">
          <p className="text-xs text-[var(--color-text-muted)] text-center" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Civia.ro · Toate drepturile rezervate
          </p>
        </div>
      </div>
    </footer>
  );
}
