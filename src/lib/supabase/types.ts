// Database types — manually kept in sync with supabase/schema.sql
// For generated types run: npx supabase gen types typescript --project-id <ref>

// 2026-05-27 — Re-export tipurile Supabase ca app code să nu mai importe
// direct din @supabase/supabase-js (per AGENTS.md guideline).
export type { User, Session, SupabaseClient } from "@supabase/supabase-js";

export type ModerationStatus = "pending" | "approved" | "rejected";

export interface ProfileRow {
  id: string;
  display_name: string;
  created_at: string;
}

export interface SesizareRow {
  id: string;
  code: string;
  user_id: string | null;
  author_name: string;
  /** Nume afisat public (display_name profile sau primul cuvant author_name). */
  author_display_name: string | null;
  author_email: string | null;
  /** 5/22/2026 — adresa cetăţeanului pentru identificare oficială în emailul către primărie (OG 27/2002). */
  author_address?: string | null;
  tip: string;
  /** 5/22/2026 — categoria custom generată de AI când tip="altele".
   *  Ex: tip="altele", custom_category="copaci netoaletați". UI afișează
   *  custom_category capitalizat în loc de label-ul generic. */
  custom_category?: string | null;
  titlu: string;
  locatie: string;
  sector: string;
  lat: number;
  lng: number;
  descriere: string;
  formal_text: string | null;
  status: string;
  imagini: string[];
  publica: boolean;
  moderation_status: ModerationStatus;
  resolved_at: string | null;
  resolved_by_author: boolean;
  resolved_photo_url: string | null;
  /** Textul răspunsului oficial al autorității (introdus de admin). */
  official_response: string | null;
  /** Timestamp-ul înregistrării răspunsului oficial. */
  official_response_at: string | null;
  county: string | null;
  locality: string | null;
  created_at: string;
  updated_at: string;
  /** 2026-05-19: trimitere via Civia (Resend) — track real send vs mailto. */
  sent_via_civia?: boolean | null;
  sent_at?: string | null;
  sent_to_emails?: string[] | null;
  resend_message_id?: string | null;
  /** 5/21/2026: nr de înregistrare oficial extras de AI din răspunsul autorității
   *  (vezi `/api/inbox/reply`). Setat când auto_apply trecut. Format liber. */
  nr_inregistrare?: string | null;
}

export interface SesizareFeedRow extends SesizareRow {
  nr_comentarii: number;
  verif_da: number;
  verif_nu: number;
}

export interface SesizareVerificationRow {
  sesizare_id: string;
  user_id: string;
  agrees: boolean;
  created_at: string;
}

export interface SesizareCommentRow {
  id: string;
  sesizare_id: string;
  user_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  /** NULL = top-level. UUID = reply la comentariul respectiv (threading 1 nivel). */
  parent_comment_id?: string | null;
}

export interface SesizareCommentVoteRow {
  id: string;
  comment_id: string;
  user_id: string;
  /** -1 = dislike, +1 = like */
  value: -1 | 1;
  created_at: string;
}

/** Comentariu cu agregări incluse (upvotes / downvotes / replies counts).
    Construit client-side din join-uri sau direct în query. */
export interface SesizareCommentWithMeta extends SesizareCommentRow {
  upvotes: number;
  downvotes: number;
  /** Vot-ul user-ului curent (-1, 1, sau null dacă n-a votat) */
  user_vote: -1 | 1 | null;
  replies: SesizareCommentRow[];
}

export interface SesizareTimelineRow {
  id: string;
  sesizare_id: string;
  event_type: string;
  description: string | null;
  created_at: string;
}

export type StatusTicketDecision = "pending" | "approved" | "rejected";

/**
 * Citizen-submitted proposal for a status update on a sesizare. Admin
 * decides via /api/admin/status-tickets/[id]; on approve, the parent
 * sesizare's status flips and a timeline row is written.
 */
export interface SesizareStatusTicketRow {
  id: string;
  sesizare_id: string;
  user_id: string;
  proposed_status: string;
  note: string;
  proof_url: string | null;
  decision: StatusTicketDecision;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      sesizari: {
        Row: SesizareRow;
        Insert: Omit<SesizareRow, "id" | "created_at" | "updated_at" | "moderation_status" | "status"> & {
          id?: string;
          moderation_status?: ModerationStatus;
          status?: string;
          created_at?: string;
        };
        Update: Partial<SesizareRow>;
        Relationships: [];
      };
      sesizare_comments: {
        Row: SesizareCommentRow;
        Insert: Omit<SesizareCommentRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<SesizareCommentRow>;
        Relationships: [];
      };
      sesizare_timeline: {
        Row: SesizareTimelineRow;
        Insert: Omit<SesizareTimelineRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<SesizareTimelineRow>;
        Relationships: [];
      };
      sesizare_verifications: {
        Row: SesizareVerificationRow;
        Insert: Omit<SesizareVerificationRow, "created_at"> & { created_at?: string };
        Update: Partial<SesizareVerificationRow>;
        Relationships: [];
      };
      sesizare_status_tickets: {
        Row: SesizareStatusTicketRow;
        Insert:
          & Omit<
              SesizareStatusTicketRow,
              "id" | "created_at" | "decision" | "decided_by" | "decided_at" | "decision_note" | "proof_url"
            >
          & {
              id?: string;
              created_at?: string;
              decision?: StatusTicketDecision;
              decided_by?: string | null;
              decided_at?: string | null;
              decision_note?: string | null;
              proof_url?: string | null;
            };
        Update: Partial<SesizareStatusTicketRow>;
        Relationships: [];
      };
    };
    Views: {
      sesizari_feed: {
        Row: SesizareFeedRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
