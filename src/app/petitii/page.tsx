import type { Metadata } from "next";
import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { Megaphone, ArrowRight, ExternalLink, Plus, Link as LinkIcon } from "lucide-react";
import { listPetitii } from "@/lib/petitii/repository";
import { CollectionPageJsonLd } from "@/components/JsonLd";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL, PETITIE_CATEGORII } from "@/lib/constants";
import { analyticsRedis } from "@/lib/analytics/redis";

const FAQ_PETITII = [
  {
    question: "Care e diferența între petiție și sesizare?",
    answer: "Sesizarea raportează o problemă concretă (groapă, parcare). Petiția cere o schimbare colectivă (lege, politică). Vezi /sesizare-vs-petitie pentru comparație completă.",
  },
  {
    question: "Câte semnături trebuie?",
    answer: "Nu există minim legal. 50+ semnături atrag atenția media. 10.000+ pentru petiții parlamentare cu impact real.",
  },
  {
    question: "Pot să iniți o petiție pe Civia?",
    answer: "Da, la /petitii/initiaza. Civia te ghidează cu titlu, descriere, autoritate-țintă, text formal cu AI.",
  },
  {
    question: "Pot semna anonim?",
    answer: "Nu. Constituția art. 51 cere identificare reală. Email + nume sunt obligatorii. Civia păstrează datele securizat în UE.",
  },
];
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { formatDateShort } from "@/lib/utils";

// Petitions list barely changes hour-to-hour — moderators add a
// handful per week. 60 s ISR was burning regenerations for no UX
// gain; 30 min still keeps the page feeling current and slashes
// origin transfer ~30×.
// 2026-05-19: 30min → 2h. Petitiile noi se adauga rar (admin manual).
export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Petiții civice",
  description:
    "Petiții civice cu impact real. Click → vezi argumentele, semnezi pe site-ul oficial. Mai multe voci = autoritățile răspund.",
  alternates: { canonical: "/petitii" },
};

/**
 * Self-healing pe vizita la /petitii: trimite POST la /api/petitii/scrape-updates
 * dacă lock-ul Redis nu e prins. TTL 24h → maxim un scrape pe zi indiferent
 * câți users vizitează. Lock-ul e NX SET ca să nu suprapunem dacă două req-uri
 * sosesc simultan.
 */
const SCRAPE_LOCK_KEY = "civia:petitii:scrape-updates:lock";
const SCRAPE_LOCK_TTL_S = 24 * 60 * 60; // 24h

