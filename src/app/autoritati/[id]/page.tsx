import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, Mail, Phone, Globe, ExternalLink, CheckCircle2 } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { ALL_COUNTIES } from "@/data/counties";
import { STATUS_COLORS, STATUS_LABELS, SITE_URL } from "@/lib/constants";

interface Authority {
  id: string;
  name: string;
  kind: string;
  county: string | null;
  sector: string | null;
  official_email: string;
  phone: string | null;
  website: string | null;
  verified: boolean;
  verified_at: string | null;
}

interface SesizareSummary {
  id: string;
  code: string;
  titlu: string;
  status: string;
  tip: string;
  created_at: string;
}

const KIND_LABELS: Record<string, string> = {
  primarie_sector: "Primărie sector",
  primarie_municipiu: "Primărie municipiu",
  primarie_judet: "Primărie județ",
  consiliu_judetean: "Consiliu județean",
  politie_locala: "Poliție locală",
  garda_mediu: "Garda de Mediu",
  salubritate: "Operator salubritate",
  apa_nova: "Operator apă",
  termoenergetica: "Termoenergetica",
  cnair: "CNAIR",
  altele: "Altă autoritate",
};

async function loadAuthority(id: string): Promise<{
  authority: Authority | null;
  sesizari: SesizareSummary[];
  stats: { total: number; responded: number; resolved: number; responseRate: number; resolveRate: number };
}> {
  try {
    const admin = createSupabaseAdmin();
    const { data: a } = await admin
      .from("authorities")
      .select("*")
      .eq("id", id)
      .eq("verified", true)
      .maybeSingle();

    if (!a) return { authority: null, sesizari: [], stats: { total: 0, responded: 0, resolved: 0, responseRate: 0, resolveRate: 0 } };

    const authority = a as Authority;

    // Filter sesizari by county/sector pentru aceasta primarie.
    let query = admin
      .from("sesizari")
      .select("id, code, titlu, status, tip, created_at, county, sector")
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (authority.county) query = query.eq("county", authority.county);
    if (authority.sector) query = query.eq("sector", authority.sector);

    const { data: sez } = await query;
    const sesizari = (sez ?? []) as SesizareSummary[];

    // Stats — agregate
    const total = sesizari.length;
    const RESPONDED = new Set(["in-lucru", "actiune_autoritate", "rezolvat", "respins", "amanat"]);
    const responded = sesizari.filter((s) => RESPONDED.has(s.status)).length;
    const resolved = sesizari.filter((s) => s.status === "rezolvat").length;

    return {
      authority,
      sesizari,
      stats: {
        total,
        responded,
        resolved,
        responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
        resolveRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      },
    };
  } catch {
    return { authority: null, sesizari: [], stats: { total: 0, responded: 0, resolved: 0, responseRate: 0, resolveRate: 0 } };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { authority } = await loadAuthority(id);
  if (!authority) return {};
  return {
    title: `${authority.name} — Civia`,
    description: `Profil public ${authority.name} pe Civia. Vezi rata de raspuns la sesizari + sesizarile recente.`,
    alternates: { canonical: `/autoritati/${id}` },
  };
}

export const revalidate = 3600;

export default async function AuthorityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { authority, sesizari, stats } = await loadAuthority(id);
  if (!authority) notFound();

  const county = authority.county ? ALL_COUNTIES.find((c) => c.id === authority.county) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentOrganization",
    name: authority.name,
    url: `${SITE_URL}/autoritati/${authority.id}`,
    email: authority.official_email,
    ...(authority.phone ? { telephone: authority.phone } : {}),
    ...(authority.website ? { sameAs: [authority.website] } : {}),
    ...(county
      ? { areaServed: { "@type": "AdministrativeArea", name: county.name } }
      : {}),
    // Citizen-derived "aggregate rating" — 1-5 stars derivat din resolveRate
    // (0% → 1.0 stele, 100% → 5.0 stele). Vizibil in SERP la cautari de
    // tip „primaria sector X". Doar daca avem ≥5 sesizari (statistic
    // semnificativ pentru Google să accepte ratingul).
    ...(stats.total >= 5
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (1 + (stats.resolveRate / 100) * 4).toFixed(1),
            ratingCount: stats.total,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Acasă", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Autorități", item: `${SITE_URL}/autoritati` },
      { "@type": "ListItem", position: 3, name: authority.name, item: `${SITE_URL}/autoritati/${authority.id}` },
    ],
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <PageHero
        title={authority.name}
        icon={Building2}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            {KIND_LABELS[authority.kind] ?? authority.kind}
            {county && ` · ${county.name}`}
            {authority.sector && ` · ${authority.sector}`}
          </>
        }
        tagline={
          authority.verified ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={12} aria-hidden="true" />
              Autoritate verificată Civia
            </span>
          ) : (
            "Profil neverificat"
          )
        }
      />

      {/* Contact card */}
      <section className="lc-glass-2 rounded-[var(--radius-md)] p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4 text-[var(--color-text)] inline-flex items-center gap-2">
          <Mail size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
          Contact oficial
        </h2>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <a
            href={`mailto:${authority.official_email}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <Mail size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
            <span className="truncate text-[var(--color-text)]">{authority.official_email}</span>
          </a>
          {authority.phone && (
            <a
              href={`tel:${authority.phone}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <Phone size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
              <span className="truncate text-[var(--color-text)]">{authority.phone}</span>
            </a>
          )}
          {authority.website && (
            <a
              href={authority.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <Globe size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
              <span className="truncate text-[var(--color-text)]">Site oficial</span>
              <ExternalLink size={10} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
            </a>
          )}
        </div>
      </section>

      {/* Stats */}
      {stats.total > 0 && (
        <section className="grid grid-cols-3 gap-3 mb-6">
          <StatBox label="Sesizări (ultimele)" value={stats.total.toString()} color="#06B6D4" />
          <StatBox label="Cu răspuns" value={`${stats.responseRate}%`} hint={`${stats.responded}/${stats.total}`} color="#10B981" />
          <StatBox label="Rezolvate" value={`${stats.resolveRate}%`} hint={`${stats.resolved}/${stats.total}`} color="#059669" />
        </section>
      )}

      {/* Recent sesizari */}
      {sesizari.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-[var(--color-text)]">
            Sesizări recente ({sesizari.length})
          </h2>
          <ul className="space-y-2">
            {sesizari.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sesizari/${s.code}`}
                  className="block lc-glass-2 rounded-[var(--radius-md)] p-3 hover:lc-glow-emerald transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: (STATUS_COLORS[s.status] ?? "#64748b") + "20",
                        color: STATUS_COLORS[s.status] ?? "#64748b",
                      }}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                      {s.code}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">
                    {s.titlu}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="text-center py-12">
          <p className="text-sm text-[var(--color-text-muted)]">
            Nicio sesizare recentă pe această autoritate.
          </p>
        </section>
      )}
    </div>
  );
}

function StatBox({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
  return (
    <div className="lc-glass-2 rounded-[var(--radius-md)] p-3 min-w-0">
      <div className="text-2xl font-bold font-[family-name:var(--font-sora)] tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
        {label}
        {hint && <span className="block opacity-70">{hint}</span>}
      </div>
    </div>
  );
}
