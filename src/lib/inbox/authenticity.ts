/**
 * Reply authenticity scoring — anti-spoofing pentru raspunsuri primite.
 *
 * Strategie pe 3 niveluri:
 *   1. Technical signals (deterministic, instant, gratis):
 *      - From domain == AUTH catalog match
 *      - From domain matches trusted RO gov TLD pattern
 *      - DKIM/SPF/DMARC results (din Authentication-Results header)
 *      - Body claims authority but sender is Gmail/Yahoo (red flag)
 *      - Reply within reasonable timeframe of original send
 *
 *   2. Semantic AI analysis (Groq Llama 3.3 70B):
 *      - Formal Romanian language? Juridic terminology?
 *      - Nr înregistrare in plausible format?
 *      - Has authority signature?
 *      - References to OG 27/2002 / GDPR / 30-day deadline?
 *      - Detect prompt injection / bot patterns?
 *
 *   3. Combined score → auto-apply decision:
 *      - authenticity_score = (technical_score + ai_score) / 2
 *      - auto-apply if (classification.confidence >= 70) AND (authenticity_score >= 60)
 *
 * Returns granular signals for debug + UI badge.
 */

import { getGroqClient, GROQ_MODEL } from "@/lib/groq/client";
import { identifySender } from "./sender-identity";

export interface AuthenticitySignal {
  name: string;
  /** -100 to +100 contribution to score */
  weight: number;
  /** Human-readable explanation */
  explanation: string;
}

export interface AuthenticityResult {
  /** 0-100 combined score */
  score: number;
  /** All signals contributing to the score (positive + negative) */
  signals: AuthenticitySignal[];
  /** Human-readable summary for UI/Sentry */
  reasoning: string;
  /** AI's semantic authenticity score (0-100) before combining with technical */
  ai_score: number;
  /** Sum of technical signals (-100 to +100) */
  technical_score: number;
}

const TRUSTED_GOV_TLDS = [
  /\.gov\.ro$/i,
  /^primaria\d*\.ro$/i,
  /\.primarie\.ro$/i,
  /^pmb\.ro$/i,
  /^sector[1-6]\.ro$/i,
  /\.politiaromana\.ro$/i,
  /^politiaromana\.ro$/i,
  /jandarmeriaromana\.ro$/i,
  /prefectur.*\.ro$/i,
  /apanovabucuresti\.ro$/i,
  /aspmb\.ro$/i,
  /alpab\.ro$/i,
  /stbsa\.ro$/i,
  /^plmb\.ro$/i,
  /cnair\.ro$/i,
  /enel\.ro$/i,
  /^eon\.ro$/i,
  /electricacf?\.ro$/i,
  /termoenergetica\.ro$/i,
  /salubris\.ro$/i,
  /retim\.ro$/i,
  /supercom\.ro$/i,
  /avp\.ro$/i,
];

const SUSPECT_PERSONAL_DOMAINS = [
  /^gmail\.com$/i,
  /^yahoo\.(com|ro)$/i,
  /^outlook\.(com|ro)$/i,
  /^hotmail\.(com|ro)$/i,
  /^icloud\.com$/i,
  /^aol\.com$/i,
  /^protonmail\.com$/i,
  /^mail\.com$/i,
];

const AUTHORITY_BODY_KEYWORDS =
  /\b(primari[ae]|prefectur[ăa]|cnair|brigada\s+rutier[ăa]|adm\.?\s+str[ăa]zilor|administra[țt]ia\s+str[ăa]zilor|poli[țt]ia\s+(local[ăa]|rom[âa]n[ăa])|jandarmeri[ae]|garda?\s+mediu|apanova|electrica|enel|eon|termoenergetica|salubri[zt]are|retim|supercom)\b/i;

const OG_27_2002_KEYWORDS =
  /\b(og\s+27\/2002|og27|ordonan[țt]a\s+(de\s+)?guvern\s+nr\.?\s*27|legea\s+544\/2001|legea\s+544|gdpr|regulament\s+(ue)?\s*2016\/679|term[ae]n(ul)?\s+de\s+30\s+(de\s+)?zile)\b/i;

