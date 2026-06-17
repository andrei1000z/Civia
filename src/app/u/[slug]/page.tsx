import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, FileText, Users } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL, SITE_NAME } from "@/lib/constants";

/**
 * 🎁 MEDIUM #6 — Profil public opt-in.
 *
 * Page: /u/[slug] — afiseaza profilul cetateanului care a optat IN
 * cu lista sesizarilor rezolvate + badge-uri civice.
 *
 * Privacy: only public_profile_enabled = TRUE users get this route.
 */

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10 min

type Params = Promise<{ slug: string }>;

interface ProfileRow {
  id: string;
  display_name: string | null;
  public_profile_slug: string | null;
  public_bio: string | null;
  public_profile_enabled: boolean;
  created_at: string;
}

async function fetchProfile(slug: string): Promise<ProfileRow | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id, display_name, public_profile_slug, public_bio, public_profile_enabled, created_at")
    .eq("public_profile_slug", slug)
    .eq("public_profile_enabled", true)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await fetchProfile(slug);
  if (!profile) return { title: "Profil necunoscut" };
  const name = profile.display_name ?? "Cetățean Civia";
  return {
    title: `${name} pe ${SITE_NAME}`,
    description: profile.public_bio?.slice(0, 160) ?? `Profilul public al cetățeanului ${name} pe ${SITE_NAME}.`,
    alternates: { canonical: `/u/${slug}` },
    openGraph: {
      title: `${name} — Profil civic`,
      description: profile.public_bio?.slice(0, 160) ?? undefined,
      url: `${SITE_URL}/u/${slug}`,
      siteName: "Civia",
      locale: "ro_RO",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — Profil civic`,
      description: profile.public_bio?.slice(0, 160) ?? undefined,
      images: ["/opengraph-image"],
    },
  };
}

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { slug } = await params;
  const profile = await fetchProfile(slug);
  if (!profile) notFound();

  const admin = createSupabaseAdmin();

  // Sesizari publice ale userului
  const { data: sesizari } = await admin
    .from("sesizari_feed")
    .select("code, titlu, tip, status, created_at")
    .eq("user_id", profile.id)
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(30);

  // Counts
  const { count: total } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id);

  const { count: resolved } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("status", "rezolvat");

  // Referral (Faza 1) — câți cetățeni a adus pe Civia prin link-ul propriu.
  const { count: referrals } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", profile.id);

  const items = (sesizari ?? []) as Array<{
    code: string;
    titlu: string;
    tip: string;
    status: string;
    created_at: string;
  }>;

  const name = profile.display_name ?? "Cetățean Civia";

  // Badge-uri civice computate
  const badges: Array<{ label: string; color: string }> = [];
  if ((total ?? 0) >= 50) badges.push({ label: "Power Contributor 50+", color: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" });
  else if ((total ?? 0) >= 10) badges.push({ label: "Contributor activ", color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" });
  if ((resolved ?? 0) >= 5) badges.push({ label: "5+ probleme rezolvate", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" });
  // Faza 1 — ambasador (cetățeni aduși pe Civia).
  const refCount = referrals ?? 0;
  if (refCount >= 20) badges.push({ label: "🌟 Ambasador civic", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" });
  else if (refCount >= 5) badges.push({ label: "📣 Ambasador de încredere", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" });
  else if (refCount >= 1) badges.push({ label: "🤝 Ambasador", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" });

  return (
    <div className="container-narrow py-8 md:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 transition-colors"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Înapoi la Civia
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{name}</h1>
        {profile.public_bio && (
          <p className="text-[var(--color-text-muted)] max-w-prose">{profile.public_bio}</p>
        )}
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Membru din {new Date(profile.created_at).toLocaleDateString("ro-RO", { year: "numeric", month: "long" })}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
          <FileText size={18} className="text-sky-500 mb-2" aria-hidden="true" />
          <p className="text-2xl font-bold tabular-nums">{total ?? 0}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Sesizări total</p>
        </div>
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
          <Award size={18} className="text-emerald-500 mb-2" aria-hidden="true" />
          <p className="text-2xl font-bold tabular-nums">{resolved ?? 0}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Rezolvate</p>
        </div>
        {refCount > 0 && (
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <Users size={18} className="text-amber-500 mb-2" aria-hidden="true" />
            <p className="text-2xl font-bold tabular-nums">{refCount}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {refCount === 1 ? "Cetățean adus pe Civia" : "Cetățeni aduși pe Civia"}
            </p>
          </div>
        )}
        {badges.length > 0 && (
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <div className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.color}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3">Sesizări publice recente</h2>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {name} nu are sesizări publice listate.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => (
              <li
                key={s.code}
                className="p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
              >
                <Link href={`/sesizari/${s.code}`} className="font-medium hover:underline">
                  {s.titlu}
                </Link>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {s.tip} · {new Date(s.created_at).toLocaleDateString("ro-RO")} ·{" "}
                  <span className={s.status === "rezolvat" ? "text-emerald-500" : ""}>
                    {s.status}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