async function maybeTriggerScrape() {
  if (!analyticsRedis) return;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;
  try {
    const lock = await analyticsRedis.set(SCRAPE_LOCK_KEY, Date.now(), {
      nx: true,
      ex: SCRAPE_LOCK_TTL_S,
    });
    if (lock !== "OK") return;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";
    await fetch(`${baseUrl}/api/petitii/scrape-updates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    // Background failure — next stale traffic retries.
  }
}

export default async function PetitiiPage() {
  const petitii = await listPetitii({ status: ["active", "closed"] });
  const active = petitii.filter((p) => p.status === "active");
  const closed = petitii.filter((p) => p.status === "closed");

  // Fire-and-forget after response sent.
  after(maybeTriggerScrape);

  return (
    <div className="container-narrow py-8 md:py-12">
      <CollectionPageJsonLd
        name="Petiții civice — Civia"
        description="Catalog cu petiții civice active. Click → semnează pe site-ul oficial. Mai multe voci = autoritățile răspund."
        url={`${SITE_URL}/petitii`}
      />
      <FaqJsonLd items={FAQ_PETITII} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Petiții civice", url: `${SITE_URL}/petitii` },
        ]}
      />

      <PageHero
        title="Petiții civice"
        icon={Megaphone}
        gradient={HERO_GRADIENT.petition}
        description={
          <>
            Curate de Civia + de la comunitate. Semnezi pe site sau pe sursa oficială.{" "}
            <strong>Multe voci pentru aceeași cauză.</strong>
          </>
        }
        tagline={
          <>
            {active.length} {active.length === 1 ? "petiție activă" : "petiții active"}
            {closed.length > 0 && ` · ${closed.length} încheiate`}
          </>
        }
      />

      {/* CTA — utilizatorii pot iniția propriile petiții */}
      <div className="mb-8 bg-gradient-to-br from-purple-500/10 via-[var(--color-surface)] to-indigo-500/5 border border-purple-500/30 rounded-[var(--radius-md)] p-4 md:p-5 flex items-start gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-[var(--radius-xs)] bg-purple-500/15 grid place-items-center shrink-0"
          aria-hidden="true"
        >
          <Plus size={18} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base mb-0.5">
            Ai o cauză pe care vrei să o promovezi?
          </p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Inițiază propria petiție pe Civia — verificare în 1-2 ore, apoi e publică.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/petitii/initiaza"
            className="lc-liquid lc-liquid-violet lc-magnetic inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-gradient-to-br from-violet-500/85 to-purple-600/85 text-white text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            <Plus size={14} aria-hidden="true" />
            Inițiază o petiție
          </Link>
          <Link
            href="/petitii/propune"
            title="Ai văzut o petiție pe alt site (Declic, Avaaz, …) și vrei să fie listată și aici? Propune-o."
            className="lc-liquid lc-liquid-violet lc-magnetic inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-purple-500/40 text-purple-700 dark:text-purple-300 text-sm font-semibold hover:bg-purple-500/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <LinkIcon size={14} aria-hidden="true" />
            Propune o petiție existentă
          </Link>
        </div>
      </div>

      {petitii.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-12">
              <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-5 flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-[var(--radius-xs)] bg-purple-500/15 text-purple-600 dark:text-purple-400 grid place-items-center"
                  aria-hidden="true"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                  </span>
                </span>
                Active
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 text-xs font-bold tabular-nums">
                  {active.length}
                </span>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
                {active.map((p) => (
                  <PetitieCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-bold mb-5 text-[var(--color-text-muted)] flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] grid place-items-center"
                  aria-hidden="true"
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]/50" />
                </span>
                Încheiate
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs font-bold tabular-nums">
                  {closed.length}
                </span>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-80">
                {closed.map((p) => (
                  <PetitieCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[280px] p-8 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] text-center">
      <div className="max-w-md">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center">
          <Megaphone size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
        </div>
        <h2 className="font-semibold text-lg mb-2">Nicio petiție activă acum</h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Verifică curând — adăugăm petiții când avem o cauză suficient
          de importantă pentru presiune publică. Între timp, poți trimite o
          sesizare individuală.
        </p>
        <Link
          href="/sesizari"
          className="inline-flex items-center gap-2 mt-5 h-11 px-5 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Fă o sesizare
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function PetitieCard({
  p,
}: {
  p: {
    slug: string;
    title: string;
    summary: string;
    image_url: string | null;
    category: string | null;
    county_code: string | null;
    status: string;
    ends_at: string | null;
    external_url: string | null;
    target_signatures: number;
    signature_count: number;
    external_signature_count?: number | null;
    last_external_sync_at?: string | null;
  };
}) {
  const cat = PETITIE_CATEGORII.find((c) => c.value === p.category);
  let externalHost: string | null = null;
  if (p.external_url) {
    try {
      externalHost = new URL(p.external_url).hostname.replace(/^www\./, "");
    } catch {
      externalHost = null;
    }
  }

  return (
    <Link
      href={`/petitii/${p.slug}`}
      className="group flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden card-lift hover:border-[var(--color-primary)]/30"
    >
      {p.image_url ? (
        <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-2)] overflow-hidden">
          <Image
            src={p.image_url}
            unoptimized
            alt={p.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="w-full aspect-[16/9] bg-gradient-to-br from-purple-500/20 via-purple-700/15 to-purple-900/20 flex items-center justify-center">
          <Megaphone size={48} className="text-purple-500/60" aria-hidden="true" />
        </div>
      )}
      <div className="flex-1 p-5 flex flex-col">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {cat && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400">
              <span aria-hidden="true">{cat.icon}</span> {cat.value}
            </span>
          )}
          {p.county_code ? (
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
              · {p.county_code}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
              · Național
            </span>
          )}
        </div>
        <h3 className="font-[family-name:var(--font-sora)] font-bold text-base md:text-lg mb-2 line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors leading-snug">
          {p.title}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] line-clamp-3 mb-4 leading-relaxed">
          {p.summary}
        </p>

        {/* 2026-06-06 (audit #5) — RESTAURAT nr. de semnături, dar acum cu
            numărul REAL sincronizat din sursă (external_signature_count), nu cel
            vechi/desincronizat din DB. Afișat doar când e sincronizat. */}
        {typeof p.external_signature_count === "number" && p.external_signature_count > 0 && (
          <div className="mb-4 flex items-center gap-1.5 text-sm">
            <Megaphone size={14} className="text-purple-500 shrink-0" aria-hidden="true" />
            <span className="font-bold text-[var(--color-text)]">
              {p.external_signature_count.toLocaleString("ro-RO")}
            </span>
            <span className="text-[var(--color-text-muted)]">
              semnături{externalHost ? ` pe ${externalHost}` : ""}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between text-xs">
          {externalHost && (
            <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
              <ExternalLink size={11} aria-hidden="true" />
              {externalHost}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] group-hover:gap-2 transition-all">
            Vezi detalii
            <ArrowRight size={12} aria-hidden="true" />
          </span>
        </div>
        {p.ends_at && (() => {
          const daysLeft = Math.ceil((new Date(p.ends_at).getTime() - Date.now()) / (24 * 3600 * 1000));
          const urgent = p.status !== "closed" && daysLeft > 0 && daysLeft <= 14;
          return (
            <p className={`text-[10px] mt-2 pt-2 border-t border-[var(--color-border)] inline-flex items-center gap-1 ${urgent ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-[var(--color-text-muted)]"}`}>
              {urgent && <span aria-hidden="true">🔥</span>}
              {p.status === "closed" ? "Încheiată " : urgent ? `Mai sunt ${daysLeft} ${daysLeft === 1 ? "zi" : "zile"} · până ` : "Până "}
              {formatDateShort(p.ends_at)}
            </p>
          );
        })()}
      </div>
    </Link>
  );
}