const FORMAL_RO_KEYWORDS =
  /\b(v[ăa]\s+(comunic[ăa]m|inform[ăa]m|aducem)|prin\s+prezenta|conform\s+prevederilor|cu\s+respect|cu\s+stim[ăa]|av[âa]nd\s+[îi]n\s+vedere|[îi]n\s+conformitate\s+cu)\b/i;

const NR_INREGISTRARE_FORMAT = /\b\d{2,7}\s*\/\s*\d{2,4}\b/;

/**
 * Technical signal scoring — deterministic, instant. Returns score
 * delta (-100 to +100) + list of signals.
 */
export function scoreTechnicalSignals(args: {
  from: string;
  body_text: string;
  headers?: Record<string, string> | null;
  sent_at?: string | null;
  received_at?: string;
}): { score: number; signals: AuthenticitySignal[] } {
  const signals: AuthenticitySignal[] = [];
  let score = 0;

  const sender = identifySender(args.from);
  const domain = sender?.domain ?? "";

  // ─── 1. Match exact in AUTH catalog ───
  if (sender?.authority_id) {
    signals.push({
      name: "auth_catalog_match",
      weight: 50,
      explanation: `Expeditor identificat exact în catalog: ${sender.authority_name}`,
    });
    score += 50;
  } else if (TRUSTED_GOV_TLDS.some((re) => re.test(domain))) {
    signals.push({
      name: "trusted_gov_tld",
      weight: 30,
      explanation: `Domeniu .ro instituțional recunoscut: ${domain}`,
    });
    score += 30;
  }

  // ─── 2. Sender domain personal (Gmail/Yahoo/etc.) ───
  const isPersonal = SUSPECT_PERSONAL_DOMAINS.some((re) => re.test(domain));
  if (isPersonal) {
    signals.push({
      name: "personal_email_domain",
      weight: -20,
      explanation: `Expeditor folosește email personal (${domain}), nu instituțional`,
    });
    score -= 20;

    // Severe penalty if body claims to be authority
    if (AUTHORITY_BODY_KEYWORDS.test(args.body_text)) {
      signals.push({
        name: "spoofing_red_flag",
        weight: -40,
        explanation: "⚠️ Corpul emailului se prezintă ca autoritate dar expeditorul e email personal",
      });
      score -= 40;
    }
  }

  // ─── 3. DKIM/SPF/DMARC din Authentication-Results ───
  const authResults = (args.headers?.["authentication-results"] ?? args.headers?.["Authentication-Results"] ?? "").toLowerCase();
  if (authResults) {
    if (/dkim=pass/.test(authResults)) {
      // Bonus only if dkim domain matches sender domain
      const dkimMatch = authResults.match(/dkim=pass[^;]*?(?:d|header\.d|domain)=([a-z0-9.-]+)/);
      const dkimDomain = dkimMatch?.[1];
      if (dkimDomain && (dkimDomain === domain || domain.endsWith(`.${dkimDomain}`))) {
        signals.push({
          name: "dkim_aligned",
          weight: 15,
          explanation: `DKIM verificat și aliniat cu domeniul expeditorului (${dkimDomain})`,
        });
        score += 15;
      }
    }
    if (/spf=pass/.test(authResults)) {
      signals.push({
        name: "spf_pass",
        weight: 5,
        explanation: "SPF verificat",
      });
      score += 5;
    }
    if (/dmarc=pass/.test(authResults)) {
      signals.push({
        name: "dmarc_pass",
        weight: 10,
        explanation: "DMARC verificat (domain owner a autorizat acest sender)",
      });
      score += 10;
    }
    if (/dmarc=fail/.test(authResults) || /dkim=fail/.test(authResults)) {
      signals.push({
        name: "auth_fail",
        weight: -30,
        explanation: "⚠️ DKIM sau DMARC eșuat — email-ul ar putea fi spoofed",
      });
      score -= 30;
    }
  }

  // ─── 4. Content patterns ───
  if (OG_27_2002_KEYWORDS.test(args.body_text)) {
    signals.push({
      name: "og_27_2002_reference",
      weight: 10,
      explanation: "Referință la OG 27/2002 / legea 544 / GDPR (caracteristic raspunsurilor oficiale)",
    });
    score += 10;
  }
  if (FORMAL_RO_KEYWORDS.test(args.body_text)) {
    signals.push({
      name: "formal_romanian",
      weight: 5,
      explanation: "Limbaj juridic formal românesc",
    });
    score += 5;
  }
  if (NR_INREGISTRARE_FORMAT.test(args.body_text)) {
    signals.push({
      name: "nr_inregistrare_format",
      weight: 10,
      explanation: "Nr înregistrare în format real (X/AN)",
    });
    score += 10;
  }

  // ─── 5. Reply timing (suspicious if too fast — autoritățile nu răspund în 30 secunde) ───
  if (args.sent_at && args.received_at) {
    const sentMs = new Date(args.sent_at).getTime();
    const receivedMs = new Date(args.received_at).getTime();
    const deltaSec = (receivedMs - sentMs) / 1000;
    if (deltaSec < 60 && deltaSec >= 0) {
      signals.push({
        name: "implausibly_fast_reply",
        weight: -15,
        explanation: `Răspuns în ${Math.round(deltaSec)}s — autoritățile nu răspund atât de rapid (suspect)`,
      });
      score -= 15;
    }
    // Slow but reasonable is fine — no signal needed.
  }

  // Clamp to reasonable bounds (we want technical score to be -50 to +100 ish)
  score = Math.max(-100, Math.min(100, score));

  return { score, signals };
}

