import type { Metadata } from "next";
import { Code2, Key, Zap, FileText, ShieldCheck } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { ApiKeysManager } from "@/components/dezvoltatori/ApiKeysManager";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "API public pentru jurnaliști și dezvoltatori — Civia",
  description:
    "Acces programmatic la sesizările publice și statisticile Civia. Free tier 100/h, scopes read:sesizari + read:stats, exemple cURL + JS.",
  alternates: { canonical: "/dezvoltatori" },
};

export default function DezvoltatoriPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="API public Civia"
        icon={Code2}
        gradient={HERO_GRADIENT.data}
        description="Acces programmatic la sesizările publice + statistici agregate. Gratuit pentru jurnaliști, ONG-uri și dezvoltatori civic-tech."
        tagline="Read-only, JSON, cached la edge · Free tier 100 req/h"
      />

      <section className="grid sm:grid-cols-3 gap-3 mb-10">
        <Card className="text-center">
          <Zap className="mx-auto mb-2 text-emerald-600" size={20} />
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Latență</div>
          <div className="text-xl font-bold">~80ms p95</div>
        </Card>
        <Card className="text-center">
          <ShieldCheck className="mx-auto mb-2 text-blue-600" size={20} />
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Tier free</div>
          <div className="text-xl font-bold">100/h · 1000/zi</div>
        </Card>
        <Card className="text-center">
          <FileText className="mx-auto mb-2 text-violet-600" size={20} />
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Date</div>
          <div className="text-xl font-bold">CC BY 4.0</div>
        </Card>
      </section>

      {/* MANAGE KEYS */}
      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3 flex items-center gap-2">
          <Key size={18} aria-hidden="true" />
          Cheile tale API
        </h2>
        <ApiKeysManager />
      </section>

      {/* ENDPOINTS */}
      <section className="mb-12 space-y-6">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold">Endpoint-uri</h2>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded">GET</span>
            <code className="text-sm">/api/v2/sesizari</code>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Listează sesizările publice. Filtre: <code>county</code>, <code>tip</code>, <code>status</code>, <code>sector</code>, <code>from</code>, <code>to</code>, <code>limit</code> (max 200), <code>offset</code>.
          </p>
          <pre className="text-[11px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 overflow-x-auto">
{`curl -H "Authorization: Bearer civia_pk_..." \\
  "${SITE_URL}/api/v2/sesizari?county=B&status=rezolvat&limit=50"`}
          </pre>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded">GET</span>
            <code className="text-sm">/api/v2/stats</code>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Agregari: Fix Score per județ, top tip-uri, evoluție 12 luni. Cache 10 min la edge.
          </p>
          <pre className="text-[11px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 overflow-x-auto">
{`curl -H "Authorization: Bearer civia_pk_..." \\
  "${SITE_URL}/api/v2/stats" | jq '.fix_score_per_county[0:5]'`}
          </pre>
        </Card>
      </section>

      {/* JS EXAMPLE */}
      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3">Exemplu JS</h2>
        <Card>
          <pre className="text-[11px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 overflow-x-auto">
{`const res = await fetch("${SITE_URL}/api/v2/sesizari?county=CJ&limit=10", {
  headers: { Authorization: "Bearer " + process.env.CIVIA_API_KEY },
});
const { data, pagination } = await res.json();
console.log(\`\${data.length} of \${pagination.total} sesizari\`);
data.forEach((s) => console.log(s.code, s.titlu, s.status));`}
          </pre>
        </Card>
      </section>

      {/* TERMS */}
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-5 text-xs text-[var(--color-text-muted)] leading-relaxed space-y-2">
        <p><strong className="text-[var(--color-text)]">Licență date:</strong> Creative Commons BY 4.0 — folosește-le în articole, dashboard-uri, research. Atribuie „date Civia.ro" cu link la sursă.</p>
        <p><strong className="text-[var(--color-text)]">Privacy:</strong> NU expunem nume, email, adresă, descriere completă a sesizărilor. Doar titlu + locație publică + status + lat/lng.</p>
        <p><strong className="text-[var(--color-text)]">Abuz / blocare:</strong> rate-limit pe key_id. Pentru tier Pro (1000/h) sau scope-uri extinse, scrie la contact@civia.ro cu use case.</p>
        <p><strong className="text-[var(--color-text)]">Versiune:</strong> v2 (stabil, semantic versioning din 2026-05). Endpoint-urile v1 sunt deprecated.</p>
      </div>
    </div>
  );
}
