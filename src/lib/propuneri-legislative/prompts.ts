/**
 * Prompt AI pentru formalizare propuneri legislative.
 *
 * Diferit față de SYSTEM_PROMPT_FORMAL (sesizări) — acolo e ton de
 * plângere concretă. Aici ton juridic-legislativ: structurat, sobru,
 * cu temei de drept + precedente europene.
 *
 * Anti-patterns evitate (învățate din producție sesizări):
 *   - Nu „România are nevoie de" / „Este imperios necesar" (clișee)
 *   - Nu exagerare fără date
 *   - Nu minimizare problemei
 *   - Nu promisiuni („va îmbunătăți") fără bază legală
 */

export const SYSTEM_PROMPT_LEGISLATIVE = `Ești expert în drept administrativ și legislație română.
Transformi propunerea unui cetățean într-un document formal structurat pentru depunere la o autoritate publică, conform Legii 52/2003 privind transparența decizională.

REGULI OBLIGATORII:
1. Ton: formal, juridic, sobru. Fără superlative sau apeluri emoționale.
2. Fiecare secțiune trebuie să fie concretă și acționabilă — nu vagi.
3. Temeiul legal trebuie să fie real (Codul Rutier, OUG, HG etc.) — nu inventa legi.
4. La Precedente: exemple reale din UE/România dacă există, altfel omite secțiunea.
5. Nu adăuga clișee precum "România modernă", "standard european", "cetățeni merită".
6. Limbaj clar, fără jargon inutil. Fraze scurte și directe.
7. Structura răspunsului: JSON valid cu exact câmpurile cerute.`;

export const USER_PROMPT_LEGISLATIVE = (params: {
  titlu: string;
  problema: string;
  solutia: string;
  categorie: string;
  destinatar: string;
}) => `
Propunerea cetățeanului:

TITLU: ${params.titlu}
CATEGORIA: ${params.categorie}
DESTINATAR: ${params.destinatar}
PROBLEMA DESCRISĂ: ${params.problema}
SOLUȚIA PROPUSĂ: ${params.solutia}

Generează un document formal cu EXACT acest JSON (fără text în afara JSON):
{
  "titlu_formal": "titlul propunerii în limbaj juridic (max 150 caractere)",
  "problema_formala": "paragraful 1-2 care descrie problema cu date/context (max 500 caractere)",
  "solutia_formala": "paragraful cu soluția concretă + cum se implementează (max 600 caractere)",
  "temei_legal": "legile/ordonanțele aplicabile (ex: Legea 195/2002, OUG 195/2002 Codul Rutier art. X, Legea 52/2003) — max 300 caractere",
  "impact_estimat": "impact concret: câți cetățeni, ce schimbări măsurabile — max 300 caractere",
  "precedente": "1-2 exemple din România sau UE unde s-a implementat similar, sau șir gol dacă nu există"
}`;

export interface LegislativeFormalResult {
  titlu_formal: string;
  problema_formala: string;
  solutia_formala: string;
  temei_legal: string;
  impact_estimat: string;
  precedente: string;
}
