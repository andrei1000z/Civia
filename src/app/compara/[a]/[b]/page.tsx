import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Users, MapPin, Building2, Wind, Car, Award, AlertTriangle } from "lucide-react";
import { getCountyBySlug } from "@/data/counties";
import { getCountyStats } from "@/data/statistici-judete";
import { getPrimarByCounty } from "@/data/primari-judete";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ a: string; b: string }>;
}): Promise<Metadata> {
  const { a, b } = await params;
  const ca = getCountyBySlug(a);
  const cb = getCountyBySlug(b);
  if (!ca || !cb) return { title: "Comparație indisponibilă" };
  return {
    title: `${ca.name} vs ${cb.name}`,
    description: `Compară ${ca.name} cu ${cb.name}: sesizări, accidente, calitate aer, primari. Date oficiale INS, DRPCIV, Civia.`,
    alternates: { canonical: `/compara/${a}/${b}` },
  };
}

interface CompareRowProps {
  label: string;
  a: string | number;
  b: string | number;
  icon?: React.ReactNode;
  higherIsBetter?: boolean;
}

function CompareRow({ label, a, b, icon, higherIsBetter }: CompareRowProps) {
  const aNum = typeof a === "number" ? a : null;
  const bNum = typeof b === "number" ? b : null;
  let aWins = false;
  let bWins = false;
  if (aNum !== null && bNum !== null && higherIsBetter !== undefined) {
    if (aNum > bNum) aWins = higherIsBetter;
    if (bNum > aNum) bWins = higherIsBetter;
    if (aNum < bNum) aWins = !higherIsBetter;
    if (bNum < aNum) bWins = !higherIsBetter;
  }

  const format = (v: string | number) =>
    typeof v === "number" ? v.toLocaleString("ro-RO") : v;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 py-3 border-b border-[var(--color-border)] last:border-b-0">
      <div className={`text-right ${aWins ? "font-bold text-emerald-600" : "text-[var(--color-text)]"}`}>
        <div className="text-base sm:text-lg tabular-nums">{format(a)}</div>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)] px-2 shrink-0">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </div>
      <div className={`text-left ${bWins ? "font-bold text-emerald-600" : "text-[var(--color-text)]"}`}>
        <div className="text-base sm:text-lg tabular-nums">{format(b)}</div>
      </div>
      <div className="col-span-3 text-center text-[10px] text-[var(--color-text-muted)] sm:hidden">
        {label}
      </div>
    </div>
  );
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ a: string; b: string }>;
}) {
  const { a, b } = await params;
  const ca = getCountyBySlug(a);
  const cb = getCountyBySlug(b);
  if (!ca || !cb) notFound();

  const sa = getCountyStats(ca.id);
  const sb = getCountyStats(cb.id);
  const pa = getPrimarByCounty(ca.id);
  const pb = getPrimarByCounty(cb.id);

  const resolvedPctA = sa.sesizariTotal > 0 ? Math.round((sa.sesizariRezolvate / sa.sesizariTotal) * 100) : 0;
  const resolvedPctB = sb.sesizariTotal > 0 ? Math.round((sb.sesizariRezolvate / sb.sesizariTotal) * 100) : 0;

  return (
    <div className="container-narrow py-12 md:py-16">
      <Link
        href="/compara"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Alte comparații
      </Link>

      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-10">
        <div className="text-center sm:text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Județul A</div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
            {ca.name}
          </h1>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">cod {ca.id}</div>
        </div>
        <div className="text-3xl md:text-5xl font-bold text-[var(--color-primary)] px-2">vs</div>
        <div className="text-center sm:text-left">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Județul B</div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
            {cb.name}
          </h1>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">cod {cb.id}</div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-[var(--radius-xs)] p-3 text-xs text-amber-800 dark:text-amber-300 mb-8 flex gap-2 items-start">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <div>
          Accidentele și sesizările per județ sunt estimări proporționale cu populația (vezi disclaimer pe paginile individuale).
          Datele oficiale complete pe{" "}
          <a href="https://www.politiaromana.ro" target="_blank" rel="noopener noreferrer" className="underline font-semibold">politiaromana.ro</a>
          {" și "}
          <a href="https://insse.ro" target="_blank" rel="noopener noreferrer" className="underline font-semibold">insse.ro</a>.
        </div>
      </div>

      {/* Demografie */}
      <Card className="mb-6">
        <Badge className="mb-3">Demografie & geografie</Badge>
        <CompareRow
          label="Populație"
          icon={<Users size={14} />}
          a={ca.population}
          b={cb.population}
          higherIsBetter={true}
        />
        <CompareRow
          label="Suprafață (km²)"
          icon={<MapPin size={14} />}
          a={sa.suprafataKmp.toLocaleString("ro-RO")}
          b={sb.suprafataKmp.toLocaleString("ro-RO")}
        />
        <CompareRow
          label="Densitate (loc/km²)"
          icon={<Building2 size={14} />}
          a={sa.densitate}
          b={sb.densitate}
        />
        <CompareRow
          label="Spații verzi (m²/loc)"
          a={sa.spatiiVerziMpPerLocuitor}
          b={sb.spatiiVerziMpPerLocuitor}
          higherIsBetter={true}
        />
      </Card>

      {/* Siguranță */}
      <Card className="mb-6">
        <Badge className="mb-3">Siguranță rutieră (estimări DRPCIV)</Badge>
        <CompareRow
          label="Accidente total"
          icon={<Car size={14} />}
          a={sa.accidenteTotal}
          b={sb.accidenteTotal}
          higherIsBetter={false}
        />
        <CompareRow
          label="Decedați"
          a={sa.accidenteDecedati}
          b={sb.accidenteDecedati}
          higherIsBetter={false}
        />
        <CompareRow
          label="Răniți"
          a={sa.accidenteRaniti}
          b={sb.accidenteRaniti}
          higherIsBetter={false}
        />
      </Card>

      {/* Sesizări civice */}
      <Card className="mb-6">
        <Badge className="mb-3">Sesizări civice</Badge>
        <CompareRow label="Total sesizări" a={sa.sesizariTotal} b={sb.sesizariTotal} higherIsBetter={true} />
        <CompareRow
          label="Rezolvate"
          a={sa.sesizariRezolvate}
          b={sb.sesizariRezolvate}
          higherIsBetter={true}
        />
        <CompareRow
          label="% rezolvate"
          a={`${resolvedPctA}%`}
          b={`${resolvedPctB}%`}
        />
      </Card>

      {/* Calitate aer + transport */}
      <Card className="mb-6">
        <Badge className="mb-3">Calitate aer & transport</Badge>
        <CompareRow
          label="AQI mediu"
          icon={<Wind size={14} />}
          a={`${sa.aqiMediu} · ${sa.aqiQuality}`}
          b={`${sb.aqiMediu} · ${sb.aqiQuality}`}
        />
        <CompareRow
          label="Metrou"
          a={sa.hasMetrou ? "Da" : "Nu"}
          b={sb.hasMetrou ? "Da" : "Nu"}
        />
        <CompareRow
          label="Operator transport"
          a={sa.transportPublicOperator}
          b={sb.transportPublicOperator}
        />
      </Card>

      {/* Primari */}
      {(pa || pb) && (
        <Card className="mb-6">
          <Badge className="mb-3">
            <Award size={12} className="inline mr-1" /> Primari în funcție
          </Badge>
          <CompareRow
            label="Nume"
            a={pa?.nume ?? "—"}
            b={pb?.nume ?? "—"}
          />
          <CompareRow
            label="Partid"
            a={pa?.partid ?? "—"}
            b={pb?.partid ?? "—"}
          />
          <CompareRow
            label="Oraș"
            a={pa?.city ?? "—"}
            b={pb?.city ?? "—"}
          />
          <CompareRow
            label="Rating (0-5)"
            a={pa?.rating ?? "—"}
            b={pb?.rating ?? "—"}
            higherIsBetter={true}
          />
        </Card>
      )}

      {/* Swap + CTA */}
      <div className="flex flex-wrap gap-3 mt-10 justify-center">
        <Link
          href={`/compara/${b}/${a}`}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium transition-colors"
        >
          ⇄ Schimbă ordinea
        </Link>
        <Link
          href="/compara"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Altă comparație <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
