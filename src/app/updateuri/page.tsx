import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { UpdateBody } from "./UpdateBody";

// Updates list barely changes — we add an entry maybe once per
// release. 30 min ISR is plenty fresh and keeps origin cost zero
// for the typical traffic pattern.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Update-uri și changelog",
  description:
    "Istoricul versiunilor Civia — ce a fost adăugat, ce s-a îmbunătățit, ce vine. V1, V2, V3 și mai departe.",
  alternates: { canonical: "/updateuri" },
};

interface UpdateRow {
  id: string;
  version: string;
  title: string;
  body: string;
  published_at: string;
}

async function fetchUpdates(): Promise<UpdateRow[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("platform_updates")
      .select("id,version,title,body,published_at")
      .order("published_at", { ascending: false });
    return (data ?? []) as UpdateRow[];
  } catch {
    return [];
  }
}

function formatRoDate(iso: string): string {
  // Arată data + ora dacă ora nu e 00:00 (default „doar data" la
  // entry-uri vechi). Așa user-ii care setează publicare la o oră
  // specifică (ex: 14:30) văd ora exactă în timeline.
  const d = new Date(iso);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return d.toLocaleString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Bucharest",
  });
}

export default async function UpdateuriPage() {
  const updates = await fetchUpdates();

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Update-uri"
        icon={Sparkles}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Tot ce s-a schimbat pe Civia, în ordinea în care s-a întâmplat.
            Versiunile sunt numerotate <strong>V1, V2, V3</strong>, începând
            cu lansarea publică.
          </>
        }
        tagline={
          updates.length > 0
            ? `${updates.length} ${updates.length === 1 ? "versiune" : "versiuni"} publicate`
            : "În curând — prima versiune apare aici."
        }
      />

      {updates.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Nu există încă nicio versiune publicată.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 md:space-y-6">
          {/* Vertical rail through the version markers — subtle but
              ties the cards together as a timeline rather than a
              detached list. Hidden on mobile (rail would float
              alone in 1-col layout). */}
          <div
            className="hidden md:block absolute left-[18px] top-3 bottom-3 w-px bg-gradient-to-b from-[var(--color-primary)]/40 via-[var(--color-border)] to-transparent pointer-events-none"
            aria-hidden="true"
          />
          {updates.map((u, i) => (
            <li key={u.id} className="relative">
              <article
                className="md:ml-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 md:p-6 hover:shadow-[var(--shadow-2)] transition-shadow"
                aria-labelledby={`update-${u.id}-title`}
              >
                {/* Version chip — sits on the rail on desktop */}
                <span
                  className="hidden md:flex absolute left-0 top-5 w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-emerald-800 text-white items-center justify-center font-[family-name:var(--font-sora)] font-bold text-[10px] shadow-[var(--shadow-2)] ring-4 ring-[var(--color-bg)]"
                  aria-hidden="true"
                >
                  {u.version}
                </span>

                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {/* Mobile shows the version inline (no rail) */}
                    <span
                      className="md:hidden inline-flex items-center px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-mono text-[11px] font-bold"
                      aria-hidden="true"
                    >
                      {u.version}
                    </span>
                    <h2
                      id={`update-${u.id}-title`}
                      className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-extrabold leading-tight"
                    >
                      <span className="sr-only">{u.version} — </span>
                      {u.title}
                    </h2>
                  </div>
                  <time
                    dateTime={u.published_at}
                    className="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0"
                  >
                    {formatRoDate(u.published_at)}
                  </time>
                </div>
                <UpdateBody markdown={u.body} />
                {/* "Cea mai nouă" pill on the most recent entry */}
                {i === 0 && (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] motion-safe:animate-pulse" />
                    Cea mai nouă
                  </p>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}

      <p className="text-center text-xs text-[var(--color-text-muted)] mt-10 leading-relaxed">
        Ai o idee, un bug, sau ceva ce ai vrea să apară pe Civia?{" "}
        <a
          href="#footer-feedback"
          className="text-[var(--color-primary)] hover:underline"
        >
          Trimite feedback din subsol
        </a>
        .
      </p>
    </div>
  );
}
