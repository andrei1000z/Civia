import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Megaphone,
  Calendar,
  ExternalLink,
  ChevronLeft,
  CheckCircle2,
  Share2,
  Sparkles,
} from "lucide-react";
import { getPetitieBySlug, listPetitieUpdates } from "@/lib/petitii/repository";
import { SITE_URL, PETITIE_CATEGORII } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { ALL_COUNTIES } from "@/data/counties";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SharePetitie } from "./SharePetitie";
import { AiSummary } from "@/app/stiri/[id]/AiSummary";
import { getOrGeneratePetitieAiSummary } from "@/lib/petitii/ai-summary";

// Petition detail content (title, body, AI summary) is essentially
// frozen after creation. The signature count comes from the external
// platform, not us.
// 2026-05-19: 1h → 12h. Content nu se modifica deloc dupa create.
export const revalidate = 43200;

// 2026-05-24 PERF: prerendered all 12 petitii la build → instant TTFB
// pe toate paginile detail. dynamicParams=true ca să servim și slug-uri
// noi adăugate între build-uri (ISR on-demand pe miss).
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("petitii")
      .select("slug")
      .eq("status", "active")
      .limit(50);
    return (data ?? []).map((p) => ({ slug: (p as { slug: string }).slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPetitieBySlug(slug);
  if (!p) return {};

  const url = `${SITE_URL}/petitii/${p.slug}`;
  const title = `${p.title} — Petiție Civia`;
  const description = p.summary.slice(0, 200);
  const ogImages = p.image_url
    ? [{ url: p.image_url, width: 1200, height: 630, alt: p.title }]
    : [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: p.title }];

  return {
    title,
    description,
    alternates: { canonical: `/petitii/${p.slug}` },
    openGraph: {
      title: p.title,
      description,
      url,
      type: "article",
      siteName: "Civia",
      locale: "ro_RO",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: p.title,
      description,
      images: ogImages.map((i) => i.url),
    },
    other: {
      "og:image:secure_url": ogImages[0]?.url ?? "",
    },
  };
}

export default async function PetitiePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const petitie = await getPetitieBySlug(slug);
  if (!petitie) notFound();

  // Generate (or read cached) AI synthesis on the server so the first
  // visitor pays the Groq cost and every subsequent one sees the
  // structured summary in the initial HTML — no client fetch, no flash.
  const [aiSummary, petitieUpdates] = await Promise.all([
    getOrGeneratePetitieAiSummary({
      id: petitie.id,
      title: petitie.title,
      summary: petitie.summary,
      body: petitie.body,
      category: petitie.category,
      ai_summary: petitie.ai_summary ?? null,
      ai_summary_version: petitie.ai_summary_version ?? 0,
    }),
    listPetitieUpdates(petitie.id),
  ]);

  const isActive = petitie.status === "active";
  const cat = PETITIE_CATEGORII.find((c) => c.value === petitie.category);
  const county = petitie.county_code
    ? ALL_COUNTIES.find((c) => c.id === petitie.county_code)
    : null;

  let externalHost: string | null = null;
  if (petitie.external_url) {
    try {
      externalHost = new URL(petitie.external_url).hostname.replace(/^www\./, "");
    } catch {
      externalHost = null;
    }
  }

  const shareUrl = `${SITE_URL}/petitii/${petitie.slug}`;

  return (
    <article className="container-narrow py-6 md:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Petiții", url: `${SITE_URL}/petitii` },
          { name: petitie.title, url: shareUrl },
        ]}
      />

      <Link
        href="/petitii"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        Toate petițiile
      </Link>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">
        {/* MAIN COLUMN */}
        <div className="min-w-0">
          {/* Image banner */}
          {petitie.image_url ? (
            <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] bg-[var(--color-surface-2)] rounded-[var(--radius-md)] overflow-hidden mb-5 md:mb-6">
              <Image
                src={petitie.image_url}
                unoptimized
                alt={petitie.title}
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] bg-gradient-to-br from-purple-600 via-purple-800 to-[#1a0a2e] rounded-[var(--radius-md)] flex items-center justify-center mb-5 md:mb-6">
              <Megaphone size={64} className="sm:hidden text-white/60" aria-hidden="true" />
              <Megaphone size={96} className="hidden sm:block text-white/60" aria-hidden="true" />
            </div>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {cat && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                <span aria-hidden="true">{cat.icon}</span> {cat.value}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              {county ? `📍 ${county.name}` : "🇷🇴 Național"}
            </span>
            {!isActive && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                Încheiată
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-[family-name:var(--font-sora)] text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[1.15] tracking-tight mb-3 md:mb-4 break-words">
            {petitie.title}
          </h1>

          {/* audit fix: social proof (nr. semnături) + bară de progres — readuse la
              momentul deciziei de semnare. Înainte dispăreau pe pagina de detaliu
              (formularul de inițiere promitea bara, dar nu se randa niciodată). */}
          {(() => {
            const signatures = petitie.external_signature_count ?? petitie.signature_count ?? 0;
            const target = petitie.target_signatures ?? 0;
            if (signatures <= 0 && target <= 0) return null;
            const pct = target > 0 ? Math.min(100, Math.round((signatures / target) * 100)) : 0;
            return (
              <div className="mb-4 md:mb-5">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-baseline gap-1.5 text-sm">
                    <span className="font-extrabold text-xl text-[var(--color-text)] tabular-nums">{signatures.toLocaleString("ro-RO")}</span>
                    <span className="text-[var(--color-text-muted)]">semnături{externalHost ? ` pe ${externalHost}` : ""}</span>
                  </span>
                  {target > 0 && (
                    <span className="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0">
                      din {target.toLocaleString("ro-RO")} · {pct}%
                    </span>
                  )}
                </div>
                {target > 0 && (
                  <div
                    className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden"
                    role="progressbar"
                    aria-valuenow={signatures}
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-label="Progres semnături"
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-700 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Adresant — către cine se adresează petiția. Apare imediat
              sub titlu ca să fie clar cine ar trebui să răspundă. */}
          {petitie.addressee && (
            <p className="text-sm md:text-base text-[var(--color-text)] mb-3 md:mb-4 inline-flex items-start gap-2 break-words">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 mt-0.5">
                Către
              </span>
              <span className="font-medium">{petitie.addressee}</span>
            </p>
          )}

          {/* Date pill */}
          {petitie.ends_at && (
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5 mb-5">
              <Calendar size={13} aria-hidden="true" />
              {petitie.status === "closed" ? "Încheiată " : "Activă până "}
              {formatDate(petitie.ends_at)}
            </p>
          )}

          {/* MOBILE-ONLY top sign CTA — appears RIGHT AFTER title before scrolling.
              Pe desktop e în sidebar dreapta. */}
          {petitie.external_url && isActive && (
            <a
              href={petitie.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="lg:hidden w-full inline-flex items-center justify-center gap-2 h-12 px-5 mb-6 rounded-[var(--radius-full)] bg-purple-600 hover:bg-purple-700 active:scale-[0.97] text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <Megaphone size={16} aria-hidden="true" />
              {externalHost ? `Semnează pe ${externalHost}` : "Semnează acum"}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}

          {/* Summary — bigger lead paragraph */}
          <p className="text-base sm:text-lg text-[var(--color-text)] mb-6 leading-relaxed font-medium">
            {petitie.summary}
          </p>

          {/* AI synthesis — same structured output as /stiri/[id]: bullets,
              bold spans, inline number highlights, reading-time + copy +
              listen toolbar. Generated server-side on first visit, cached
              in petitii.ai_summary. */}
          {aiSummary && (
            <section
              aria-label="Sinteză Civia"
              className="mb-7 bg-[var(--color-surface)] border border-purple-500/30 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-7 h-7 rounded-[var(--radius-xs)] bg-gradient-to-br from-purple-500 to-fuchsia-600 grid place-items-center text-white"
                  aria-hidden="true"
                >
                  <Sparkles size={14} />
                </span>
                <div>
                  <p className="font-[family-name:var(--font-sora)] font-bold text-sm leading-tight">
                    Sinteză Civia
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">
                    Rezumat al cererii și impactului
                  </p>
                </div>
              </div>
              <AiSummary
                initialSummary={aiSummary}
                fallbackText={petitie.summary || petitie.body || ""}
              />
            </section>
          )}

          {/* Updates timeline — actualizări scrape-uite zilnic de la inițiator
              (Declic „Campania în 5 minute"). Apar doar dacă există măcar 1.
              Push notif se trimite automat pentru fiecare update nou (vezi
              /api/petitii/scrape-updates). */}
          {petitieUpdates.length > 0 && (
            <section id="updates" className="bg-[var(--color-surface)] border border-purple-500/30 rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 md:p-6 scroll-mt-24">
              <div className="flex items-start gap-3 mb-5">
                <div
                  className="w-9 h-9 rounded-[var(--radius-xs)] bg-purple-500/15 grid place-items-center shrink-0"
                  aria-hidden="true"
                >
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-[family-name:var(--font-sora)] font-bold text-base md:text-lg leading-tight">
                    Actualizări de la inițiator
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {petitieUpdates.length === 1
                      ? "1 actualizare"
                      : `${petitieUpdates.length} actualizări`}
                    {externalHost && ` · scrape zilnic de pe ${externalHost}`}
                  </p>
                </div>
              </div>
              <ol className="space-y-5 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-purple-500/20">
                {petitieUpdates.map((u) => (
                  <li key={u.id} className="pl-6 relative">
                    <span
                      className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-purple-500 ring-4 ring-[var(--color-surface)]"
                      aria-hidden="true"
                    />
                    {u.update_date && (
                      <time
                        dateTime={u.update_date}
                        className="block text-[10px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400 mb-1"
                      >
                        {formatDate(u.update_date)}
                      </time>
                    )}
                    <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base mb-2 leading-snug">
                      {u.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line">
                      {u.body}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Body — collapsed by default when AI synthesis exists (the
              synthesis is the better read); open by default otherwise */}
          <details
            className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 md:p-6"
            {...(aiSummary ? {} : { open: true })}
          >
            <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] inline-flex items-center gap-2 transition-colors">
              <span
                className="w-5 h-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] grid place-items-center text-[var(--color-text-muted)] group-open:bg-[var(--color-primary-soft)] group-open:text-[var(--color-primary-on-soft)] transition-colors"
                aria-hidden="true"
              >
                <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
              </span>
              Text original al petiției
            </summary>
            <div className="text-[15px] sm:text-base text-[var(--color-text)] leading-[1.7] whitespace-pre-line mt-4 pt-4 border-t border-[var(--color-border)]">
              {petitie.body}
            </div>
          </details>

          {/* Inline CTA after body — desktop + mobile (al doilea touchpoint) */}
          {petitie.external_url && isActive && (
            <div className="mt-8 md:mt-10 p-5 sm:p-6 rounded-[var(--radius-lg)] bg-gradient-to-br from-purple-600 to-purple-800 text-white">
              <p className="text-[10px] uppercase tracking-wider font-bold opacity-90 mb-2 inline-flex items-center gap-1">
                <Megaphone size={12} aria-hidden="true" /> Susține petiția
              </p>
              <h2 className="font-[family-name:var(--font-sora)] text-lg sm:text-xl md:text-2xl font-bold mb-3 leading-tight">
                {externalHost ? `Semnează pe ${externalHost}` : "Semnează acum"}
              </h2>
              <p className="text-sm text-white/90 mb-5 leading-relaxed">
                Civia agregă petițiile civice. Click → semnezi pe site-ul oficial unde
                petiția a fost lansată. O secundă, niciun spam, nu stocăm date despre
                semnătura ta.
              </p>
              <a
                href={petitie.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-full)] bg-white text-purple-700 font-semibold hover:bg-white/90 active:scale-[0.97] transition-all shadow-[var(--shadow-3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-700"
              >
                {externalHost ? `Mergi pe ${externalHost}` : "Semnează"}
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          )}

          {!isActive && (
            <div className="mt-6 md:mt-8 p-4 sm:p-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <p className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
                Petiție încheiată
              </p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Nu mai primește semnături. O lăsăm publică pentru transparență.
              </p>
            </div>
          )}

          {/* 2026-05-19 — Feature J: Petitie → Sesizare pipeline.
              Sugereaza utilizatorului ce poate face LOCAL: dupa ce a
              semnat petitia nationala, depune si o sesizare concreta
              catre primarie. Cross-pollination civic. */}
          {(() => {
            // Map de la categoria petitiei la tipul de sesizare relevant.
            const PETITIE_TO_SESIZARE: Record<string, { tip: string; pitch: string }> = {
              Mediu: { tip: "copac", pitch: "Vezi un copac taiat, gunoi pe spatiu verde sau alta problema de mediu in cartierul tau?" },
              Transport: { tip: "transport", pitch: "Banda autobuz blocata, semafor stricat, sau o problema de transport in zona ta?" },
              Sănătate: { tip: "altele", pitch: "Vezi probleme locale legate de sanatate publica (gunoi netoxic, lipsa servicii)?" },
              Locuințe: { tip: "trotuar", pitch: "Vezi probleme de urbanism in cartierul tau (trotuare, spatii verzi, mobilier urban)?" },
              Siguranță: { tip: "iluminat", pitch: "Iluminat stricat, parcare ilegala, sau alte probleme de siguranta in zona?" },
              Animale: { tip: "altele", pitch: "Vezi animale fara stapan, abuzate sau alte probleme legate de drepturile animalelor local?" },
              Cultură: { tip: "altele", pitch: "Vezi probleme legate de patrimoniu local sau cultura (cladiri istorice degradate)?" },
            };
            const mapped = petitie.category ? PETITIE_TO_SESIZARE[petitie.category] : null;
            if (!mapped) return null;
            return (
              <div className="mt-6 p-4 sm:p-5 rounded-[var(--radius-md)] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300 mb-2 inline-flex items-center gap-1">
                  <Sparkles size={11} aria-hidden="true" /> Si la nivel local?
                </p>
                <h3 className="font-semibold text-sm sm:text-base mb-2 text-[var(--color-text)]">
                  {mapped.pitch}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
                  Depune o sesizare concreta catre primaria ta — Civia
                  formalizeaza textul, gaseste autoritatile si trimite. 90 secunde.
                </p>
                <Link
                  href={`/sesizari?tip=${mapped.tip}`}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-xs)] bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  Fă o sesizare locală
                  <ChevronLeft size={14} className="rotate-180" aria-hidden="true" />
                </Link>
              </div>
            );
          })()}

          {/* MOBILE-ONLY share — directly after content (touch within thumb reach) */}
          <div className="lg:hidden mt-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-1">
              <Share2 size={11} aria-hidden="true" /> Distribuie petiția
            </p>
            <SharePetitie url={shareUrl} title={petitie.title} summary={petitie.summary} />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
              Mai mulți oameni = mai multe semnături.
            </p>
          </div>

        </div>

        {/* DESKTOP-ONLY SIDEBAR — hidden pe mobile (CTA + share + cross sunt
            inline în main content pentru fiecare touchpoint vizibil din scroll). */}
        <aside className="hidden lg:block lg:sticky lg:top-24 space-y-3">
          {petitie.external_url && isActive && (
            <div className="bg-[var(--color-surface)] border border-purple-500/30 rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-2)]">
              <p className="text-[10px] uppercase tracking-wider font-bold text-purple-700 dark:text-purple-400 mb-3 inline-flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded-[var(--radius-xs)] bg-purple-500/15 grid place-items-center"
                  aria-hidden="true"
                >
                  <Megaphone size={11} />
                </span>
                Semnează aici
              </p>
              <a
                href={petitie.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-full)] bg-gradient-to-br from-purple-600 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-800 active:scale-[0.97] text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
              >
                <Megaphone size={16} aria-hidden="true" />
                Mergi pe {externalHost}
              </a>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-3 text-center leading-relaxed">
                Petiția e găzduită pe <strong>{externalHost}</strong>. Civia o
                agregă pentru vizibilitate — <strong>nu stocăm date despre semnătura ta</strong>.
              </p>
            </div>
          )}

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-1)]">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-[var(--radius-xs)] bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 grid place-items-center"
                aria-hidden="true"
              >
                <Share2 size={11} />
              </span>
              Distribuie petiția
            </p>
            <SharePetitie url={shareUrl} title={petitie.title} summary={petitie.summary} />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
              Mai mulți oameni = mai multe semnături.
            </p>
          </div>

        </aside>
      </div>

      {/* 2026-05-25 — Sticky bottom sign bar mobile.
          Mereu vizibil la scroll, garantează că CTA-ul rămâne mereu la îndemână.
          Hide pe desktop (sidebar are deja sign button). Hide când petiția
          e închisă. Respectă safe-area-inset-bottom pentru iOS notch. */}
      {petitie.external_url && isActive && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom,0px)] bg-[var(--color-bg)]/95 backdrop-blur border-t border-[var(--color-border)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3.5rem)" }}
        >
          <div className="container-narrow py-3 px-3">
            <a
              href={petitie.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 h-12 px-5 rounded-[var(--radius-full)] bg-gradient-to-br from-purple-600 to-fuchsia-600 hover:brightness-110 active:scale-[0.97] text-white text-sm font-bold transition-all shadow-[0_8px_24px_-4px_rgba(147,51,234,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              <Megaphone size={18} aria-hidden="true" />
              {externalHost ? `Semnează pe ${externalHost}` : "Semnează acum"}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </article>
  );
}
