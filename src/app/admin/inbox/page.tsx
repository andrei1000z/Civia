import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Inbox — Răspunsuri primite" };
export const dynamic = "force-dynamic";

interface ReplyRow {
  id: string;
  sesizare_id: string | null;
  from_email: string;
  from_name: string | null;
  authority_name: string | null;
  subject: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_authenticity_score: number | null;
  auto_applied: boolean | null;
  trusted_sender: boolean | null;
  received_at: string;
  attachments: Array<{
    filename?: string;
    extracted_text?: string | null;
    extraction_method?: string;
  }> | null;
}

const STATUS_LABELS: Record<string, string> = {
  inregistrata: "📨 Înregistrată",
  "in-lucru": "🛠️ În lucru",
  rezolvat: "🎉 Rezolvat",
  redirectionata: "↗️ Redirecționată",
  respins: "⚠️ Respins",
  cerere_informatii: "❓ Cerere informații",
  necunoscut: "❔ Necunoscut",
};

export default async function AdminInboxPage() {
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
  let rows: ReplyRow[] = [];
  try {
    const { data } = await admin
      .from("sesizare_replies")
      .select(
        "id, sesizare_id, from_email, from_name, authority_name, subject, ai_status, ai_confidence, ai_summary, ai_authenticity_score, auto_applied, trusted_sender, received_at, attachments",
      )
      .order("received_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as ReplyRow[];
  } catch {
    // SQL outage → empty list
  }

  // 2026-06-10 (audit statusuri, #5) — răspunsuri „în așteptare de confirmare":
  // AI le-a clasificat cu un status real, dar NU le-a aplicat automat (încredere
  // medie + sender netrusted) ȘI sunt legate de o sesizare. Adminul trebuie să le
  // vadă clar ca să confirme manual statusul sugerat (înainte erau pierdute în listă).
  const needsReview = (r: ReplyRow) =>
    !!r.ai_status &&
    r.ai_status !== "necunoscut" &&
    r.ai_status !== "cerere_informatii" &&
    !r.auto_applied &&
    !r.trusted_sender &&
    !!r.sesizare_id;
  const pendingCount = rows.filter(needsReview).length;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← Admin home
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mt-2">
          Inbox — Răspunsuri primite ({rows.length})
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Răspunsuri AI-classified din emailuri primite la sesizari@civia.ro.
          Click pe rând pentru detalii + textele extrase din atașamente.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/25 px-4 py-3 text-sm">
          <strong className="text-amber-800 dark:text-amber-300 tabular-nums">{pendingCount}</strong>{" "}
          {pendingCount === 1 ? "răspuns așteaptă" : "răspunsuri așteaptă"} confirmare manuală —
          AI le-a clasificat dar nu le-a aplicat automat (încredere medie). Rândurile evidențiate
          de mai jos — click pentru a confirma statusul sugerat.
        </div>
      )}

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">De la</th>
              <th className="px-3 py-2 text-left">Subiect</th>
              <th className="px-3 py-2 text-left">Status AI</th>
              <th className="px-3 py-2 text-right">Conf</th>
              <th className="px-3 py-2 text-right">Auth</th>
              <th className="px-3 py-2 text-center">📎</th>
              <th className="px-3 py-2 text-left">Auto</th>
              <th className="px-3 py-2 text-left">Primit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-[var(--color-border)] transition-colors ${
                  needsReview(r)
                    ? "bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/35"
                    : "hover:bg-[var(--color-surface-2)]"
                }`}
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/inbox/${r.id}`}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    {r.authority_name ?? r.from_name ?? r.from_email}
                  </Link>
                  <div className="text-xs text-[var(--color-text-muted)]">{r.from_email}</div>
                </td>
                <td className="px-3 py-2 max-w-md truncate" title={r.subject ?? ""}>
                  {r.subject ?? <em className="text-[var(--color-text-muted)]">(fără subiect)</em>}
                </td>
                <td className="px-3 py-2">
                  {r.ai_status ? STATUS_LABELS[r.ai_status] ?? r.ai_status : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.ai_confidence ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.ai_authenticity_score ?? "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.attachments && r.attachments.length > 0
                    ? r.attachments.length
                    : ""}
                </td>
                <td className="px-3 py-2">
                  {r.auto_applied ? "✓" : r.trusted_sender ? "trust" : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {formatDate(r.received_at)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  Niciun răspuns încă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
