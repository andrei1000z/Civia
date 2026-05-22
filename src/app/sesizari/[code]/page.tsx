import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, User, Clock, UserPlus, FileText, Image as ImageIcon, Map as MapIcon, Scroll } from "lucide-react";
import {
  getSesizareByCode,
  getTimeline,
  getComments,
  getUserVote,
  getUserVerification,
  getSimilarSesizari,
  isFollowing,
} from "@/lib/sesizari/repository";
import { createSupabaseServer } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS, SESIZARE_TIPURI } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { VoteButtons } from "@/components/sesizari/VoteButtons";
import { CommentsSection } from "@/components/sesizari/CommentsSection";
import { EvenimentMap } from "@/components/maps/EvenimentMap";
import { SignSesizareButton } from "@/components/sesizari/SignSesizareButton";
import { CosignersBadge } from "@/components/sesizari/CosignersBadge";
import { publicAuthorName } from "@/lib/sesizari/display-name";
import { MarkResolvedButton } from "@/components/sesizari/MarkResolvedButton";
import { ShareMenu } from "@/components/sesizari/ShareMenu";
import { BeforeAfter } from "@/components/sesizari/BeforeAfter";
import { VerifyPanel } from "@/components/sesizari/VerifyPanel";
import { SimilarSesizari } from "@/components/sesizari/SimilarSesizari";
import { FollowButton } from "@/components/sesizari/FollowButton";
import { ResendButton } from "@/components/sesizari/ResendButton";
import { DeleteSesizareButton } from "@/components/sesizari/DeleteSesizareButton";
import { StatusTicketButton } from "@/components/sesizari/StatusTicketButton";
import { PhotoGallery } from "@/components/sesizari/PhotoGallery";
import { RepliesSection } from "@/components/sesizari/RepliesSection";
import { OverdueBadge } from "@/components/sesizari/OverdueBadge";
import { ReminderButton } from "@/components/sesizari/ReminderButton";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { GovernmentServiceJsonLd } from "@/components/JsonLd";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { getSesizareEventMeta, isRedundantEventDescription } from "@/lib/sesizari/events";
import { stripPrivateAddress } from "@/lib/privacy";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Event labels + icons + colors live in src/lib/sesizari/events.ts so
// /urmareste, this page, and any future surface stay in sync.

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> }
): Promise<Metadata> {
  const { code } = await params;
  const s = await getSesizareByCode(code);
  return {
    title: s ? s.titlu : "Sesizare negăsită",
    description: s?.descriere.slice(0, 160) ?? "",
    alternates: { canonical: `/sesizari/${code}` },
    openGraph: {
      title: s?.titlu,
      description: s?.descriere.slice(0, 160),
      type: "article",
    },
  };
}

