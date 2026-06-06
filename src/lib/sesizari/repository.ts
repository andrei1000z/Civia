import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getHiddenUserIds } from "@/lib/privacy/hidden-users";
import { scrubFormalTextForPublic } from "./scrub-public";
import { safeTitlu } from "./titlu";
import { restoreDiacritics } from "./diacritice";
import type {
  SesizareFeedRow,
  SesizareRow,
  SesizareCommentRow,
  SesizareTimelineRow,
  SesizareVerificationRow,
} from "@/lib/supabase/types";

const ANONYMOUS_LABEL = "[nume]";

// One pass on the session: returns the viewer's user id (if any), email
// (for legacy guest-then-signed-up rows where user_id may be null but
// author_email matches), and whether they have the admin role. Used by
// both the name anonymizer and the formal_text scrubber so we fetch the
// auth+profile row once per request.
async function getViewerContext(): Promise<{
  viewerId: string | null;
  viewerEmail: string | null;
  isAdmin: boolean;
}> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { viewerId: null, viewerEmail: null, isAdmin: false };
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return {
      viewerId: user.id,
      viewerEmail: user.email?.toLowerCase().trim() ?? null,
      isAdmin: (profile as { role?: string } | null)?.role === "admin",
    };
  } catch {
    return { viewerId: null, viewerEmail: null, isAdmin: false };
  }
}

type Anonymizable = {
  user_id: string | null;
  author_name: string;
  author_display_name?: string | null;
  author_email?: string | null;
  formal_text?: string | null;
};

/**
 * Applies public-viewer privacy to a list of sesizări:
 *   - always scrubs the home address out of formal_text (promised on the
 *     public page: "adresa de domiciliu a fost ascunsă automat")
 *   - always nulls author_email for non-owner non-admin viewers — the
 *     email is collected only for OG 27/2002 compliance + notifications,
 *     never displayed publicly. Defense in depth on top of the in-page
 *     redaction so the API GET response can't leak it either.
 *   - additionally scrubs the author name (in author_name AND in
 *     formal_text) when the owner toggled hide_name in /cont. The match
 *     happens on user_id OR author_email — guests-then-signed-up users
 *     have legacy rows with user_id=null but their email in
 *     author_email; the email path catches those.
 *   - admins and the row's owner bypass all scrubs (they're either
 *     moderating or reading their own sesizare)
 *
 * Runs two Redis SMISMEMBER round-trips (user_ids + emails) plus one
 * Supabase profile lookup for the viewer's role. Zero per-row queries.
 */
async function anonymizeHiddenAuthors<T extends Anonymizable>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;

  const { viewerId, viewerEmail, isAdmin } = await getViewerContext();
  if (isAdmin) return rows;

  // 2026-06-06 — PERF (cauza /sesizari-publice ~5-12s în Sentry): scos
  // getHiddenUserIds/getHiddenEmails (Upstash). Upstash e SUSPENDAT (billing) →
  // cele 2 `smismember` făceau TIMEOUT câteva secunde pe FIECARE request. Iar
  // rezultatul era oricum NEFOLOSIT: scrub-ul de nume e ON by default pentru
  // toți ne-ownerii (hideName=true). => zero Upstash în calea feed-ului, rapid.
  return rows.map((r) => {
    // Ownership: by user_id OR by email match (for legacy guest-then-
    // signed-up rows where user_id may be null but author_email matches
    // the now-signed-up viewer's email).
    const isOwner =
      (!!r.user_id && r.user_id === viewerId) ||
      (!!viewerEmail && r.author_email?.toLowerCase().trim() === viewerEmail);
    if (isOwner) return r; // owner sees their own name + address + email

    // Decizie 5/5/2026: scrub-uim NUMELE pentru TOȚI ne-owneri, default
    // on. Anterior era opt-in via hidden_users (idHit/emailHit) — dar
    // user-ul a observat numele real exposed pe pagina publică (incluzând
    // sesizări co-semnate cu numele original al inițiatorului). Privacy
    // by default, nu privacy by opt-in. Owner-ul își vede tot numele
    // său (logged-in match pe user_id sau author_email).
    const hideName = true;

    let scrubbedFormalText = r.formal_text ?? null;
    if (scrubbedFormalText) {
      scrubbedFormalText = scrubFormalTextForPublic(scrubbedFormalText, {
        authorName: r.author_name,
        hideName,
      });
    }

    return {
      ...r,
      author_name: ANONYMOUS_LABEL,
      // Display name (prenume / primul cuvânt) e tot info identificabilă —
      // user a cerut explicit „SA NU DEZVALUI INFO" pe public (5/24/2026).
      // Anterior se afișa „Calapod" pe card. Acum: „Cetățean" pe public.
      author_display_name: "Cetățean",
      author_email: null, // never expose to non-owner non-admin viewers
      formal_text: scrubbedFormalText,
    };
  });
}

