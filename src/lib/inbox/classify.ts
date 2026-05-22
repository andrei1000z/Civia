import { getGroqClient, GROQ_MODEL } from "@/lib/groq/client";

/**
 * AI classifier for inbound replies from Romanian authorities.
 *
 * Reads the email body and decides:
 *   - status: which sesizare status to set
 *   - nr_inregistrare: official registration nr (if mentioned)
 *   - summary: one-sentence neutral summary in Romanian
 *   - deadline: any mentioned timeline/date
 *   - confidence: 0-100, how sure
 *   - suggested_action: what the citizen should do next
 *
 * Cost: ~$0.0002 per call (Llama 3.3 70B via Groq). With aggressive
 * caching and per-IP rate limit on the webhook, this stays under $5/mo
 * even with 5000+ replies/month.
 */

export type ReplyStatus =
  | "inregistrata"
  | "in-lucru"
  | "rezolvat"
  | "redirectionata"
  | "respins"
  | "cerere_informatii"
  | "necunoscut";

export type SuggestedAction =
  | "wait_for_resolution" // status update, no action needed from citizen
  | "respond_with_info" // authority cere informații
  | "escalate_now" // refuzat / pasat → escalare la Avocatul Poporului
  | "confirm_resolution" // autoritatea zice „rezolvat" → user verifică
  | "monitor_progress"; // lucrare în execuție

export interface ClassifyResult {
  status: ReplyStatus;
  confidence: number;
  nr_inregistrare: string | null;
  summary: string;
  deadline: string | null;
  suggested_action: SuggestedAction;
  /** True if this looked like spam/unrelated, not a real reply */
  is_spam: boolean;
  /** Raw model response for debugging */
  raw?: unknown;
}

const SYSTEM_PROMPT = `Esti un classifier specializat in raspunsuri oficiale de la autoritati publice romanesti la sesizari civice depuse prin platforma Civia.

Userul a depus o sesizare. Acum autoritatea (primarie, prefectura, Brigada Rutiera, CNAIR, etc.) raspunde. Citesti textul raspunsului si returnezi UN SINGUR JSON cu schema:

{
  "status": "inregistrata|in-lucru|rezolvat|redirectionata|respins|cerere_informatii|necunoscut",
  "confidence": <0-100>,
  "nr_inregistrare": "<numarul de inregistrare daca apare, altfel null>",
  "summary": "<o fraza scurta in romana, neutra, max 150 caractere>",
  "deadline": "<dead-line sau perioada mentionata, altfel null>",
  "suggested_action": "wait_for_resolution|respond_with_info|escalate_now|confirm_resolution|monitor_progress",
  "is_spam": <true daca emailul nu pare raspuns oficial, altfel false>
}

CRITERII STATUS:

- "inregistrata": Autoritatea confirma primirea sesizarii si ofera un numar de inregistrare. Exemple:
  - "Sesizarea a fost inregistrata cu nr X/AN"
  - "Va comunicam ca am inregistrat petitia dvs sub numarul X"
  - "Nr de inregistrare: X"

- "in-lucru": Autoritatea confirma ca lucreaza/intervine. Exemple:
  - "Echipa noastra va interveni saptamana viitoare"
  - "Lucrarea este in executie"
  - "Am alocat resurse pentru remediere"

- "rezolvat": Autoritatea confirma ca problema este rezolvata.
  - "Lucrarea a fost finalizata"
  - "Problema semnalata a fost remediata"
  - "Va comunicam rezolvarea"

- "redirectionata": Autoritatea spune ca nu e competenta ei, indica alta institutie.
  - "Nu intra in competenta noastra, va rugam sa va adresati X"
  - "Am transmis sesizarea la X"

- "respins": Autoritatea refuza explicit (sesizare nefondata, lipsa date, etc.)
  - "Sesizarea nu este intemeiata"
  - "Conform legii X, nu se justifica interventia"

- "cerere_informatii": Autoritatea cere CLARIFICARI sau detalii suplimentare.
  - "Va rugam sa precizati exact locatia"
  - "Avem nevoie de mai multe detalii"

- "necunoscut": Daca textul NU e raspuns la sesizare sau e ambiguu / not relevant.

REGULI:

1. Confidence 90+ DOAR pentru raspunsuri clare cu fraze tipic-oficiale. Mai jos pentru text ambiguu.
2. nr_inregistrare: cauta pattern-uri tip "nr X/AN", "numarul X", "X/AAAA". Returneaza string-ul exact ca apare (cu sau fara slash, exact ca in text).
3. summary: in romana, neutra, sa explice cititorul ce a hotarat institutia. NU "felicitari", NU comentarii.
4. is_spam=true daca: textul e marketing, newsletter, auto-reply standard ("am primit emailul dvs, va raspundem in 30 zile" fara nr inregistrare = is_spam=false, dar status=necunoscut).
5. RASPUNZI DOAR JSON valid. Fara markdown, fara explicatii.`;

