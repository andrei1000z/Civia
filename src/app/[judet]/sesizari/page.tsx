import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountyBySlug } from "@/data/counties";
import { FileText, Eye, CheckCircle2, BookOpen } from "lucide-react";
import { SesizareForm } from "@/components/sesizari/SesizareForm";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  CountyPageHero,
  COUNTY_HERO_GRADIENT,
} from "@/components/county/CountyPageHero";

// 2026-05-19: ISR 6h. Pagina e entry-point pt formularul de sesizare per
// judet. Continutul nu se schimba (formular static), doar count-ul „rezolvate
// cu poza" — refresh la 6h e abundent.
export const revalidate = 21600;

/**
 * Same probe as /sesizari/page.tsx — the "Rezolvate" entry-point card
 * appears only when at least one approved public sesizare in the
 * gallery has both `status='rezolvat'` and a `resolved_photo_url`.
 * Kept county-agnostic for now (a shared "anything in Romania has been
 * resolved with a photo" signal is enough to surface the gallery link).
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
    return false;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  return {
    title: "Sesizări",
    description: `Trimite sesizări formale la autoritățile din ${county.name}. Generăm textul cu temei legal automat.`,
    alternates: { canonical: `/${county.slug}/sesizari` },
  };
}

export default async function SesizariPage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) notFound();

  const showDovezi = await hasAnyResolvedWithPhoto();

  const quickLinks = [
    {
      href: "/sesizari-publice",
      icon: Eye,
      label: "Sesizări publice",
      hint: "Vezi ce semnalează alții",
      accent: "var(--color-primary)",
    },
    {
      href: "/urmareste",
      icon: FileText,
      label: "Urmărește o sesizare",
      hint: "Verifică statusul cu codul tău",
      accent: "#F59E0B",
    },
    ...(showDovezi
      ? [
          {
            href: "/sesizari-rezolvate",
            icon: CheckCircle2,
            label: "Rezolvate",
            hint: "Galerie before & after",
            accent: "#059669",
          } as const,
        ]
      : []),
    {
      href: "/ghiduri/ghid-sesizari",
      icon: BookOpen,
      label: "Cum scrii eficient",
      hint: "Ghidul rapid Civia",
      accent: "#8B5CF6",
    },
  ] as const;

  return (
    <div className="container-narrow py-8 md:py-12">
      <CountyPageHero
        countyName={county.name}
        countyId={county.id}
        countySlug={county.slug}
        title="Sesizări"
        icon={FileText}
        gradient={COUNTY_HERO_GRADIENT.primary}
        description={
          <>
            Trimite o sesizare formală la autoritățile din <strong>{county.name}</strong>.
            Generăm textul cu temei legal, alegem instituția competentă, tu doar
            apeși trimite.
          </>
        }
        tagline="OG 27/2002 — autoritățile au obligația să răspundă în max 30 de zile calendaristice."
      />

      {/* Quick links — column count tracks the visible-link count so a
          missing "Rezolvate" entry doesn't leave a stretched 4th cell. */}
      <div
        className={
          quickLinks.length === 4
            ? "grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
            : "grid grid-cols-2 lg:grid-cols-3 gap-3 mb-10"
        }
      >
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <span
                className="w-9 h-9 rounded-[var(--radius-xs)] grid place-items-center shrink-0"
                style={{ backgroundColor: `${link.accent}1a`, color: link.accent }}
                aria-hidden="true"
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {link.label}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {link.hint}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Form intro */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6 mb-6">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
          Fă o sesizare în {county.name}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Alege tipul de sesizare. <strong>Sesizarea rapidă</strong> necesită
          doar datele minime — tip, locație, descriere. <strong>Sesizarea completă</strong>{" "}
          adaugă date care ajută autoritățile să rezolve mai repede: poze, GPS,
          context. Rescriem totul într-un text formal cu temei legal.
        </p>
      </div>

      {/* The actual form */}
      <SesizareForm />

      {/* Legal info — left-border callout, same look as the new email
          callouts used everywhere else in the product. */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-400 rounded-[var(--radius-md)] p-4 text-sm">
        <p className="text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Conform OG 27/2002</strong>, autoritățile au obligația să răspundă în
          30 de zile calendaristice. Sesizarea generată include temei legal și e
          adresată instituției competente din {county.name}.
        </p>
      </div>
    </div>
  );
}