export interface ListFilters {
  tip?: string;
  status?: string;
  sector?: string;
  county?: string;
  limit?: number;
  offset?: number;
}

// Columns the public list cards actually render (SesizariPublice.tsx).
// We deliberately skip large fields the card never shows (formal_text
// in full, address, author_email, AI metadata, etc.) and instead derive
// a short formal_text excerpt below. The detail page uses
// getSesizareByCode which selects the full row.
//
// CRITICAL fix 5/21/2026: lat,lng INCLUDED. SesizariMap foloseste
// acelasi endpoint pentru a randa markeri pe harta — fara lat/lng,
// Leaflet arunca „Invalid LatLng object: (undefined, undefined)" si
// pagina /sesizari-publice?view=map cade in error boundary. Cost: 16
// bytes per row.
const FEED_LIST_COLUMNS =
  "id,code,user_id,author_name,author_display_name,author_email,titlu,locatie,sector,county,lat,lng,tip,custom_category,status,formal_text,descriere,imagini,resolved_photo_url,created_at,nr_comentarii,nr_cosigners,publica,moderation_status";

// Card preview is line-clamp-2 (~150 visible chars). 320 is a safe
// over-provision that still slashes the average row from ~3 KB to
// ~600 B while preserving punctuation/diacritics around the cut.
const PREVIEW_CHARS = 320;

/**
 * 2026-06-04 — Defense-in-depth la boundary-ul de citire: rândurile VECHI din
 * DB pot avea titlul placeholder „Altele (categoria se creează automat din
 * descriere)" (create înainte de garanția de titlu din create route). Curățăm
 * titlul la fiecare citire ca să nu se scurgă în pagina publică, OG, PDF,
 * subiectul emailului către autorități, etc. Pentru rândurile noi (titlu deja
 * curat) `safeTitlu` întoarce titlul neschimbat.
 */
function sanitizeRowTitlu<T extends { titlu?: string | null; descriere?: string | null }>(row: T): T {
  // 2026-06-05 — pe lângă safeTitlu (placeholder), restaurăm diacriticele
  // deterministe pe titlu („Cosuri de gunoi" → „Coșuri de gunoi") fiindcă unele
  // titluri vechi au fost stocate fără diacritice. Fix la afișare, fără backfill.
  return { ...row, titlu: restoreDiacritics(safeTitlu(row.titlu, { descriere: row.descriere })) };
}

/** Taie la GRANIȚĂ DE CUVÂNT sub `max` + „…" — fără cuvinte rupte la mijloc
 *  („mașinil…"). 2026-06-05. */
function clampAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max - 50 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?–-]+$/, "") + "…";
}

function truncateForFeed<T extends { formal_text?: string | null; descriere?: string | null }>(row: T): T {
  const next = { ...row };
  if (next.formal_text && next.formal_text.length > PREVIEW_CHARS) {
    next.formal_text = clampAtWord(next.formal_text, PREVIEW_CHARS);
  }
  if (next.descriere && next.descriere.length > PREVIEW_CHARS) {
    next.descriere = clampAtWord(next.descriere, PREVIEW_CHARS);
  }
  return next;
}

