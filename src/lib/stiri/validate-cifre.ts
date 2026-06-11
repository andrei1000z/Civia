/**
 * 2026-06-11 — Defense-in-depth contra cifrelor INVENTATE în „Cifre cheie".
 *
 * Bug real (articol Ciucu/Gândul): modelul, forțat de structura cu secțiuni,
 * a umplut „Cifre cheie" cu numere fabricate („0: numărul de funcții pe care
 * dorește să le părăsească", „1: ani de muncă", „2024" — în 2026), deși
 * promptul interzice explicit inventarea. Promptul singur nu e gardă — ca la
 * anti-minimization (sesizări), garanția e POST-PROCESORUL:
 *
 * Fiecare bullet din „Cifre cheie" care conține cifre trebuie să aibă TOATE
 * numerele prezente în textul-sursă al articolului. Bullet cu număr negăsit →
 * tăiat. Secțiune rămasă fără bullet-uri → tăiată complet (cu titlu cu tot) —
 * secțiunea e oricum opțională prin prompt.
 *
 * Bullet-urile FĂRĂ cifre (nume proprii / termeni legali pe bold — permise de
 * prompt) sunt păstrate: nu pot halucina numere.
 */

const SECTION_HEADINGS = ["Cifre cheie:", "Cifre & date cheie:"];
const ALL_MARKERS = [
  "Pe scurt:",
  "Cifre cheie:",
  "Cifre & date cheie:",
  "Ce cere petiția:",
  "Context:",
  "Ce urmează:",
  "De ce contează:",
];

/** Colapsează separatorii din interiorul grupurilor de cifre (1.000 / 1,5 /
 *  1 000 → 1000/15/1000) ca să comparăm consistent sursa cu bulletul. */
function normNumbers(s: string): string {
  return s.replace(/(\d)[.,  ](?=\d)/g, "$1");
}

/** Extrage token-urile numerice dintr-un text (după normalizare). */
function numberTokens(s: string): string[] {
  return normNumbers(s).match(/\d+/g) ?? [];
}

/** True dacă token-ul numeric apare în sursă ca număr de sine stătător
 *  (nu ca sub-secvență a altui număr — „1" nu se validează prin „2014"). */
function numberInSource(token: string, normSource: string): boolean {
  return new RegExp(`(?<!\\d)${token}(?!\\d)`).test(normSource);
}

/**
 * Filtrează bullet-urile cu cifre inventate din secțiunile de tip „Cifre
 * cheie". Întoarce sumarul curățat (posibil fără secțiune, dacă nimic nu a
 * supraviețuit). Sumare fără secțiunea respectivă trec neatinse.
 */
export function stripInventedCifre(summary: string, sourceText: string): string {
  let out = summary;
  const normSource = normNumbers(sourceText);

  for (const heading of SECTION_HEADINGS) {
    const start = out.indexOf(heading);
    if (start === -1) continue;

    // Corpul secțiunii ține până la următorul marker de secțiune sau finalul.
    const afterHeading = start + heading.length;
    let end = out.length;
    for (const marker of ALL_MARKERS) {
      if (marker === heading) continue;
      const idx = out.indexOf(marker, afterHeading);
      if (idx !== -1 && idx < end) end = idx;
    }

    const body = out.slice(afterHeading, end);
    const lines = body.split("\n");
    const kept: string[] = [];
    let dropped = 0;
    for (const line of lines) {
      const isBullet = /^\s*[-•]\s+/.test(line);
      if (!isBullet) {
        kept.push(line); // linii goale / text liber — neatinse
        continue;
      }
      const tokens = numberTokens(line.replace(/\*\*/g, ""));
      if (tokens.length === 0) {
        kept.push(line); // bullet fără cifre (nume/termen legal) — permis
        continue;
      }
      const allFound = tokens.every((t) => numberInSource(t, normSource));
      if (allFound) kept.push(line);
      else dropped += 1;
    }

    if (dropped === 0) continue; // nimic inventat — secțiunea rămâne ca atare

    const survivors = kept.filter((l) => /^\s*[-•]\s+/.test(l)).length;
    if (survivors > 0) {
      out = out.slice(0, afterHeading) + kept.join("\n") + out.slice(end);
    } else {
      // Secțiunea a rămas fără conținut → scoatem tot blocul, cu titlu.
      // Înghițim și newline-urile imediat după bloc ca să nu lăsăm goluri.
      const before = out.slice(0, start).replace(/\n+$/, "\n\n");
      const after = out.slice(end);
      out = (before + after).replace(/\n{3,}/g, "\n\n").trim();
    }
  }

  return out;
}
