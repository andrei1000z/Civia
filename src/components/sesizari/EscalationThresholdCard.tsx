import { Scale, Users, Clock } from "lucide-react";
import { evaluateAvpEligibility } from "@/lib/sesizari/escalation";
import { EscalateAvpButton } from "@/components/sesizari/EscalateAvpButton";

/**
 * Card prag de escaladare (Faza 1) — în sidebar-ul paginii de sesizare.
 *
 * Pune față în față DOUĂ semnale ORTOGONALE, ca cetățeanul să vadă că sunt
 * lucruri diferite (onestitate — vezi escalation.ts):
 *   • GREUTATE comunitară — câți cetățeni au trimis (co-semnături). NU grăbește
 *     termenul legal; e doar vizibilitate/presiune publică.
 *   • ELIGIBILITATE legală — numărătoare de timp pură (OG 27/2002). Doar timpul
 *     deblochează escaladarea la Avocatul Poporului, indiferent de co-semnături.
 *
 * Server Component (zero JS), butonul author-only e singura insulă „use client".
 * Ascuns pe statusuri finale (rezolvat/respins — nimic de escaladat).
 */
export function EscalationThresholdCard({
  code,
  createdAt,
  status,
  officialResponseAt,
  cosignersCount,
  isAuthor,
}: {
  code: string;
  createdAt: string;
  status: string;
  officialResponseAt: string | null;
  cosignersCount: number;
  isAuthor: boolean;
}) {
  const elig = evaluateAvpEligibility({
    created_at: createdAt,
    status,
    official_response_at: officialResponseAt,
  });

  // Pe statusuri finale (rezolvat/respins) sau cu răspuns oficial, escaladarea
  // n-are sens — nu afișăm cardul deloc.
  if (elig.reason === "resolved" || elig.reason === "responded") return null;

  const totalSenders = cosignersCount + 1; // autorul + co-semnatarii

  return (
    <section
      className={`rounded-[var(--radius-md)] border p-4 ${
        elig.eligible
          ? "bg-amber-50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-900/50"
          : "bg-[var(--color-surface)] border-[var(--color-border)]"
      }`}
    >
      <h2 className="text-sm font-bold mb-3 inline-flex items-center gap-1.5">
        <Scale size={14} className="text-amber-600" aria-hidden="true" />
        Presiune & escaladare
      </h2>

      {/* AXA 1 — greutate comunitară (co-semnături) */}
      <div className="flex items-start gap-2 mb-2.5">
        <Users size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-[var(--color-text)] leading-relaxed">
          <strong className="tabular-nums">{totalSenders}</strong>{" "}
          {totalSenders === 1 ? "cetățean a trimis" : "cetățeni au trimis"} această
          sesizare. Cu cât sunt mai mulți, cu atât crește presiunea publică.
        </p>
      </div>

      {/* AXA 2 — eligibilitate legală (timp pur, OG 27/2002) */}
      <div className="flex items-start gap-2">
        <Clock size={14} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          {elig.eligible ? (
            <>
              Autoritatea nu a răspuns nici în termenul extins (OG 27/2002) —
              sesizarea poate fi escaladată la Avocatul Poporului.
            </>
          ) : (
            <>
              {/* 2026-07-01 — reformulat ca să NU se contrazică cu badge-ul
                  „Termen depășit" din header (termenul de bază de 30 de zile).
                  Aici numărăm până la fereastra de escaladare la AVP (30 + 15
                  zile extindere, art. 9), care e un prag DISTINCT. */}
              Escaladarea la Avocatul Poporului devine disponibilă în{" "}
              <strong className="tabular-nums">
                {elig.daysUntilEligible} {elig.daysUntilEligible === 1 ? "zi" : "zile"}
              </strong>
              . Numărul de co-semnături nu grăbește acest termen.
            </>
          )}
        </p>
      </div>

      {isAuthor && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <EscalateAvpButton
            code={code}
            eligible={elig.eligible}
            reason={elig.reason}
            daysUntilEligible={elig.daysUntilEligible}
          />
        </div>
      )}
    </section>
  );
}
