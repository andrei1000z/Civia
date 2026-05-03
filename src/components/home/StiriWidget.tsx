import Link from "next/link";
import Image from "next/image";
import { Newspaper, ArrowRight } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NATIONAL_SOURCES } from "@/lib/stiri/sources";
import { SOURCE_COLORS, readableTextColor, sourceTextColor } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { TimeAgo } from "@/components/ui/TimeAgo";

interface HomepageStire {
  id: string;
  title: string;
  source: string;
  category: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string;
}

/**
 * Top 6 most recent national articles, picked across the full
 * NATIONAL_SOURCES list. Lives on the homepage as a "what's
 * happening right now" rail. Server component, no JS to client.
 *
 * Limited to 6 columns × ~250 B per row payload — light footprint.
 */
async function fetchTopStiri(): Promise<HomepageStire[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("stiri_cache")
      .select("id,title,source,category,excerpt,image_url,published_at")
      .in("source", [...NATIONAL_SOURCES])
      .order("published_at", { ascending: false })
      .limit(6);
    return (data as HomepageStire[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function StiriWidget() {
  const items = await fetchTopStiri();
  if (items.length === 0) return null;

  // Hero is the first article (visual anchor); the next 5 form a tight
  // sidebar list. Same layout pattern as /stiri so users get visual
  // continuity between homepage and the full feed.
  const [hero, ...rest] = items;
  if (!hero) return null;

  return (
    <section className="py-12 md:py-16 bg-[var(--color-surface)] border-y border-[var(--color-border)]">
      <div className="container-narrow">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold inline-flex items-center gap-2">
            <Newspaper size={22} className="text-[var(--color-primary)]" aria-hidden="true" />
            Știri civice — în timp real
          </h2>
          <Link
            href="/stiri"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
          >
            Toate știrile <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
          {/* Featured article */}
          <Link
            href={`/stiri/${hero.id}`}
            className="group relative bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/40 transition-all"
          >
            <div className="relative aspect-[16/9] bg-[var(--color-surface-2)] overflow-hidden">
              {hero.image_url ? (
                <Image
                  src={hero.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-[var(--color-text-muted)]">
                  <Newspaper size={48} className="opacity-30" aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge
                  bgColor={SOURCE_COLORS[hero.source] ?? "#64748b"}
                  color={readableTextColor(SOURCE_COLORS[hero.source] ?? "#64748b")}
                  className="text-[10px]"
                >
                  {hero.source}
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-[family-name:var(--font-sora)] font-bold text-lg md:text-xl leading-tight mb-2 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                {hero.title}
              </h3>
              {hero.excerpt && (
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2 mb-3">
                  {hero.excerpt}
                </p>
              )}
              <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                <TimeAgo date={hero.published_at} />
              </p>
            </div>
          </Link>

          {/* Compact list — 5 items */}
          <ul className="space-y-2.5">
            {rest.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/stiri/${s.id}`}
                  className="group flex items-start gap-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-1)] transition-all"
                >
                  {/* Container cu bg neutru + Newspaper icon ca fallback
                      vizibil pe dark mode. Vechiul cod folosea bg cu
                      culoarea sursei la 10% alpha — pentru G4Media
                      (#0A0A0A near-black) era invizibil. Acum surface-2
                      (gri vizibil) + icon colorat cu source text color. */}
                  <div className="relative w-16 h-16 rounded-[var(--radius-xs)] overflow-hidden shrink-0 bg-[var(--color-surface-2)]">
                    <div
                      className="absolute inset-0 grid place-items-center"
                      style={{ color: sourceTextColor(s.source) }}
                      aria-hidden="true"
                    >
                      <Newspaper size={20} />
                    </div>
                    {s.image_url && (
                      <Image
                        src={s.image_url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="text-[9px] uppercase tracking-wider font-bold"
                        style={{ color: sourceTextColor(s.source) }}
                      >
                        {s.source}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                        <TimeAgo date={s.published_at} />
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                      {s.title}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
