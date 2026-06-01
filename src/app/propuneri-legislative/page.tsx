import type { Metadata } from "next";
import Link from "next/link";
import { Scale, Plus, ChevronRight, Send } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { AUTHORITIES, CATEGORII_PROPUNERI, VOTE_THRESHOLD_SEND } from "@/lib/propuneri-legislative/authorities";
import { PropuneFormClient } from "./PropuneFormClient";

export const metadata: Metadata = {
  title: "Propuneri legislative cetățenești — Civia",
  description:
    "Propune schimbări la lege (Codul Rutier, urbanism, siguranță). AI formalizează textul, cetățenii susțin, Civia trimite oficial la MAI, IGPR, Parlament via Legea 52/2003.",
  alternates: { canonical: "/propuneri-legislative" },
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

interface PropunereRow {
  id: string;
  titlu: string;
  categorie: string;
  destinatar_key: string;
  votes_count: number;
  status: string;
  sent_at: string | null;
  author_display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
  ai_temei_legal: string | null;
}

export default async function PropuneriLegislativePage() {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("propuneri_legislative")
    .select("id, titlu, categorie, destinatar_key, votes_count, status, sent_at, author_display_name, is_anonymous, created_at, ai_temei_legal")
    .in("status", ["active", "sent"])
    .order("votes_count", { ascending: false })
    .limit(30);

  const items = (data ?? []) as PropunereRow[];

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Propuneri legislative cetățenești"
        icon={Scale}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Propune o schimbare la lege. AI scrie textul formal, cetățenii susțin,
            la <strong>{VOTE_THRESHOLD_SEND} susținători</strong> Civia trimite oficial
            la autoritate prin email — cu referință la <strong>Legea 52/2003</strong>.
          </>
        }
        tagline="De la idee la propunere oficială în 2 minute."
      />

      {/* CTA + stats */}
      <div className="my-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-sm text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">{items.length}</span> propuneri active
          {" · "}
          <span className="font-semibold text-emerald-600">{items.filter(i => i.status === "sent").length}</span> trimise la autorități
        </div>
        <PropuneFormClient />
      </div>

      {/* Cum funcționează */}
      <div className="mb-8 grid sm:grid-cols-3 gap-3">
        {[
          { step: "1", icon: "✍️", title: "Descrie problema", desc: "Scrie ce lege/regulament trebuie schimbat și de ce" },
          { step: "2", icon: "🤖", title: "AI formalizează", desc: "Groq AI scrie textul juridic structurat cu temei legal" },
          { step: "3", icon: "📬", title: "Cetățenii susțin → autoritatea primește", desc: `La ${VOTE_THRESHOLD_SEND} susținători, email oficial la MAI/IGPR/Parlament` },
        ].map((s) => (
          <div key={s.step} className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xs font-bold text-[var(--color-primary)]">Pasul {s.step}</span>
            </div>
            <p className="text-sm font-semibold mb-1">{s.title}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Lista propuneri */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <Scale size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold mb-1">Nicio propunere încă</p>
          <p className="text-sm text-[var(--color-text-muted)]">Fii primul care propune o schimbare la lege.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((p) => {
            const authority = AUTHORITIES[p.destinatar_key];
            const catMeta = CATEGORII_PROPUNERI.find(c => c.value === p.categorie);
            const pct = Math.min(100, Math.round((p.votes_count / VOTE_THRESHOLD_SEND) * 100));
            const isSent = p.status === "sent";

            return (
              <li key={p.id} className={`p-5 rounded-[var(--radius-md)] border transition-colors ${isSent ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" : "bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50"}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {catMeta && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                        {catMeta.icon} {catMeta.label}
                      </span>
                    )}
                    {authority && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold">
                        {authority.icon} {authority.shortName}
                      </span>
                    )}
                    {isSent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 font-semibold inline-flex items-center gap-1">
                        <Send size={8} />
                        Trimisă oficial
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                    {new Date(p.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
                  </span>
                </div>

                <h2 className="text-base font-bold mb-3">
                  <Link href={`/propuneri-legislative/${p.id}`} className="hover:underline">
                    {p.titlu}
                  </Link>
                </h2>

                {/* Progress bar */}
                {!isSent && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-muted)]">
                        <strong className="text-[var(--color-text)]">{p.votes_count}</strong> / {VOTE_THRESHOLD_SEND} susținători
                      </span>
                      <span className="font-bold text-[var(--color-primary)]">{pct}%</span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-primary)] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {p.votes_count >= VOTE_THRESHOLD_SEND * 0.8 && (
                      <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                        🔥 Aproape de trimitere — mai sunt {VOTE_THRESHOLD_SEND - p.votes_count} susținători!
                      </p>
                    )}
                  </div>
                )}

                {isSent && p.sent_at && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                    ✅ Trimisă la {authority?.name} pe{" "}
                    {new Date(p.sent_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}

                {p.ai_temei_legal && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-3 line-clamp-1">
                    ⚖️ {p.ai_temei_legal}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <Link
                    href={`/propuneri-legislative/${p.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {isSent ? "Vezi detalii" : "Susține propunerea"}
                    <ChevronRight size={14} />
                  </Link>
                  {!p.is_anonymous && p.author_display_name && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      de {p.author_display_name}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Disclaimer legal */}
      <div className="mt-8 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          <strong>Cum funcționează legal:</strong> Propunerile sunt transmise prin email în baza{" "}
          <strong>Legii 52/2003</strong> (transparență decizională) și <strong>OG 27/2002</strong> (petiții).
          Autoritățile au obligația legală să răspundă în <strong>30 de zile lucrătoare</strong>.
          Civia este un facilitator civic — nu garantează adoptarea propunerilor și nu reprezintă
          niciun partid politic sau ONG.
        </p>
      </div>
    </div>
  );
}
