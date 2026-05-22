import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff, Sparkles } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { CATEGORIE_META, type Actualizare } from "@/data/actualizari";

export const dynamic = "force-dynamic";

const LUNI_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatDataRo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dataText = `${d.getDate()} ${LUNI_RO[d.getMonth()]} ${d.getFullYear()}`;
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${dataText}, ${h}:${m}`;
}

interface ActualizareRow extends Actualizare {
  id: string;
  published: boolean;
  continut_markdown?: string | null;
}

export default async function AdminActualizariPage() {
  // Auth gate
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?login=1");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    redirect("/");
  }

  // Fetch all (including unpublished)
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("actualizari")
    .select("*")
    .order("data", { ascending: false });
  const actualizari = (data as ActualizareRow[] | null) ?? [];

  return (
    <div>
      <header className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-1">
            Actualizări
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Istoricul versiunilor Civia — apare public la{" "}
            <Link href="/actualizari" className="text-[var(--color-primary)] hover:underline">
              /actualizari
            </Link>
            . Adaugă versiuni cu schimbări + descriere markdown + rich text.
          </p>
        </div>
        <Link
          href="/admin/actualizari/nou"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors shrink-0"
        >
          <Plus size={16} aria-hidden="true" />
          Adaugă versiune
        </Link>
      </header>

      {actualizari.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Nicio actualizare. Apasă „Adaugă versiune" sus.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actualizari.map((a) => (
            <article
              key={a.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="inline-flex items-center justify-center min-w-[60px] h-6 px-2 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold tabular-nums shrink-0"
                    >
                      v{a.versiune}
                    </span>
                    {a.major && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500">
                        <Sparkles size={10} aria-hidden="true" />
                        Major
                      </span>
                    )}
                    {a.minimalist && (
                      <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-500">
                        Minimalist
                      </span>
                    )}
                    {!a.published && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                        <EyeOff size={10} aria-hidden="true" />
                        Draft
                      </span>
                    )}
                    {a.published && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                        <Eye size={10} aria-hidden="true" />
                        Public
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-base truncate">{a.titlu}</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {formatDataRo(a.data)}
                    {" · "}
                    {a.schimbari?.length ?? 0} schimbări
                    {a.continut_markdown ? " · cu Markdown" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/actualizari/${a.versiune}`}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-primary)] hover:text-white text-xs font-semibold transition-colors"
                  >
                    <Pencil size={12} aria-hidden="true" />
                    Editează
                  </Link>
                  <form action={`/admin/actualizari/${a.versiune}/delete`} method="post">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-xs)] bg-red-500/10 text-red-600 hover:bg-red-500/20 text-xs font-semibold transition-colors"
                      title="Șterge actualizarea"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                      Șterge
                    </button>
                  </form>
                </div>
              </div>

              {/* Schimbări preview */}
              {a.schimbari && a.schimbari.length > 0 && (
                <ul className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1 text-xs">
                  {a.schimbari.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0"
                        style={{
                          background: CATEGORIE_META[s.categorie].bg,
                          color: CATEGORIE_META[s.categorie].color,
                        }}
                      >
                        {CATEGORIE_META[s.categorie].label}
                      </span>
                      <span className="text-[var(--color-text-muted)] line-clamp-1">{s.text}</span>
                    </li>
                  ))}
                  {a.schimbari.length > 3 && (
                    <li className="text-[10px] text-[var(--color-text-muted)] italic">
                      + {a.schimbari.length - 3} alte schimbări
                    </li>
                  )}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-xs text-[var(--color-text-muted)]">
        <strong>Sintaxă Markdown suportată:</strong>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">**bold**</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">*italic*</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">~~strike~~</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">__underline__</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">{`{color:red}text{/color}`}</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">{`{size:large}text{/size}`}</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5"># H1</code>{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] mx-0.5">- listă</code>
      </div>
    </div>
  );
}
