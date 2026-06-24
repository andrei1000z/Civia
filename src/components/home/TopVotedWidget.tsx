import Link from "next/link";
import { MapPin, ArrowRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { STATUS_COLORS, STATUS_LABELS, SESIZARE_TIPURI } from "@/lib/constants";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { getRecentSesizariCached } from "@/lib/cached-queries";

interface Row {
  id: string;
  code: string;
  titlu: string;
  locatie: string;
  sector: string;
  tip: string;
  status: string;
  nr_comentarii: number;
  created_at: string;
}

/**
 * 2026-06-03 — Era „TopVotedWidget" (ranking pe voturi). Votarea a fost
 * eliminată; acum arată cele mai RECENTE sesizări active („Ce semnalează
 * cetățenii acum"). Numele fișierului păstrat pentru a minimiza churn-ul de
 * importuri; rolul e „recent".
 *
 * 2026-06-24 — Server Component: datele vin din getRecentSesizariCached (incluse
 * în HTML-ul ISR al homepage-ului). Înainte era „use client" + fetch în useEffect
 * → waterfall + skeleton pe „/" (cale fierbinte, 53% mobil) la fiecare încărcare.
 */
export async function TopVotedWidget() {
  const rows = (await getRecentSesizariCached(5)) as Row[];

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[220px] p-6 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-3xl text-center">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">
            Nicio sesizare încă
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-4">
            Fii primul cetățean care raportează o problemă civică.
          </p>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Send size={14} aria-hidden="true" />
            Fă prima sesizare
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 lc-stagger">
      {rows.map((s) => {
        const tipIcon = SESIZARE_TIPURI.find((t) => t.value === s.tip)?.icon ?? "📝";
        return (
          <Link
            key={s.id}
            href={`/sesizari/${s.code}`}
            className="flex items-center gap-4 p-4 lc-glass-2 rounded-3xl shadow-[var(--shadow-1)] hover:border-[var(--color-primary)]/40 card-lift group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            aria-label={`${s.titlu} — ${STATUS_LABELS[s.status] ?? s.status}`}
          >
            <div
              className="shrink-0 w-12 h-12 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-emerald-800 text-white flex items-center justify-center text-2xl"
              aria-hidden="true"
            >
              {tipIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge bgColor={STATUS_COLORS[s.status]} color="white">
                  {STATUS_LABELS[s.status]}
                </Badge>
                {s.sector && (
                  <Badge variant="neutral" className="text-[10px]">
                    {s.sector}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-sm md:text-base truncate group-hover:text-[var(--color-primary)]">
                {s.titlu}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] truncate flex items-center gap-1 mt-0.5">
                <MapPin size={11} aria-hidden="true" />
                {s.locatie}
                <span aria-hidden="true">·</span>
                <TimeAgo date={s.created_at} />
              </p>
            </div>
            <ArrowRight
              size={18}
              className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all"
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </div>
  );
}
