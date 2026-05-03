import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { CookiePreferencesButton } from "./FooterClientLinks";
import { FooterFeedback } from "./FooterFeedback";

const linkCls =
  "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors";

export function Footer() {
  return (
    <footer className="bg-[var(--color-surface-soft)] border-t border-[var(--color-border)] mt-auto">
      <div className="container-narrow py-12">
        {/* Brand + 2 link sections (Despre Civia + Resurse oficiale).
            User a cerut: scoatem complet „Folosește platforma" + „Ghiduri
            practice" — sunt deja accesibile din navbar/Altele dropdown. */}
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
            <p className="text-xs text-[var(--color-text-muted)] max-w-xs leading-relaxed italic">
              Civia.ro nu promovează niciun partid politic, nicio poziționare ideologică. Milităm pentru o țară corectă, modernă și pentru oameni.
            </p>
          </div>

          {/* Column 2 — Despre Civia (legal + about) */}
          <div>
            <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
              Despre Civia
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/impact" className={linkCls}>Ce s-a rezolvat prin Civia</Link></li>
              <li><Link href="/updateuri" className={linkCls}>Update-uri și changelog</Link></li>
              <li><Link href="/dezvoltatori" className={linkCls}>API public — pentru jurnaliști</Link></li>
              <li><Link href="/accesibilitate" className={linkCls}>Accesibilitate (WCAG 2.1)</Link></li>
              <li><Link href="/legal/confidentialitate" className={linkCls}>Confidențialitate și GDPR</Link></li>
              <li><Link href="/legal/termeni" className={linkCls}>Termenii de utilizare</Link></li>
              <li><CookiePreferencesButton /></li>
            </ul>
          </div>

          {/* Column 3 — Resurse oficiale */}
          <div>
            <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
              Resurse oficiale
            </h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://data.gov.ro" target="_blank" rel="noopener noreferrer" className={linkCls}>Portalul datelor publice</a></li>
              <li><a href="https://www.ghiseul.ro" target="_blank" rel="noopener noreferrer" className={linkCls}>Plăți taxe (Ghișeul.ro)</a></li>
              <li><a href="https://www.anpm.ro" target="_blank" rel="noopener noreferrer" className={linkCls}>Agenția de Mediu</a></li>
              <li><a href="https://www.politiaromana.ro" target="_blank" rel="noopener noreferrer" className={linkCls}>Poliția Română</a></li>
            </ul>
          </div>
        </div>

        {/* Urmărește Civia — social row. Pentru moment doar eYou (noua
            platformă socială europeană unde echipa e activă). Vor fi
            adăugate alte rețele când conturile vor fi gata. */}
        <div className="mt-10 pt-6 border-t border-[var(--color-border)]">
          <h4 className="font-semibold mb-3 text-[var(--color-text)] text-sm">
            Urmărește Civia
          </h4>
          <ul className="flex flex-wrap items-center gap-2">
            <li>
              <a
                href="https://eyou.com/civia"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Civia pe eYou — @civia"
                title="eYou (platformă socială europeană)"
                className="group inline-flex items-center gap-2 h-10 pl-2.5 pr-3.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <span
                  aria-hidden="true"
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 grid place-items-center text-white text-[11px] font-bold font-[family-name:var(--font-sora)]"
                >
                  e
                </span>
                <span className="text-sm">
                  <span className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">eYou</span>
                  <span className="text-[var(--color-text-muted)]"> · @civia</span>
                </span>
              </a>
            </li>
            {/* Aici vor fi adăugate Facebook / Instagram / X când conturile
                vor fi create. Pattern-ul de mai sus e refolosibil. */}
          </ul>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
            eYou e o platformă socială europeană cu accent pe confidențialitate.
            Postăm acolo update-uri scurte despre platformă și petițiile noi.
          </p>
        </div>

        {/* Feedback + newsletter */}
        <FooterFeedback />

        {/* Bottom bar — year derived dynamically so the footer doesn't
            need a yearly bump. ISR rebuilds capture the new year on
            their next regeneration cycle. */}
        <div className="mt-10 pt-6 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] text-center" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Civia.ro · Toate drepturile rezervate
          </p>
        </div>
      </div>
    </footer>
  );
}
