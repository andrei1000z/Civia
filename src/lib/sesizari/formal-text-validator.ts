/**
 * Post-process validators pentru formal_text generat de AI.
 * Bug fixes 5/22/2026 — toate problemele identificate in audit:
 *
 *   #1 Placeholder neînlocuit ([NUMELE], [ADRESA]) → detectează + flag
 *   #2 Self-reference („casa mea", „blocul meu") → replace cu adresa obiectivă
 *   #4 Word count out-of-range (< 140 sau > 320) → flag
 *   #5 Markdown leak (*, _, **, etc. orphan) → strip
 *   #6 Plagiat user → AI (similaritate > 0.85) → flag
 */

export interface FormalTextValidation {
  /** True dacă text-ul e gata de trimitere (toate check-uri OK). */
  ok: boolean;
  /** Text-ul după post-process (cu fix-uri aplicate automat unde se poate). */
  text: string;
  /** Probleme blocante care necesită intervenție user. */
  errors: string[];
  /** Probleme non-blocante (avertismente). */
  warnings: string[];
  /** Detalii diagnostic. */
  meta: {
    wordCount: number;
    hasPlaceholders: boolean;
    hadSelfRefs: boolean;
    hadMarkdownLeak: boolean;
    plagiarismScore: number; // 0-1
  };
}

const PLACEHOLDER_PATTERN = /\[(NUMELE|ADRESA|NUME|LOCATIA|LOCAȚIA|DATA|TIP|PROPUNEREA|DESCRIEREA)\]/gi;

const SELF_REF_PATTERNS: Array<{ pattern: RegExp; replacement: (locatie?: string) => string }> = [
  {
    pattern: /\bîn dreptul (?:domiciliului|casei|blocului|apartamentului) meu\b/gi,
    replacement: (loc) => loc ? `în zona ${loc}` : "în zona indicată",
  },
  {
    pattern: /\b(?:în|pe|de pe) (?:strada|cartierul|bulevardul) mea?\b/gi,
    replacement: (loc) => loc ? `pe ${loc}` : "în zona indicată",
  },
  {
    pattern: /\blângă (?:casa|blocul|apartamentul) meu\b/gi,
    replacement: (loc) => loc ? `în apropiere de ${loc}` : "în apropiere",
  },
  {
    pattern: /\bblocul meu\b/gi,
    replacement: (loc) => loc ? `clădirea de la ${loc}` : "clădirea din zonă",
  },
  {
    pattern: /\bcasa mea\b/gi,
    replacement: (loc) => loc ? `locația de la ${loc}` : "locația indicată",
  },
  {
    pattern: /\bîn vecinătatea mea\b/gi,
    replacement: () => "în vecinătatea zonei",
  },
];

/**
 * Strip orphan markdown markers care AI poate lăsa cand nu inchide o
 * emphasis correctly (* fara ** sau backtick fara pereche).
 */
export function stripOrphanMarkdown(text: string): { text: string; changed: boolean } {
  const before = text;
  let t = text;

  // Strip orphan * și _ urmate de space/newline/end (markeri neînchiși).
  // NU atingem cele in pereche valid (gen *italic* sau **bold**).
  // Heuristic: dacă numărul de * e impar → există orphan.
  const starCount = (t.match(/\*/g) ?? []).length;
  if (starCount % 2 !== 0) {
    // Remove all single * that aren't part of ** pairs
    t = t.replace(/(?<!\*)\*(?!\*)/g, "");
  }

  const underscoreCount = (t.match(/(?<!\w)_(?!\w)/g) ?? []).length;
  if (underscoreCount % 2 !== 0) {
    t = t.replace(/(?<!\w)_(?!\w)/g, "");
  }

  // Strip leftover backticks
  const tickCount = (t.match(/`/g) ?? []).length;
  if (tickCount % 2 !== 0) {
    t = t.replace(/`/g, "");
  }

  // Strip leading # (heading markers that AI shouldn't have used)
  t = t.replace(/^#+\s+/gm, "");

  return { text: t, changed: t !== before };
}

/**
 * Jaro-Winkler-like simple similarity — counts proportion of unique
 * 3-grams shared între original și generat.
 */
export function computeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\s+/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 10 || nb.length < 10) return 0;

  const grams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 2; i++) {
      set.add(s.slice(i, i + 3));
    }
    return set;
  };

  const ga = grams(na);
  const gb = grams(nb);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Main validator — runs all checks + applies fixes where safe.
 */
export function validateFormalText(args: {
  text: string;
  userDescription: string;
  locatie?: string | null;
}): FormalTextValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // #5 Markdown leak
  const md = stripOrphanMarkdown(args.text);
  let workingText = md.text;

  // #1 Placeholders
  const hasPlaceholders = PLACEHOLDER_PATTERN.test(workingText);
  if (hasPlaceholders) {
    errors.push(
      "AI-ul a lăsat placeholder-uri neînlocuite ([NUMELE], [ADRESA], etc.). Completează datele tale în formular și regenerează."
    );
  }
  // Reset regex state (global flag has lastIndex side effect)
  PLACEHOLDER_PATTERN.lastIndex = 0;

  // #2 Self-references → replace
  let hadSelfRefs = false;
  for (const { pattern, replacement } of SELF_REF_PATTERNS) {
    if (pattern.test(workingText)) {
      hadSelfRefs = true;
      workingText = workingText.replace(pattern, () => replacement(args.locatie ?? undefined));
    }
    pattern.lastIndex = 0;
  }
  if (hadSelfRefs) {
    warnings.push(
      `Am corectat referințe la „casa/blocul/strada mea" — sesizarea se poate co-semna acum de alți cetățeni.`
    );
  }

  // #4 Word count
  const wordCount = countWords(workingText);
  if (wordCount < 100) {
    errors.push(`Text prea scurt (${wordCount} cuvinte). AI-ul ar trebui sa scrie 150-280 cuvinte. Regenerează.`);
  } else if (wordCount > 350) {
    warnings.push(`Text lung (${wordCount} cuvinte). Recomandat 150-280. Considera „Mai scurt".`);
  }

  // #6 Plagiat user description (similaritate 3-gram)
  const plagiarismScore = computeSimilarity(args.userDescription, workingText);
  if (plagiarismScore > 0.85) {
    warnings.push(
      `AI-ul nu a formalizat textul suficient (similaritate ${Math.round(plagiarismScore * 100)}% cu ce ai scris). Apasă „Refac" pentru rewrite.`
    );
  }

  return {
    ok: errors.length === 0,
    text: workingText,
    errors,
    warnings,
    meta: {
      wordCount,
      hasPlaceholders,
      hadSelfRefs,
      hadMarkdownLeak: md.changed,
      plagiarismScore,
    },
  };
}