export async function listSesizari(filters: ListFilters = {}): Promise<SesizareFeedRow[]> {
  const supabase = await createSupabaseServer();
  let query = supabase.from("sesizari_feed").select(FEED_LIST_COLUMNS);

  if (filters.tip && filters.tip !== "toate") query = query.eq("tip", filters.tip);
  if (filters.status && filters.status !== "toate") query = query.eq("status", filters.status);
  if (filters.sector && filters.sector !== "toate") query = query.eq("sector", filters.sector);
  if (filters.county) query = query.eq("county", filters.county.toUpperCase());

  query = query.order("created_at", { ascending: false });

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  const anonymized = await anonymizeHiddenAuthors((data ?? []) as SesizareFeedRow[]);
  return anonymized.map(truncateForFeed).map(sanitizeRowTitlu);
}

export async function getSesizareByCode(code: string): Promise<SesizareFeedRow | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("sesizari_feed")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  const row = (data as SesizareFeedRow | null) ?? null;
  if (!row) return null;
  // 5/23/2026 — strip nr_inregistrare la boundary repository.
  // Câmpul e privat (unic per sesizare → permite tracking 1:1 al cetățeanului
  // care a depus dacă e expus public). Apelantul care e SIGUR că user e autor
  // folosește getNrInregistrareForAuthor() ca să-l aducă explicit.
  const stripped = { ...row, nr_inregistrare: null };
  const [anonymized] = await anonymizeHiddenAuthors([stripped]);
  return sanitizeRowTitlu(anonymized ?? stripped);
}

/**
 * Aduce nr_inregistrare DOAR dacă userId match-uie user_id-ul autorului.
 * Folosit pe /sesizari/[code] după ce isAuthor a fost calculat.
 * Server-only — nu se apelează din Client Components.
 */
export async function getNrInregistrareForAuthor(
  sesizareId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("sesizari")
    .select("nr_inregistrare, user_id")
    .eq("id", sesizareId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { nr_inregistrare: string | null; user_id: string | null };
  if (row.user_id !== userId) return null;
  return row.nr_inregistrare;
}

export async function getSesizareById(id: string): Promise<SesizareFeedRow | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("sesizari_feed")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = (data as SesizareFeedRow | null) ?? null;
  if (!row) return null;
  const [anonymized] = await anonymizeHiddenAuthors([row]);
  return sanitizeRowTitlu(anonymized ?? row);
}

export async function getTimeline(sesizareId: string): Promise<SesizareTimelineRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("sesizare_timeline")
    .select("*")
    .eq("sesizare_id", sesizareId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SesizareTimelineRow[];
}

/**
 * 2026-05-26 — Numărul REAL de cetățeni care au co-trimis sesizarea
 * prin sesizari@civia.ro (email trimis cu succes via Resend).
 *
 * Sursa: tabelul `sesizare_cosigners` — fiecare rând = 1 email trimis
 * cu succes. Endpoint-ul de cosign INSERT doar după ce Resend confirmă
 * delivery (vezi cosign-send/route.ts:207-213). Zero false positives.
 *
 * Folosit pentru a afișa „Co-trimisă de alți X cetățeni" în timeline-ul
 * de pe pagina sesizării — count exact, nu cosemnat-events-count.
 */
export async function getCosignersCount(sesizareId: string): Promise<number> {
  const supabase = await createSupabaseServer();
  const { count, error } = await supabase
    .from("sesizare_cosigners")
    .select("id", { count: "exact", head: true })
    .eq("sesizare_id", sesizareId);
  if (error) return 0; // best-effort: 0 dacă DB error
  return count ?? 0;
}

export async function getComments(sesizareId: string): Promise<SesizareCommentRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("sesizare_comments")
    .select("*")
    .eq("sesizare_id", sesizareId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as SesizareCommentRow[];
  return anonymizeHiddenComments(rows);
}

/**
 * Mirror of `anonymizeHiddenAuthors` for comments. The hide-name flag
 * is per-user (Redis SET membership), so a user who opted in expects
 * their name redacted everywhere their handle would surface — comments
 * included. Owner of the comment and admins still see the real name.
 */
async function anonymizeHiddenComments(
  rows: SesizareCommentRow[],
): Promise<SesizareCommentRow[]> {
  if (rows.length === 0) return rows;
  const { viewerId, isAdmin } = await getViewerContext();
  if (isAdmin) return rows;

  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)),
  );
  const hidden = userIds.length > 0 ? await getHiddenUserIds(userIds) : new Set<string>();

  return rows.map((r) => {
    const isOwner = !!r.user_id && r.user_id === viewerId;
    if (isOwner) return r;
    if (!r.user_id || !hidden.has(r.user_id)) return r;
    return { ...r, author_name: ANONYMOUS_LABEL, author_display_name: "Cetățean" };
  });
}

