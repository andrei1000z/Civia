import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Scale, ExternalLink, Send, ChevronLeft } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { AUTHORITIES, CATEGORII_PROPUNERI, VOTE_THRESHOLD_SEND, VOTE_THRESHOLD_PRESS } from "@/lib/propuneri-legislative/authorities";
import { SITE_URL } from "@/lib/constants";
import { VoteButtonClient } from "./VoteButtonClient";
import type { LegislativeFormalResult } from "@/lib/propuneri-legislative/prompts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("propuneri_legislative")
    .select("titlu, destinatar_key, votes_count")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "Propunere — Civia" };
  const p = data as { titlu: string; destinatar_key: string; votes_count: number };
  const authority = AUTHORITIES[p.destinatar_key];

  return {
    title: `${p.titlu} — Propunere legislativă Civia`,
    description: `${p.votes_count} cetățeni susțin această propunere adresată ${authority?.shortName ?? p.destinatar_key}. Susține și tu pe Civia.ro.`,
    openGraph: {
      title: p.titlu,
      description: `${p.votes_count} cetățeni susțin · Destinatar: ${authority?.name ?? p.destinatar_key}`,
      url: `${SITE_URL}/propuneri-legislative/${id}`,
    },
  };
}

export default async function PropunereLegislativaPage({ params }: Props) {
  const { id } = await params;
  const admin = createSupabaseAdmin();

  // Paralelizăm fetch-ul propunerii + comentariile (independente) → o singură
  // rundă de latență în loc de două secvențiale pe o pagină force-dynamic.
  const [propRes, comentariiRes] = await Promise.all([
    admin
      .from("propuneri_legislative")
      .select("*")
      .eq("id", id)
      .in("status", ["active", "sent"])
      .maybeSingle(),
    admin
      .from("propuneri_comentarii")
      .select("id, content, display_name, created_at")
      .eq("propunere_id", id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  const { data } = propRes;
  const { data: comentarii } = comentariiRes;

  if (!data) notFound();

  const p = data as {
    id: string;
    titlu: string;
    problema: string;
    solutia: string;
    categorie: string;
    destinatar_key: string;
    votes_count: number;
    status: string;
    sent_at: string | null;
    author_display_name: string | null;
    is_anonymous: boolean;
    created_at: string;
    ai_formal_text: string | null;
    ai_temei_legal: string | null;
    ai_impact: string | null;
    ai_precedente: string | null;
  };

  const authority = AUTHORITIES[p.destinatar_key];
  const catMeta = CATEGORII_PROPUNERI.find(c => c.value === p.categorie);
  const isSent = p.status === "sent";
  const pct = Math.min(100, Math.round((p.votes_count / VOTE_THRESHOLD_SEND) * 100));

  let formal: LegislativeFormalResult | null = null;
  if (p.ai_formal_text) {
    try { formal = JSON.parse(p.ai_formal_text) as LegislativeFormalResult; } catch { /* ignore */ }
  }

  return (
    <div className="container-narrow py-8 md:py-12">
      {/* Back */}
      <Link
        href="/propuneri-legislative"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-6"
      >
        <ChevronLeft size={14} />
        Toate propunerile
      </Link>

      {/* Status badge */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {catMeta && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            {catMeta.icon} {catMeta.label}
          </span>
        )}
        {authority && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold">
            {authority.icon} {authority.shortName}
          </span>
        )}
        {isSent && (
          <Badge variant="success" className="font-semibold">
            <Send size={10} />
            Trimisă oficial
          </Badge>
        )}
      </div>

      <h1 className="text-2xl md:text-3xl font-bold mb-2">
        {formal?.titlu_formal ?? p.titlu}
      </h1>

      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        {!p.is_anonymous && p.author_display_name && (
          <>Propus de <strong>{p.author_display_name}</strong> · </>
        )}
        {new Date(p.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Votes + progress */}
      <div className={`p-5 rounded-[var(--radius-md)] border mb-6 ${isSent ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200" : "bg-[var(--color-surface-2)] border-[var(--color-border)]"}`}>
        {isSent ? (
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600 mb-1">✅ Trimisă oficial!</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Susținută de <strong>{p.votes_count} cetățeni</strong> și trimisă la{" "}
              <strong>{authority?.name}</strong>
              {p.sent_at && ` pe ${new Date(p.sent_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}`}.
              Autoritatea are 30 de zile lucrătoare să răspundă.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-3xl font-bold tabular-nums">{p.votes_count}</p>
                <p className="text-xs text-[var(--color-text-muted)]">cetățeni susțin · target {VOTE_THRESHOLD_SEND}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--color-primary)]">{pct}%</p>
                <p className="text-xs text-[var(--color-text-muted)]">din prag trimitere</p>
              </div>
            </div>
            <div className="h-3 bg-[var(--color-surface)] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[var(--color-primary)] transition-all duration-700 ease-out rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            {p.votes_count >= VOTE_THRESHOLD_SEND * 0.8 && p.votes_count < VOTE_THRESHOLD_SEND && (
              <p className="text-xs text-amber-600 font-semibold mb-3">
                🔥 Doar {VOTE_THRESHOLD_SEND - p.votes_count} susținători până la trimitere automată la {authority?.shortName}!
              </p>
            )}
            {p.votes_count >= VOTE_THRESHOLD_PRESS && (
              <p className="text-xs text-purple-600 font-semibold mb-3">
                🗞️ {p.votes_count}+ susținători — presă notificată!
              </p>
            )}
            <VoteButtonClient propunereId={p.id} currentCount={p.votes_count} threshold={VOTE_THRESHOLD_SEND} />
          </>
        )}
      </div>

      {/* Conținut original */}
      <div className="space-y-5 mb-8">
        <section>
          <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Problema identificată</h2>
          <p className="text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{formal?.problema_formala ?? p.problema}</p>
        </section>
        <section>
          <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Soluția propusă</h2>
          <p className="text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{formal?.solutia_formala ?? p.solutia}</p>
        </section>
      </div>

      {/* AI formal sections */}
      {formal && (
        <div className="mb-8 p-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
          <p className="text-xs font-bold text-[var(--color-primary)] mb-4 flex items-center gap-1.5">
            <Scale size={12} />
            Document formal generat de AI (Groq Llama) — Legea 52/2003
          </p>
          <div className="space-y-4">
            {formal.temei_legal && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">⚖️ Temei legal</p>
                <p className="text-sm leading-relaxed">{formal.temei_legal}</p>
              </div>
            )}
            {formal.impact_estimat && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">📊 Impact estimat</p>
                <p className="text-sm leading-relaxed">{formal.impact_estimat}</p>
              </div>
            )}
            {formal.precedente && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">🌍 Precedente</p>
                <p className="text-sm leading-relaxed">{formal.precedente}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autoritate info */}
      {authority && (
        <div className="mb-8 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
          <p className="text-sm font-semibold mb-1">{authority.icon} Destinatar: {authority.name}</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">{authority.description}</p>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
            <span>📬 {authority.email}</span>
            <span>📍 {authority.address}</span>
          </div>
          <a
            href={authority.website}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] mt-2 hover:underline"
          >
            Site oficial <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* Comentarii */}
      <section>
        <h2 className="text-base font-bold mb-4">
          Discuție ({(comentarii ?? []).length} comentarii)
        </h2>
        {(comentarii ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Niciun comentariu. Fii primul!</p>
        ) : (
          <ul className="space-y-3">
            {(comentarii ?? []).map((c: { id: string; content: string; display_name: string | null; created_at: string }) => (
              <li key={c.id} className="p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">{c.display_name ?? "Anonim"}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(c.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
