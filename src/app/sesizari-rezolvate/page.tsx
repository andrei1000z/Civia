import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, MapPin, Calendar, Send } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SESIZARE_TIPURI, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { formatDate } from "@/lib/utils";
import type { SesizareRow } from "@/lib/supabase/types";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Probleme rezolvate",
  description:
    `Galerie "înainte / după" cu sesizări rezolvate efectiv de primării și autorități. Dovada că implicarea civică mișcă lucrurile în România.`,
  alternates: { canonical: "/sesizari-rezolvate" },
};

// Resolved gallery is curated, low churn (a handful per week).
// 6 hours ISR keeps it fresh enough that a newly resolved sesizare
// surfaces same-day without burning regenerations.
export const revalidate = 21600;

// Subset of SesizareRow with only the columns the gallery actually
// renders — saves ~1-3 KB per row vs select("*"), times 48 rows
// per render times every 6h.
type ResolvedGalleryRow = Pick<
  SesizareRow,
  | "id"
  | "code"
  | "titlu"
  | "tip"
  | "locatie"
  | "imagini"
  | "resolved_photo_url"
  | "resolved_at"
>;

async function getResolved(): Promise<ResolvedGalleryRow[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("sesizari")
      .select("id,code,titlu,tip,locatie,imagini,resolved_photo_url,resolved_at")
      .eq("status", "rezolvat")
      .eq("publica", true)
      .eq("moderation_status", "approved")
      .order("resolved_at", { ascending: false })
      .limit(48);
    return (data as ResolvedGalleryRow[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function SesizariResolvatePage() {
  const resolved = await getResolved();

  const withPhotos = resolved.filter(
    (r) => r.resolved_photo_url && r.imagini.length > 0,
  );
  const withoutPhotos = resolved.filter(
    (r) => !r.resolved_photo_url || r.imagini.length === 0,
  );

  return (
    <div className="container-narrow py-8 md:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Sesizări rezolvate", url: `${SITE_URL}/sesizari-rezolvate` },
        ]}
      />
      <PageHero
        backHref="/sesizari"
        backLabel="Trimit și eu o sesizare"
        title="Probleme rezolvate — dovada că funcționează"
        icon={CheckCircle2}
        gradient={HERO_GRADIENT.success}
        description={`Fiecare poză „înainte / după" de mai jos este o sesizare trimisă prin Civia, acționată de primărie sau de autoritate. Scris-am, au răspuns, au reparat. Așa arată implicarea civică reală.`}
        tagline={
          <>
            {withPhotos.length} {withPhotos.length === 1 ? "poveste" : "povești"} reparate cu
            poză „după" · {resolved.length} sesizări rezolvate total
          </>
        }
      />

      {resolved.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <div
            className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto mb-4 grid place-items-center"
            aria-hidden="true"
          >
            <CheckCircle2 size={22} />
          </div>
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
            Galeria se completează în timp
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto leading-relaxed">
            Încă nu avem suficiente sesizări rezolvate cu poză „după". Ajută-ne să construim
            dovada — trimite o sesizare acum, iar când autoritatea o rezolvă încarcă și o poză „după".
          </p>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            <Send size={14} aria-hidden="true" />
            Fă o sesizare acum
          </Link>
        </div>
      ) : (
        <>
          {/* Before / After gallery */}
          {withPhotos.length > 0 && (
            <section className="mb-12">
              <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-5 inline-flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-[var(--radius-xs)] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center"
                  aria-hidden="true"
                >
                  <CheckCircle2 size={14} />
                </span>
                Înainte și după — galerie foto
              </h2>
              <div className="grid md:grid-cols-2 gap-5">
                {withPhotos.map((s) => {
                  const tipIcon = SESIZARE_TIPURI.find((t) => t.value === s.tip)?.icon ?? "📝";
                  return (
                    <Link
                      key={s.id}
                      href={`/sesizari/${s.code}`}
                      className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 transition-all"
                    >
                      <div className="grid grid-cols-2">
                        <div className="relative h-44 sm:h-48">
                          <Image
                            src={s.imagini[0] ?? ""}
                            alt="Înainte"
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="object-cover"
                            unoptimized
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/90 text-white backdrop-blur-sm">
                            Înainte
                          </span>
                        </div>
                        <div className="relative h-44 sm:h-48">
                          <Image
                            src={s.resolved_photo_url!}
                            alt="După"
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="object-cover"
                            unoptimized
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/95 text-white backdrop-blur-sm">
                            După
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-semibold leading-snug group-hover:text-[var(--color-primary)] transition-colors">
                          <span aria-hidden="true">{tipIcon}</span> {s.titlu}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--color-text-muted)] flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} aria-hidden="true" />
                            <span className="truncate max-w-[180px]">{s.locatie}</span>
                          </span>
                          {s.resolved_at && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={11} aria-hidden="true" />
                              {formatDate(s.resolved_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* List without photos */}
          {withoutPhotos.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-bold mb-4 text-[var(--color-text-muted)]">
                Alte rezolvări (fără poză „după")
              </h2>
              <div className="space-y-2">
                {withoutPhotos.map((s) => {
                  const tipIcon = SESIZARE_TIPURI.find((t) => t.value === s.tip)?.icon ?? "📝";
                  return (
                    <Link
                      key={s.id}
                      href={`/sesizari/${s.code}`}
                      className="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] px-4 py-3 hover:border-[var(--color-primary)]/30 hover:shadow-[var(--shadow-1)] transition-all"
                    >
                      <span
                        className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0"
                        aria-hidden="true"
                      >
                        <CheckCircle2 size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          <span aria-hidden="true">{tipIcon}</span> {s.titlu}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{s.locatie}</p>
                      </div>
                      {s.resolved_at && (
                        <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 tabular-nums">
                          {formatDate(s.resolved_at)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
