import type { Metadata } from "next";
import Link from "next/link";
import { Vote, ExternalLink } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 🚀 BIG #10 — Decizii Deschise consilii locale.
 *
 * Lista propunerilor consiliilor locale (PMB, sectoare, capitale județe)
 * cu AI summary „Pe scurt → Ce schimbă → Cine câștigă → Cine pierde".
 */

export const metadata: Metadata = {
  title: "Decizii Deschise — Propuneri consiliu local",
  description:
    "Toate propunerile la dispoziția consiliilor locale (PMB, sectoare, capitale județe) cu rezumat AI + comments cetățenești.",
  alternates: { canonical: "/decizii-deschise" },
};

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface PropunereRow {
  id: string;
  consiliu: string;
  titlu: string;
  ai_summary: string | null;
  category: string | null;
  date_published: string;
  date_voting: string | null;
  vote_result: string | null;
  source_url: string | null;
}

export default async function DeciziiDeschisePage() {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("consiliu_propuneri")
    .select("id, consiliu, titlu, ai_summary, category, date_published, date_voting, vote_result, source_url")
    .order("date_published", { ascending: false })
    .limit(50);

  const items = (data ?? []) as PropunereRow[];

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Decizii Deschise"
        icon={Vote}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Toate propunerile la dispoziția consiliilor locale cu{" "}
            <strong>rezumat AI</strong> + spațiu pentru opinii cetățenești.
          </>
        }
        tagline="Transparență sistemică la nivel legislativ local."
      />

      <div className="my-6 flex flex-wrap gap-2">
        {["urbanism", "buget", "transport", "salubrizare", "cultura"].map((cat) => (
          <Link
            key={cat}
            href={`/decizii-deschise?cat=${cat}`}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
          >
            {cat}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--color-text-muted)]">
          <Vote size={32} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p>Niciun set de propuneri încă în baza de date.</p>
          <p className="text-xs mt-2">Scrapers încep să ruleze post-deploy mig 090.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((p) => (
            <li
              key={p.id}
              className="p-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold">
                    {p.consiliu}
                  </span>
                  {p.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                      {p.category}
                    </span>
                  )}
                  {p.vote_result && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.vote_result === "aprobat" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {p.vote_result}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                  {new Date(p.date_published).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
                </span>
              </div>
              <h2 className="text-base font-bold mb-2">
                <Link href={`/decizii-deschise/${p.id}`} className="hover:underline">
                  {p.titlu}
                </Link>
              </h2>
              {p.ai_summary && (
                <p className="text-sm text-[var(--color-text-muted)] mb-2">
                  {p.ai_summary}
                </p>
              )}
              <div className="flex items-center justify-between text-xs mt-3">
                <Link
                  href={`/decizii-deschise/${p.id}`}
                  className="text-[var(--color-primary)] font-medium hover:underline"
                >
                  Comentează & detalii →
                </Link>
                {p.source_url && (
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-[var(--color-text-muted)]"
                  >
                    Sursa oficială
                    <ExternalLink size={10} aria-hidden="true" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