const AI_SYSTEM_PROMPT = `Esti un evaluator de autenticitate pentru raspunsuri primite la sesizari civice. Analizezi un text si decizi cat de probabil e ca a venit DE LA O AUTORITATE PUBLICA RO reala (primarie, prefectura, politia rutiera, CNAIR, etc.) vs un email fake/test/spam/utilizator obisnuit.

Returnezi STRICT JSON:
{
  "score": <0-100>,
  "reasoning": "<o fraza scurta in romana, max 200 caractere>",
  "red_flags": ["<flag 1>", "<flag 2>"],
  "green_flags": ["<flag 1>", "<flag 2>"]
}

CRITERII pentru autoritate REALA (green flags, score sus):
- Limbaj formal românesc juridic („Vă comunicăm", „Prin prezenta", „Conform prevederilor")
- Semnătură instituțională la final („Primăria Sector X", „Director Y", „Compartiment Z")
- Nr înregistrare în format real („1234/2026", „BPR-2026-7421")
- Referire la legi specifice (OG 27/2002, Legea 544/2001, GDPR)
- Termen 30 zile menționat (conform OG 27/2002)
- Ton neutru, profesional, fără emoji-uri
- Referire la sesizare cu cod sau detalii specifice
- Structură formală (subject + body + semnătură + ștampilă)

RED FLAGS pentru raspuns FAKE/test (score jos):
- Limbaj informal sau colocvial („mersi", „salut", „pa pa")
- Lipsă semnătură instituțională
- Nr înregistrare evident fake („123", "TEST", "8888")
- Emoji-uri sau punctuație excesivă (!!!, ???, 😀)
- Text foarte scurt sau generic („ok", „am primit")
- Ortografie/gramatică foarte slabă (autoritățile au corectori)
- Promisiuni nerealiste („rezolvăm azi", „intervenim acum")
- Text generat AI / repetiții / patterns de bot
- Lipsa referințelor juridice

SCORE GUIDE:
- 90-100: aproape sigur autoritate reală (formal + signatură + lege + nr)
- 70-89: probabil autoritate (majoritate green flags, lipsește 1-2)
- 50-69: ambiguu (mix de signale)
- 30-49: probabil NU e autoritate (informal sau lipsesc indicatori)
- 0-29: aproape sigur fake/test/personal

RASPUNZI DOAR JSON. Fara markdown, fara comentarii in afara JSON.`;

