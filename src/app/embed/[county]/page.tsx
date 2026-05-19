import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";
import { SESIZARE_TIPURI, SITE_URL } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

/**
 * Embed widget pentru jurnalisti / bloggeri / site-uri ONG.
 *
 * Usage: ei iframe-uiesc `https://civia.ro/embed/b` (sau ce judet) pe site-ul
 * lor. Widget-ul se auto-actualizeaza, arata top 5 sesizari publice recente
 * + counter total + buton CTA „Trimite o sesizare in {judet}" cu UTM tracking.
 *
 * Sterge-mi-paddingul exterior (max-w-md, fara navbar, fara footer) astfel
 * incat sa para nativ pe orice site embedded. Tema light/dark via prefers.
 *
 * SEO bonus: orice site care embedeaza widget-ul ne da un backlink prin
 * iframe src + posibil link extern. Bloggeri locali (cluj-news, sibiu100,
 * etc) sunt audience perfecta.
 */

interface PageProps {
  params: Promise<{ county: string }>;
}

// 2026-05-19: 10min → 2h. Embed-urile sunt iframe-uri pe site-uri externe,
// nu trebuie real-time. 2h suficient.
export const revalidate = 7200;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { county: countySlug } = await params;
  const county = ALL_COUNTIES.find((c) => c.slug === countySlug);
  return {
    title: county ? `Sesizări civice — ${county.name}` : "Embed Civia",
    robots: { index: false, follow: false }, // not for SEO, just embeds
  };
}

interface SesizareRow {
  code: string;
  titlu: string;
  tip: string;
  locatie: string;
  status: string;
  created_at: string;
  upvotes: number;
}

async function getCountySesizari(countyId: string): Promise<{ rows: SesizareRow[]; total: number }> {
  try {
    const admin = createSupabaseAdmin();
    const [list, count] = await Promise.all([
      admin
        .from("sesizari_feed")
        .select("code, titlu, tip, locatie, status, created_at, upvotes")
        .eq("county", countyId)
        .eq("publica", true)
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("county", countyId)
        .eq("moderation_status", "approved"),
    ]);
    return {
      rows: (list.data ?? []) as SesizareRow[],
      total: count.count ?? 0,
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

export default async function EmbedCountyPage({ params }: PageProps) {
  const { county: countySlug } = await params;
  const county = ALL_COUNTIES.find((c) => c.slug === countySlug);

  if (!county) {
    return (
      <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
        <p>Județul nu există. Verifică slug-ul.</p>
        <p className="mt-2">
          Embed-uri valide:{" "}
          <code className="text-xs">/embed/b</code>,{" "}
          <code className="text-xs">/embed/cj</code>,{" "}
          <code className="text-xs">/embed/is</code> etc.
        </p>
      </div>
    );
  }

  const { rows, total } = await getCountySesizari(county.id);

  return (
    <div className="max-w-md mx-auto p-4 bg-[var(--color-surface)] text-[var(--color-text)]">
      {/* Header */}
      <header className="flex items-center justify-between mb-3 pb-3 border-b border-[var(--color-border)]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
            Sesizări civice live
          </p>
          <p className="font-[family-name:var(--font-sora)] font-bold text-base">{county.name}</p>
        </div>
        <Link
          href={`${SITE_URL}?utm_source=embed&utm_medium=widget&utm_campaign=${county.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          via Civia.ro
        </Link>
      </header>

      {/* Counter */}
      <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-3 mb-3 flex items-center gap-3">
        <Activity size={20} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold tabular-nums leading-tight">
            {total.toLocaleString("ro-RO")}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            sesizări trimise public în {county.name}
          </p>
        </div>
      </div>

      {/* Recent list */}
      {rows.length > 0 ? (
        <ul className="space-y-2 mb-3">
          {rows.map((s) => {
            const tipMeta = SESIZARE_TIPURI.find((t) => t.value === s.tip);
            return (
              <li key={s.code}>
                <a
                  href={`${SITE_URL}/sesizari/${s.code}?utm_source=embed&utm_medium=widget&utm_campaign=${county.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] rounded-[var(--radius-xs)] p-2.5 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0" aria-hidden="true">
                      {tipMeta?.icon ?? "📝"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{s.titlu}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                        {s.locatie} · {timeAgo(s.created_at)}
                      </p>
                    </div>
                    {s.upvotes > 0 && (
                      <span className="text-[10px] text-[var(--color-primary)] font-semibold tabular-nums shrink-0">
                        ↑ {s.upvotes}
                      </span>
                    )}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)] mb-3 text-center py-4">
          Nicio sesizare publică încă. Fii primul.
        </p>
      )}

      {/* CTA */}
      <Link
        href={`${SITE_URL}/${county.slug}/sesizari?utm_source=embed&utm_medium=widget&utm_campaign=${county.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center py-2.5 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        Trimite o sesizare în {county.name}
        <ArrowRight size={11} className="inline ml-1 -mt-0.5" aria-hidden="true" />
      </Link>

      <p className="text-[9px] text-[var(--color-text-muted)] text-center mt-2">
        Embed gratuit · widget actualizat la 10 min
      </p>
    </div>
  );
}
