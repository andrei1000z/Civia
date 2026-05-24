/**
 * pluralizeRO — pluralizare română corectă peste 20.
 *
 * Romanian has 3 grammatical forms for counting nouns:
 *   - singular (1)    → „1 sesizare"
 *   - paucal (2-19)   → „2 sesizări"
 *   - plural (≥ 20)   → „21 DE sesizări" (insert „de" before noun)
 *
 * Important for natural reading. „21 sesizări" sounds robotic; „21 de sesizări" is correct.
 *
 * Examples:
 *   pluralizeRO(1, "sesizare", "sesizări") → "1 sesizare"
 *   pluralizeRO(5, "sesizare", "sesizări") → "5 sesizări"
 *   pluralizeRO(25, "sesizare", "sesizări") → "25 de sesizări"
 *   pluralizeRO(0, "sesizare", "sesizări") → "0 sesizări"
 *   pluralizeRO(0, "sesizare", "sesizări", "nici o sesizare") → "nici o sesizare"
 */

export function pluralizeRO(
  count: number,
  singular: string,
  pluralPaucal: string,
  zeroOverride?: string,
): string {
  const formatted = count.toLocaleString("ro-RO");

  if (count === 0 && zeroOverride) return zeroOverride;
  if (count === 1) return `${formatted} ${singular}`;
  // Romanian rule: numbers ending in 01-19 (last 2 digits) use paucal form
  // WITHOUT „de". Numbers ending in 00 or 20-99 use „de + paucal".
  // Special case: 0 is paucal.
  const lastTwo = Math.abs(count) % 100;
  const needsDe = count !== 0 && (lastTwo === 0 || lastTwo >= 20);
  return needsDe ? `${formatted} de ${pluralPaucal}` : `${formatted} ${pluralPaucal}`;
}

/** Common Romanian noun pairs used across Civia. */
export const PLURAL_FORMS = {
  sesizare: ["sesizare", "sesizări"],
  petitie: ["petiție", "petiții"],
  protest: ["protest", "proteste"],
  stire: ["știre", "știri"],
  comentariu: ["comentariu", "comentarii"],
  vot: ["vot", "voturi"],
  zi: ["zi", "zile"],
  ora: ["oră", "ore"],
  minut: ["minut", "minute"],
  utilizator: ["utilizator", "utilizatori"],
  cetatean: ["cetățean", "cetățeni"],
  autoritate: ["autoritate", "autorități"],
  primarie: ["primărie", "primării"],
  poza: ["poză", "poze"],
  raspuns: ["răspuns", "răspunsuri"],
  semnatura: ["semnătură", "semnături"],
  reamintire: ["reamintire", "reamintiri"],
} as const;

/** Quick helper folosit cu PLURAL_FORMS. */
export function pluralizeKey(count: number, key: keyof typeof PLURAL_FORMS): string {
  const [singular, plural] = PLURAL_FORMS[key];
  return pluralizeRO(count, singular, plural);
}
