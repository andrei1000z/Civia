export const meta = {
  name: 'civia-sesizari-qa',
  description: 'Audit calitate texte formale generate (50 sesizări) + validare web legal',
  phases: [
    { title: 'Analyze', detail: 'un agent per sesizare — rubrică + validare web' },
    { title: 'Synthesize', detail: 'agregare → probleme sistemice + scor' },
  ],
}

const ANALYZER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'tip', 'quality_score', 'severity', 'issues', 'positives', 'web_validation'],
  properties: {
    id: { type: 'number' },
    tip: { type: 'string' },
    quality_score: { type: 'number' },
    severity: { type: 'string', enum: ['ok', 'minor', 'major', 'critical'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'severity', 'quote', 'problem', 'suggested_fix'],
        properties: {
          category: { type: 'string' },
          severity: { type: 'string', enum: ['minor', 'major', 'critical'] },
          quote: { type: 'string' },
          problem: { type: 'string' },
          suggested_fix: { type: 'string' },
        },
      },
    },
    positives: { type: 'array', items: { type: 'string' } },
    web_validation: { type: 'string' },
  },
}

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['avg_score', 'verdict', 'systemic_issues'],
  properties: {
    avg_score: { type: 'number' },
    verdict: { type: 'string' },
    systemic_issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pattern', 'severity', 'affected_ids', 'recommended_fix', 'file_hint'],
        properties: {
          pattern: { type: 'string' },
          severity: { type: 'string', enum: ['minor', 'major', 'critical'] },
          affected_ids: { type: 'array', items: { type: 'number' } },
          recommended_fix: { type: 'string' },
          file_hint: { type: 'string' },
        },
      },
    },
  },
}

const DIR = 'c:/Users/Andrei/Civia/scripts/qa'
const ids = Array.from({ length: 50 }, (_, i) => i + 1)
log(`Audit ${ids.length} sesizări generate (un agent per sesizare + validare web)`)

const findings = (await parallel(ids.map((id) => () =>
  agent(
    `Ești auditor de calitate pentru platforma civică Civia.ro. Citește cu tool-ul Read fișierul: ${DIR}/${id}.json (cale absolută Windows; folosește exact acest path). Conține: descriere_originala (ce a scris cetățeanul), tip, locatie_finala, descriere_reformulata, formal_text (emailul complet trimis la AUTORITĂȚI REALE).

Analizează formal_text + descriere_reformulata strict, notează FIECARE problemă cu citat exact:
1. STRUCTURĂ — salut + „Mă numesc X, locuiesc în Y" + „constatată pe {locație}:" + măsuri numerotate + nr. înregistrare & răspuns 30 zile (OG 27/2002) + clauză GDPR + închidere. Lipsește/dublat?
2. REFORMULARE — input transformat în problemă oficială? Rămas brut? Argou/înjurătură scăpată („plm","dracu","ma","frate","bus","shelter","please")?
3. DIACRITICE + GRAMATICĂ corectă?
4. MINIMIZARE — interzis „rămâne spațiu", „mașinile ocupă X%".
5. HALUCINAȚIE — fapte inventate?
6. LEGAL — referințele potrivite + corecte pt. tip? OBLIGATORIU fă ≥1 WebSearch/WebFetch ca să validezi un articol citat SAU autoritatea responsabilă pt. acest tip (cine repară gropi/taie copaci/sancționează parcarea/iluminat etc.). Pune rezultatul în web_validation.
7. LOCAȚIE — adresa corectă, ne-trunchiată?
8. TON — oficial, ferm, nu dramatic?
9. PLACEHOLDER — fără „{...}", fără text tăiat / fără punctuație finală.

Returnează id=${id} + quality_score (0-100), severity, issues (citat + fix), positives, web_validation. Dacă fișierul nu poate fi citit, returnează id=${id}, tip="unknown", quality_score=0, severity="critical", un issue care explică.`,
    { label: `qa:${id}`, phase: 'Analyze', schema: ANALYZER_SCHEMA }
  )
))).filter(Boolean)

phase('Synthesize')
const synthesis = await agent(
  `Ești lead QA pentru generatorul de sesizări Civia.ro. ${findings.length} rapoarte de audit pe texte formale generate automat din inputuri diverse (informale, ALL CAPS, telegrafice, lungi, politicoase, engleză amestecată). Identifică PROBLEMELE SISTEMICE, prioritizează, dă fix-uri CONCRETE.

Cod: src/lib/sesizari/reformulate-descriere.ts (reformulare + fallback determinist formalizat + scrub), formal-template.ts (structura + TIP_DATA + referințe legale), diacritice.ts, anti-minimization.ts. AI-ul are cascadă multi-provider (Groq→Gemini→Cerebras/Mistral/NVIDIA→Cloudflare) + fallback determinist.

RAPOARTE (JSON): ${JSON.stringify(findings).slice(0, 110000)}

Returnează: avg_score, verdict (1-2 fraze), systemic_issues sortate după severity (pattern, severity, affected_ids, recommended_fix concret, file_hint).`,
  { label: 'synthesis', phase: 'Synthesize', schema: SYNTH_SCHEMA }
)

return { count: findings.length, findings, synthesis }
