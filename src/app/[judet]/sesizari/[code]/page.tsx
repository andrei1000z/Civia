import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Calendar, User } from "lucide-react";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { getCountyBySlug } from "@/data/counties";
import { createSupabaseServer } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS, resolveTipLabel, SITE_URL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { CommentsSection } from "@/components/sesizari/CommentsSection";
import { ShareMenu } from "@/components/sesizari/ShareMenu";
import { EvenimentMap } from "@/components/maps/EvenimentMap";
import { stripPrivateAddress } from "@/lib/privacy";
import { getComments } from "@/lib/sesizari/repository";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string; code: string }>;
}): Promise<Metadata> {
  const { judet, code } = await params;
  const s = await getSesizareByCode(code);
  if (!s) return { title: "Sesizare negăsită" };
  return {
    title: s.titlu,
    description: s.descriere.slice(0, 160),
    alternates: { canonical: `/${judet}/sesizari/${code}` },
  };
}

export default async function CountySesizareDetail({
  params,
}: {
  params: Promise<{ judet: string; code: string }>;
}) {
  const { judet, code } = await params;
  const county = getCountyBySlug(judet);
  const sesizare = await getSesizareByCode(code);
  if (!sesizare) notFound();
  // audit fix: validează că sesizarea aparține județului din URL — înainte
  // /cluj/sesizari/00007 afișa o sesizare din alt județ (conținut duplicat SEO +
  // breadcrumb greșit). + scos apelul getUser() mort (rezultat nefolosit).
  if (county && sesizare.county && sesizare.county !== county.id) notFound();

  const comments = await getComments(sesizare.id);

  const { label: tipLabel, icon: tipIcon } = resolveTipLabel(
    sesizare.tip,
    (sesizare as unknown as { custom_category?: string | null }).custom_category,
  );

  return (
    <div className="container-narrow py-8 md:py-12">
      <BreadcrumbJsonLd items={[
        { name: "Civia", url: SITE_URL },
        { name: county?.name ?? "Sesizări", url: `${SITE_URL}/${judet}/sesizari` },
        { name: sesizare.titlu, url: `${SITE_URL}/${judet}/sesizari/${code}` },
      ]} />

      <Link
        href={`/${judet}/sesizari`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-6 transition-colors"
      >
        <ChevronLeft size={16} /> Sesizări {county?.name}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge bgColor={STATUS_COLORS[sesizare.status] ?? "#64748B"} color="white">
            {STATUS_LABELS[sesizare.status] ?? sesizare.status}
          </Badge>
          <Badge variant="neutral">
            <span className="mr-1">{tipIcon}</span>
            {tipLabel}
          </Badge>
          {sesizare.sector && <Badge variant="neutral">{sesizare.sector}</Badge>}
          <span className="font-mono text-xs text-[var(--color-text-muted)] ml-auto">
            {sesizare.code}
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-3xl md:text-4xl font-extrabold mb-3">
          {sesizare.titlu}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-muted)] mb-4">
          <span className="flex items-center gap-1.5">
            <MapPin size={14} />
            {sesizare.locatie}
          </span>
          {/* 2026-05-28 — Author name ASCUNS per user request (vezi page.tsx
              principal pentru rationale). */}
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {formatDate(sesizare.created_at)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareMenu
            url={`${SITE_URL}/${judet}/sesizari/${sesizare.code}`}
            title={sesizare.titlu}
            size="lg"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div>
          {/* Description */}
          <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-6">
            <h2 className="font-semibold mb-3">Descriere</h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{sesizare.descriere}</p>
          </section>

          {sesizare.formal_text && (
            <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-6">
              <h2 className="font-semibold mb-3">
                Text formal
              </h2>
              <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-4 text-xs font-mono whitespace-pre-wrap">
                {stripPrivateAddress(sesizare.formal_text, sesizare.author_name)}
              </div>
            </section>
          )}

          {/* Map */}
          <section className="mb-6">
            <h2 className="font-semibold mb-3">Localizare</h2>
            <EvenimentMap
              coords={[sesizare.lat, sesizare.lng]}
              label={sesizare.titlu}
              color={STATUS_COLORS[sesizare.status] ?? "#64748B"}
              zoom={16}
              height="320px"
            />
          </section>

          <CommentsSection code={sesizare.code} initialComments={comments} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Link
            href={`/sesizari/${code}`}
            className="block text-center text-sm text-[var(--color-primary)] hover:underline"
          >
            Vezi pagina completă a sesizării →
          </Link>
        </aside>
      </div>
    </div>
  );
}
