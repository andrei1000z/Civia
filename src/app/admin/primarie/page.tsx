import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, AlertCircle, CheckCircle2, Clock, MapPin } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SESIZARE_TIPURI, STATUS_LABELS } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard primărie — Civia",
  description: "Gestionează sesizările cetățenilor din județul tău.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Helper extras din render: React Compiler nu vrea Date.now() inline in JSX.
// Server Component render = o singura evaluare per request → safe sa
// folosim Date.now() in afara JSX-ului inline.
function isOverdue(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > 30 * 24 * 60 * 60_000;
}

export default async function PrimariePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/cont?from=primarie");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, authority_county, authority_sector, display_name, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "primarie") {
    return (
      <div className="container-narrow py-12">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-[var(--radius-md)] p-6">
          <h1 className="font-bold text-lg mb-2">Acces restricționat</h1>
          <p className="text-sm mb-3">
            Această pagină e pentru reprezentanții oficiali ai primăriilor. Dacă ești
            angajat al unei primării din România și vrei acces, trimite-ne un email la{" "}
            <a href="mailto:contact@civia.ro" className="underline">contact@civia.ro</a>{" "}
            cu dovada că reprezinți instituția (email oficial cu domeniu primarie.ro / pmb.ro / etc).
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Înapoi la <Link href="/" className="underline">civia.ro</Link>.
          </p>
        </div>
      </div>
    );
  }

  const county = ALL_COUNTIES.find((c) => c.id === profile.authority_county);
  const scope = profile.authority_sector
    ? `${profile.authority_sector} (București)`
    : county?.name ?? "Necunoscut";

  // Pull sesizări relevante pentru această primărie (RLS deja filtrează).
  const admin = createSupabaseAdmin();
  let q = admin
    .from("sesizari")
    .select("id, code, tip, titlu, locatie, sector, county, status, created_at, author_name", { count: "exact" })
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (profile.authority_sector) {
    q = q.eq("sector", profile.authority_sector);
  } else if (profile.authority_county) {
    q = q.eq("county", profile.authority_county);
  }

  const { data: sezData, count } = await q;
  const sez = sezData ?? [];

  const statusCounts = {
    nou: sez.filter((s) => s.status === "nou").length,
    trimis: sez.filter((s) => s.status === "trimis").length,
    rezolvat: sez.filter((s) => s.status === "rezolvat").length,
    in_lucru: sez.filter((s) => ["raspuns_partial", "in_lucru"].includes(s.status)).length,
  };

  const resolveRate = sez.length > 0
    ? Math.round((statusCounts.rezolvat / sez.length) * 100)
    : 0;

  return (
    <div className="container-narrow py-8 md:py-12 space-y-8">
      <header>
        <Badge variant="primary" className="mb-3">
          <Building2 size={11} aria-hidden="true" /> PRIMĂRIE — {scope}
        </Badge>
        <h1 className="font-[family-name:var(--font-sora)] text-3xl md:text-4xl font-extrabold mb-2">
          Bună, {profile.display_name || profile.full_name || "stimată autoritate"}
        </h1>
        <p className="text-[var(--color-text-muted)]">
          Sesizările din {scope} pe care cetățenii le-au trimis prin Civia.
        </p>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="text-center">
          <AlertCircle className="mx-auto mb-2 text-amber-600" size={20} />
          <div className="text-2xl font-extrabold tabular-nums">{statusCounts.nou + statusCounts.trimis}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Necesită răspuns</div>
        </Card>
        <Card className="text-center">
          <Clock className="mx-auto mb-2 text-blue-600" size={20} />
          <div className="text-2xl font-extrabold tabular-nums">{statusCounts.in_lucru}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">În lucru</div>
        </Card>
        <Card className="text-center">
          <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={20} />
          <div className="text-2xl font-extrabold tabular-nums">{statusCounts.rezolvat}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Rezolvate</div>
        </Card>
        <Card className="text-center">
          <MapPin className="mx-auto mb-2 text-violet-600" size={20} />
          <div className="text-2xl font-extrabold tabular-nums">{count ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Total</div>
        </Card>
        <Card className="text-center col-span-2 md:col-span-1">
          <div className="text-3xl font-extrabold tabular-nums" style={{ color: resolveRate >= 60 ? "var(--color-success)" : resolveRate >= 30 ? "var(--color-warning)" : "var(--color-error)" }}>
            {resolveRate}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Fix Score</div>
        </Card>
      </section>

      {/* LIST */}
      <section>
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3">
          Ultimele 50 sesizări
        </h2>
        {sez.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">
              Nicio sesizare publică pentru {scope} încă.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {sez.map((s) => {
              const tipMeta = SESIZARE_TIPURI.find((t) => t.value === s.tip);
              // `now` evaluat aici intr-un Server Component e ok (RSC are
              // 1 render pe request); React Compiler il flag-eaza pe regula
              // generala „pure render". Wrap-uim explicit ca const lazy.
              const overdue = ["nou", "trimis"].includes(s.status) && isOverdue(s.created_at);

              return (
                <Link
                  key={s.id}
                  href={`/sesizari/${s.code}`}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 hover:shadow-[var(--shadow-2)] hover:border-[var(--color-primary)]/30 transition-all flex items-start gap-3"
                >
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {tipMeta?.icon ?? "📝"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm line-clamp-1">{s.titlu}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{s.locatie}</span>
                      {s.sector && <span>· {s.sector}</span>}
                      <span>· {formatDate(s.created_at)}</span>
                      {overdue && (
                        <span className="inline-block bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          OVER 30 ZILE
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shrink-0"
                    style={{ background: tipMeta?.icon ? "var(--color-surface-2)" : undefined }}
                  >
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-5 text-xs text-[var(--color-text-muted)]">
        <p className="mb-2">
          <strong className="text-[var(--color-text)]">Cum răspunzi:</strong>{" "}
          Răspunsul oficial îl trimiți prin email obișnuit la cetățean (folosind adresa lui din mailul primit).
          Apoi, marchează aici statusul ca <code>raspuns_partial</code> sau <code>rezolvat</code>.
        </p>
        <p>
          Pentru sesizările publice, statusul + comentariul tău apar pe pagina sesizării — cetățenii văd că primăria a răspuns.
        </p>
      </div>
    </div>
  );
}
