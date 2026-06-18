import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import {
  getActiveInterruptions,
  TYPE_COLORS,
  TYPE_ICONS,
  TYPE_LABELS,
} from "@/data/intreruperi";
import { UpcomingClock } from "@/components/ui/UpcomingClock";

/**
 * Homepage widget — arată următoarele 4 întreruperi care pornesc curând.
 * Server component — zero JS trimis la client.
 */
export async function IntreruperiWidget() {
  const items = (await getActiveInterruptions()).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-[var(--color-bg)] min-h-[280px]">
      <div className="container-narrow">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold flex items-center gap-2 min-w-0">
            <AlertTriangle
              size={20}
              className="text-amber-500 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">Întreruperi programate</span>
          </h2>
          <Link
            href="/intreruperi"
            className="text-sm text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
          >
            Toate <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 lc-stagger">
          {items.map((i) => (
            <Link
              key={i.id}
              href={`/intreruperi/${i.id}`}
              prefetch
              className="group lc-glass-2 rounded-3xl p-4 hover:border-[var(--color-primary)]/30 card-lift min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
              style={{
                borderLeftWidth: "4px",
                borderLeftColor: TYPE_COLORS[i.type],
              }}
            >
              <div className="flex items-start justify-between mb-2 gap-2 min-w-0">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-xs)] text-lg shrink-0"
                  style={{
                    background: TYPE_COLORS[i.type] + "20",
                  }}
                  aria-hidden="true"
                >
                  {TYPE_ICONS[i.type]}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 shrink-0"
                  style={{
                    background:
                      i.status === "in-desfasurare"
                        ? "color-mix(in srgb, var(--color-warning) 13%, transparent)"
                        : "color-mix(in srgb, var(--color-news) 13%, transparent)",
                    color:
                      i.status === "in-desfasurare"
                        ? "var(--color-warning)"
                        : "var(--color-news)",
                  }}
                >
                  <Clock size={9} aria-hidden="true" />
                  {i.status === "in-desfasurare" ? (
                    "acum"
                  ) : (
                    <UpcomingClock date={i.startAt} />
                  )}
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-0.5">
                {TYPE_LABELS[i.type]}
              </p>
              <p className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                {i.reason}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                {i.addresses[0]}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
