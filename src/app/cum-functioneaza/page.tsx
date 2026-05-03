import type { Metadata } from "next";
import Link from "next/link";
import {
  Crown,
  Briefcase,
  Scale,
  Vote,
  Landmark,
  Gavel,
  FileText,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Users,
  BookOpen,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CivicQuiz } from "@/components/functioneaza/CivicQuiz";
import { Glosar } from "@/components/functioneaza/Glosar";
import { FaqJsonLd } from "@/components/FaqJsonLd";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import {
  PRESEDINTE,
  GUVERN,
  PARLAMENT,
  JUSTITIE,
  ADMINISTRATIE_LOCALA,
  PROCES_LEGISLATIV,
} from "@/data/romania-structura";

const FAQ_ITEMS = [
  {
    question: "Care sunt cele trei puteri ale statului român?",
    answer:
      "Conform Constituției, statul român se bazează pe separația și echilibrul puterilor: legislativă (Parlamentul — Senat + Camera Deputaților), executivă (Președintele + Guvernul) și judecătorească (instanțele, cu ICCJ în vârf).",
  },
  {
    question: "Cât durează mandatul Președintelui?",
    answer:
      "Mandatul Președintelui României e de 5 ani. O persoană poate deține funcția pentru maxim 2 mandate (consecutive sau nu).",
  },
  {
    question: "Cum se numește Prim-Ministrul?",
    answer:
      "Președintele desemnează un candidat pentru funcția de prim-ministru, după consultarea partidului care are majoritatea absolută în Parlament (sau a partidelor reprezentate în Parlament, dacă nu există majoritate). Guvernul depune jurământul după votul de învestitură al Parlamentului.",
  },
  {
    question: "Câți membri are Parlamentul României?",
    answer:
      `Parlamentul e bicameral: ${PARLAMENT.senat.numarMembri} de senatori și ${PARLAMENT.cameraDeputatilor.numarMembri} de deputați. Ambii sunt aleși pentru mandate de 4 ani.`,
  },
  {
    question: "Ce face Curtea Constituțională?",
    answer:
      "CCR decide asupra constituționalității legilor adoptate de Parlament, a ordonanțelor Guvernului, și soluționează conflicte juridice între autoritățile publice. Este compusă din 9 judecători cu mandat de 9 ani.",
  },
  {
    question: "Cum intră o lege în vigoare?",
    answer:
      "Legea trece prin 6 etape: inițiativă → aviz Consiliu Legislativ → prima cameră → camera decizională → promulgare prezidențială → publicare în Monitorul Oficial. Intră în vigoare la 3 zile de la publicare (sau la data stabilită în text).",
  },
];

export const metadata: Metadata = {
  title: "Cum funcționează România — Președinte, Guvern, Parlament, Justiție",
  description:
    "Ghid complet despre structura statului român: Președintele, Guvernul, Parlamentul, Justiția, administrația locală și procesul legislativ.",
  alternates: { canonical: "/cum-functioneaza" },
  openGraph: {
    title: "Cum funcționează România — Civia",
    description:
      "Președinte, Guvern, Parlament, Justiție, administrație locală — toate instituțiile statului român explicate.",
  },
};

function SectionHeading({
  number,
  icon,
  title,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
          {number}
        </p>
        <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold">
          {title}
        </h2>
      </div>
    </div>
  );
}

