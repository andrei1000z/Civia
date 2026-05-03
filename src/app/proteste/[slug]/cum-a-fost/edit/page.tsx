import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { AftermathForm } from "./AftermathForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Adaugă Cum a fost",
  description:
    "Documentează ce s-a întâmplat la protest — câți au participat, ce s-a scandat, presa, video-uri.",
  robots: { index: false, follow: false },
};

interface ProtestSummary {
  id: string;
  slug: string;
  title: string;
  start_at: string;
  visibility: string;
  moderation_status: string;
  aftermath_moderation_status: string;
}

async function fetchProtest(slug: string): Promise<ProtestSummary | null> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("proteste")
      .select(
        "id, slug, title, start_at, visibility, moderation_status, aftermath_moderation_status",
      )
      .eq("slug", slug)
      .maybeSingle();
    return (data as ProtestSummary | null) ?? null;
  } catch {
    return null;
  }
}

export default async function AftermathEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Admin-only — feature scos din public, mutat în admin pentru a evita
  // spam + moderare manuală. Admin publică direct ca approved.
  const supa = await createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(`/cont?next=/proteste/${slug}/cum-a-fost/edit`);
  const { data: profile } = await supa
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    notFound();
  }

  const protest = await fetchProtest(slug);
  if (!protest) notFound();
  if (protest.visibility !== "publica" || protest.moderation_status !== "approved") {
    notFound();
  }

  const isInFuture = new Date(protest.start_at) > new Date();
  if (isInFuture) {
    redirect(`/proteste/${protest.slug}?aftermath=too-early`);
  }
  // Admin poate suprascrie aftermath existent — fără block pe „exists".

  const protestDate = new Date(protest.start_at).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Cum a fost (admin)"
        icon={ShieldCheck}
        gradient={HERO_GRADIENT.authority}
        backHref={`/proteste/${protest.slug}`}
        backLabel="Înapoi la protest"
        description={
          <>
            Documentează ce s-a întâmplat la <strong>„{protest.title}"</strong> ({protestDate}).
            Lipește 1-10 link-uri către articolele de presă și AI completează automat
            câmpurile, sau scrie tu manual.
          </>
        }
        tagline="Admin-only. Submisia se publică direct, fără moderare suplimentară."
      />

      <AftermathForm slug={protest.slug} protestTitle={protest.title} />

      <div className="mt-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-xs text-[var(--color-text-muted)] leading-relaxed space-y-2">
        <p>
          <strong className="text-[var(--color-text)]">Cum funcționează AI-ul:</strong>{" "}
          lipești 1-10 link-uri spre articole (Digi24, HotNews, G4Media, etc), apeși
          „Completează cu AI", backend-ul citește corpul fiecărui articol și sintetizează
          un raport structurat (estimare participanți, atmosferă, momente, sloganuri,
          declarații). Verifici, corectezi, salvezi.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Publicare directă:</strong> ca admin,
          conținutul devine public imediat. Sursele rămân vizibile ca link-uri „Citește mai
          multe" pe pagina protestului.
        </p>
        <p>
          <Link
            href="/admin/proteste"
            className="text-[var(--color-primary)] hover:underline"
          >
            ← Toate protestele (admin)
          </Link>
        </p>
      </div>
    </div>
  );
}
