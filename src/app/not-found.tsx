import Link from "next/link";
import { SearchX, Home, AlertCircle, BookOpen, Newspaper, Megaphone } from "lucide-react";
import { NotFoundTracker } from "./NotFoundTracker";
import { NotFoundSearchButton } from "./NotFoundSearchButton";

export default function NotFound() {
  const quickLinks = [
    { href: "/sesizari", label: "Trimit o sesizare", icon: AlertCircle },
    { href: "/petitii", label: "Petiții", icon: Megaphone },
    { href: "/ghiduri", label: "Ghiduri practice", icon: BookOpen },
    { href: "/stiri", label: "Știri locale", icon: Newspaper },
  ];

  return (
    <div className="container-narrow py-16 md:py-24 max-w-lg text-center">
      <NotFoundTracker />
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
        <SearchX size={36} className="text-[var(--color-text-muted)]" aria-hidden="true" />
      </div>
      <h1 className="font-[family-name:var(--font-sora)] text-5xl font-extrabold mb-2">404</h1>
      <p className="text-lg text-[var(--color-text-muted)] mb-2">
        N-am găsit pagina asta.
      </p>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        Probabil ai un link vechi sau ai tastat greșit URL-ul. Scrie-ne <Link href="/#footer-feedback" className="text-[var(--color-primary)] hover:underline">aici</Link> dacă ai venit din altă parte de pe site — reparăm linkul.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          <Home size={16} aria-hidden="true" />
          Înapoi la pagina principală
        </Link>
        <NotFoundSearchButton />
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Sau mergi direct la:</p>
        <div className="flex flex-wrap justify-center gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
              >
                <Icon size={14} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