function InstitutieCard({
  nume,
  role,
  website,
  extra,
}: {
  nume: string;
  role: string;
  website?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <h4 className="font-bold text-base mb-1">{nume}</h4>
      <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">{role}</p>
      {extra}
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline mt-2"
        >
          Site oficial <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

export default function CumFunctioneazaPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <FaqJsonLd items={FAQ_ITEMS} />

      <PageHero
        title="Cum funcționează România"
        icon={Landmark}
        gradient={HERO_GRADIENT.authority}
        description="Un ghid clar despre instituțiile statului român: cine conduce, cum se iau deciziile, cum intră o lege și cum te poți implica ca cetățean."
        tagline="Separația puterilor e la baza democrației — iată cum arată concret"
      />
      <div className="mb-8" />

      {/* Section 1: Președinte */}
      <section className="mb-16">
        <SectionHeading number="01" icon={<Crown size={22} />} title="Președintele României" />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          Șef de stat, ales direct de cetățeni pentru un mandat de 5 ani (maxim 2 mandate).
          Rolul e definit de Constituție: reprezintă România, veghează la respectarea Constituției
          și la buna funcționare a autorităților publice.
        </p>

        <div className="bg-gradient-to-br from-[var(--color-primary-soft)] to-transparent border border-[var(--color-primary)]/20 rounded-[var(--radius-md)] p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xl font-bold">
              {PRESEDINTE.nume
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                Președintele în funcție
              </div>
              <div className="text-2xl font-bold">{PRESEDINTE.nume}</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {PRESEDINTE.partid} · mandat {PRESEDINTE.mandat}
              </div>
            </div>
          </div>
          <a
            href={PRESEDINTE.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
          >
            presidency.ro <ExternalLink size={12} />
          </a>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
            Atribuții principale
          </h4>
          <ul className="space-y-2">
            {PRESEDINTE.atributii.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight size={16} className="mt-0.5 text-[var(--color-primary)] shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 2: Guvern */}
      <section className="mb-16">
        <SectionHeading number="02" icon={<Briefcase size={22} />} title="Guvernul" />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">{GUVERN.rolGeneral}</p>

        <div className="grid md:grid-cols-[1fr_1fr] gap-5 mb-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Prim-Ministru
            </div>
            <div className="text-xl font-bold mb-1">{GUVERN.primMinistru}</div>
            <div className="text-sm text-[var(--color-text-muted)]">
              {GUVERN.primMinistruPartid}
            </div>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Coaliție guvernamentală
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {GUVERN.coalitieGuvernamentala.map((p) => (
                <Badge key={p} className="text-xs">
                  {p}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-2">
              {GUVERN.numarMinisteri} ministere
            </div>
          </div>
        </div>

        {/* Banner explicativ — schimbare politică majoră (mai 2026).
            Apare deasupra listei de miniștri ca user-ul să înțeleagă
            de ce sunt interimari în unele portofolii. */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-md)] p-4 mb-5 flex items-start gap-3 text-sm">
          <span
            className="w-8 h-8 rounded-[var(--radius-xs)] bg-amber-500/15 text-amber-700 dark:text-amber-300 grid place-items-center shrink-0"
            aria-hidden="true"
          >
            <Brain size={14} />
          </span>
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold text-[var(--color-text)] mb-1">
              Criza politică aprilie–mai 2026 — PSD a ieșit din coaliție
            </p>
            <p className="text-[var(--color-text-muted)] text-xs">
              Pe <strong>23 aprilie 2026</strong> cei 6 miniștri PSD + vicepremierul
              Marian Neacșu și-au depus demisiile. Decretele de eliberare + numire
              interimari publicate în Monitorul Oficial pe 24 aprilie. Cabinetul
              Bolojan continuă cu <strong>PNL + USR + UDMR</strong> (minoritar
              parlamentar). 7 portofolii vacante sunt acoperite de actualii miniștri
              cu mandat dublu (badge <strong>„Interimar"</strong> mai jos). Termenul
              constituțional pentru remaniere completă: <strong>8 iunie 2026</strong>{" "}
              (45 zile de la decret).
            </p>
          </div>
        </div>

        <h3 className="text-sm font-bold mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
          Miniștri cheie
        </h3>
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {GUVERN.ministeriCheie.map((m) => (
            <a
              key={m.portofoliu}
              href={m.website}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-md)] transition-all flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate group-hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5 flex-wrap">
                  <span className="truncate">{m.nume}</span>
                  {m.interimar && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase tracking-wider border border-amber-500/40 shrink-0">
                      Interimar
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] truncate">
                  {m.portofoliu}
                  {m.partid && ` · ${m.partid}`}
                </div>
              </div>
              <ExternalLink size={12} className="shrink-0 text-[var(--color-text-muted)]" />
            </a>
          ))}
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
            Atribuții
          </h4>
          <ul className="space-y-2">
            {GUVERN.atributii.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight size={16} className="mt-0.5 text-[var(--color-primary)] shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          <a
            href={GUVERN.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mt-4"
          >
            gov.ro <ExternalLink size={12} />
          </a>
        </div>
      </section>

      {/* Section 3: Parlament */}
      <section className="mb-16">
        <SectionHeading number="03" icon={<Landmark size={22} />} title="Parlamentul" />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          Parlamentul României este bicameral, ales direct de cetățeni la fiecare 4 ani. Adoptă
          legile și controlează activitatea Guvernului.
        </p>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <InstitutieCard
            nume={PARLAMENT.senat.nume}
            role={PARLAMENT.senat.rolSpecific}
            website={PARLAMENT.senat.website}
            extra={
              <div className="space-y-1 text-xs mb-2">
                <div>
                  <strong>{PARLAMENT.senat.numarMembri}</strong> senatori
                </div>
                <div>
                  Președinte: <strong>{PARLAMENT.senat.presedinte}</strong>{" "}
                  <span className="text-[var(--color-text-muted)]">
                    ({PARLAMENT.senat.presedintePartid})
                  </span>
                </div>
                <div>
                  Mandat: <strong>{PARLAMENT.senat.durataMandat} ani</strong>
                </div>
              </div>
            }
          />
          <InstitutieCard
            nume={PARLAMENT.cameraDeputatilor.nume}
            role={PARLAMENT.cameraDeputatilor.rolSpecific}
            website={PARLAMENT.cameraDeputatilor.website}
            extra={
              <div className="space-y-1 text-xs mb-2">
                <div>
                  <strong>{PARLAMENT.cameraDeputatilor.numarMembri}</strong> deputați
                </div>
                <div>
                  Președinte: <strong>{PARLAMENT.cameraDeputatilor.presedinte}</strong>{" "}
                  <span className="text-[var(--color-text-muted)]">
                    ({PARLAMENT.cameraDeputatilor.presedintePartid})
                  </span>
                </div>
                <div>
                  Mandat: <strong>{PARLAMENT.cameraDeputatilor.durataMandat} ani</strong>
                </div>
              </div>
            }
          />
        </div>

        {/* Compoziție politică */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-6">
          <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-[var(--color-text-muted)]">
            Compoziția Parlamentului (după alegerile 2024)
          </h4>
          <div className="space-y-2">
            {PARLAMENT.componenta2024.map((p) => (
              <div key={p.partid}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold">{p.partid}</span>
                  <span className="text-[var(--color-text-muted)] tabular-nums">
                    {p.procent.toFixed(1)}% · {p.locuri} locuri
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(p.procent / 25) * 100}%`,
                      backgroundColor: p.culoare,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
            Atribuții Parlament
          </h4>
          <ul className="space-y-2">
            {PARLAMENT.atributii.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight size={16} className="mt-0.5 text-[var(--color-primary)] shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 4: Justiție */}
      <section className="mb-16">
        <SectionHeading number="04" icon={<Scale size={22} />} title="Justiția" />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          Puterea judecătorească e independentă. Aplică legile, apără drepturile cetățenilor și
          controlează constituționalitatea actelor normative. Compoziție: instanțele (4 niveluri),
          Ministerul Public (parchete) și Consiliul Superior al Magistraturii (garant al
          independenței).
        </p>

        <div className="grid md:grid-cols-2 gap-5 mb-6">
          {JUSTITIE.institutii.map((i) => (
            <InstitutieCard
              key={i.shortForm}
              nume={`${i.nume} (${i.shortForm})`}
              role={i.rol}
              website={i.website}
              extra={
                <div className="text-[11px] text-[var(--color-text-muted)] mb-2 italic">
                  {i.numireConducator}
                </div>
              }
            />
          ))}
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-6">
          <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-[var(--color-text-muted)]">
            Ierarhia instanțelor de drept comun
          </h4>
          <div className="space-y-3">
            {JUSTITIE.ierarhieInstante.map((nivel, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{nivel.nivel}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {nivel.descriere}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
            Atribuții fundamentale
          </h4>
          <ul className="space-y-2">
            {JUSTITIE.atributii.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Gavel size={14} className="mt-0.5 text-[var(--color-primary)] shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 5: Administrația locală */}
      <section className="mb-16">
        <SectionHeading
          number="05"
          icon={<Users size={22} />}
          title="Administrația locală"
        />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          În paralel cu guvernul central, România are 3 niveluri de administrație locală. Fiecare
          județ (și București) are propria structură cu competențe distincte.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {ADMINISTRATIE_LOCALA.map((nivel) => (
            <div
              key={nivel.nivel}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5"
            >
              <div className="text-3xl mb-2">{nivel.icon}</div>
              <h4 className="font-bold text-base mb-1">{nivel.nivel}</h4>
              <div className="text-xs text-[var(--color-text-muted)] mb-3">
                {nivel.numar.toLocaleString("ro-RO")} în România
              </div>
              <p className="text-sm text-[var(--color-text-muted)] mb-3">{nivel.rol}</p>
              <ul className="space-y-1.5">
                {nivel.atributii.slice(0, 3).map((a, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-xs">
                    <ChevronRight
                      size={12}
                      className="mt-0.5 text-[var(--color-primary)] shrink-0"
                    />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/20 rounded-[var(--radius-md)] p-5 text-sm">
          <p className="mb-2">
            💡 <strong>Vrei să vezi administrația din județul tău?</strong>
          </p>
          <p className="text-[var(--color-text-muted)] mb-3">
            Intră pe pagina județului pentru primar, consiliul local, prefectură și sesizările
            active.
          </p>
          <Link
            href="/judete"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium hover:underline"
          >
            Alege județul tău <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Section 6: Proces legislativ */}
      <section className="mb-16">
        <SectionHeading
          number="06"
          icon={<FileText size={22} />}
          title="Cum intră o lege în vigoare"
        />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          Procesul legislativ are 6 etape obligatorii. Orice cetățean poate urmări proiectul prin
          fiecare pas pe site-urile Camerelor sau pe Monitorul Oficial.
        </p>

        <div className="space-y-3">
          {PROCES_LEGISLATIV.map((pas) => (
            <div key={pas.pas} className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold">
                {pas.pas}
              </div>
              <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-4">
                <p className="font-semibold text-sm mb-0.5">{pas.titlu}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{pas.descriere}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 7: Quiz */}
      <section className="mb-16">
        <SectionHeading number="07" icon={<Brain size={22} />} title="Quiz civic" />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          Testează-ți cunoștințele despre administrația românească. 10 întrebări variate.
        </p>
        <CivicQuiz />
      </section>

      {/* Section 8: Glosar */}
      <section className="mb-16">
        <SectionHeading number="08" icon={<BookOpen size={22} />} title="Glosar civic" />
        <p className="text-[var(--color-text-muted)] mb-6 max-w-3xl">
          Abrevierile și termenii esențiali din administrație pe care trebuie să-i știi pentru a
          înțelege știrile politice și documentele oficiale.
        </p>
        <Glosar />
      </section>

      {/* Final CTA */}
      <div className="bg-gradient-to-br from-[var(--color-primary-soft)] to-transparent border border-[var(--color-primary)]/20 rounded-[var(--radius-card)] p-8 text-center">
        <Vote size={40} className="mx-auto mb-3 text-[var(--color-primary)]" />
        <h3 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-2">
          Implicarea ta contează
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-5 max-w-xl mx-auto">
          Cetățenii informați sunt cetățeni puternici. Exercită-ți drepturile: votează, depune
          sesizări, cere informații publice (L544/2001), participă la dezbateri publice.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/ghiduri/ghid-cetatean"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)]"
          >
            Ghidul cetățeanului <ArrowRight size={16} />
          </Link>
          <Link
            href="/ghiduri/ghid-legea-544"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] font-medium"
          >
            Legea 544/2001
          </Link>
        </div>
      </div>
    </div>
  );
}
