import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, TrendingUp } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categorii noi (AI) — Admin",
  robots: { index: false, follow: false },
};

interface CategoryGroup {
  category: string;
  count: number;
  recentSesizari: Array<{
    code: string;
    titlu: string;
    locatie: string;
    confidence: number | null;
    created_at: string;
  }>;
}

async function loadCategories(): Promise<CategoryGroup[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("sesizari")
    .select("code, titlu, locatie, custom_category, custom_category_confidence, created_at")
    .eq("tip", "altele")
    .not("custom_category", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const groups = new Map<string, CategoryGroup>();
  for (const row of data ?? []) {
    if (!row.custom_category) continue;
    let g = groups.get(row.custom_category);
    if (!g) {
      g = { category: row.custom_category, count: 0, recentSesizari: [] };
      groups.set(row.custom_category, g);
    }
    g.count += 1;
    if (g.recentSesizari.length < 5) {
      g.recentSesizari.push({
        code: row.code,
        titlu: row.titlu,
        locatie: row.locatie,
        confidence: row.custom_category_confidence,
        created_at: row.created_at,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export default async function CategoriiNoiPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?from=admin-categorii");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return (
      <div className="container-narrow py-12">
        <p>Acces restricționat. Doar admin.</p>
      </div>
    );
  }

  const groups = await loadCategories();
  const totalSesizari = groups.reduce((acc, g) => acc + g.count, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold flex items-center gap-2">
          <Sparkles size={20} className="text-[var(--color-primary)]" aria-hidden="true" />
          Categorii noi generate de AI
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Sesizări cu tip „altele" + etichetă custom_category propusă de AI.
          Ordonate descrescător după volum — categoriile cu count mare merită promovate la tipuri oficiale.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <div className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]">{groups.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Etichete unice</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-extrabold tabular-nums">{totalSesizari}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Sesizări „altele"</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-extrabold tabular-nums">
            {groups.filter((g) => g.count >= 3).length}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">≥ 3 apariții</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-extrabold tabular-nums">
            {groups.filter((g) => g.count >= 10).length}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">≥ 10 (promovează!)</div>
        </Card>
      </div>

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">
            Nicio sesizare cu „altele" + custom_category încă. Va apărea aici cand userii folosesc fallback-ul.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.category}>
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base flex items-center gap-2 flex-wrap break-words">
                    {g.category}
                    {g.count >= 10 && (
                      <Badge variant="primary" className="shrink-0">
                        <TrendingUp size={11} aria-hidden="true" />
                        promovează
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {g.count} {g.count === 1 ? "apariție" : "apariții"}
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 text-xs">
                {g.recentSesizari.map((s) => (
                  <li key={s.code} className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/sesizari/${s.code}`}
                      className="text-[var(--color-primary)] hover:underline font-medium"
                    >
                      {s.code}
                    </Link>
                    <span className="text-[var(--color-text)] truncate">{s.titlu}</span>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="text-[var(--color-text-muted)] text-[11px]">{s.locatie}</span>
                    {s.confidence !== null && (
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                        conf {s.confidence}%
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--color-text-muted)]">{formatDate(s.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-4 text-xs text-[var(--color-text-muted)] leading-relaxed">
        <p className="mb-2">
          <strong className="text-[var(--color-text)]">Cum promovezi o categorie:</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Vezi o etichetă cu count mare (≥ 10 e semnal solid)?</li>
          <li>Adaugă tipul nou în <code>src/lib/constants.ts → SESIZARE_TIPURI</code> cu un value scurt (ex: <code>cosuri_gunoi</code>) și icon potrivit.</li>
          <li>Adaugă tipul nou și în <code>SYSTEM_PROMPT_CLASSIFIER</code> din <code>src/lib/groq/prompts.ts</code> cu descrierea când e folosit.</li>
          <li>Adaugă routing autoritate (dacă diferă) în <code>src/lib/sesizari/authorities.ts</code>.</li>
          <li>(Opțional) Backfill: update sesizari existente unde <code>custom_category</code> match → set tip nou.</li>
        </ol>
      </div>
    </div>
  );
}
