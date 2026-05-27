import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Răspuns inbox — detaliu" };
export const dynamic = "force-dynamic";

interface ReplyDetail {
  id: string;
  sesizare_id: string | null;
  from_email: string;
  from_name: string | null;
  authority_id: string | null;
  authority_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  raw_headers: Record<string, string> | null;
  attachments: Array<{
    filename?: string;
    content_type?: string;
    size?: number;
    r2_key?: string | null;
    extracted_text?: string | null;
    extraction_method?: string;
    extraction_ms?: number;
    extraction_error?: string | null;
  }> | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_chain: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_nr_inregistrare: string | null;
  ai_deadline: string | null;
  ai_suggested_action: string | null;
  ai_authenticity_score: number | null;
  ai_authenticity_reasoning: string | null;
  ai_input_text: string | null;
  auto_applied: boolean | null;
  trusted_sender: boolean | null;
  received_at: string;
  processed_at: string | null;
}

export default async function AdminInboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") notFound();

  const admin = createSupabaseAdmin();
  let row: ReplyDetail | null = null;
  try {
    const { data } = await admin
      .from("sesizare_replies")
      .select(
        "id, sesizare_id, from_email, from_name, authority_id, authority_name, subject, body_text, body_html, raw_headers, attachments, message_id, in_reply_to, references_chain, ai_status, ai_confidence, ai_summary, ai_nr_inregistrare, ai_deadline, ai_suggested_action, ai_authenticity_score, ai_authenticity_reasoning, ai_input_text, auto_applied, trusted_sender, received_at, processed_at",
      )
      .eq("id", id)
      .maybeSingle();
    row = data as ReplyDetail | null;
  } catch {
    // continue with null
  }

  if (!row) notFound();

  // Sesizare info
  let sesizareCode: string | null = null;
  let sesizareTitle: string | null = null;
  if (row.sesizare_id) {
    try {
      const { data: ses } = await admin
        .from("sesizari")
        .select("code, titlu")
        .eq("id", row.sesizare_id)
        .maybeSingle();
      if (ses) {
        sesizareCode = (ses as { code: string }).code;
        sesizareTitle = (ses as { titlu: string }).titlu;
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/inbox"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← Inbox
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mt-2">
          {row.subject ?? "(fără subiect)"}
        </h1>
        <div className="text-sm text-[var(--color-text-muted)] mt-2">
          De la <strong>{row.from_name ?? row.from_email}</strong> ({row.from_email})
          {row.authority_name && (
            <> — autoritate: <strong>{row.authority_name}</strong></>
          )}
          <br />
          Primit: {formatDate(row.received_at)}
        </div>
      </div>

      {/* Sesizare match */}
      {sesizareCode && (
        <section className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h2 className="text-sm font-bold mb-2">Sesizare asociată</h2>
          <Link
            href={`/sesizari/${sesizareCode}`}
            className="text-[var(--color-primary)] hover:underline"
          >
            {sesizareCode} — {sesizareTitle}
          </Link>
        </section>
      )}

      {/* AI classification */}
      <section className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
        <h2 className="text-sm font-bold mb-3">Clasificare AI</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--color-text-muted)]">Status</dt>
          <dd className="font-medium">{row.ai_status ?? "—"}</dd>
          <dt className="text-[var(--color-text-muted)]">Confidence</dt>
          <dd className="tabular-nums">{row.ai_confidence ?? "—"}/100</dd>
          <dt className="text-[var(--color-text-muted)]">Authenticity</dt>
          <dd className="tabular-nums">{row.ai_authenticity_score ?? "—"}/100</dd>
          <dt className="text-[var(--color-text-muted)]">Auto-applied</dt>
          <dd>{row.auto_applied ? "✓ DA" : "—"}</dd>
          <dt className="text-[var(--color-text-muted)]">Trusted sender</dt>
          <dd>{row.trusted_sender ? "✓" : "—"}</dd>
          <dt className="text-[var(--color-text-muted)]">Nr înregistrare</dt>
          <dd>{row.ai_nr_inregistrare ?? "—"}</dd>
          <dt className="text-[var(--color-text-muted)]">Deadline</dt>
          <dd>{row.ai_deadline ?? "—"}</dd>
          <dt className="text-[var(--color-text-muted)]">Acțiune sugerată</dt>
          <dd>{row.ai_suggested_action ?? "—"}</dd>
        </dl>
        {row.ai_summary && (
          <div className="mt-3 p-3 bg-[var(--color-surface-2)] rounded text-sm">
            <strong>Rezumat:</strong> {row.ai_summary}
          </div>
        )}
        {row.ai_authenticity_reasoning && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-[var(--color-text-muted)]">
              Authenticity reasoning
            </summary>
            <div className="mt-2 p-2 bg-[var(--color-surface-2)] rounded">
              {row.ai_authenticity_reasoning}
            </div>
          </details>
        )}
      </section>

      {/* Attachments cu texte extrase */}
      {row.attachments && row.attachments.length > 0 && (
        <section className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h2 className="text-sm font-bold mb-3">
            Atașamente ({row.attachments.length})
          </h2>
          <div className="space-y-3">
            {row.attachments.map((att, i) => (
              <div key={i} className="border border-[var(--color-border)] rounded p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium text-sm">{att.filename ?? "unknown"}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {att.content_type} · {att.size ? `${Math.round(att.size / 1024)} KB` : ""}
                      {att.extraction_method && (
                        <> · extracție: <code>{att.extraction_method}</code></>
                      )}
                      {att.extraction_ms !== undefined && (
                        <> · {att.extraction_ms}ms</>
                      )}
                    </div>
                  </div>
                </div>
                {att.extraction_error && (
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded mt-2">
                    Eroare extracție: {att.extraction_error}
                  </div>
                )}
                {att.extracted_text && (
                  <details>
                    <summary className="cursor-pointer text-xs text-[var(--color-primary)] mt-2">
                      Vezi text extras ({att.extracted_text.length} chars)
                    </summary>
                    <pre className="mt-2 p-3 bg-[var(--color-surface-2)] rounded text-xs whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                      {att.extracted_text}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Body original */}
      <section className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
        <h2 className="text-sm font-bold mb-3">Body email</h2>
        {row.body_text ? (
          <pre className="text-sm whitespace-pre-wrap font-sans">{row.body_text}</pre>
        ) : (
          <em className="text-[var(--color-text-muted)]">(body gol — răspuns probabil doar în atașament)</em>
        )}
      </section>

      {/* AI input text — ce a văzut AI exact */}
      {row.ai_input_text && row.ai_input_text !== row.body_text && (
        <section className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
          <h2 className="text-sm font-bold mb-3">
            Text trimis la AI (body + atașamente concat)
          </h2>
          <details>
            <summary className="cursor-pointer text-xs text-[var(--color-primary)]">
              Vezi text ({row.ai_input_text.length} chars)
            </summary>
            <pre className="mt-2 p-3 bg-[var(--color-surface-2)] rounded text-xs whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {row.ai_input_text}
            </pre>
          </details>
        </section>
      )}

      {/* Threading info */}
      <section className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
        <h2 className="text-sm font-bold mb-3">Threading (RFC 5322)</h2>
        <dl className="grid grid-cols-1 gap-y-1 text-xs font-mono">
          <dt className="text-[var(--color-text-muted)]">Message-ID</dt>
          <dd className="break-all">{row.message_id ?? "—"}</dd>
          <dt className="text-[var(--color-text-muted)] mt-2">In-Reply-To</dt>
          <dd className="break-all">{row.in_reply_to ?? "—"}</dd>
          <dt className="text-[var(--color-text-muted)] mt-2">References chain</dt>
          <dd className="break-all">{row.references_chain ?? "—"}</dd>
        </dl>
      </section>
    </div>
  );
}
