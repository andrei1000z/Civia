"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Inbox,
  ArrowLeft,
  ImageOff,
  MessageCircle,
  AlertTriangle,
  FileText,
  Eye,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { timeAgo } from "@/lib/utils";
import { SESIZARE_STATUS_META, type SesizareStatus } from "@/lib/sesizari/status";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { Lightbox } from "@/components/ui/Lightbox";
import { ApproveTicketDialog, type ApproveTicketPayload } from "./ApproveTicketDialog";

type Decision = "pending" | "approved" | "rejected";

interface TicketRow {
  id: string;
  sesizare_id: string;
  proposed_status: string;
  note: string;
  proof_url: string | null;
  decision: Decision;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  user_id: string;
  decided_by: string | null;
  sesizare: {
    id?: string;
    code: string;
    titlu: string;
    status: string;
    locatie: string;
    tip: string;
  } | null;
  proposer: {
    id: string;
    display_name: string;
    full_name: string | null;
  } | null;
  decided_by_profile: {
    id: string;
    display_name: string;
  } | null;
}

const FILTERS: Array<{ value: Decision | "all"; label: string }> = [
  { value: "pending", label: "În așteptare" },
  { value: "approved", label: "Aprobate" },
  { value: "rejected", label: "Respinse" },
  { value: "all", label: "Toate" },
];

function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

