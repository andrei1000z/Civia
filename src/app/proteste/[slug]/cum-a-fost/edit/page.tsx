import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
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
  const protest = await fetchProtest(slug);
  if (!protest) notFound();
  if (protest.visibility !== "publica" || protest.moderation_status !== "approved") {
    notFound();
  }

  const isInFuture = new Date(protest.start_at) > new Date();
  if (isInFuture) {
    // Nu permite aftermath pentru proteste care nu s-au întâmplat încă —
    // redirect spre detail page cu mesaj.
    redirect(`/proteste/${protest.slug}?aftermath=too-early`);
  }
  if (
    protest.aftermath_moderation_status === "pending" ||
    protest.aftermath_moderation_status === "approved"
  ) {
    redirect(`/proteste/${protest.slug}?aftermath=exists`);
  }

  const protestDate = new Date(protest.start_at).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Cum a fost"
        icon={Megaphone}
        gradient={HERO_GRADIENT.success}
        backHref={`/proteste/${protest.slug}`}
        backLabel="Înapoi la protest"
        description={
          <>
            Documentează ce s-a întâmplat la <strong>„{protest.title}"</strong> ({protestDate}).
            Lipește 1-10 link-uri către articolele de presă și AI completează automat
            câmpurile, sau scrie tu manual.
          </>
        }
        tagline="Submisia intră în coada de moderare. Echipa Civia verifică și publică în 24-48h."
      />

      <AftermathForm slug={protest.slug} protestTitle={protest.title} />

      <div className="mt-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-xs text-[var(--color-text-muted)] leading-relaxed space-y-2">
        <p>
          <strong className="text-[var(--color-text)]">Cum funcționează AI-ul:</strong>{" "}
          adaugi link-urile spre articole care relatează protestul (Digi24, HotNews, G4Media, etc).
          Apăsăm „Completează cu AI", citim corpul fiecărui articol și sintetizăm un raport
          structurat (atmosferă, momente, sloganuri, declarații). Tu corectezi tot ce vrei
          înainte de „Trimite".
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Sursele rămân vizibile</strong> pe pagina
          publică ca link-uri „Citește mai multe", deci cititorul poate verifica fiecare
          afirmație. AI nu inventează — dacă un articol nu menționează o cifră, câmpul rămâne gol.
        </p>
        <p>
          <Link
            href="/legal/comunitate"
            className="text-[var(--color-primary)] hover:underline"
          >
            Reguli comunitate Civia →
          </Link>
        </p>
      </div>
    </div>
  );
}
