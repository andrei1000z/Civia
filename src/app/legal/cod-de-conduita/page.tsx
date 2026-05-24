import type { Metadata } from "next";
import Link from "next/link";
import { Heart, ShieldAlert, Users } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Cod de conduită • Civia",
  description:
    "Comunitatea Civia. Reguli simple: respect, civilizație, fără hărțuire. Anti-harassment policy + procedură raportare.",
  alternates: { canonical: `${SITE_URL}/legal/cod-de-conduita` },
};

export const revalidate = 86400;

export default function CodConduitaPage() {
  return (
    <>
      <PageHero
        title="Cod de conduită"
        icon={Heart}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Civia e un spațiu civic <strong>sigur, respectuos, inclusiv</strong>. Aici sunt
            regulile simple după care funcționăm.
          </>
        }
        tagline="Adaptat după Contributor Covenant 2.1"
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        <Section title="🤝 Promisiunea noastră">
          <p>
            Ca membri, contribuabili și administratori, ne angajăm să facem Civia un mediu
            <strong> liber de hărțuire</strong>, indiferent de:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Vârstă, dimensiune corporală, dizabilitate vizibilă sau invizibilă</li>
            <li>Etnie, naționalitate, rasă, religie</li>
            <li>Identitate sau exprimare de gen, orientare sexuală</li>
            <li>Nivel de experiență tech sau educație formală</li>
            <li>Statut socio-economic</li>
            <li>Afiliere politică (Civia e independent — păstrăm civilitatea trans-partid)</li>
          </ul>
        </Section>

        <Section title="✅ Comportament acceptat">
          <ul className="list-disc list-inside space-y-1.5">
            <li>Empatie + bunătate față de alți cetățeni</li>
            <li>Respect pentru opinii diferite, experiențe, perspective</li>
            <li>Feedback constructiv (criticăm ideea, nu omul)</li>
            <li>Asumare a greșelii + învățare din ea</li>
            <li>Focus pe binele comunității, nu doar pe propriul interes</li>
          </ul>
        </Section>

        <Section title="❌ Comportament INACCEPTABIL">
          <ul className="list-disc list-inside space-y-1.5">
            <li>Limbaj sau imagini sexualizate; atenție sexuală nedorită</li>
            <li>Trolling, comentarii insultătoare/derogatorii, atacuri personale sau politice</li>
            <li>Hărțuire publică sau privată</li>
            <li>Publicarea informațiilor private ale altora (doxing) fără consimțământ</li>
            <li>Spam, autopromo nesolicitat, scheme</li>
            <li>Fake news, manipulare, deepfakes</li>
            <li>Conduită în mod rezonabil considerată inadecvată într-un cadru civic-profesional</li>
          </ul>
        </Section>

        <Section title="🛡️ Aplicare">
          <p>
            Administratorii Civia sunt responsabili să clarifice standardele și pot lua acțiuni
            corecte și echitabile când consideră necesar:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>
              <strong>1. Avertisment privat</strong> — discuție prietenoasă, explicație
            </li>
            <li>
              <strong>2. Avertisment public</strong> — pe pagina sesizării/petiției
            </li>
            <li>
              <strong>3. Suspendare temporară</strong> — 7-30 zile, pentru încălcări serioase
            </li>
            <li>
              <strong>4. Ban permanent</strong> — pentru pattern de comportament toxic sau
              încălcare gravă (hate speech, hărțuire continuă, doxing)
            </li>
          </ul>
        </Section>

        <Section title="📞 Raportează un incident">
          <p className="mb-3">
            Dacă vezi sau ești ținta unei încălcări, raportează la{" "}
            <a href="mailto:conduita@civia.ro" className="text-[var(--color-primary)] hover:underline">
              conduita@civia.ro
            </a>
            . Toate raportările sunt:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Tratate <strong>confidențial</strong> (nu publicăm identitatea reporterului)</li>
            <li>Investigate prompt (răspuns inițial ≤ 48h)</li>
            <li>Răspuns cu decizie în maxim 7 zile</li>
            <li>Eligibile pentru appeal cu Civia admin senior</li>
          </ul>
        </Section>

        <Section title="🔍 Scopul">
          <p>
            Acest cod se aplică în <strong>toate</strong> spațiile Civia:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Comentarii pe sesizări și petiții</li>
            <li>Comunicarea cu primării (sesizări trimise via Civia)</li>
            <li>GitHub issues + PRs (open-source repo)</li>
            <li>Discord/Slack civic-tech (când le lansăm)</li>
            <li>Email-uri către conturile Civia oficiale</li>
            <li>Evenimente publice unde reprezenți Civia</li>
          </ul>
        </Section>

        <Section title="📜 Atribuire">
          <p>
            Acest Cod de conduită e adaptat după{" "}
            <a href="https://www.contributor-covenant.org/version/2/1/code_of_conduct/" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">
              Contributor Covenant v2.1
            </a>
            , cu adaptări pentru context civic românesc.
          </p>
        </Section>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Pentru raportări security — vezi{" "}
          <Link href="/security" className="text-[var(--color-primary)] hover:underline">/security</Link>.
          Pentru raportări anonime serioase — vezi{" "}
          <Link href="/whistleblower" className="text-[var(--color-primary)] hover:underline">/whistleblower</Link>.
        </p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3">{title}</h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}
