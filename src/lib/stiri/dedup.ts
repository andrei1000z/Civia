/**
 * Detectie articole duplicate / cvasi-duplicate.
 *
 * 2026-05-27 — Bug raportat de user: pe /stiri apar 2 carduri Gândul cu
 * aceeași poză + titluri foarte asemănătoare („Eugen Tomac, iepurele scos
 * din pălărie..." vs „Eugen Tomac, primul mesaj după ce a fost vehiculat
 * ca viitor premier..."). URL-uri diferite → UNIQUE(url) DB nu prinde
 * duplicarea. RSS feed-urile publică multiple articole pe aceeași știre,
 * iar editorul folosește aceeași poză.
 *
 * Strategy (cheap, no AI):
 *   1. Same (source, image_url) where image_url non-null → keep most
 *      recent. Imaginea identică din aceeași sursă = burst editorial.
 *   2. Same source + Jaccard similarity tokens > 0.7 → keep most recent.
 *      Surprinde titluri cvasi-identice cu poze diferite.
 *   3. Cross-source: NU dedup (perspectivă editorială diferită = valoare).
 *
 * O(n²) worst-case dar n ≤ 200 (limit max) → microsecond work.
 */

type DedupRow = {
  title: string;
  source: string;
  image_url: string | null;
  published_at: string;
  [k: string]: unknown;
};

/**
 * Normalizează titlu pentru comparație: lowercase, fără diacritice,
 * fără punctuație, tokens cu min 3 chars.
 */
function tokenize(title: string): Set<string> {
  return new Set(
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|.
 * Returns 0..1. 1 = identice, 0 = no overlap.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  if (union === 0) return 0;
  return intersect / union;
}

/**
 * Threshold-ul de similaritate Jaccard peste care 2 titluri din aceeași
 * sursă sunt considerate același articol. Empiric:
 *   - 0.7 prinde „Eugen Tomac, iepurele scos..." vs „Eugen Tomac, primul
 *     mesaj după ce a fost vehiculat ca viitor premier..." (overlap pe
 *     tokens „eugen", „tomac", „premier", „țara", „guvern" ≈ 0.75)
 *   - <0.65 risc fals-pozitiv pe titluri legitim distincte cu același
 *     subject (ex: 2 articole diferite Gândul despre același consilier
 *     dar pe teme distincte).
 */
const TITLE_SIMILARITY_THRESHOLD = 0.7;

export function dedupeArticles<T extends DedupRow>(rows: T[]): T[] {
  if (rows.length < 2) return rows;
  // Sort by published_at desc — păstrăm cel mai recent dintre duplicate.
  // (Asumăm input deja sortat, dar e cheap să garantăm).
  const sorted = [...rows].sort((a, b) =>
    b.published_at.localeCompare(a.published_at),
  );

  const kept: T[] = [];
  const keptTokensBySource = new Map<string, Array<{ tokens: Set<string>; row: T }>>();
  const keptImagesBySource = new Map<string, Set<string>>();

  for (const row of sorted) {
    // Check 1: aceeași imagine din aceeași sursă → duplicate.
    if (row.image_url) {
      const imgs = keptImagesBySource.get(row.source);
      if (imgs && imgs.has(row.image_url)) continue;
    }

    // Check 2: titlu similar din aceeași sursă → duplicate.
    const tokens = tokenize(row.title);
    const prevSameSource = keptTokensBySource.get(row.source);
    if (prevSameSource) {
      const isNearDup = prevSameSource.some(
        ({ tokens: prev }) => jaccard(tokens, prev) >= TITLE_SIMILARITY_THRESHOLD,
      );
      if (isNearDup) continue;
    }

    // Not a duplicate — keep.
    kept.push(row);
    if (row.image_url) {
      let imgs = keptImagesBySource.get(row.source);
      if (!imgs) {
        imgs = new Set();
        keptImagesBySource.set(row.source, imgs);
      }
      imgs.add(row.image_url);
    }
    let tokenList = keptTokensBySource.get(row.source);
    if (!tokenList) {
      tokenList = [];
      keptTokensBySource.set(row.source, tokenList);
    }
    tokenList.push({ tokens, row });
  }

  return kept;
}

// Export helpers pentru testing.
export const __test = { tokenize, jaccard, TITLE_SIMILARITY_THRESHOLD };