export async function scoreAiAuthenticity(args: {
  subject: string;
  body: string;
  sender_domain: string;
}): Promise<{ score: number; reasoning: string; red_flags: string[]; green_flags: string[] }> {
  const fallback = {
    score: 50,
    reasoning: "AI nu a putut evalua autenticitatea — clasificare neutră.",
    red_flags: [],
    green_flags: [],
  };

  const text = [
    `Subject: ${args.subject || "(none)"}`,
    `From domain: ${args.sender_domain || "(unknown)"}`,
    "",
    args.body?.slice(0, 5000) || "(empty)",
  ].join("\n");

  if (text.trim().length < 30) return fallback;

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.05,
      max_tokens: 300,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 50)),
      reasoning: typeof parsed.reasoning === "string"
        ? parsed.reasoning.slice(0, 300)
        : fallback.reasoning,
      red_flags: Array.isArray(parsed.red_flags)
        ? parsed.red_flags.slice(0, 5).map(String)
        : [],
      green_flags: Array.isArray(parsed.green_flags)
        ? parsed.green_flags.slice(0, 5).map(String)
        : [],
    };
  } catch {
    return fallback;
  }
}

/**
 * Combined authenticity scoring — technical signals + AI semantic.
 *
 * Returns 0-100 score + breakdown. Used by inbox/reply route to decide
 * auto-apply and by RepliesSection UI to show authenticity badge.
 */
export async function scoreAuthenticity(args: {
  from: string;
  subject: string;
  body_text: string;
  headers?: Record<string, string> | null;
  sent_at?: string | null;
  received_at?: string;
}): Promise<AuthenticityResult> {
  const sender = identifySender(args.from);
  const domain = sender?.domain ?? "";

  const technical = scoreTechnicalSignals(args);
  const ai = await scoreAiAuthenticity({
    subject: args.subject,
    body: args.body_text,
    sender_domain: domain,
  });

  // Combine: technical is -100..+100, AI is 0-100. Normalize technical
  // to 0-100 (treat -100 as 0, +100 as 100, midpoint 50).
  const technicalNormalized = Math.max(0, Math.min(100, 50 + technical.score / 2));

  // Weighted average: 60% technical, 40% AI (technical signals are
  // more reliable; AI can be tricked by sophisticated fakes).
  const combined = Math.round(technicalNormalized * 0.6 + ai.score * 0.4);

  // Build reasoning from top signals
  const topSignals = [...technical.signals]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3);
  const reasoning = topSignals.length > 0
    ? topSignals.map((s) => s.explanation).join("; ") + (ai.reasoning ? `. AI: ${ai.reasoning}` : "")
    : ai.reasoning;

  return {
    score: combined,
    signals: technical.signals,
    reasoning: reasoning.slice(0, 500),
    ai_score: ai.score,
    technical_score: technical.score,
  };
}

/**
 * Decide if reply should auto-apply status change to sesizare.
 *
 * NEW logic (5/21/2026): trusted_sender alone is no longer required —
 * we use the combined authenticity score. This means a Gmail email can
 * STILL auto-apply if AI is highly confident it's a forwarded authority
 * response (e.g. funcționar forwardează din contul personal accidental).
 *
 * Conservative for status=respins — always requires manual review since
 * escalation decisions are high-stakes.
 */
export function shouldAutoApplyEnhanced(args: {
  classification_confidence: number;
  classification_status: string;
  authenticity_score: number;
  is_spam: boolean;
}): boolean {
  if (args.is_spam) return false;
  if (args.classification_status === "necunoscut") return false;
  if (args.classification_status === "respins") return false; // always manual
  if (args.classification_confidence < 70) return false;
  if (args.authenticity_score < 60) return false;
  return true;
}
