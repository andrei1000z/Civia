import type { Metadata } from "next";
import { Megaphone, Sparkles, ShieldCheck, Clock } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InitiatePetitieForm } from "./InitiatePetitieForm";
import { LoginRequiredCard } from "./LoginRequiredCard";

// Pagina e pură UI shell + check auth — content-ul e în client component.
// force-dynamic pentru că auth state vine din cookies (variază per request).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inițiază o petiție",
  description:
    "Pornește o petiție civică pe Civia. Completezi 4 câmpuri, echipa verifică în câteva ore, apoi e publică pentru semnături. Gratuit.",
  alternates: { canonical: "/petitii/initiaza" },
};

export default async function InitiazaPetitiePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Inițiază o petiție"
        icon={Megaphone}
        gradient={HERO_GRADIENT.petition}
        backHref="/petitii"
        backLabel="Toate petițiile"
        description={
          <>
            Pornește o cauză pe care o susții. Completezi titlul + descrierea + target-ul
            de semnături — echipa verifică în câteva ore, apoi e publică pentru oricine
            vrea să semneze.
          </>
        }
        tagline="Gratuit. Fără cost ascuns. Tu deții petiția — o poți închide oricând."
      />

      {/* Trust strip — 3 promisiuni vizuale ca user să înțeleagă rapid
          că nu e capcană. Civia n-a avut user-initiated până acum. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <TrustBadge
          icon={ShieldCheck}
          title="Verificată de echipă"
          desc="Citim fiecare petiție înainte să o publicăm — fără spam, fără ură, fără înșelăciuni."
          accent="#10B981"
        />
        <TrustBadge
          icon={Clock}
          title="Live în câteva ore"
          desc="Aprobări manuale, dar rapide. De obicei sub 1-2 ore în timpul zilei."
          accent="#F59E0B"
        />
        <TrustBadge
          icon={Sparkles}
          title="Sintetizată cu AI"
          desc='După publicare, AI-ul generează automat „Pe scurt", „Ce cere", „De ce contează".'
          accent="#7C3AED"
        />
      </div>

      {isLoggedIn ? (
        <InitiatePetitieForm userEmail={user.email ?? null} />
      ) : (
        <LoginRequiredCard />
      )}

      {/* Reguli — sub form, ca să nu bloceze citirea câmpurilor */}
      <details className="mt-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
        <summary className="cursor-pointer font-semibold text-sm select-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
          Reguli de moderare — ce respingem
        </summary>
        <ul className="mt-3 space-y-2 text-xs text-[var(--color-text-muted)] list-disc pl-5 leading-relaxed">
          <li>
            <strong>Cerere clară:</strong> petiția trebuie să ceară o acțiune concretă
            (ex: „Vrem ca primăria X să...") — nu doar să se plângă vag.
          </li>
          <li>
            <strong>Verificabilă:</strong> dacă cifra/factul-cheie e fals (ex: „milioane
            de oameni mor anual din cauza X" fără sursă), respingem.
          </li>
          <li>
            <strong>Pașnică, fără ură:</strong> niciun atac la persoană, niciun hate speech,
            niciun apel la violență. Critica instituțiilor e OK; insultele nu.
          </li>
          <li>
            <strong>Non-comercială:</strong> petițiile nu sunt despre promovarea unei
            firme/produs. Cauze civice, da.
          </li>
          <li>
            <strong>Drepturi de autor:</strong> nu copia text de pe alte petiții; scrie cu
            propriile cuvinte.
          </li>
        </ul>
      </details>
    </div>
  );
}

function TrustBadge({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: typeof ShieldCheck;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 flex items-start gap-3">
      <span
        className="w-9 h-9 rounded-[var(--radius-xs)] grid place-items-center shrink-0"
        style={{ backgroundColor: `${accent}1a`, color: accent }}
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold mb-0.5">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
