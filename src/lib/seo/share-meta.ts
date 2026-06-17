/**
 * Helperi pentru metadata de share (OG / Twitter). Un audit opengraph.xyz real
 * a arătat că titlurile lungi (titlu sesizare/petiție/știre netrunchiat, 87-89
 * caractere) sunt tăiate urât de X/LinkedIn, iar descrierile de 200 caractere
 * sunt trunchiate pe mobil. Trunchiem la graniță de cuvânt + „…".
 *
 * Notă: pentru `<title>` (SEO) păstrăm titlul complet — Google indexează tot,
 * doar AFIȘAREA e trunchiată. Astea sunt DOAR pentru og:title/twitter:title +
 * og:description, unde lungimea afectează direct preview-ul de share.
 */

function truncateAtWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Taie la ultimul spațiu dacă nu pierdem prea mult (>60% din limită), altfel
  // tăietură hard. Adaugă elipsa „…" (un singur caracter, nu „...").
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s.,;:–—-]+$/, "") + "…";
}

/** og:title / twitter:title — X & LinkedIn taie peste ~60-70 → țintă ~65. */
export function ogTitle(title: string, max = 65): string {
  return truncateAtWord(title, max);
}

/** og:description — social previews afișează ~125-160 → țintă ~155. */
export function ogDescription(desc: string, max = 155): string {
  return truncateAtWord(desc, max);
}
