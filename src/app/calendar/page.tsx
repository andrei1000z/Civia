import type { Metadata } from "next";
import { Calendar as CalendarIcon, Megaphone, Vote, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 🎁 MEDIUM #3 — Calendar civic.
 *
 * Aggregator: proteste programate + consultatii publice + sedinte consiliu local.
 * Per perioada urmatoarele 30 zile.
 */

export const metadata: Metadata = {
  title: "Calendar civic — evenimente importante",
  description:
    "Toate evenimentele civice relevante săptămânale: ședințe consiliu local, consultări publice, proteste programate, termene legale.",
  alternates: { canonical: "/calendar" },
};

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface EvenimentRow {
  id: string;
  date: string;
  category: string;
  title: string;
  location: string | null;
  source_url: string | null;
}

async function loadEvenimente(): Promise<EvenimentRow[]> {
  const admin = createSupabaseAdmin();
  const events: EvenimentRow[] = [];

  // Proteste programate
  const { data: proteste } = await admin
    .from("proteste")
    .select("id, data, titlu, oras, source_url")
    .gte("data", new Date().toISOString().slice(0, 10))
    .lte("data", new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10))
    .order("data", { ascending: true })
    .limit(50);

  for (const p of (proteste ?? []) as Array<{ id: string; data: string; titlu: string; oras: string | null; source_url: string | null }>) {
    events.push({
      id: `protest-${p.id}`,
      date: p.data,
      category: "Protest",
      title: p.titlu,
      location: p.oras,
      source_url: p.source_url,
    });
  }

  // Consultatii publice (dacă există tabela)
  try {
    const { data: cons } = await admin
      .from("consultatii_publice")
      .select("id, date_sedinta, titlu, consiliu, source_url")
      .gte("date_sedinta", new Date().toISOString().slice(0, 10))
      .lte("date_sedinta", new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10))
      .order("date_sedinta", { ascending: true })
      .limit(50);
    for (const c of (cons ?? []) as Array<{ id: string; date_sedinta: string | null; titlu: string; consiliu: string; source_url: string | null }>) {
      if (!c.date_sedinta) continue;
      events.push({
        id: `cons-${c.id}`,
        date: c.date_sedinta,
        category: "Consultare publică",
        title: c.titlu,
        location: c.consiliu,
        source_url: c.source_url,
      });
    }
  } catch {
    // tabela poate sa nu existe inca
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export default async function CalendarPage() {
  const events = await loadEvenimente();

  // Group by week
  const today = new Date().toISOString().slice(0, 10);
  const byWeek: Record<string, EvenimentRow[]> = {};
  for (const ev of events) {
    const weekStart = getWeekStart(ev.date);
    (byWeek[weekStart] ||= []).push(ev);
  }

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Calendar civic"
        icon={CalendarIcon}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Tot ce se întâmplă civic săptămâna asta: <strong>ședințe consiliu</strong>,{" "}
            <strong>consultări publice</strong>, <strong>proteste programate</strong>.
          </>
        }
        tagline="Awareness → participare."
      />

      <div className="my-6 flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
        <Link
          href="/api/calendar/export.ics"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
        >
          <CalendarIcon size={12} aria-hidden="true" />
          Export iCal (Google Calendar)
        </Link>
        <span className="px-3 py-1.5">{events.length} evenimente · următoarele 30 zile</span>
      </div>

      {Object.entries(byWeek).length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--color-text-muted)]">
          <CalendarIcon size={32} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p>Niciun eveniment programat în următoarele 30 zile.</p>
        </div>
      ) : (
        Object.entries(byWeek).map(([weekStart, weekEvents]) => (
          <section key={weekStart} className="mb-8">
            <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Săptămâna {formatWeekRange(weekStart)}
            </h2>
            <ul className="space-y-2">
              {weekEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-center shrink-0">
                      <p className="text-2xl font-bold tabular-nums">
                        {new Date(ev.date).getDate()}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] uppercase">
                        {new Date(ev.date).toLocaleDateString("ro-RO", { month: "short" })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium mb-1">
                        {ev.category === "Protest" ? (
                          <Megaphone size={10} aria-hidden="true" />
                        ) : (
                          <Vote size={10} aria-hidden="true" />
                        )}
                        {ev.category}
                      </span>
                      <p className="font-medium">{ev.title}</p>
                      {ev.location && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {ev.location}
                        </p>
                      )}
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline mt-2"
                        >
                          Detalii
                          <ExternalLink size={10} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="text-xs text-[var(--color-text-muted)] mt-12 text-center">
        Today: {today}
      </p>
    </div>
  );
}

function getWeekStart(date: string): string {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start.getTime() + 6 * 86400_000);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("ro-RO", opts)} – ${end.toLocaleDateString("ro-RO", opts)}`;
}
