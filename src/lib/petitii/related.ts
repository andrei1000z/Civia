import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Petiții înrudite pentru chaining sesizare→petiție (Faza 1).
 *
 * Interoghează `petitii_with_count` (view) pe categorie + județ. Petițiile
 * NAȚIONALE (county_code IS NULL) match-uiesc mereu; cele locale (county_code =
 * județul sesizării) sunt prioritizate în ranking. Doar coloane existente,
 * fără migrație nouă. Degradează grațios (return [] pe eroare / tabel lipsă).
 */

export interface RelatedPetitie {
  slug: string;
  title: string;
  summary: string;
  category: string | null;
  county_code: string | null;
  signature_count: number;
  target_signatures: number;
}

export async function listRelatedPetitii(opts: {
  categorie: string;
  county?: string | null;
  limit?: number;
}): Promise<RelatedPetitie[]> {
  const { categorie, county, limit = 3 } = opts;
  if (!categorie) return [];

  const admin = createSupabaseAdmin();
  const orFilter = county
    ? `county_code.eq.${county},county_code.is.null`
    : `county_code.is.null`;

  const { data, error } = await admin
    .from("petitii_with_count")
    .select(
      "slug,title,summary,category,county_code,signature_count,external_signature_count,target_signatures",
    )
    .eq("category", categorie)
    .in("status", ["active", "closed"])
    .or(orFilter)
    .limit(20); // luăm mai multe, rankuim, apoi tăiem la `limit`

  if (error || !data) return []; // tabel lipsă / migrație neaplicată → fără crash

  type Row = {
    slug: string;
    title: string;
    summary: string;
    category: string | null;
    county_code: string | null;
    signature_count: number | null;
    external_signature_count: number | null;
    target_signatures: number | null;
  };

  const rows = data as unknown as Row[];

  const ranked = rows
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      county_code: r.county_code,
      // semnături raportate de sursă (Declic/Avaaz) au prioritate față de count-ul intern
      signature_count: r.external_signature_count ?? r.signature_count ?? 0,
      target_signatures: r.target_signatures ?? 0,
    }))
    .sort((a, b) => {
      // 1) potrivire locală (județ exact) înaintea celor naționale
      const aLocal = county && a.county_code === county ? 1 : 0;
      const bLocal = county && b.county_code === county ? 1 : 0;
      if (aLocal !== bLocal) return bLocal - aLocal;
      // 2) apoi descrescător după semnături
      return b.signature_count - a.signature_count;
    });

  return ranked.slice(0, limit);
}
