import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Calendar, User, Tag, Building2, Info, Sparkles } from "lucide-react";
import { createSupabaseAnon } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/Badge";
import { SOURCE_COLORS, SITE_URL, readableTextColor, sourceTextColor } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { getOrGenerateAiSummary } from "@/lib/stiri/ai-summary";
import { AiSummary } from "./AiSummary";
import { NewsArticleJsonLd } from "@/components/JsonLd";
import { ReadingProgress } from "@/components/stiri/ReadingProgress";

const SOURCE_LOGOS: Record<string, string> = {
  "Digi24": "/images/sources/digi24.png",
  "Hotnews": "/images/sources/hotnews.png",
  "G4Media": "/images/sources/g4media.png",
  "Mediafax": "/images/sources/mediafax.png",
  "News.ro": "/images/sources/newsro.png",
  "B365.ro": "/images/sources/b365.png",
};

// Stire content is immutable once published, AI summary cached in DB.
// ISR 10 min is plenty for the rare case a summary gets regenerated.
export const revalidate = 600;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

interface StireRow {
  id: string;
  url: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  source: string;
  category: string;
  author: string | null;
  image_url: string | null;
  published_at: string;
  ai_summary: string | null;
  /** Version stamp matched against AI_SUMMARY_VERSION; older values
   *  trigger transparent regeneration. */
  ai_summary_version: number | null;
}

const getSupabase = createSupabaseAnon;

// The "Articole similare" rail only needs id/title/source/category/
// published_at/image_url. Skipping content + excerpt + ai_summary
// drops ~10-30 KB per row off the page payload, times 4 related
// articles per render times every revalidate cycle.
type RelatedStireRow = Pick<
  StireRow,
  "id" | "title" | "source" | "category" | "published_at" | "image_url"
>;

async function getRelatedArticles(stire: StireRow): Promise<RelatedStireRow[]> {
  try {
    const { data } = await getSupabase()
      .from("stiri_cache")
      .select("id,title,source,category,published_at,image_url")
      .neq("id", stire.id)
      .eq("category", stire.category)
      .order("published_at", { ascending: false })
      .limit(4);
    return (data ?? []) as RelatedStireRow[];
  } catch {
    return [];
  }
}

async function getStire(id: string): Promise<StireRow | null> {
  try {
    const { data, error } = await getSupabase()
      .from("stiri_cache")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return data as StireRow | null;
  } catch {
    return null;
  }
}

