import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Search, CheckCircle2, Send, Scale } from "lucide-react";
import { SesizareForm } from "@/components/sesizari/SesizareForm";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

const FAQ_SESIZARI = [
  {
    question: "Cât costă o sesizare prin Civia?",
    answer: "GRATUIT. Conform OG 27/2002, toate sesizările civice sunt gratuite. Civia.ro nu percepe nicio taxă — folosim doar tehnologie AI și emailul tău.",
  },
  {
    question: "Cât durează până primesc răspuns?",
    answer: "30 zile calendaristice (OG 27/2002 art. 8). Pentru cazuri complexe, prelungire maxim 15 zile cu notificare. Civia urmărește automat termenul.",
  },
  {
    question: "Trebuie să mă identific cu numele real?",
    answer: "DA pentru ca primăria să fie OBLIGATĂ să răspundă (OG 27/2002 art. 12). Pe Civia poți ascunde public numele, dar în emailul oficial apare.",
  },
  {
    question: "Cum aleg autoritatea corectă?",
    answer: "AI Civia detectează automat din locație + tip problemă. Drum național → CNAIR, stradă urbană → primărie, parcare ilegală → Poliția Locală.",
  },
  {
    question: "Ce fac dacă primăria nu răspunde?",
    answer: "1) Revenire. 2) Avocatul Poporului (gratuit, avp.ro). 3) Contencios administrativ. Civia generează template pentru toate trei.",
  },
];

export const metadata: Metadata = {
  title: "Sesizări",
  description:
    "Trimite o sesizare formală la autorități. Generăm textul cu temei legal automat. Detectăm județul din locația ta.",
  alternates: { canonical: "/sesizari" },
};

// Pure form shell — content e mostly static. ISR 24h is enough; the
// "Dovezi că funcționează" probe below is checked at revalidate time
// so the link surfaces automatically the day after the first resolved
// sesizare with an after-photo lands.
export const revalidate = 86400;

interface QuickLink {
  href: string;
  icon: typeof Eye;
  title: string;
  desc: string;
  accent: string;
}

const STATIC_QUICK_LINKS: readonly QuickLink[] = [
  {
    href: "/sesizari-publice",
    icon: Eye,
    title: "Ce semnalează alții",
    desc: "Votează + trimite și tu",
    accent: "var(--color-primary)",
  },
  {
    href: "/urmareste",
    icon: Search,
    title: "Urmărește sesizarea ta",
    desc: "Verifică statusul cu codul primit",
    accent: "#F59E0B",
  },
] as const;

const DOVEZI_LINK: QuickLink = {
  href: "/sesizari-rezolvate",
  icon: CheckCircle2,
  title: "Dovezi că funcționează",
  desc: `Galerie „înainte / după"`,
  accent: "#10B981",
};

/**
 * Returns true once at least one approved public sesizare has both a
 * resolved status AND an after-photo. The /sesizari-rezolvate gallery
 * is built from this exact intersection — surfacing the entry-point
 * card before that first row exists ships users to an empty page.
 */
async function hasAnyResolvedWithPhoto(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin();
    const { count } = await admin
      .from("sesizari")
      .select("id", { count: "exact", head: true })
      .eq("status", "rezolvat")
      .eq("publica", true)
      .eq("moderation_status", "approved")
      .not("resolved_photo_url", "is", null);
    return (count ?? 0) > 0;
  } catch {
    // Conservative on failure: assume there's nothing to show, so the
    // user doesn't land on an empty gallery from a broken probe.
    return false;
  }
}

export default async function SesizariPage() {
  const showDovezi = await hasAnyResolvedWithPhoto();
  const QUICK_LINKS: readonly QuickLink[] = showDovezi
    ? [...STATIC_QUICK_LINKS, DOVEZI_LINK]
    : STATIC_QUICK_LINKS;
  return (
    <div className="container-narrow py-8 md:py-12">
      <FaqJsonLd items={FAQ_SESIZARI} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Sesizări", url: `${SITE_URL}/sesizari` },
        ]}
      />
      <PageHero
        title="Trimite o sesizare formală"
        icon={Send}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Descrii simplu, atașezi o poză. AI rescrie formal + alegem autoritatea.
          </>
        }
        tagline="2 minute la tine · 30 zile pentru răspuns (OG 27/2002)."
      />

      {/* Quick links — colored accent ring + icon chip per item.
          Grid scales to the link count so two cards don't stretch
          weirdly when the "Dovezi" entry is hidden pending the first
          resolved-with-photo sesizare. Class names are listed as
          literals so Tailwind's JIT picks them up. */}
      <div
        className={
          QUICK_LINKS.length === 3
            ? "grid sm:grid-cols-3 gap-3 mb-8"
            : "grid sm:grid-cols-2 gap-3 mb-8"
        }
      >
        {QUICK_LINKS.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.href}
              href={q.href}
              className="group relative flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)]/30 card-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <span
                className="w-9 h-9 rounded-[var(--radius-xs)] grid place-items-center shrink-0"
                style={{ backgroundColor: `${q.accent}1a`, color: q.accent }}
                aria-hidden="true"
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight group-hover:text-[var(--color-primary)] transition-colors">
                  {q.title}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{q.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Sesizare form */}
      <SesizareForm />

      {/* Legal footer card */}
      <div className="mt-8 bg-[var(--color-surface)] border border-blue-500/30 rounded-[var(--radius-md)] p-5 flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-[var(--radius-xs)] bg-blue-500/15 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0"
          aria-hidden="true"
        >
          <Scale size={16} />
        </span>
        <div className="flex-1 text-sm">
          <p className="font-bold mb-1 text-blue-700 dark:text-blue-300">
            Legal — OG 27/2002 art. 8 alin. (1)
          </p>
          <p className="text-[var(--color-text)] leading-relaxed">
            Autoritatea are <strong>30 de zile</strong> să răspundă (OG 27/2002 art. 8).
          </p>
        </div>
      </div>

      {/* Cross-link: propuneri legislative */}
      <div className="mt-6 p-4 rounded-md bg-surface-2 border border-border flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold mb-0.5">Vrei să schimbi legea, nu doar să raportezi?</p>
          <p className="text-xs text-text-muted">Propunerile legislative ajung la MAI, IGPR, Parlament prin Legea 52/2003.</p>
        </div>
        <a
          href="/propuneri-legislative"
          className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline whitespace-nowrap"
        >
          ⚖️ Propune o modificare
        </a>
      </div>

      {/* FAQ section removed (5/8/2026 user request — minimalist).
          Răspunsurile la cele mai comune întrebări sunt deja în
          /ghiduri/ghid-sesizari + în PageHero-ul de mai sus. */}
    </div>
  );
}
