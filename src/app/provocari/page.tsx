import type { Metadata } from "next";
import Link from "next/link";
import { Target, Send, Trophy, Users } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getProvocareCurenta,
  getProvocariTrecute,
  monthLabel,
  type Provocare,
} from "@/data/provocari";
import { countProvocareProgress, userHasParticipated } from "@/lib/provocari/progress";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";
import { UrmaresteZonaProvocare } from "@/components/provocari/UrmaresteZonaProvocare";

export const metadata: Metadata = {
  title: "Provocarea civică a lunii",
  description:
    "O temă civică pe lună, un oraș, un obiectiv colectiv. Depune o sesizare și contribuie la schimbare împreună cu ceilalți cetățeni.",
  alternates: { canonical: "/provocari" },
};

export const revalidate = 3600;

function ariaLabel(p: Provocare): string {
  const c = ALL_COUNTIES.find((x) => x.id === p.county)?.name ?? p.county;
  return p.locality ? `${p.locality}, ${c}` : c;
}

export default async function ProvocariPage() {
  const provocare = getProvocareCurenta();
  const trecute = getProvocariTrecute();

  if (!provocare) {
    return (
      <div className="lc-canvas lc-canvas--flat flex-1">
        <div className="container-narrow py-8 md:py-12">
          <PageHero
            title="Provocarea civică a lunii"
            icon={Target}
            gradient={HERO_GRADIENT.primary}
            tagline="Revino curând — pregătim provocarea următoarei luni."
          />
          <Card variant="glass" className="text-center py-10">
            <div className="text-3xl mb-2" aria-hidden="true">🎯</div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Nicio provocare activă luna aceasta. Între timp, poți depune oricând o
              sesizare.
            </p>
            <Link
              href="/sesizari"
              className="inline-flex items-center gap-1.5 h-10 px-4 mt-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Send size={14} aria-hidden="true" /> Fă o sesizare
            </Link>
          </Card>
          {trecute.length > 0 && <Arhiva trecute={trecute} />}
        </div>
      </div>
    );
  }

  // Progres colectiv (admin = bypass RLS, count public+approved) + participare.
  const admin = createSupabaseAdmin();
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [progress, participated] = await Promise.all([
    countProvocareProgress(admin, provocare),
    user
      ? userHasParticipated(admin, provocare, { userId: user.id, email: user.email ?? null })
      : Promise.resolve(false),
  ]);

  const tint = progress.atins ? "var(--color-success)" : "var(--color-primary)";
  const arie = ariaLabel(provocare);
  const gradient = HERO_GRADIENT[provocare.gradient as keyof typeof HERO_GRADIENT] ?? HERO_GRADIENT.warning;

  return (
    <div className="lc-canvas lc-canvas--flat flex-1">
      <div className="container-narrow py-8 md:py-12">
        <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Provocări", url: `${SITE_URL}/provocari` },
        ]}
      />
      <PageHero
        title={provocare.titlu}
        icon={Target}
        gradient={gradient}
        tagline={`${provocare.icon} ${arie} · ${monthLabel(provocare.month)}`}
      />

      {/* Card progres colectiv — centerpiece */}
      <Card variant="glass" className="mb-8 p-6 sm:p-8">
        <p className="text-sm text-[var(--color-text)] leading-relaxed mb-5">
          {provocare.descriere}
        </p>

        <div className="flex items-end justify-between mb-2">
          <div>
            <span
              className="font-[family-name:var(--font-sora)] text-4xl sm:text-5xl font-extrabold tabular-nums"
              style={{ color: tint }}
            >
              {progress.count}
            </span>
            <span className="text-lg text-[var(--color-text-muted)] font-semibold">
              {" "}/ {progress.prag}
            </span>
          </div>
          <span
            className="text-2xl font-extrabold tabular-nums"
            style={{ color: tint }}
          >
            {progress.pct}%
          </span>
        </div>

        {/* Bara colectivă */}
        <div className="h-3 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.max(2, progress.pct)}%`, backgroundColor: tint }}
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1.5">
          <Users size={12} aria-hidden="true" />
          {progress.count === 1 ? "1 sesizare depusă" : `${progress.count} sesizări depuse`} pe această temă în {arie} luna aceasta
          {progress.atins && (
            <Badge variant="success" className="ml-1">🎉 Prag atins!</Badge>
          )}
        </p>

        {/* Badge ediție-limitată — doar dacă userul a participat */}
        {participated && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-success-soft)] border border-[var(--color-success)]/30">
            <span className="text-xl" aria-hidden="true">{provocare.badge.icon}</span>
            <div>
              <p className="text-sm font-bold text-[var(--color-success)]">
                {provocare.badge.name}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {provocare.badge.description} ✓
              </p>
            </div>
          </div>
        )}

        {/* CTA-uri */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/sesizari?tip=${provocare.tip}`}
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Send size={15} aria-hidden="true" />
            {participated ? "Mai fă o sesizare" : "Fă o sesizare"}
          </Link>
          <UrmaresteZonaProvocare county={provocare.county} category={provocare.tip} arie={arie} />
        </div>

        {!user && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
            <Link href="/cont" className="text-[var(--color-primary)] hover:underline">Conectează-te</Link>{" "}
            ca să-ți primești badge-ul „{provocare.badge.name}" când participi.
          </p>
        )}
      </Card>

      {trecute.length > 0 && <Arhiva trecute={trecute} />}
      </div>
    </div>
  );
}

function Arhiva({ trecute }: { trecute: Provocare[] }) {
  return (
    <section className="mb-8">
      <h2 className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
        <Trophy size={18} aria-hidden="true" className="text-amber-500" />
        Provocări trecute
      </h2>
      <div className="grid gap-2 lc-stagger">
        {trecute.map((p) => (
          <div
            key={p.id}
            className="lc-glass-2 rounded-3xl px-4 py-3 flex items-center gap-3"
          >
            <span className="text-xl" aria-hidden="true">{p.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {p.titlu}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">{monthLabel(p.month)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