const categoryLabels: Record<string, string> = {
  transport: "Transport",
  urbanism: "Urbanism",
  mediu: "Mediu",
  siguranta: "Siguranță",
  administratie: "Administrație",
  eveniment: "Evenimente",
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const stire = await getStire(id);
  if (!stire) {
    return { title: "Știre inexistentă", robots: { index: false, follow: false } };
  }
  const title = stire.title;
  const description = stire.excerpt?.slice(0, 160) ?? `Știre din ${stire.source}`;
  const sectionLabel = categoryLabels[stire.category] ?? stire.category;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stiri/${id}` },
    authors: stire.author ? [{ name: stire.author }] : [{ name: "Civia" }],
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: stire.published_at,
      modifiedTime: stire.published_at,
      // article:section helps Google News + social previews place the
      // article in the right vertical (Politică, Sport, etc.).
      section: sectionLabel,
      authors: stire.author ? [stire.author] : ["Civia"],
      url: `${SITE_URL}/stiri/${id}`,
      siteName: "Civia",
      locale: "ro_RO",
      images: stire.image_url
        ? [{ url: stire.image_url, alt: stire.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: stire.image_url ? [stire.image_url] : undefined,
    },
    // News-specific signals for Google + Bingbot. Robots default is
    // index/follow; max-image-preview=large unlocks the big-image
    // Google News carousel card.
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
  };
}

export default async function StireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stire = await getStire(id);
  if (!stire) notFound();

  // Generate (or read cached) AI summary on the server so the first user
  // to open the article pays the Groq cost and every subsequent visitor
  // gets the summary pre-rendered in the initial HTML — no client fetch,
  // no flicker, no duplicate API calls.
  const aiSummary = await getOrGenerateAiSummary(stire);

  const related = await getRelatedArticles(stire);
  const sourceColor = SOURCE_COLORS[stire.source] ?? "#64748b";
  // Mid-tone variant for plain-text rendering on neutral surfaces — the
  // raw brand color is sometimes pure black (G4Media) which disappears
  // on dark theme. Borders + tinted backgrounds keep using the raw color.
  const sourceTextTint = sourceTextColor(stire.source);

  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <ReadingProgress />
      <NewsArticleJsonLd
        headline={stire.title}
        description={stire.excerpt ?? undefined}
        url={`${SITE_URL}/stiri/${stire.id}`}
        datePublished={stire.published_at}
        author={stire.author ?? undefined}
        sourceName={stire.source}
        sourceUrl={stire.url}
        image={stire.image_url ?? undefined}
      />
      <Link
        href="/stiri"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Toate știrile
      </Link>

      {/* Hero — on mobile the image stacks above the title (so long
          Romanian titles don't get clipped over a fixed-height image
          card). On md+ we keep the cinematic overlay with the title
          floating bottom-left. */}
      <div className="mb-8">
        {stire.image_url && (
          <>
            {/* Mobile: image on top, title below — no clipping. */}
            <div className="md:hidden">
              <div className="relative aspect-[16/9] rounded-[var(--radius-md)] overflow-hidden mb-4 bg-[var(--color-surface-2)]">
                <Image
                  src={stire.image_url}
                  alt={stire.title}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  priority
                  unoptimized
                />
              </div>
              <div className="flex gap-2 mb-3 flex-wrap">
                <Badge bgColor={sourceColor} color={readableTextColor(sourceColor)}>{stire.source}</Badge>
                <Badge variant="neutral" className="uppercase text-[10px]">
                  {categoryLabels[stire.category] ?? stire.category}
                </Badge>
              </div>
              <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold leading-tight">
                {stire.title}
              </h1>
            </div>

            {/* Desktop: full-bleed image with floating title overlay. */}
            <div className="relative h-[420px] rounded-[var(--radius-md)] overflow-hidden mb-6 bg-[var(--color-surface-2)] hidden md:block">
              <Image
                src={stire.image_url}
                alt={stire.title}
                fill
                sizes="896px"
                className="object-cover"
                priority
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex gap-2 mb-3 flex-wrap">
                  <Badge bgColor={sourceColor} color={readableTextColor(sourceColor)}>{stire.source}</Badge>
                  <Badge className="bg-white/20 text-white border border-white/30 uppercase text-[10px] backdrop-blur-sm">
                    {categoryLabels[stire.category] ?? stire.category}
                  </Badge>
                </div>
                <h1 className="font-[family-name:var(--font-sora)] text-4xl font-extrabold text-white leading-tight drop-shadow-lg">
                  {stire.title}
                </h1>
              </div>
            </div>
          </>
        )}

        {!stire.image_url && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              <Badge bgColor={sourceColor} color={readableTextColor(sourceColor)}>{stire.source}</Badge>
              <Badge variant="neutral" className="uppercase text-[10px]">
                {categoryLabels[stire.category] ?? stire.category}
              </Badge>
            </div>
            <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-4xl font-extrabold leading-tight mb-4">
              {stire.title}
            </h1>
          </>
        )}

        {/* Meta bar */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} aria-hidden="true" />
            <time dateTime={stire.published_at}>{formatDateTime(stire.published_at)}</time>
          </span>
          {stire.author && (
            <span className="flex items-center gap-1.5">
              <User size={14} aria-hidden="true" />
              {stire.author}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Tag size={14} aria-hidden="true" />
            {categoryLabels[stire.category] ?? stire.category}
          </span>
          <a
            href={stire.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline ml-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
            aria-label={`Citește articolul original pe ${stire.source} (deschide în tab nou)`}
          >
            <ExternalLink size={14} aria-hidden="true" />
            {stire.source}
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        <div>
          {/* Sinteză */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="w-7 h-7 rounded-[var(--radius-xs)] bg-gradient-to-br from-violet-500 to-fuchsia-600 grid place-items-center text-white"
                aria-hidden="true"
              >
                <Sparkles size={14} />
              </span>
              <div>
                <p className="font-[family-name:var(--font-sora)] font-bold text-sm leading-tight">Sinteză Civia</p>
                <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">Rezumat al articolului original</p>
              </div>
            </div>
            <AiSummary
              initialSummary={aiSummary}
              fallbackText={stire.excerpt || stire.content || ""}
              synthesizeUrl={`/api/stiri/${stire.id}/synthesize`}
            />
          </div>

          {/* Original content */}
          {(stire.excerpt || stire.content) && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 md:p-6 mb-6">
              <h2 className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-4 inline-flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] grid place-items-center"
                  style={{ color: sourceTextTint }}
                  aria-hidden="true"
                >
                  <Building2 size={11} />
                </span>
                Text original — {stire.source}
              </h2>
              {stire.excerpt && (
                <p
                  className="text-base leading-relaxed mb-4 font-medium border-l-4 pl-4 text-[var(--color-text-muted)]"
                  style={{ borderLeftColor: `${sourceColor}66` }}
                >
                  {stire.excerpt}
                </p>
              )}
              {stire.content && stire.content !== stire.excerpt && (
                <div className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                  {stire.content}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          {/* Source card — colored ring tinted by the source */}
          <div
            className="bg-[var(--color-surface)] border rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5"
            style={{ borderColor: `${sourceColor}40` }}
          >
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-3 inline-flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-[var(--radius-xs)] grid place-items-center"
                style={{ backgroundColor: `${sourceColor}1a`, color: sourceTextTint }}
                aria-hidden="true"
              >
                <Building2 size={11} />
              </span>
              Sursă
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-white/30 shrink-0"
                style={{ backgroundColor: sourceColor }}
              >
                {SOURCE_LOGOS[stire.source] ? (
                  <Image
                    src={SOURCE_LOGOS[stire.source] ?? ""}
                    alt={stire.source}
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain"
                  />
                ) : (
                  <span className="text-white font-bold text-base">{stire.source.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{stire.source}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {categoryLabels[stire.category] ?? stire.category}
                </p>
              </div>
            </div>
            <a
              href={stire.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 w-full justify-center h-11 rounded-[var(--radius-full)] text-white text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition-all shadow-[var(--shadow-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
              style={{ backgroundColor: sourceColor }}
              aria-label={`Citește articolul complet pe ${stire.source} (deschide în tab nou)`}
            >
              <ExternalLink size={14} aria-hidden="true" />
              Articolul complet
            </a>
          </div>

          {/* Info card — explains the AI synthesis + source provenance */}
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-2 inline-flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] grid place-items-center"
                aria-hidden="true"
              >
                <Info size={11} />
              </span>
              Despre
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              Civia agregă știri din surse verificate și generează automat o sinteză
              pentru înțelegere rapidă. Conținutul original aparține publicației{" "}
              <strong>{stire.source}</strong>.
            </p>
          </div>
        </aside>
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-bold mb-5 inline-flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center"
              aria-hidden="true"
            >
              <Tag size={13} />
            </span>
            Știri similare
            <span className="text-[10px] font-normal text-[var(--color-text-muted)]">
              ({related.length})
            </span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/stiri/${r.id}`}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 transition-all"
              >
                <div className="relative h-32 bg-gradient-to-br from-slate-600 to-slate-800">
                  {r.image_url ? (
                    <Image
                      src={r.image_url}
                      alt={r.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      unoptimized
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-white/20">{r.source.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-2 left-2">
                    <Badge bgColor={SOURCE_COLORS[r.source] ?? "#64748b"} color={readableTextColor(SOURCE_COLORS[r.source] ?? "#64748b")} className="text-[9px]">
                      {r.source}
                    </Badge>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-[var(--color-primary)] transition-colors">
                    {r.title}
                  </h3>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 inline-flex items-center gap-1">
                    <Calendar size={10} aria-hidden="true" />
                    {formatDateTime(r.published_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