const FALLBACK: ClassifyResult = {
  status: "necunoscut",
  confidence: 0,
  nr_inregistrare: null,
  summary: "Email primit, clasificarea AI a eșuat — verificare manuală necesară.",
  deadline: null,
  suggested_action: "wait_for_resolution",
  is_spam: false,
};

export async function classifyReply(args: {
  subject: string | null | undefined;
  body: string | null | undefined;
  sender_name?: string | null;
  authority_hint?: string | null;
}): Promise<ClassifyResult> {
  const text = [
    args.subject ? `Subject: ${args.subject}` : "",
    args.sender_name ? `From: ${args.sender_name}` : "",
    args.authority_hint ? `Authority hint: ${args.authority_hint}` : "",
    "",
    args.body ?? "",
  ].filter(Boolean).join("\n");

  if (!text.trim() || text.length < 20) {
    return { ...FALLBACK, summary: "Email gol sau prea scurt pentru clasificare." };
  }

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 8000) }, // cap pe corp lung
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return FALLBACK;

    const parsed = JSON.parse(raw) as Partial<ClassifyResult>;

    // Validează status
    const validStatuses: ReplyStatus[] = [
      "inregistrata", "in-lucru", "rezolvat", "redirectionata",
      "respins", "cerere_informatii", "necunoscut",
    ];
    const status = validStatuses.includes(parsed.status as ReplyStatus)
      ? (parsed.status as ReplyStatus)
      : "necunoscut";

    // Validează suggested_action
    const validActions: SuggestedAction[] = [
      "wait_for_resolution", "respond_with_info", "escalate_now",
      "confirm_resolution", "monitor_progress",
    ];
    const suggested_action = validActions.includes(parsed.suggested_action as SuggestedAction)
      ? (parsed.suggested_action as SuggestedAction)
      : "wait_for_resolution";

    // Bug fix #10 (5/22/2026) — număr înregistrare hallucinat:
    // AI poate inventa „nr 1234/2026" cand textul NU contine asta.
    // Validare strictă cu regex + cross-check că apare în text.
    let nrInregistrare: string | null = null;
    if (typeof parsed.nr_inregistrare === "string" && parsed.nr_inregistrare.length > 0) {
      const cand = parsed.nr_inregistrare.slice(0, 50);
      // Format: cifre/litere 3-12 caractere, optional /YYYY
      const isValidFormat = /^[A-Z0-9.\-/]{3,20}(?:\/\d{4})?$/i.test(cand);
      // Cross-check: numarul TREBUIE sa apara în text-ul original (sau o
      // variantă apropiată). Daca nu apare deloc, AI a hallucinat.
      const numCore = cand.replace(/^(?:nr\.?|numar\s*|nr)/i, "").trim();
      const appearsInText = text.toLowerCase().includes(numCore.toLowerCase());
      nrInregistrare = isValidFormat && appearsInText ? cand : null;
    }

    // Bug fix #11 (5/22/2026) — auto-reply detection.
    // Daca text-ul e auto-reply standard („Vă răspundem în 30 zile",
    // „Sesizarea a fost primită", etc.) status devine „inregistrata"
    // (in loc de „necunoscut") + suggested_action = monitor_progress
    // (in loc de wait_for_resolution care e tacut).
    const autoReplyPatterns = [
      /vă\s+răspundem\s+în\s+\d+\s+zile/i,
      /am\s+primit\s+(?:sesizarea|petiția|cererea)/i,
      /va\s+fi\s+(?:analizată|soluționată)\s+în\s+termenul\s+legal/i,
      /conform\s+(?:OG|Ordonanței)\s+27\/2002/i,
    ];
    const isAutoReply = autoReplyPatterns.some((p) => p.test(text));
    let finalStatus = status;
    let finalAction = suggested_action;
    if (isAutoReply && status === "necunoscut") {
      finalStatus = "inregistrata";
      finalAction = "monitor_progress";
    }

    return {
      status: finalStatus,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      nr_inregistrare: nrInregistrare,
      summary: typeof parsed.summary === "string"
        ? parsed.summary.slice(0, 300)
        : "Răspuns oficial primit.",
      deadline: typeof parsed.deadline === "string" && parsed.deadline.length > 0
        ? parsed.deadline.slice(0, 100)
        : null,
      suggested_action: finalAction,
      is_spam: parsed.is_spam === true,
      raw: parsed,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Decide whether the AI classification should be auto-applied to the
 * sesizare status, vs require manual user confirmation.
 *
 * Auto-apply if:
 *   - Sender is from a trusted domain (gov.ro / autoritate cunoscută)
 *   - AI confidence >= 80
 *   - Status is not "necunoscut" / "respins" (status drastic — vrem
 *     review user pentru respins ca să nu ratăm escalare)
 */
export function shouldAutoApply(args: {
  classification: ClassifyResult;
  trusted_sender: boolean;
}): boolean {
  const { classification, trusted_sender } = args;
  if (!trusted_sender) return false;
  if (classification.is_spam) return false;
  if (classification.confidence < 80) return false;
  if (classification.status === "necunoscut") return false;
  // Respins → requires user review (escalation decision)
  if (classification.status === "respins") return false;
  return true;
}