export default function AdminTicketsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Decision | "all">("pending");
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});
  // Lightbox preview for the proof attachment.
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  // Approve dialog: which ticket is being reviewed + submit state.
  const [approving, setApproving] = useState<TicketRow | null>(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const load = useCallback(async () => {
    setTickets(null);
    try {
      const res = await fetch(`/api/admin/status-tickets?decision=${filter}`);
      const j = await res.json();
      setTickets((j.data as TicketRow[]) ?? []);
    } catch {
      setTickets([]);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Reject path stays inline — the admin types a quick note and clicks
  // Respinge. Approve path now goes through ApproveTicketDialog where the
  // admin can edit status / event date / timeline note before applying.
  const reject = async (id: string) => {
    const noteForId = decisionNote[id]?.trim();
    setActing(`${id}-rejected`);
    try {
      const res = await fetch(`/api/admin/status-tickets/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "rejected",
          ...(noteForId ? { decision_note: noteForId } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare");
      toast("Propunere respinsă", "success");
      setTickets((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
      setDecisionNote((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setActing(null);
    }
  };

  const submitApprove = async (payload: ApproveTicketPayload) => {
    if (!approving) return;
    setApproveSubmitting(true);
    try {
      const res = await fetch(`/api/admin/status-tickets/${approving.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "approved",
          applied_status: payload.applied_status,
          applied_note: payload.applied_note,
          event_at: payload.event_at,
          ...(payload.decision_note ? { decision_note: payload.decision_note } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare");
      toast(
        `Aprobat ca „${SESIZARE_STATUS_META[payload.applied_status].label}"`,
        "success",
      );
      const id = approving.id;
      setTickets((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
      setApproving(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setApproveSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/sesizari"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Înapoi la sesizări
          </Link>
          <h2 className="font-semibold inline-flex items-center gap-2 text-sm">
            <Inbox size={14} aria-hidden="true" />
            Propuneri de status de la cetățeni
          </h2>
        </div>
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1"
          role="group"
          aria-label="Filtrează după decizie"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                filter === f.value
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {tickets === null ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)]">
          <Inbox size={28} className="mx-auto text-[var(--color-text-muted)] mb-3" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {filter === "pending"
              ? "Nicio propunere în așteptare. 🎉"
              : "Nicio propunere în această categorie."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => {
            const meta = SESIZARE_STATUS_META[t.proposed_status as SesizareStatus];
            const sesizareLink = t.sesizare ? `/sesizari/${t.sesizare.code}` : null;
            const proposerName =
              t.proposer?.display_name || t.proposer?.full_name || "Cetățean";
            const isPending = t.decision === "pending";
            const proofIsPdf = t.proof_url ? isPdfUrl(t.proof_url) : false;

            return (
              <li
                key={t.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] overflow-hidden"
              >
                <div className="p-4 flex items-start gap-4 flex-wrap md:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${meta?.color ?? "#64748B"}1a`,
                          color: meta?.color ?? "#64748B",
                        }}
                      >
                        <span aria-hidden="true">{meta?.emoji ?? "🏷️"}</span>
                        {meta?.label ?? t.proposed_status}
                      </span>
                      {t.sesizare && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          title="Statusul curent al sesizării"
                          style={{
                            backgroundColor: `${STATUS_COLORS[t.sesizare.status] ?? "#64748B"}1a`,
                            color: STATUS_COLORS[t.sesizare.status] ?? "#64748B",
                          }}
                        >
                          acum: {STATUS_LABELS[t.sesizare.status] ?? t.sesizare.status}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        {t.sesizare?.code ?? "—"}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        · {timeAgo(t.created_at)} · de {proposerName}
                      </span>
                    </div>
                    {t.sesizare && (
                      <p className="font-semibold text-sm leading-snug mb-1 line-clamp-2">
                        {t.sesizare.titlu}
                      </p>
                    )}
                    <div className="text-xs leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
                        <MessageCircle size={10} aria-hidden="true" />
                        Notă propunător
                      </span>
                      <p className="mt-1">{t.note}</p>
                    </div>
                    {t.decision_note && t.decision !== "pending" && (
                      <div className="text-xs leading-relaxed text-[var(--color-text-muted)] italic mt-2 border-l-2 border-[var(--color-border)] pl-3">
                        Notă admin: {t.decision_note}
                        {t.decided_by_profile && (
                          <> — {t.decided_by_profile.display_name}</>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Proof preview — clicking opens an in-tab Lightbox
                      (image inline, PDF embedded). Both formats keep the
                      same 160x160 frame so the queue layout stays
                      uniform; PDF gets a labeled rose card, images get a
                      thumbnail. */}
                  <div className="w-full md:w-40 shrink-0">
                    {t.proof_url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({
                            url: t.proof_url!,
                            title: `Dovadă · ${t.sesizare?.code ?? ""} · ${proposerName}`,
                          })
                        }
                        className="group relative block aspect-square w-full rounded-[var(--radius-xs)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-primary)]/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                        title="Previzualizează dovada"
                      >
                        {proofIsPdf ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400">
                            <FileText size={28} aria-hidden="true" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">
                              PDF
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-700/80 dark:text-rose-400/80">
                              <Eye size={10} aria-hidden="true" />
                              click pentru deschidere
                            </span>
                          </div>
                        ) : (
                          <Image
                            src={t.proof_url}
                            alt="Dovadă propusă de cetățean"
                            width={160}
                            height={160}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        )}
                        <span
                          className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/30 transition-colors"
                          aria-hidden="true"
                        >
                          <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-medium transition-opacity">
                            <Eye size={10} aria-hidden="true" />
                            Previzualizează
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="aspect-square rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] grid place-items-center text-[var(--color-text-muted)]">
                        <div className="text-center text-[10px] uppercase tracking-wider">
                          <ImageOff size={16} className="mx-auto mb-1" aria-hidden="true" />
                          fără dovadă
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex flex-wrap items-center gap-2">
                  {sesizareLink && (
                    <Link
                      href={sesizareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    >
                      <ExternalLink size={11} aria-hidden="true" />
                      Vezi sesizarea
                    </Link>
                  )}
                  {isPending && (
                    <>
                      <input
                        type="text"
                        aria-label="Motiv respingere (opțional)"
                        value={decisionNote[t.id] ?? ""}
                        onChange={(e) =>
                          setDecisionNote((p) => ({ ...p, [t.id]: e.target.value }))
                        }
                        placeholder="Motiv respingere (opțional, merge în email)"
                        maxLength={500}
                        className="flex-1 min-w-[180px] h-8 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => reject(t.id)}
                        disabled={acting === `${t.id}-rejected` || approveSubmitting}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-xs)] bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[11px] font-semibold hover:bg-rose-500/20 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        {acting === `${t.id}-rejected` ? (
                          <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <XCircle size={11} aria-hidden="true" />
                        )}
                        Respinge
                      </button>
                      <button
                        type="button"
                        onClick={() => setApproving(t)}
                        disabled={approveSubmitting || acting === `${t.id}-rejected`}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-xs)] bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-500"
                      >
                        <CheckCircle2 size={11} aria-hidden="true" />
                        Aprobă & aplică
                      </button>
                    </>
                  )}
                  {!isPending && (
                    <span
                      className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-[11px] font-semibold ${
                        t.decision === "approved"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {t.decision === "approved" ? (
                        <CheckCircle2 size={12} aria-hidden="true" />
                      ) : (
                        <AlertTriangle size={12} aria-hidden="true" />
                      )}
                      {t.decision === "approved" ? "Aprobată" : "Respinsă"}
                      {t.decided_at && (
                        <span className="opacity-70 font-normal">· {timeAgo(t.decided_at)}</span>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* In-tab proof preview */}
      <Lightbox
        open={!!preview}
        onClose={() => setPreview(null)}
        url={preview?.url ?? ""}
        title={preview?.title}
      />

      {/* Approve & apply modal — editable status / date / note + AI assist */}
      <ApproveTicketDialog
        open={!!approving}
        ticket={approving}
        submitting={approveSubmitting}
        onClose={() => !approveSubmitting && setApproving(null)}
        onSubmit={submitApprove}
      />
    </div>
  );
}
