import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, User, Clock, UserPlus, FileText, Image as ImageIcon, Map as MapIcon, Scroll } from "lucide-react";
import {
  getSesizareByCode,
  getTimeline,
  getComments,
  getSimilarSesizari,
  getNrInregistrareForAuthor,
  getCosignersCount,
} from "@/lib/sesizari/repository";
import { createSupabaseServer } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS, SESIZARE_TIPURI, resolveTipLabel, bestTextColor } from "@/lib/constants";
import { ogTitle, ogDescription } from "@/lib/seo/share-meta";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { CommentsSection } from "@/components/sesizari/CommentsSection";
import { LiveSesizareRefresh } from "@/components/sesizari/LiveSesizareRefresh";
import { EvenimentMap } from "@/components/maps/EvenimentMap";
import { SignSesizareButton } from "@/components/sesizari/SignSesizareButton";
import { publicAuthorName } from "@/lib/sesizari/display-name";
import { MarkResolvedButton } from "@/components/sesizari/MarkResolvedButton";
import { ShareMenu } from "@/components/sesizari/ShareMenu";
import { BeforeAfter } from "@/components/sesizari/BeforeAfter";
import { SimilarSesizari } from "@/components/sesizari/SimilarSesizari";
import { EscalationThresholdCard } from "@/components/sesizari/EscalationThresholdCard";
import { ResendButton } from "@/components/sesizari/ResendButton";
import { DeleteSesizareButton } from "@/components/sesizari/DeleteSesizareButton";
import { StatusTicketButton } from "@/components/sesizari/StatusTicketButton";
import { PhotoGallery } from "@/components/sesizari/PhotoGallery";
import { OverdueBadge } from "@/components/sesizari/OverdueBadge";
import { ReminderButton } from "@/components/sesizari/ReminderButton";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { GovernmentServiceJsonLd } from "@/components/JsonLd";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { getSesizareEventMeta, isRedundantEventDescription, isTerminalEvent, dedupeConsecutiveEvents } from "@/lib/sesizari/events";
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
  // OG image: imaginea dinamică din opengraph-image.tsx (cardul sesizării). Era
  // NEreferențiată → share-urile (cea mai distribuită pagină!) arătau preview gol.
  const url = `${SITE_URL}/sesizari/${code}`;
  const description = s ? ogDescription(s.descriere) : "";
  const ogTtl = s ? ogTitle(s.titlu) : undefined;
  const ogImages = s
    ? [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: s.titlu }]
    : undefined;
  return {
    title: s ? s.titlu : "Sesizare negăsită",
    description,
    alternates: { canonical: `/sesizari/${code}` },
    openGraph: {
      title: ogTtl,
      description,
      url,
      type: "article",
      siteName: "Civia",
      locale: "ro_RO",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTtl,
      description,
      images: s ? [`${url}/opengraph-image`] : undefined,
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

  const [allTimelineEvents, comments, similar, cosignersCount] = await Promise.all([
    getTimeline(sesizare.id),
    getComments(sesizare.id),
    getSimilarSesizari(sesizare.id, 300),
    getCosignersCount(sesizare.id),
  ]);

  // 2026-05-24 PRIVACY FIX (user request „să NU mai apară numele full public"):
  // pe timeline public arătăm DOAR evenimente despre STAREA SESIZĂRII
  // (depusa/trimis/inregistrata/in-lucru/actiune-autoritate/rezolvat/
  // ignorat/respins/amanata/delivery_problem).
  //
  // Excludem evenimentele care expun acțiuni individuale de cetățean:
  //   - cosemnat — „Un alt cetățean a co-semnat" (descriere e ok dar
  //     CosignersBadge arată deja count public)
  //   - cosign_send — „X Y a trimis și el această sesizare" (LEAK NUME)
  //   - trimis_via_civia — variantă legacy a cosign_send
  //
  // Aceste evenimente rămân în DB pentru audit/admin, dar NU pe public.
  // PRIVACY: cosemnat/cosign_send/trimis_via_civia leak nume cetățeni.
  // NOISE: delivery_problem (legacy ghost-send false positives), raspuns_oficial
  // (duplicat al „inregistrata" status update event), eveniment generic. Toate
  // afișate ca „Eveniment" placeholder fără ikonografie — distrag user-ul.
  // 2026-05-28 — adăugat „status_changed_trimis" (event-ul tipic „Sesizare
  // trimisă către autorități") la lista de filter per user request. Vrem
  // doar „Sesizare depusă pe platformă" pe timeline + badge dedesubt cu
  // numărul de cetățeni care au trimis.
  const PRIVATE_EVENT_TYPES = new Set([
    "cosemnat",
    "cosign_send",
    "trimis_via_civia",
    "delivery_problem",
    "raspuns_oficial",
    "eveniment",
    "trimis",
    "status_changed_trimis",
    "status_change_trimis",
  ]);
  const timeline = dedupeConsecutiveEvents(
    allTimelineEvents.filter((e) => !PRIVATE_EVENT_TYPES.has(e.event_type)),
  );

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthor = user
    ? sesizare.user_id === user.id || sesizare.author_email === user.email
    : false;

  // 5/23/2026 — nr_inregistrare e privat (unic per sesizare). Fetch separat
  // doar pentru autor, ca să nu fie inclus în RSC payload pentru viewerii public.
  const authorNrInregistrare =
    isAuthor && user
      ? await getNrInregistrareForAuthor(sesizare.id, user.id)
      : null;

  // Poză "before" pentru before/after: prima imagine a sesizării (dacă există)
  const beforeUrl = sesizare.imagini.length > 0 ? sesizare.imagini[0] : null;
  const afterUrl = sesizare.resolved_photo_url;
  const isResolved = sesizare.status === "rezolvat";
  // 2026-05-25 — arătăm secțiunea before/after dacă sesizarea e rezolvată
  // ȘI există măcar o poză „înainte". Poza „după" e opțională (când
  // lipsește, BeforeAfter randă placeholder + CTA pentru autor).
  const showBeforeAfter = isResolved && !!beforeUrl;

  const { label: tipLabel, icon: tipIcon } = resolveTipLabel(
    sesizare.tip,
    (sesizare as unknown as { custom_category?: string | null }).custom_category,
  );

  return (
    <div className="lc-canvas lc-canvas--flat">
    <div className="container-narrow py-8 md:py-12">
      {/* Update LIVE al statusului când autoritatea răspunde (realtime). */}
      <LiveSesizareRefresh sesizareId={sesizare.id} />
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
          getAuthoritiesFor(sesizare.tip, sesizare.sector, sesizare.county, sesizare.locatie, undefined, sesizare.descriere ?? undefined)
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
            className="relative mb-6 overflow-x-clip rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-2)] p-5 md:p-6"
            style={{
              backgroundImage: `linear-gradient(135deg, ${statusColor}1f, transparent 55%)`,
            }}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap mb-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Badge variant="neutral" className="inline-flex items-center gap-1">
                  <span aria-hidden="true">{tipIcon}</span>
                  {tipLabel}
                </Badge>
                {sesizare.sector && <Badge variant="neutral">{sesizare.sector}</Badge>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
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
            <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-4xl font-extrabold leading-tight mb-3 w-full min-w-0 [overflow-wrap:break-word] [word-break:break-word]">
              {sesizare.titlu}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)] mb-5">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{sesizare.locatie}</span>
              </span>
              {/* 2026-05-28 — Author name ASCUNS complet per user request.
                  Nu mai afișăm nici numele complet, nici prenumele, nici
                  fallback „Cetățean". Sesizările sunt afișate public ca
                  acțiuni civice colective, nu personale. Numele rămâne în
                  DB pentru OG 27/2002 (primăria are nevoie să răspundă)
                  dar nu mai apare în UI. */}
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} aria-hidden="true" />
                <time dateTime={sesizare.created_at}>{formatDate(sesizare.created_at)}</time>
              </span>
            </div>
            {/* 2026-05-26 — CosignersBadge scos de aici. Counter-ul real
                apare în „Status & activitate" timeline sub event-ul
                „Sesizare depusă pe platformă" („Co-trimisă de alți X
                cetățeni"). Evităm duplicare informație în header + sidebar. */}

            {/* 5/23/2026 — Banner de confirmare oficială DOAR pentru autor.
                Numărul de înregistrare e unic per sesizare → expunere publică
                ar permite tracking 1:1 al persoanei care a depus. Strict private:
                - repository.getSesizareByCode strip-uie nr_inregistrare la return
                - aici facem fetch separat cu getNrInregistrareForAuthor care
                  verifică user_id la query level. */}
            {authorNrInregistrare && (
              <div className="mt-1 mb-5 inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-purple-500/10 border border-purple-500/30 text-sm">
                <Scroll
                  size={14}
                  className="text-purple-600 dark:text-purple-400 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-purple-700 dark:text-purple-300">
                    Înregistrată oficial:
                  </strong>{" "}
                  <span className="font-mono text-[var(--color-text)] font-bold">
                    {authorNrInregistrare}
                  </span>
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    · doar pentru tine
                  </span>
                </span>
              </div>
            )}

            {/* 5/22/2026 — Resend alert pentru ghost-sends / bounces.
                Vizibil DOAR pentru autor + DOAR dacă există problemă.
                2026-05-24: suprimă alerta când există reply oficial (orice
                răspuns dovedește că emailul a ajuns — ghost-send fals pozitiv
                pentru sesizări trimise prin flow vechi care nu populau
                resend_message_id). Status-uri non-trimis (inregistrata,
                in-lucru, rezolvat) implicit dovedesc delivery. */}
            {isAuthor && (() => {
              // Un status „advanced" (autoritatea a răspuns/înregistrat/rezolvat)
              // DOVEDEȘTE că emailul a ajuns — orice flag de livrare problematic
              // (bounced pe un CC, ghost-send fără resend_message_id) e atunci
              // STALE. Suprimăm banner-ul „Email respins / Livrare neconfirmată"
              // ca să nu contrazică un status care arată clar că a ajuns
              // (caz 00051/00053: bounced pe dispecerat@pmb dar înregistrate).
              const arrivalProven = ["inregistrata", "in-lucru", "rezolvat", "actiune-autoritate", "interventie", "redirectionata"].includes(sesizare.status);
              const deliveryStatus = (sesizare as unknown as { delivery_status?: string | null }).delivery_status ?? null;
              return (
                <ResendButton
                  code={sesizare.code}
                  deliveryStatus={arrivalProven ? null : deliveryStatus}
                  isGhostSend={
                    sesizare.sent_via_civia === true &&
                    !(sesizare as unknown as { resend_message_id?: string | null }).resend_message_id &&
                    !arrivalProven
                  }
                />
              );
            })()}
            {/* Action row: butoane standardizate (h-10 cu wrap) in ordine
                de prioritate vizuala:
                  1. „Trimite si tu" (primary highlight) - h-11
                  2. „Urmaresti / Urmareste" (toggle)
                  3. „Ai vazut progres? Raporteaza" (amber)
                  4. „S-a rezolvat" (DOAR autor)
                  5. „Distribuie" (last, neutral) */}
            <div className="flex flex-wrap items-stretch gap-2">
              {/* 2026-05-26 — pe rezolvat ascundem „Trimite și tu" +
                  „Urmărești" — nu mai are sens să trimiți / urmărești o
                  sesizare deja închisă. Distribuie + Status ticket rămân
                  (impact retroactiv: cetățeanul poate raporta revenire). */}
              {!isResolved && (
                <SignSesizareButton
                  tip={sesizare.tip}
                  titlu={sesizare.titlu}
                  locatie={sesizare.locatie}
                  sector={sesizare.sector}
                  county={sesizare.county}
                  descriere={sesizare.descriere}
                  formal_text={sesizare.formal_text}
                  imagini={sesizare.imagini}
                  code={sesizare.code}
                  variant="primary"
                />
              )}
              {/* 2026-05-26 — „Ai văzut progres? Raportează" ascuns pe
                  rezolvat. Pentru impact retroactiv (problema revine),
                  cetățeanul poate folosi „Distribuie" + comentarii. */}
              {!isResolved && (
                <StatusTicketButton
                  code={sesizare.code}
                  currentStatus={sesizare.status}
                />
              )}
              <MarkResolvedButton
                code={sesizare.code}
                status={sesizare.status}
                isAuthor={isAuthor}
              />
              <ShareMenu
                url={`${SITE_URL}/sesizari/${sesizare.code}`}
                title={sesizare.titlu}
                message={`Am trimis o sesizare pe Civia: „${sesizare.titlu}". Trimite și tu — durează 90 de secunde și pune presiune pe autorități să rezolve 👇`}
                size="lg"
              />
              {/* 2026-06-12 — utilitarele autorului (reamintire + șterge) stau
                  pe ACELAȘI rând, cu aceeași mărime/stil ca restul acțiunilor
                  (cerere user: toate butoanele uniforme). flex-wrap = pe ecrane
                  înguste trec pe rândul următor natural. */}
              {isAuthor && (
                <>
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
                </>
              )}
            </div>
          </header>
        );
      })()}

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div className="lc-stagger">
          {/* Description */}
          <section className="lc-glass-2 rounded-3xl p-5 md:p-6 mb-6">
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

          {/* Before / After — DOAR pentru sesizări rezolvate.
              Plasat sub Descriere ca să fie next logical info după ce
              citești problema („uite cum arăta vs. cum arată acum"). */}
          {showBeforeAfter && beforeUrl && (
            <BeforeAfter
              beforeUrl={beforeUrl}
              afterUrl={afterUrl}
              resolvedAt={sesizare.resolved_at}
              isAuthor={isAuthor}
            />
          )}

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
            <section className="lc-glass-2 rounded-3xl p-5 md:p-6 mb-6">
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

          {/* 2026-05-25 — RepliesSection scoasă la cererea user-ului. Răspunsurile
              de la autorități se reflectă în „Status & activitate" timeline +
              notificarea bell. Listare separată dubla informația și aglomera UI. */}


          {/* Photos */}
          {sesizare.imagini.length > 0 && (
            <section className="lc-glass-2 rounded-3xl p-5 md:p-6 mb-6">
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
          <section className="lc-glass-2 rounded-3xl p-5 md:p-6 mb-6">
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

          {/* 2026-05-26 — VerifyPanel scos la cererea user-ului. Confirmarea
              rezolvării se face acum prin email loop-followup la T+14
              (1-tap DA/NU în inbox). Da/Nu count rămâne pe sesizare ca
              pentru analytics dar nu mai e expus public. */}

          {/* Timeline — shares the same EVENT_META catalog as /urmareste so
              labels, icons and colors stay consistent across surfaces.
              2026-05-25 — UI refresh: bigger dots, color-tinted rail, current
              step highlighted cu „Acum" pill, time-ago inline cu Clock. */}
          <div className="lc-glass-2 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                Status &amp; activitate
              </p>
              {timeline.length > 0 && (
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  {timeline.length} {timeline.length === 1 ? "etapă" : "etape"}
                </span>
              )}
            </div>
            {timeline.length === 0 ? (
              <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-xs)] p-4 text-center">
                <p className="text-sm text-[var(--color-text-muted)] italic">
                  Nu există evenimente încă.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-5 stagger-children" aria-label="Cronologia stării sesizării">
                {timeline.map((step, i) => {
                  const isLast = i === timeline.length - 1;
                  const terminal = isTerminalEvent(step.event_type);
                  // Highlight cu „Acum" pill + pulse doar dacă e ultimul ȘI
                  // nu e status terminal (rezolvat/respins/ignorat = pentru
                  // totdeauna; nu mai e „live").
                  const isCurrent = isLast && !terminal;
                  const meta = getSesizareEventMeta(step.event_type);
                  const Icon = meta.icon;
                  const showDescription = !isRedundantEventDescription(step.event_type, step.description);
                  return (
                    <li
                      key={step.id}
                      className="relative pl-11"
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {/* Connector line to next step */}
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[14px] top-8 bottom-[-20px] w-0.5 rounded-full"
                          style={{ backgroundColor: `${meta.color}30` }}
                        />
                      )}
                      {/* Icon chip — filled pentru ultimul pas (live sau
                          terminal); soft pentru pașii intermediari. */}
                      <span
                        className={`absolute left-0 top-0 w-[30px] h-[30px] rounded-full grid place-items-center ring-[3px] ring-[var(--color-surface)] shadow-[var(--shadow-1)] ${isCurrent ? "animate-pulse" : ""}`}
                        style={{
                          backgroundColor: isLast ? meta.color : `${meta.color}1a`,
                          color: isLast ? bestTextColor(meta.color) : meta.color,
                        }}
                        aria-hidden="true"
                      >
                        <Icon size={14} strokeWidth={isLast ? 2.5 : 2} />
                      </span>
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className={`text-sm leading-tight ${isLast ? "font-bold text-[var(--color-text)]" : "font-semibold text-[var(--color-text)]"}`}>
                          {meta.label}
                        </p>
                        {isCurrent && (
                          <span
                            className="inline-flex items-center text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-[var(--radius-full)]"
                            style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                          >
                            Acum
                          </span>
                        )}
                        {/* 2026-05-27 — Collapse counter: când autoritatea a
                            trimis mai multe confirmări identice <24h, arătăm
                            un singur eveniment cu badge „×N" (caz Cluj-Napoca
                            5 confirmări pentru 00049 cu același nr 563). */}
                        {(step as { _collapsed_count?: number })._collapsed_count &&
                          (step as { _collapsed_count?: number })._collapsed_count! > 1 && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                            title={`Autoritatea a trimis ${(step as { _collapsed_count?: number })._collapsed_count} confirmări în 24h`}
                          >
                            ×{(step as { _collapsed_count?: number })._collapsed_count}
                          </span>
                        )}
                      </div>
                      {showDescription && step.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-col gap-1.5">
                        <p className="text-[11px] text-text-muted flex items-center gap-1 tabular-nums">
                          <Clock size={10} aria-hidden="true" />
                          <time dateTime={step.created_at}>{formatDateTime(step.created_at)}</time>
                        </p>
                        {step.event_type === "depusa" && (
                          <p className="text-xs text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5 font-medium">
                            <UserPlus size={11} aria-hidden="true" />
                            Trimisă de {cosignersCount + 1}{" "}
                            {cosignersCount + 1 === 1 ? "cetățean" : "cetățeni"}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Prag de escaladare (Faza 1) — greutate civică (co-semnături) +
              countdown legal AVP (timp pur, OG 27/2002). Ascuns pe rezolvat. */}
          <EscalationThresholdCard
            code={sesizare.code}
            createdAt={sesizare.created_at}
            status={sesizare.status}
            officialResponseAt={sesizare.official_response_at ?? null}
            cosignersCount={cosignersCount}
            isAuthor={isAuthor}
          />

          {/* Similar sesizari (cine a mai sesizat) — sub Status & activitate */}
          <SimilarSesizari sesizari={similar} />
        </aside>
      </div>
    </div>
    </div>
  );
}