export interface CreateSesizareInput {
  code: string;
  user_id?: string | null;
  author_name: string;
  author_email?: string | null;
  /** Adresa cetățeanului — folosită în textul formal („Mă numesc X,
   *  locuiesc în Y"). Stocată ca să nu o pierdem la re-generare. */
  author_address?: string | null;
  tip: string;
  titlu: string;
  locatie: string;
  sector: string | null;
  lat: number;
  lng: number;
  descriere: string;
  formal_text?: string | null;
  imagini?: string[];
  publica?: boolean;
  /** AI auto-eticheta cand tip="altele". Optional. */
  custom_category?: string | null;
  custom_category_confidence?: number | null;
  /** Nume afisat public (display_name din profile, sau primul cuvant author_name). */
  author_display_name?: string | null;
  /** 2026-05-26 — cod județ pentru routing autorități. Dacă null, codul de
   *  creare derivă din locatie text (detectCountyFromLocatie). */
  county?: string | null;
}

export async function createSesizare(input: CreateSesizareInput): Promise<SesizareRow> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("sesizari")
    .insert({
      code: input.code,
      user_id: input.user_id ?? null,
      author_name: input.author_name,
      author_email: input.author_email ?? null,
      author_address: input.author_address ?? null,
      tip: input.tip,
      titlu: input.titlu,
      locatie: input.locatie,
      sector: input.sector || null,
      lat: input.lat,
      lng: input.lng,
      descriere: input.descriere,
      formal_text: input.formal_text ?? null,
      imagini: input.imagini ?? [],
      publica: input.publica ?? true,
      custom_category: input.custom_category ?? null,
      custom_category_confidence: input.custom_category_confidence ?? null,
      author_display_name: input.author_display_name ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SesizareRow;
}

export async function addComment(params: {
  sesizareId: string;
  userId: string;
  authorName: string;
  body: string;
  /** ID-ul comentariului-părinte (null = top-level). Permite reply 1-nivel. */
  parentCommentId?: string | null;
}): Promise<SesizareCommentRow> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("sesizare_comments")
    .insert({
      sesizare_id: params.sesizareId,
      user_id: params.userId,
      author_name: params.authorName,
      body: params.body,
      parent_comment_id: params.parentCommentId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SesizareCommentRow;
}

// ========== VERIFICĂRI REZOLVARE ==========

export async function getVerifications(
  sesizareId: string
): Promise<SesizareVerificationRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("sesizare_verifications")
    .select("*")
    .eq("sesizare_id", sesizareId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SesizareVerificationRow[];
}

export async function getUserVerification(params: {
  sesizareId: string;
  userId: string;
}): Promise<boolean | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("sesizare_verifications")
    .select("agrees")
    .eq("sesizare_id", params.sesizareId)
    .eq("user_id", params.userId)
    .maybeSingle();
  return (data as { agrees: boolean } | null)?.agrees ?? null;
}

export async function upsertVerification(params: {
  sesizareId: string;
  userId: string;
  agrees: boolean;
}): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("sesizare_verifications")
    .upsert(
      {
        sesizare_id: params.sesizareId,
        user_id: params.userId,
        agrees: params.agrees,
      },
      { onConflict: "sesizare_id,user_id" }
    );
  if (error) throw error;
}

// ========== SESIZĂRI SIMILARE ==========

export async function getSimilarSesizari(
  sesizareId: string,
  radiusM: number = 300
): Promise<SesizareFeedRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("sesizari_similare", {
    p_sesizare_id: sesizareId,
    p_radius_m: radiusM,
  });
  if (error) {
    // RPC might not exist yet (migration not applied) — fail gracefully
    return [];
  }
  // Apply the same anonymization + address scrub as every other read path.
  // Without this, the "Alții au sesizat aceeași problemă" widget leaked
  // the real author_name even when hide_name was enabled.
  return await anonymizeHiddenAuthors((data ?? []) as SesizareFeedRow[]);
}
