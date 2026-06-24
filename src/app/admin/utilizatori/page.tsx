import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { Users, Mail, Calendar, FileText, Shield } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utilizatori — Admin Civia" };

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  role: string | null;
  created_at: string;
  nr_sesizari?: number;
}

export default async function AdminUtilizatoriPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const admin = createSupabaseAdmin();

  // audit fix: înainte, fără căutare, se făcea `.ilike("id", "%")` pe o coloană
  // uuid → eroare → total mereu 0. Acum: filtru DOAR când există căutare, peste
  // full_name + email + display_name (toate afișate ca coloane).
  const safeQ = q ? q.replace(/[,()%*]/g, "") : "";
  const orFilter = safeQ
    ? `full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,display_name.ilike.%${safeQ}%`
    : null;

  // Total count
  let countQuery = admin.from("profiles").select("*", { count: "exact", head: true });
  if (orFilter) countQuery = countQuery.or(orFilter);
  const { count: total } = await countQuery;

  // Fetch profiles
  let query = admin
    .from("profiles")
    .select("id, email, full_name, display_name, role, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (orFilter) query = query.or(orFilter);

  const { data: profiles } = await query;

  // Per-user sesizari count (batch)
  const ids = (profiles ?? []).map((p) => p.id);
  const { data: counts } = ids.length
    ? await admin
        .from("sesizari")
        .select("user_id")
        .in("user_id", ids)
        // 2026-06-24 — limită explicită peste default-ul PostgREST de 1000:
        // altfel, dacă userii din pagina curentă au cumulat >1000 sesizări,
        // numărătoarea per-user ieșea trunchiată silent.
        .limit(10000)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    if (row.user_id) countMap[row.user_id] = (countMap[row.user_id] ?? 0) + 1;
  }

  const rows = (profiles ?? []) as Profile[];
  const totalPages = Math.ceil((total ?? 0) / pageSize);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--color-primary)]" />
          <h1 className="font-bold text-lg">Utilizatori</h1>
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
            ({total?.toLocaleString("ro-RO") ?? 0} total)
          </span>
        </div>
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Caută după nume..."
            className="h-9 px-3 text-sm rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
          <button
            type="submit"
            className="h-9 px-4 text-sm rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-medium"
          >
            Caută
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-2)] text-left">
              <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Utilizator</th>
              <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wide text-center">Sesizări</th>
              <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Rol</th>
              <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Înregistrat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((u) => (
              <tr key={u.id} className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.full_name ?? u.display_name ?? "—"}</div>
                  {u.display_name && u.full_name && u.display_name !== u.full_name && (
                    <div className="text-xs text-[var(--color-text-muted)]">@{u.display_name}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                    <Mail size={11} className="shrink-0" />
                    {u.email ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center tabular-nums">
                  {countMap[u.id] ? (
                    <span className="inline-flex items-center gap-1 text-[var(--color-primary)] font-semibold">
                      <FileText size={11} />
                      {countMap[u.id]}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">
                      <Shield size={10} />
                      admin
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">user</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(u.created_at).toLocaleDateString("ro-RO", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  Niciun utilizator găsit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">
            Pagina {page} din {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="h-9 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] inline-flex items-center hover:bg-[var(--color-surface)] transition-colors"
              >
                ← Anterior
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="h-9 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white inline-flex items-center hover:opacity-90 transition-opacity"
              >
                Următor →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