export default async function SesizareDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const sesizare = await getSesizareByCode(code);
  if (!sesizare) notFound();

  const [timeline, comments, similar] = await Promise.all([
    getTimeline(sesizare.id),
    getComments(sesizare.id),
    getSimilarSesizari(sesizare.id, 300),
  ]);

  // Check if current user has voted / verified
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  let userVote: -1 | 1 | null = null;
  let userVerification: boolean | null = null;
  let userFollowing = false;
  if (user) {
    userVote = await getUserVote({ sesizareId: sesizare.id, userId: user.id });
    userVerification = await getUserVerification({
      sesizareId: sesizare.id,
      userId: user.id,
    });
    userFollowing = await isFollowing({ sesizareId: sesizare.id, userId: user.id });
  }

  const isAuthor = user
    ? sesizare.user_id === user.id || sesizare.author_email === user.email
    : false;

  // Poză "before" pentru before/after: prima imagine a sesizării (dacă există)
  const beforeUrl = sesizare.imagini.length > 0 ? sesizare.imagini[0] : null;
  const afterUrl = sesizare.resolved_photo_url;
  const isResolved = sesizare.status === "rezolvat";
  const hasBeforeAfter = isResolved && beforeUrl && afterUrl;

  const tipLabel = SESIZARE_TIPURI.find((t) => t.value === sesizare.tip)?.label ?? sesizare.tip;
  const tipIcon = SESIZARE_TIPURI.find((t) => t.value === sesizare.tip)?.icon ?? "📝";

  return (
    <div className="container-narrow py-8 md:py-12">
      <BreadcrumbJsonLd items={[
        { name: "Civia", url: SITE_URL },
        { name: "Sesizări", url: `${SITE_URL}/sesizari` },
        { name: sesizare.titlu, url: `${SITE_URL}/sesizari/${sesizare.code}` },
      ]} />
      <GovernmentServiceJsonLd
        code={sesizare.code}
        titlu={sesizare.titlu}
        tip={tipLabel}
        locatie={sesizare.locatie}
        descriere={sesizare.descriere ?? undefined}
        url={`${SITE_URL}/sesizari/${sesizare.code}`}
        providerName={
          getAuthoritiesFor(sesizare.tip, sesizare.sector, sesizare.county, sesizare.locatie)
            .primary[0]?.name ?? "Primăria locală"
        }
        createdAt={sesizare.created_at}
        status={STATUS_LABELS[sesizare.status] ?? sesizare.status}
      />
      <Link
        href="/sesizari-publice"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Toate sesizările publice
      </Link>

      {/* Hero header — glass card tinted by status color so the page leads
          with the most important signal: where this sesizare stands now. */}
      {(() => {
        const statusColor = STATUS_COLORS[sesizare.status] ?? "#64748B";
        const statusLabel = STATUS_LABELS[sesizare.status] ?? sesizare.status;
        return (
          <header
            className="relative mb-6 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-2)] p-5 md:p-6"
            style={{
              backgroundImage: `linear-gradient(135deg, ${statusColor}1f, transparent 55%)`,
            }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="neutral" className="inline-flex items-center gap-1">
                  <span aria-hidden="true">{tipIcon}</span>
                  {tipLabel}
                </Badge>
                <Badge variant="neutral">{sesizare.sector}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: statusColor }}
                    aria-hidden="true"
                  />
                  {statusLabel}
                </span>
                <span
                  className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tabular-nums"
                  aria-label={`Cod sesizare ${sesizare.code}`}
                >
                  {sesizare.code}
                </span>
                <OverdueBadge
                  createdAt={sesizare.created_at}
                  status={sesizare.status}
                  officialResponseAt={sesizare.official_response_at ?? null}
                  variant="full"
                />
              </div>
            </div>
            <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-4xl font-extrabold leading-tight mb-3">
              {sesizare.titlu}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)] mb-5">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} aria-hidden="true" />
                {sesizare.locatie}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User size={12} aria-hidden="true" />
                {publicAuthorName({
                  display_name: sesizare.author_display_name,
                  author_name: sesizare.author_name,
                })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} aria-hidden="true" />
                <time dateTime={sesizare.created_at}>{formatDate(sesizare.created_at)}</time>
              </span>
            </div>
            <CosignersBadge code={sesizare.code} />
            {/* 5/22/2026 — Resend alert pentru ghost-sends / bounces.
                Vizibil DOAR pentru autor + DOAR dacă există problemă. */}
            {isAuthor && (
              <ResendButton
                code={sesizare.code}
                deliveryStatus={(sesizare as unknown as { delivery_status?: string | null }).delivery_status ?? null}
                isGhostSend={
                  sesizare.sent_via_civia === true &&
                  !(sesizare as unknown as { resend_message_id?: string | null }).resend_message_id
                }
              />
            )}
            {/* Action row: butoane standardizate (h-10 cu wrap) in ordine
                de prioritate vizuala:
                  1. „Trimite si tu" (primary highlight) - h-11
                  2. „Urmaresti / Urmareste" (toggle)
                  3. „Ai vazut progres? Raporteaza" (amber)
                  4. „S-a rezolvat" (DOAR autor)
                  5. „Distribuie" (last, neutral) */}
            <div className="flex flex-wrap items-stretch gap-2">
              <SignSesizareButton
                tip={sesizare.tip}
                titlu={sesizare.titlu}
                locatie={sesizare.locatie}
                sector={sesizare.sector}
                descriere={sesizare.descriere}
                formal_text={sesizare.formal_text}
                imagini={sesizare.imagini}
                code={sesizare.code}
                variant="primary"
              />
              <FollowButton
                code={sesizare.code}
                initialFollowing={userFollowing}
                initialCount={sesizare.nr_followers ?? 0}
              />
              <StatusTicketButton
                code={sesizare.code}
                currentStatus={sesizare.status}
              />
              <MarkResolvedButton
                code={sesizare.code}
                status={sesizare.status}
                isAuthor={isAuthor}
              />
              <ShareMenu
                url={`${SITE_URL}/sesizari/${sesizare.code}`}
                title={sesizare.titlu}
                size="md"
              />
            </div>
            {/* Secondary actions: author-only utility row, mai jos pentru
                separare vizuala de actiunile primary. */}
            {isAuthor && (
              <div className="flex flex-wrap items-stretch gap-2 mt-2">
                <ReminderButton
                  emailInput={{
                    tip: sesizare.tip,
                    titlu: sesizare.titlu,
                    locatie: sesizare.locatie,
                    sector: sesizare.sector,
                    descriere: sesizare.descriere,
                    formal_text: sesizare.formal_text,
                    author_name: sesizare.author_name,
                    author_email: null,
                    author_address: null,
                    imagini: sesizare.imagini,
                    code: sesizare.code,
                  }}
                  createdAt={sesizare.created_at}
                  status={sesizare.status}
                  officialResponseAt={sesizare.official_response_at ?? null}
                />
                <DeleteSesizareButton
                  code={sesizare.code}
                  isAuthor={isAuthor}
                />
              </div>
            )}
          </header>
        );
      })()}

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div>
          {/* Before / After (doar dacă e rezolvat) */}
          {hasBeforeAfter && (
            <BeforeAfter
              beforeUrl={beforeUrl}
              afterUrl={afterUrl}
              resolvedAt={sesizare.resolved_at}
            />
          )}

          {/* Description */}
          <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6">
            <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] grid place-items-center"
                aria-hidden="true"
              >
                <FileText size={13} />
              </span>
              Descriere
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text)]">
              {sesizare.descriere}
            </p>
          </section>

          {/* Official response from authority — when admin pastes
              the email reply from the primărie/PMB/etc. Treated as a
              first-class section (featured above AI formal text) since
              it's the authoritative answer. */}
          {sesizare.official_response && (
            <section
              className={`border rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-6 mb-6 ${
                sesizare.status === "respins"
                  ? "bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-700"
                  : sesizare.status === "amanata"
                  ? "bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-900/50"
                  : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/50"
              }`}
            >
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-lg">
                  {sesizare.status === "respins"
                    ? "⛔"
                    : sesizare.status === "amanata"
                    ? "🕒"
                    : "✅"}
                </span>
                Răspunsul autorității
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                Status:{" "}
                <strong>
                  {STATUS_LABELS[sesizare.status] ?? sesizare.status}
                </strong>
                {sesizare.official_response_at && (
                  <>
                    {" · "}
                    {formatDate(sesizare.official_response_at)}
                  </>
                )}
              </p>
              <blockquote className="text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-current pl-4 opacity-90">
                {sesizare.official_response}
              </blockquote>
            </section>
          )}

          {/* Formal text — address stripped for privacy */}
          {sesizare.formal_text && (
            <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6">
              <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-[var(--radius-xs)] bg-violet-500/15 text-violet-600 dark:text-violet-400 grid place-items-center"
                  aria-hidden="true"
                >
                  <Scroll size={13} />
                </span>
                Text formal
              </h2>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-4 sm:p-5 text-sm leading-relaxed text-[var(--color-text)] space-y-3">
                {stripPrivateAddress(sesizare.formal_text, sesizare.author_name)
                  .split(/\n\n+/)
                  .map((para, i) => (
                    <p key={i} className="whitespace-pre-line break-words">
                      {para.trim()}
                    </p>
                  ))}
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2 italic">
                Adresa de domiciliu a fost ascunsă automat pentru protecția datelor personale.
              </p>
            </section>
          )}

          {/* AI-tracked replies from authorities (feature 5/21/2026) —
              afișează doar dacă există măcar un răspuns primit. */}
          <RepliesSection code={sesizare.code} isOwner={sesizare.user_id === user?.id} />


          {/* Photos */}
          {sesizare.imagini.length > 0 && (
            <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6">
              <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-[var(--radius-xs)] bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center"
                  aria-hidden="true"
                >
                  <ImageIcon size={13} />
                </span>
                Fotografii
                <span className="text-[10px] font-normal text-[var(--color-text-muted)] ml-1">
                  ({sesizare.imagini.length})
                </span>
              </h2>
              <PhotoGallery urls={sesizare.imagini} title="Fotografie" />
            </section>
          )}

          {/* Map */}
          <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6">
            <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-[var(--radius-xs)] bg-rose-500/15 text-rose-600 dark:text-rose-400 grid place-items-center"
                aria-hidden="true"
              >
                <MapIcon size={13} />
              </span>
              Localizare
            </h2>
            <div className="rounded-[var(--radius-xs)] overflow-hidden border border-[var(--color-border)]">
              <EvenimentMap
                coords={[sesizare.lat, sesizare.lng]}
                label={sesizare.titlu}
                color={STATUS_COLORS[sesizare.status] ?? "#64748B"}
                zoom={16}
                height="320px"
              />
            </div>
          </section>

          {/* Comments — component renders its own heading already */}
          <CommentsSection code={sesizare.code} initialComments={comments} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Vote */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
              Sprijină sesizarea
            </p>
            <VoteButtons
              code={sesizare.code}
              initialUpvotes={sesizare.upvotes}
              initialDownvotes={sesizare.downvotes}
              initialUserVote={userVote}
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              {sesizare.voturi_net > 0 ? "+" : ""}
              {sesizare.voturi_net} scor net · {sesizare.nr_comentarii} comentarii
            </p>
          </div>

          {/* Verify panel (doar la rezolvate) */}
          {isResolved && (
            <VerifyPanel
              code={sesizare.code}
              verifDa={sesizare.verif_da}
              verifNu={sesizare.verif_nu}
              initialUserChoice={userVerification}
              isAuthor={isAuthor}
            />
          )}

          {/* Timeline — shares the same EVENT_META catalog as /urmareste so
              labels, icons and colors stay consistent across surfaces.
              Moved ABOVE „Alții au sesizat" la cererea user 5/22/2026
              („vreau prima data Status si dupa Alții au sesizat"). */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                Status &amp; activitate
              </p>
              {(() => {
                const cosemneNr = timeline.filter((e) => e.event_type === "cosemnat").length;
                return cosemneNr > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 tabular-nums"
                    aria-label={`${cosemneNr} ${cosemneNr === 1 ? "cetățean a co-semnat" : "cetățeni au co-semnat"}`}
                  >
                    <UserPlus size={10} aria-hidden="true" />
                    +{cosemneNr} {cosemneNr === 1 ? "cetățean" : "cetățeni"}
                  </span>
                ) : null;
              })()}
            </div>
            {timeline.length === 0 ? (
              <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-xs)] p-4 text-center">
                <p className="text-sm text-[var(--color-text-muted)] italic">
                  Nu există evenimente încă.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-5 ml-1">
                {/* Vertical rail behind the dots */}
                <span
                  aria-hidden="true"
                  className="absolute left-3 top-3 bottom-3 w-px bg-[var(--color-border)]"
                />
                {timeline.map((step, i) => {
                  const isLast = i === timeline.length - 1;
                  const meta = getSesizareEventMeta(step.event_type);
                  const Icon = meta.icon;
                  const showDescription = !isRedundantEventDescription(step.event_type, step.description);
                  return (
                    <li key={step.id} className="relative pl-10">
                      <span
                        className={`absolute left-0 top-0 w-7 h-7 rounded-full grid place-items-center ring-4 ring-[var(--color-surface)] ${isLast ? "animate-pulse" : ""}`}
                        style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                        aria-hidden="true"
                      >
                        <Icon size={13} />
                      </span>
                      <p className={`text-sm leading-tight ${isLast ? "font-bold" : "font-semibold"}`}>
                        {meta.label}
                      </p>
                      {showDescription && step.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 inline-flex items-center gap-1 tabular-nums">
                        <Clock size={10} aria-hidden="true" />
                        <time dateTime={step.created_at}>{formatDateTime(step.created_at)}</time>
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Similar sesizari (cine a mai sesizat) — sub Status & activitate */}
          <SimilarSesizari sesizari={similar} />
        </aside>
      </div>
    </div>
  );
}
