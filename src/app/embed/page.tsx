import type { Metadata } from "next";
import Link from "next/link";
import { ALL_COUNTIES } from "@/data/counties";
import { SITE_URL } from "@/lib/constants";
import { Code2, Eye, Newspaper } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Embed widget — Civia pentru jurnaliști și bloggeri",
  description:
    "Embedează gratuit pe site-ul tău widget-ul Civia cu sesizările civice live din județul tău. Iframe simplu, actualizat la 10 min, fără SDK.",
  alternates: { canonical: "/embed" },
};

export default function EmbedDocsPage() {
  const exampleCounties = ["b", "cj", "is", "tm", "ct"] as const;

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Embed widget Civia"
        icon={Code2}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Embedează gratuit pe blogul/site-ul tău widget-ul cu{" "}
            <strong>sesizările civice live din județul tău</strong>. Iframe simplu, fără
            SDK, fără cont. Util pentru jurnaliști locali, bloggeri civici și
            ONG-uri.
          </>
        }
        tagline="Date publice CC BY 4.0 · update automat la 10 min · funcționează pe orice site"
      />

      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6 mb-6">
        <h2 className="font-semibold text-lg mb-3 inline-flex items-center gap-2">
          <Code2 size={18} aria-hidden="true" className="text-[var(--color-primary)]" />
          Cum embedezi
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
          Adaugă acest iframe oriunde pe pagina ta. Înlocuiește{" "}
          <code className="text-xs bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">b</code>{" "}
          cu slug-ul județului tău (vezi lista de mai jos).
        </p>
        <pre className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 text-xs overflow-x-auto font-mono">
          <code>{`<iframe
  src="${SITE_URL}/embed/b"
  width="100%"
  height="520"
  frameborder="0"
  loading="lazy"
  title="Civia — sesizări civice București"
></iframe>`}</code>
        </pre>
      </section>

      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6 mb-6">
        <h2 className="font-semibold text-lg mb-3 inline-flex items-center gap-2">
          <Eye size={18} aria-hidden="true" className="text-[var(--color-primary)]" />
          Previzualizare
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {exampleCounties.map((slug) => {
            const c = ALL_COUNTIES.find((x) => x.slug === slug);
            if (!c) return null;
            return (
              <Link
                key={slug}
                href={`/embed/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface)] transition-colors"
              >
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Vezi widget:</p>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1">
                  /embed/{slug}
                </p>
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          Toate cele 42 de județe disponibile — slug-urile sunt cele de 1-3
          litere standard ANCPI (de exemplu <code>b</code> = București,{" "}
          <code>cj</code> = Cluj, <code>tm</code> = Timiș, <code>is</code> = Iași).
        </p>
      </section>

      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6">
        <h2 className="font-semibold text-lg mb-3 inline-flex items-center gap-2">
          <Newspaper size={18} aria-hidden="true" className="text-[var(--color-primary)]" />
          Pentru jurnaliști
        </h2>
        <ul className="text-sm text-[var(--color-text-muted)] space-y-2 list-disc list-inside leading-relaxed">
          <li>
            Datele sunt sub licență <strong>CC BY 4.0</strong> — folosește
            liber, atribuie sursa „Civia.ro".
          </li>
          <li>
            Endpoint API public:{" "}
            <code className="text-xs">{SITE_URL}/api/v1/sesizari</code> și{" "}
            <code className="text-xs">{SITE_URL}/api/v1/stats</code> (JSON, CORS
            deschis).
          </li>
          <li>
            Pentru investigații aprofundate sau date dezagregate — contactează
            via{" "}
            <Link href="/legal/confidentialitate" className="text-[var(--color-primary)] hover:underline">
              formularul GDPR
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
