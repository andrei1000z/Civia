/**
 * Anti-minimizare pentru formal_text al sesizarilor.
 *
 * Cauza: AI-ul (chiar cu prompt updated) emite ocazional fraze care
 * MINIMIZEAZA problema raportata — ex: „pietonilor li se asigura inca
 * suficient spatiu pentru a circula". Asta e o EROARE LOGICA: daca user
 * depune sesizare = exista problema; textul nu poate spune ca nu e
 * problema, e contradictie.
 *
 * Primaria poate folosi aceste fraze ca pretext sa clasifice sesizarea
 * fara raspuns („spuneti chiar voi ca nu e o problema majora").
 *
 * Functia detecteaza minimization phrases si le inlocuieste cu echivalent
 * neutral sau factual.
 */

interface ReplaceRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * Lista de pattern-uri de minimizare detectate empiric in outputs reale.
 * Ordine: cele specifice primele (substring complet match-uit), generice
 * la urma.
 */
const MINIMIZATION_RULES: ReplaceRule[] = [
  // „pietonilor li se asigură [încă] suficient spațiu pentru a circula"
  {
    pattern: /pietonilor li se asigur[ăa]\s+(?:[îi]nc[ăa]\s+)?suficient\s+spa[țt]iu(?:\s+pentru\s+a\s+circula)?/gi,
    replacement: "circulația pietonilor este împiedicată",
  },
  // „rămâne suficient spațiu" / „rămâne loc"
  {
    pattern: /r[ăa]m[âa]ne\s+(?:[îi]nc[ăa]\s+)?suficient\s+(?:spa[țt]iu|loc)(?:\s+(?:de|pentru)\s+(?:trecere|circula[țt]ie|pietoni))?/gi,
    replacement: "spațiul destinat pietonilor este restricționat",
  },
  // „pietonii pot încă circula" / „pot circula normal"
  {
    pattern: /pietonii\s+pot\s+(?:[îi]nc[ăa]\s+)?circula(?:\s+normal)?/gi,
    replacement: "pietonii sunt obligați să ocolească mașinile",
  },
  // „nu reprezintă o problemă (majoră)"
  {
    pattern: /nu\s+reprezint[ăa]\s+o\s+problem[ăa](?:\s+major[ăa])?/gi,
    replacement: "afectează circulația normală",
  },
  // „nu pune în pericol [pietonii/circulația]"
  {
    pattern: /nu\s+pune\s+[îi]n\s+pericol(?:\s+pietonii|\s+circula[țt]ia)?/gi,
    replacement: "afectează siguranța pietonilor",
  },
  // „nu afectează grav" / „nu afectează semnificativ"
  {
    pattern: /nu\s+afecteaz[ăa]\s+(?:grav|semnificativ|major)(?:\s+circula[țt]ia|\s+pietonii)?/gi,
    replacement: "afectează",
  },
  // „mașinile ocupă doar o parte [din spațiul trotuarului]" / „doar partial"
  {
    pattern: /ma[șs]inile\s+ocup[ăa]\s+(?:doar\s+)?(?:o\s+parte|par[țt]ial|o\s+por[țt]iune)(?:\s+din\s+(?:spa[țt]iul\s+)?trotuarului)?/gi,
    replacement: "mașinile ocupă trotuarul",
  },
  // Cleanup pe replacement-ul vechi/awkward din backfill anterior:
  // „mașinile ocupă spațiul destinat pietonilor din spațiul trotuarului"
  // (rezultat al primei versiuni a regulii de mai sus, pe sesizari
  // patch-uite inainte de improvement).
  {
    pattern: /ma[șs]inile\s+ocup[ăa]\s+spa[țt]iul\s+destinat\s+pietonilor\s+din\s+spa[țt]iul\s+trotuarului/gi,
    replacement: "mașinile ocupă trotuarul",
  },
  // „situația nu este alarmantă"
  {
    pattern: /situa[țt]ia\s+nu\s+este\s+alarmant[ăa]/gi,
    replacement: "situația necesită intervenție",
  },
  // „nu este o problemă acută/urgentă"
  {
    pattern: /nu\s+este\s+o\s+problem[ăa]\s+(?:acut[ăa]|urgent[ăa])/gi,
    replacement: "necesită intervenție",
  },
];

export interface AntiMinimizationResult {
  text: string;
  changed: boolean;
  replacements: number;
  matched: string[];
}

/**
 * Detecteaza fraze de minimizare si le inlocuieste.
 */
export function removeMinimization(formalText: string): AntiMinimizationResult {
  if (!formalText) {
    return { text: formalText, changed: false, replacements: 0, matched: [] };
  }
  let text = formalText;
  let replacements = 0;
  const matched: string[] = [];

  for (const rule of MINIMIZATION_RULES) {
    text = text.replace(rule.pattern, (match) => {
      replacements += 1;
      matched.push(match);
      return rule.replacement;
    });
  }

  // Cleanup gramatical post-replacement: virgule duble, spatii multiple,
  // virgula inainte de „si"/„iar" devenita awkward.
  text = text
    .replace(/,\s*,/g, ",")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ");

  return { text, changed: replacements > 0, replacements, matched };
}
